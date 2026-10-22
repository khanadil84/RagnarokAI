from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.core.intent import parse_operator_intent
from backend.simulation import history
from backend.simulation.engine import run_incident

app = FastAPI(
    title="Ragnarok AI",
    description="Voice-driven infrastructure resilience simulator",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IncidentRequest(BaseModel):
    fault: str = Field(default="memory_pressure")
    approve_recovery: bool = False
    operator_request: str = Field(default="", max_length=500)
    # Deterministic failure demo for the bounded loop: none | once | always.
    simulate_failure: Literal["none", "once", "always"] = "none"


class IntentRequest(BaseModel):
    text: str = Field(default="", max_length=500)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "project": "Ragnarok AI",
        "simulation_only": True,
        "voice_input": "browser_client",
        "run_count": len(history.list_runs(limit=50)),
    }


@app.post("/api/intents/parse")
def parse_intent(request: IntentRequest):
    """Parse free-form operator text into a structured, simulation-safe intent.

    Additive endpoint: never grants approval; intent only reshapes planning.
    """
    return parse_operator_intent(request.text)


@app.post("/api/incidents/run")
def run(request: IncidentRequest):
    return history.remember(run_incident(
        fault=request.fault,
        approve_recovery=request.approve_recovery,
        operator_request=request.operator_request,
        simulate_failure=request.simulate_failure,
    ))


@app.get("/api/incidents")
def list_incidents(limit: int = Query(default=20, ge=1, le=50)):
    return {"items": history.list_runs(limit=limit)}


@app.get("/api/incidents/{incident_id}")
def incident(incident_id: str):
    run = history.get_run(incident_id)
    if run is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return run


@app.get("/api/lifecycle")
def lifecycle():
    """Static contract describing the recovery lifecycle this API exposes."""
    return {
        "simulation_only": True,
        "stages": [
            {"name": "operator_request", "agent": None,
             "source": "POST /api/incidents/run .operator_request"},
            {"name": "orchestration", "agent": "OrchestratorPrime",
             "source": ".plan (OrchestratorPrime.create_plan)"},
            {"name": "fault_simulation", "agent": "ChaosValkyrie",
             "source": ".events[].fault_injected"},
            {"name": "diagnosis", "agent": "AegisSentinel",
             "source": ".events[].diagnosis"},
            {"name": "recovery_proposal", "agent": "RagnarokPatcher",
             "source": ".proposal"},
            {"name": "policy_approval", "agent": None,
             "source": ".policy / .recovery.type"},
            {"name": "simulated_execution", "agent": "NexusDeployer",
             "source": ".recovery"},
            {"name": "verification", "agent": "NexusDeployer",
             "source": ".verification"},
        ],
        "known_gaps": [
            "Browser-side speech recognition (SpeechRecognition API) and "
            "Wispr Flow dictation feed operator_request; the API itself "
            "receives text only and has no voice endpoint.",
            "Operator or voice text can never grant policy approval: the "
            "approve_recovery request flag is the only approval source.",
            "No live event stream: lifecycle data is read from the "
            "synchronous run response.",
            "Run history is in-memory only and resets on process restart.",
        ],
    }


_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="web")
