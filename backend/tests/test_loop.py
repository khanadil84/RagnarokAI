from backend.simulation.engine import run_incident


def test_simulate_failure_once_retries_and_succeeds():
    result = run_incident(approve_recovery=True, simulate_failure="once")
    assert result["loop"]["retries_used"] == 1
    assert result["loop"]["revised"] is True
    assert result["loop"]["aborted"] is False
    assert [a["result"] for a in result["loop"]["attempts"]] == [
        "failure", "success",
    ]
    assert result["recovery"]["type"] == "simulated_recovery"
    assert result["recovery"]["attempt"] == 2
    assert result["verification"]["verified"] is True
    types = [event["type"] for event in result["events"]]
    assert "step_failed" in types
    assert "plan_revised" in types
    assert result["plan"][-1] == "retry_simulated_recovery"


def test_simulate_failure_always_aborts_safely_without_success():
    result = run_incident(approve_recovery=True, simulate_failure="always")
    assert result["loop"]["aborted"] is True
    assert result["loop"]["abort_reason"] == "retries_exhausted"
    assert result["loop"]["retries_used"] == 1
    assert result["recovery"]["type"] == "recovery_aborted"
    assert result["verification"]["verified"] is False
    assert result["stages"][-1]["status"] == "failed"
    types = [event["type"] for event in result["events"]]
    assert "run_aborted" in types
    assert "simulated_recovery" not in types


def test_failure_injection_never_runs_without_approval():
    result = run_incident(approve_recovery=False, simulate_failure="always")
    assert result["recovery"]["type"] == "recovery_blocked"
    assert result["loop"]["aborted"] is False
    assert result["loop"]["attempts"] == []


def test_loop_stays_within_iteration_budget():
    result = run_incident(approve_recovery=True, simulate_failure="always")
    assert result["loop"]["iterations"] <= result["loop"]["max_iterations"]
    assert result["loop"]["max_retries_per_step"] == 1
