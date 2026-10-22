"""Rule-based operator-intent parser.

Voice and typed requests are treated as *data*, never as authority: this module
extracts structured hints (service, fault, constraints, urgency) that reshape
planning and simulation. It can never grant policy approval — approval only
comes from the explicit ``approve_recovery`` flag on the run request.
"""

from __future__ import annotations

import re

KNOWN_SERVICES = ("checkout", "api", "search", "payments", "inventory")
DEFAULT_SERVICE = "checkout"

FAULT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "memory_pressure": ("memory", "ram", "oom", "leak", "heap"),
    "latency_spike": ("latency", "slow", "spike", "p99", "lag", "response time"),
    "disk_saturation": ("disk", "storage", "volume", "inode", "partition"),
    "connection_exhaustion": ("connection", "pool", "socket", "exhaust"),
}

CONSTRAINT_PATTERNS: dict[str, tuple[str, ...]] = {
    "read_only": ("read only", "read-only", "readonly", "do not change",
                  "don't change", "observe only", "observe-only"),
    "no_restart": ("do not restart", "don't restart", "no restart",
                   "without restarting"),
    "no_deploy": ("do not deploy", "don't deploy", "no deploy",
                  "no deployment"),
}

ACTION_PATTERNS: dict[str, tuple[str, ...]] = {
    "restore_capacity": ("restore", "recover", "fix", "heal", "remediate",
                         "bring back", "scale up", "scale"),
    "investigate_only": ("investigate", "diagnose", "look into", "check",
                         "inspect", "assess"),
}

URGENCY_WORDS = ("asap", "immediately", "urgent", "right now", "now", "p1", "critical")


def _match_keyword(text: str, table: dict[str, tuple[str, ...]]) -> str | None:
    for key, words in table.items():
        for word in words:
            if re.search(rf"(?<!\w){re.escape(word)}(?!\w)", text):
                return key
    return None


def parse_operator_intent(text: str) -> dict:
    """Parse free-form operator text into a structured, simulation-safe intent.

    Always returns a full intent dict; unknown input falls back to neutral
    defaults so the engine can proceed with the explicitly configured fault.
    """
    raw = (text or "").strip()
    normalized = re.sub(r"\s+", " ", raw.lower())

    service = DEFAULT_SERVICE
    earliest: tuple[int, str] | None = None
    for candidate in KNOWN_SERVICES:
        index = normalized.find(candidate)
        if index >= 0 and (earliest is None or index < earliest[0]):
            earliest = (index, candidate)
    if earliest is not None:
        service = earliest[1]

    fault_hint = _match_keyword(normalized, FAULT_KEYWORDS)

    constraints = [
        name
        for name, patterns in CONSTRAINT_PATTERNS.items()
        if any(pattern in normalized for pattern in patterns)
    ]

    requested_action = None
    if _match_keyword(normalized, ACTION_PATTERNS) == "investigate_only":
        requested_action = "investigate_only"
    elif _match_keyword(normalized, ACTION_PATTERNS) == "restore_capacity":
        requested_action = "restore_capacity"

    urgency = "high" if any(word in normalized for word in URGENCY_WORDS) else "normal"

    return {
        "service": service,
        "fault_hint": fault_hint,
        "requested_action": requested_action,
        "constraints": constraints,
        "urgency": urgency,
        "raw": raw,
        "source": "rule_based_parser",
        "simulation_only": True,
    }
