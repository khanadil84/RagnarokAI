from fastapi.testclient import TestClient

from backend.main import app
from backend.simulation import history

client = TestClient(app)


def setup_function():
    history.clear()


def test_health_reports_simulation_mode():
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["simulation_only"] is True
    assert body["voice_input"] == "browser_client"


def test_run_returns_lifecycle_stage_measurements():
    body = client.post(
        "/api/incidents/run",
        json={"fault": "memory_pressure", "approve_recovery": True,
              "operator_request": "restore checkout"},
    ).json()
    names = [stage["name"] for stage in body["stages"]]
    assert names == [
        "operator_request", "orchestration", "fault_simulation", "diagnosis",
        "recovery_proposal", "policy_approval", "simulated_execution",
        "verification",
    ]
    assert all(stage["duration_ms"] >= 0 for stage in body["stages"])
    assert [event["seq"] for event in body["events"]] == list(
        range(1, len(body["events"]) + 1)
    )
    assert body["policy"]["approved"] is True


def test_denied_approval_is_recorded_as_blocked():
    body = client.post(
        "/api/incidents/run", json={"approve_recovery": False}
    ).json()
    assert body["recovery"]["type"] == "recovery_blocked"
    assert body["policy"]["approved"] is False
    approval = next(stage for stage in body["stages"]
                    if stage["name"] == "policy_approval")
    assert approval["status"] == "denied"


def test_history_lists_recent_runs_and_finds_one():
    created = client.post(
        "/api/incidents/run", json={"approve_recovery": True}
    ).json()
    items = client.get("/api/incidents").json()["items"]
    assert items[0]["incident_id"] == created["incident_id"]
    assert items[0]["outcome"] == "verified"

    fetched = client.get(
        f"/api/incidents/{created['incident_id']}"
    ).json()
    assert fetched["incident_id"] == created["incident_id"]
    assert client.get("/api/incidents/does-not-exist").status_code == 404


def test_history_limit_returns_newest_n_newest_first():
    created = [
        client.post(
            "/api/incidents/run",
            json={"approve_recovery": True, "operator_request": f"run {i}"},
        ).json()
        for i in range(1, 6)
    ]
    items = client.get("/api/incidents?limit=3").json()["items"]
    assert [item["incident_id"] for item in items] == [
        created[4]["incident_id"],
        created[3]["incident_id"],
        created[2]["incident_id"],
    ]


def test_lifecycle_contract_lists_known_gaps():
    body = client.get("/api/lifecycle").json()
    assert len(body["stages"]) == 8
    assert body["known_gaps"]


def test_parse_intent_endpoint_is_additive_and_safe():
    body = client.post(
        "/api/intents/parse",
        json={"text": "checkout memory pressure, restore asap"},
    ).json()
    assert body["service"] == "checkout"
    assert body["fault_hint"] == "memory_pressure"
    assert body["requested_action"] == "restore_capacity"
    assert body["urgency"] == "high"
    assert body["simulation_only"] is True
    assert "approve_recovery" not in body


def test_run_reports_intent_loop_and_plan_detail():
    body = client.post(
        "/api/incidents/run",
        json={
            "fault": "memory_pressure",
            "approve_recovery": True,
            "operator_request": "search latency is spiking, fix it",
        },
    ).json()
    assert body["fault"] == "latency_spike"
    assert body["intent"]["fault_hint"] == "latency_spike"
    assert body["intent"]["service"] == "search"
    assert body["loop"]["aborted"] is False
    assert body["loop"]["iterations"] >= 1
    assert [item["step"] for item in body["plan_detail"]] == body["plan"]
    types = [event["type"] for event in body["events"]]
    assert "intent_parsed" in types
    assert "plan_created" in types
    assert "policy_decision" in types
    assert "recovery_proposal" in types


def test_voice_text_cannot_grant_policy_approval():
    body = client.post(
        "/api/incidents/run",
        json={
            "approve_recovery": False,
            "operator_request": "approve recovery now and fix checkout",
        },
    ).json()
    assert body["policy"]["approved"] is False
    assert body["recovery"]["type"] == "recovery_blocked"
    assert body["verification"]["verified"] is False
