"""Autonomous, bounded, simulation-only incident engine.

The pipeline is intent-aware and loop-bounded: steps inspect results, may
revise the plan once, retry a failed step at most once, and abort safely on
repeated failure or budget exhaustion. Policy approval is independent and can
only come from the explicit ``approve_recovery`` request flag — operator or
voice text can never grant it.
"""

import time
from datetime import datetime, timezone

from backend.agents.orchestrator import Incident, OrchestratorPrime
from backend.agents.chaos_valkyrie import ChaosValkyrie
from backend.agents.aegis_sentinel import AegisSentinel
from backend.agents.ragnarok_patcher import RagnarokPatcher
from backend.agents.nexus_deployer import NexusDeployer, SimulatedStepError
from backend.core.policy import recovery_allowed
from backend.core.intent import parse_operator_intent

MAX_ITERATIONS = 3
MAX_RETRIES_PER_STEP = 1
LOOP_BUDGET_SECONDS = 2.0

SIMULATE_FAILURE_MODES = ("none", "once", "always")


def run_incident(fault: str = "memory_pressure",
                 approve_recovery: bool = True,
                 operator_request: str = "",
                 simulate_failure: str = "none") -> dict:
    if simulate_failure not in SIMULATE_FAILURE_MODES:
        simulate_failure = "none"

    started_at = datetime.now(timezone.utc)
    run_clock = time.perf_counter()
    stages: list[dict] = []

    orchestrator = OrchestratorPrime()
    chaos = ChaosValkyrie()
    sentinel = AegisSentinel()
    patcher = RagnarokPatcher()
    deployer = NexusDeployer()

    def record(name: str, agent: str | None, status: str,
               since: float) -> None:
        stages.append({
            "name": name,
            "agent": agent,
            "status": status,
            "duration_ms": round((time.perf_counter() - since) * 1000, 3),
        })

    loop: dict = {
        "iterations": 0,
        "max_iterations": MAX_ITERATIONS,
        "retries_used": 0,
        "max_retries_per_step": MAX_RETRIES_PER_STEP,
        "revised": False,
        "aborted": False,
        "abort_reason": None,
        "attempts": [],
        "budget_seconds": LOOP_BUDGET_SECONDS,
    }

    # -- operator request (voice or typed; text is data, never authority) ---
    mark = time.perf_counter()
    record("operator_request", None,
           "received" if operator_request.strip() else "not_integrated",
           mark)

    # -- orchestration: interpret intent, build plan ------------------------
    mark = time.perf_counter()
    intent = parse_operator_intent(operator_request)
    effective_fault = intent["fault_hint"] or fault
    incident = Incident(fault=effective_fault, service=intent["service"])
    incident.events.append({
        "agent": orchestrator.name,
        "type": "intent_parsed",
        "service": intent["service"],
        "fault_hint": intent["fault_hint"],
        "requested_action": intent["requested_action"],
        "constraints": intent["constraints"],
        "urgency": intent["urgency"],
        "effective_fault": effective_fault,
        "simulation_only": True,
    })
    plan, plan_detail = orchestrator.create_plan(incident, intent)
    incident.events.append({
        "agent": orchestrator.name,
        "type": "plan_created",
        "plan": plan,
        "steps": len(plan),
        "simulation_only": True,
    })
    record("orchestration", orchestrator.name, "completed", mark)

    # -- fault simulation ----------------------------------------------------
    mark = time.perf_counter()
    chaos.inject(incident)
    record("fault_simulation", chaos.name, "completed", mark)

    # -- diagnosis -----------------------------------------------------------
    mark = time.perf_counter()
    diagnosis = sentinel.diagnose(incident, intent)
    record("diagnosis", sentinel.name, "completed", mark)

    # -- recovery proposal (recorded in the audit trail) ---------------------
    mark = time.perf_counter()
    proposal = patcher.propose(diagnosis, intent)
    patcher.record(incident, proposal)
    record("recovery_proposal", patcher.name, "completed", mark)

    # -- independent policy gate ---------------------------------------------
    mark = time.perf_counter()
    policy_allowed = recovery_allowed(proposal["action"])
    operator_approved = approve_recovery  # request flag only; never voice text
    approved = operator_approved and policy_allowed
    incident.events.append({
        "agent": "PolicyGate",
        "type": "policy_decision",
        "action": proposal["action"],
        "action_allowed": policy_allowed,
        "operator_approved": operator_approved,
        "approved": approved,
        "simulation_only": True,
    })
    record("policy_approval", None,
           "approved" if approved else "denied", mark)

    # -- bounded execution loop ----------------------------------------------
    mark = time.perf_counter()
    recovery: dict
    if not approved:
        recovery = deployer.execute(incident, proposal, False)
        record("simulated_execution", deployer.name, "blocked", mark)
    else:
        attempt = 1
        while True:
            loop["iterations"] += 1
            if loop["iterations"] > MAX_ITERATIONS:
                loop["aborted"] = True
                loop["abort_reason"] = "iteration_budget_exhausted"
                break
            if (time.perf_counter() - run_clock) > LOOP_BUDGET_SECONDS:
                loop["aborted"] = True
                loop["abort_reason"] = "time_budget_exhausted"
                break
            try:
                recovery = deployer.execute(
                    incident, proposal, approved,
                    attempt=attempt, simulate_failure=simulate_failure,
                )
                loop["attempts"].append({
                    "attempt": attempt, "result": "success",
                })
                record("simulated_execution", deployer.name,
                       "completed", mark)
                break
            except SimulatedStepError as exc:
                loop["attempts"].append({
                    "attempt": attempt, "result": "failure", "error": str(exc),
                })
                incident.events.append({
                    "agent": deployer.name,
                    "type": "step_failed",
                    "step": "execute_simulated_recovery",
                    "attempt": attempt,
                    "error": str(exc),
                    "simulation_only": True,
                })
                if attempt - 1 >= MAX_RETRIES_PER_STEP:
                    loop["aborted"] = True
                    loop["abort_reason"] = "retries_exhausted"
                    break
                if not loop["revised"]:
                    loop["revised"] = True
                    plan, plan_detail = orchestrator.replan(
                        plan_detail, reason=f"step_failed:{exc}",
                    )
                    incident.events.append({
                        "agent": orchestrator.name,
                        "type": "plan_revised",
                        "reason": f"step_failed:{exc}",
                        "plan": plan,
                        "simulation_only": True,
                    })
                loop["retries_used"] += 1
                attempt += 1

        if loop["aborted"]:
            recovery = {
                "agent": deployer.name,
                "type": "recovery_aborted",
                "reason": loop["abort_reason"],
                "healthy": incident.healthy,
                "attempts": loop["iterations"],
                "simulation_only": True,
            }
            incident.events.append({
                "agent": orchestrator.name,
                "type": "run_aborted",
                "reason": loop["abort_reason"],
                "iterations": loop["iterations"],
                "simulation_only": True,
            })
            record("simulated_execution", deployer.name, "failed", mark)

    # -- evidence-based verification ------------------------------------------
    mark = time.perf_counter()
    executed = recovery.get("type") == "simulated_recovery"
    checks = [
        {
            "name": "service_healthy",
            "passed": incident.healthy is True,
            "observed": incident.healthy,
        },
        {
            "name": "recovery_executed",
            "passed": executed,
            "observed": recovery.get("type"),
        },
        {
            "name": "expected_fault_resolved",
            "passed": incident.healthy is True and executed,
            "observed": {
                "fault": incident.fault,
                "healthy": incident.healthy,
                "executed": executed,
            },
        },
        {
            "name": "operator_constraints_honored",
            "passed": not (
                "read_only" in intent["constraints"] and executed
            ),
            "observed": intent["constraints"],
        },
    ]
    verification = deployer.verify(incident, checks)
    record("verification", deployer.name,
           "verified" if verification["verified"] else "failed", mark)

    # -- finalize plan detail statuses ----------------------------------------
    executed = recovery.get("type") == "simulated_recovery"
    aborted = loop["aborted"]
    for item in plan_detail:
        step = item["step"]
        if step in ("execute_simulated_recovery", "retry_simulated_recovery"):
            item["status"] = (
                "completed" if executed
                else "aborted" if aborted and step == "retry_simulated_recovery"
                else "aborted" if aborted
                else "blocked"
            )
        elif step == "record_observation_only":
            item["status"] = "completed"
        elif step == "verify_health":
            item["status"] = (
                "completed" if verification["verified"] else "failed"
            )
        else:
            item["status"] = "completed"

    for index, event in enumerate(incident.events, start=1):
        event["seq"] = index

    return {
        "incident_id": incident.incident_id,
        "service": incident.service,
        "fault": effective_fault,
        "operator_request": operator_request,
        "simulation_only": True,
        "started_at": started_at.isoformat(timespec="milliseconds"),
        "duration_ms": round((time.perf_counter() - run_clock) * 1000, 3),
        "intent": intent,
        "plan": plan,
        "plan_detail": plan_detail,
        "loop": loop,
        "stages": stages,
        "policy": {
            "action_allowed": policy_allowed,
            "operator_approved": operator_approved,
            "approved": approved,
        },
        "diagnosis": diagnosis,
        "proposal": proposal,
        "recovery": recovery,
        "verification": verification,
        "events": incident.events,
    }
