from backend.simulation.engine import run_incident


def test_approved_simulated_recovery():
    result = run_incident(approve_recovery=True)
    assert result["simulation_only"] is True
    assert result["recovery"]["healthy"] is True
    assert result["verification"]["verified"] is True


def test_recovery_requires_approval():
    result = run_incident(approve_recovery=False)
    assert result["recovery"]["type"] == "recovery_blocked"
    assert result["verification"]["verified"] is False


def test_simulation_does_not_claim_real_infrastructure():
    result = run_incident()
    assert result["simulation_only"] is True
    assert all(event.get("simulation_only") is True
               for event in result["events"])


def test_voice_text_influences_fault_selection():
    result = run_incident(
        operator_request="search latency is spiking, restore checkout",
    )
    assert result["fault"] == "latency_spike"
    assert result["service"] == "search"


def test_read_only_intent_blocks_protected_execution():
    result = run_incident(
        approve_recovery=True,
        operator_request="investigate checkout, read only please",
    )
    assert result["proposal"]["action"] == "observe_only_no_change"
    assert result["policy"]["action_allowed"] is False
    assert result["policy"]["approved"] is False
    assert result["recovery"]["type"] == "recovery_blocked"
    assert result["verification"]["verified"] is False


def test_verification_requires_all_evidence_checks():
    result = run_incident(approve_recovery=True)
    checks = result["verification"]["checks"]
    assert len(checks) == 4
    assert all(check["passed"] for check in checks)
    assert result["verification"]["verified"] is True


def test_proposal_and_decisions_appear_in_audit_events():
    result = run_incident(approve_recovery=False)
    types = [event["type"] for event in result["events"]]
    assert "intent_parsed" in types
    assert "plan_created" in types
    assert "recovery_proposal" in types
    assert "policy_decision" in types
    assert "verification" in types

