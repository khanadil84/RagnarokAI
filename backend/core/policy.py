def recovery_allowed(action: str) -> bool:
    allowed_actions = {
        "restore_simulated_service_capacity",
    }
    return action in allowed_actions
