from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class Incident:
    incident_id: str = field(default_factory=lambda: str(uuid4()))
    service: str = "checkout"
    fault: str = "memory_pressure"
    healthy: bool = True
    events: list[dict[str, Any]] = field(default_factory=list)


BLOCKED_BY_INTENT = "operator_intent_no_changes"


class OrchestratorPrime:
    name = "OrchestratorPrime"

    def create_plan(self, incident: Incident, intent: dict | None = None
                    ) -> tuple[list[str], list[dict]]:
        """Build an intent-aware plan.

        Returns the contract-safe string list plus structured step detail.
        Operator intent can only narrow the plan (observation-only), never
        widen authority: execution still requires the policy gate.
        """
        intent = intent or {}
        constraints = intent.get("constraints") or []
        observe_only = (
            "read_only" in constraints
            or intent.get("requested_action") == "investigate_only"
        )

        steps: list[dict] = [
            {
                "step": "simulate_fault",
                "owner": "ChaosValkyrie",
                "purpose": f"inject simulated {incident.fault} into {incident.service}",
            },
            {
                "step": "collect_evidence",
                "owner": "AegisSentinel",
                "purpose": "gather simulated evidence and diagnose the cause",
            },
            {
                "step": "evaluate_recovery",
                "owner": "RagnarokPatcher",
                "purpose": "propose a recovery action for the independent policy gate",
            },
        ]
        if observe_only:
            steps.append({
                "step": "record_observation_only",
                "owner": "NexusDeployer",
                "purpose": (
                    "operator intent forbids state changes; observe without "
                    "executing recovery"
                ),
            })
        else:
            steps.append({
                "step": "execute_simulated_recovery",
                "owner": "NexusDeployer",
                "purpose": "apply the approved recovery inside the simulation",
            })
        steps.append({
            "step": "verify_health",
            "owner": "NexusDeployer",
            "purpose": "verify outcomes against collected evidence",
        })

        plan = [item["step"] for item in steps]
        detail = [{**item, "status": "planned"} for item in steps]
        return plan, detail

    def replan(self, detail: list[dict], reason: str
               ) -> tuple[list[str], list[dict]]:
        """Revise the plan after a failed step (bounded by the engine loop)."""
        revised = [dict(item) for item in detail]
        revised.append({
            "step": "retry_simulated_recovery",
            "owner": "NexusDeployer",
            "purpose": f"bounded retry after {reason}",
            "status": "planned",
        })
        plan = [item["step"] for item in revised]
        return plan, revised
