from threading import Lock

_MAX_RUNS = 50

_lock = Lock()
_runs: list[dict] = []


def _outcome(run: dict) -> str:
    if run.get("verification", {}).get("verified"):
        return "verified"
    if run.get("recovery", {}).get("type") == "recovery_blocked":
        return "blocked"
    return "unverified"


def remember(result: dict) -> dict:
    with _lock:
        _runs.append(result)
        if len(_runs) > _MAX_RUNS:
            del _runs[:-_MAX_RUNS]
    return result


def summary(run: dict) -> dict:
    return {
        "incident_id": run["incident_id"],
        "started_at": run["started_at"],
        "service": run["service"],
        "fault": run["fault"],
        "operator_request": run.get("operator_request", ""),
        "duration_ms": run["duration_ms"],
        "event_count": len(run["events"]),
        "outcome": _outcome(run),
        "approved": run.get("policy", {}).get("approved"),
        "verified": run.get("verification", {}).get("verified"),
        "simulation_only": run["simulation_only"],
    }


def list_runs(limit: int = 20) -> list[dict]:
    if limit <= 0:
        return []
    with _lock:
        snapshot = list(_runs)
    # Newest N runs, newest-first (snapshot is append/chronological order).
    return [summary(run) for run in reversed(snapshot[-limit:])]


def get_run(incident_id: str) -> dict | None:
    with _lock:
        for run in reversed(_runs):
            if run["incident_id"] == incident_id:
                return run
    return None


def clear() -> None:
    with _lock:
        _runs.clear()
