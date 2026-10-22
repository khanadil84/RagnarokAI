class SimulatedStepError(Exception):
    """Raised inside the simulation when a recovery step fails deterministically."""


class NexusDeployer:
    name = "NexusDeployer"

    def execute(self, incident, proposal: dict, approved: bool,
                *, attempt: int = 1, simulate_failure: str = "none") -> dict:
        """Apply a recovery action to the in-memory simulation only.

        ``simulate_failure`` is a deterministic demo/test hook:
        - "once": the first attempt raises SimulatedStepError (retry succeeds)
        - "always": every attempt raises (loop must abort safely)
        """
        if not approved:
            result = {
                "agent": self.name,
                "type": "recovery_blocked",
                "reason": "Policy approval not granted",
                "healthy": incident.healthy,
                "attempt": attempt,
                "simulation_only": True,
            }
            incident.events.append(result)
            return result

        if simulate_failure == "always" or (
            simulate_failure == "once" and attempt == 1
        ):
            raise SimulatedStepError(
                f"simulated recovery fault on attempt {attempt}"
            )

        incident.healthy = True
        result = {
            "agent": self.name,
            "type": "simulated_recovery",
            "action": proposal["action"],
            "healthy": incident.healthy,
            "attempt": attempt,
            "simulation_only": True,
        }
        incident.events.append(result)
        return result

    def verify(self, incident, checks: list[dict] | None = None) -> dict:
        """Verify outcomes against evidence checks; success only if all pass."""
        if checks is None:
            checks = [{
                "name": "service_healthy",
                "passed": incident.healthy is True,
                "observed": incident.healthy,
            }]
        verified = all(check["passed"] for check in checks)
        result = {
            "agent": self.name,
            "type": "verification",
            "healthy": incident.healthy,
            "verified": verified,
            "checks": checks,
            "simulation_only": True,
        }
        incident.events.append(result)
        return result
