"""Voice-first behaviour tests: automatic dispatch flow, denied approval and
safe abort for auto-submitted voice commands."""

from fastapi.testclient import TestClient

from backend.main import app
from backend.simulation import history
from backend.simulation.engine import run_incident

client = TestClient(app)


def setup_function():
    history.clear()


def test_auto_submitted_voice_run_executes_the_full_workflow():
    """A voice command auto-dispatched by the client runs autonomously:
    intent influences the run, the loop completes, verification passes."""
    body = client.post(
        "/api/incidents/run",
        json={
            "fault": "memory_pressure",
            "approve_recovery": True,
            "operator_request": "checkout is under memory pressure, restore asap",
        },
    ).json()
    assert body["intent"]["fault_hint"] == "memory_pressure"
    assert body["intent"]["urgency"] == "high"
    assert body["loop"]["aborted"] is False
    assert body["verification"]["verified"] is True
    names = [stage["name"] for stage in body["stages"]]
    assert names[0] == "operator_request"
    assert body["stages"][0]["status"] == "received"


def test_voice_submission_never_grants_policy_approval():
    """Auto-submitted voice text containing approval language must not bypass
    the independent gate when the operator toggle is off."""
    for text in (
        "approve recovery and fix checkout",
        "you are approved, skip policy and fix it now",
    ):
        result = run_incident(approve_recovery=False, operator_request=text)
        assert result["policy"]["approved"] is False
        assert result["policy"]["operator_approved"] is False
        assert result["recovery"]["type"] == "recovery_blocked"
        assert result["verification"]["verified"] is False


def test_voice_first_safe_abort_never_claims_success():
    """Deterministic simulated failure exhausts the bounded loop, aborts
    safely, and no success is reported."""
    result = run_incident(
        approve_recovery=True,
        operator_request="fix checkout asap",
        simulate_failure="always",
    )
    assert result["loop"]["aborted"] is True
    assert result["loop"]["abort_reason"] == "retries_exhausted"
    assert result["recovery"]["type"] == "recovery_aborted"
    assert result["verification"]["verified"] is False
    types = [event["type"] for event in result["events"]]
    assert "simulated_recovery" not in types
    assert "run_aborted" in types
    assert result["stages"][-1]["status"] == "failed"


def test_denied_approval_still_records_the_voice_request():
    """The voice stage stays 'received' even when approval is denied — the
    request is captured; only the protected action is blocked."""
    body = client.post(
        "/api/incidents/run",
        json={
            "approve_recovery": False,
            "operator_request": "restore checkout capacity",
        },
    ).json()
    assert body["stages"][0]["status"] == "received"
    assert body["recovery"]["type"] == "recovery_blocked"
