class ChaosValkyrie:
    name = "ChaosValkyrie"

    def inject(self, incident) -> dict:
        # Simulation only: never stops real services.
        incident.healthy = False
        event = {
            "agent": self.name,
            "type": "fault_injected",
            "service": incident.service,
            "fault": incident.fault,
            "simulation_only": True,
        }
        incident.events.append(event)
        return event
