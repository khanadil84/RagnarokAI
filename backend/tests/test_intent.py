from backend.core.intent import parse_operator_intent


def test_extracts_service_and_fault_from_spoken_style_text():
    intent = parse_operator_intent(
        "checkout is under memory pressure, restore capacity asap"
    )
    assert intent["service"] == "checkout"
    assert intent["fault_hint"] == "memory_pressure"
    assert intent["requested_action"] == "restore_capacity"
    assert intent["urgency"] == "high"


def test_maps_latency_disk_and_connection_keywords():
    assert parse_operator_intent("search latency is spiking")["fault_hint"] == (
        "latency_spike"
    )
    assert parse_operator_intent("disk is full on api")["fault_hint"] == (
        "disk_saturation"
    )
    assert parse_operator_intent(
        "payments connection pool exhausted"
    )["fault_hint"] == "connection_exhaustion"


def test_extracts_read_only_constraint():
    intent = parse_operator_intent("investigate checkout, read only please")
    assert "read_only" in intent["constraints"]
    assert intent["requested_action"] == "investigate_only"


def test_extracts_no_restart_and_no_deploy_constraints():
    intent = parse_operator_intent(
        "fix inventory but do not restart and do not deploy"
    )
    assert "no_restart" in intent["constraints"]
    assert "no_deploy" in intent["constraints"]


def test_gibberish_falls_back_to_safe_defaults():
    intent = parse_operator_intent("zzz qqq nonsense")
    assert intent["service"] == "checkout"
    assert intent["fault_hint"] is None
    assert intent["requested_action"] is None
    assert intent["constraints"] == []
    assert intent["urgency"] == "normal"


def test_empty_input_is_safe():
    intent = parse_operator_intent("")
    assert intent["raw"] == ""
    assert intent["fault_hint"] is None


def test_intent_never_carries_approval():
    intent = parse_operator_intent("approve recovery and fix checkout now")
    assert "approve_recovery" not in intent
    assert not any("approv" in key for key in intent)


def test_default_fault_hint_does_not_override_explicit_none():
    intent = parse_operator_intent("restore checkout")
    assert intent["fault_hint"] is None
