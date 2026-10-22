class AegisSentinel:
    name = "AegisSentinel"

    def diagnose(self, incident, intent: dict | None = None) -> dict:
        intent = intent or {}
        constraints = intent.get("constraints") or []
        evidence = [
            "simulated health check failed",
            f"simulated fault: {incident.fault}",
            f"service: {incident.service}",
        ]
        for constraint in constraints:
            evidence.append(f"operator constraint: {constraint}")

        event = {
            "agent": self.name,
            "type": "diagnosis",
            "service": incident.service,
            "cause": incident.fault,
            "evidence": evidence,
            "operator_constraints": constraints,
            "simulation_only": True,
        }
        incident.events.append(event)
        return event
