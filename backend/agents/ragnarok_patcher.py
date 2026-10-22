class RagnarokPatcher:
    name = "RagnarokPatcher"

    def propose(self, diagnosis: dict, intent: dict | None = None) -> dict:
        """Propose a simulated recovery; intent can only narrow the action.

        Operator intent never grants approval — this proposal always requires
        the independent policy gate.
        """
        intent = intent or {}
        constraints = intent.get("constraints") or []
        observe_only = (
            "read_only" in constraints
            or intent.get("requested_action") == "investigate_only"
        )

        if observe_only:
            action = "observe_only_no_change"
        else:
            action = "restore_simulated_service_capacity"

        proposal = {
            "agent": self.name,
            "type": "recovery_proposal",
            "action": action,
            "based_on": diagnosis["cause"],
            "operator_constraints": constraints,
            "requires_policy_approval": True,
            "simulation_only": True,
        }
        # Recorded in the audit trail by the engine (previously a known gap).
        return proposal

    def record(self, incident, proposal: dict) -> dict:
        incident.events.append(proposal)
        return proposal
