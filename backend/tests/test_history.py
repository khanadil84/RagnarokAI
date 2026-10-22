from backend.simulation import history


def _run(tag: str) -> dict:
    return {
        "incident_id": tag,
        "service": "checkout",
        "fault": "memory_pressure",
        "operator_request": tag,
        "duration_ms": 1.0,
        "started_at": "2026-10-21T00:00:00.000+00:00",
        "simulation_only": True,
        "policy": {"approved": False},
        "verification": {"verified": False},
        "recovery": {"type": "recovery_blocked"},
        "events": [{"seq": 1}],
    }


def setup_function():
    history.clear()


def test_list_runs_returns_newest_n_in_newest_first_order():
    for index in range(1, 6):
        history.remember(_run(f"run-{index}"))

    items = history.list_runs(limit=3)

    assert [item["incident_id"] for item in items] == [
        "run-5", "run-4", "run-3",
    ]


def test_list_runs_with_limit_larger_than_history_returns_all_newest_first():
    for index in range(1, 4):
        history.remember(_run(f"run-{index}"))

    items = history.list_runs(limit=50)

    assert [item["incident_id"] for item in items] == [
        "run-3", "run-2", "run-1",
    ]


def test_list_runs_limit_zero_returns_empty():
    history.remember(_run("run-1"))
    assert history.list_runs(limit=0) == []
