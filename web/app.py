"""Démo web locale — plateforme Jahiz (جاهز).

Lance :  python web/app.py
Ouvre :  http://127.0.0.1:8000

Toutes les données sont SYNTHÉTIQUES. Le moteur de règles est le même que celui
de `src/rules_engine.py` : l'interface ne fait que présenter ses décisions.
"""

from __future__ import annotations

import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from src.rules_engine import (  # noqa: E402
    Assessment,
    CheckIn,
    Context,
    Session,
    evaluate,
    load_config,
)

try:
    from .darija import parse_darija
except ImportError:  # exécution directe : python web/app.py
    from darija import parse_darija  # type: ignore

CONFIG = load_config()
TODAY = date.today()
STATIC_DIR = ROOT / "web" / "static"
app = FastAPI(title="Jahiz MVP — démo locale", version="1.0.0")


# --------------------------------------------------------------------------- #
# État synthétique en mémoire
# --------------------------------------------------------------------------- #
def _iso(value: date) -> str:
    return value.isoformat()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_state() -> dict[str, Any]:
    return {
        "consent": False,
        "sessions": [
            {
                "id": "SYNTH-DEMO-013",
                "date": _iso(TODAY - timedelta(days=2)),
                "rpe": 4,
                "nrs": 1,
                "duration": 20,
                "red_flags": [],
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
                "status": "COMPLETED",
            },
            {
                "id": "SYNTH-DEMO-014",
                "date": _iso(TODAY - timedelta(days=1)),
                "rpe": 4,
                "nrs": 1,
                "duration": 20,
                "red_flags": [],
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
                "status": "COMPLETED",
            },
        ],
        "checkins": [],
        "t0": 350,
        "t1": None,
        "goal": 400,
        "t1_due": False,
        "last_activity": _iso(TODAY - timedelta(days=1)),
        "inactivity_days": 1,
        "decisions": [],
        "alerts": [],
        "applied_duration": 20,
        "session_active": False,
        "program_status": "EN_COURS",
        "last_voice": None,
        "scenario": "r1",
    }


STATE: dict[str, Any] = new_state()


# --------------------------------------------------------------------------- #
# Construction du contexte et appel du moteur
# --------------------------------------------------------------------------- #
def compute_inactivity() -> int:
    try:
        last = date.fromisoformat(STATE["last_activity"])
    except (ValueError, TypeError):
        return 0
    return max((TODAY - last).days, 0)


def build_context(t1_due: bool | None = None) -> Context:
    sessions = [
        Session(
            id=s["id"],
            date=date.fromisoformat(s["date"]),
            rpe=s.get("rpe"),
            nrs=s.get("nrs"),
            duration_min=s.get("duration"),
            red_flags=tuple(s.get("red_flags", [])),
            source=s.get("source", "MANUAL"),
            confidence=float(s.get("confidence", 1.0)),
            confirmed=bool(s.get("confirmed", True)),
            status=s.get("status", "COMPLETED"),
        )
        for s in STATE["sessions"]
    ]
    checkins = [
        CheckIn(
            date=date.fromisoformat(c["date"]),
            state=c.get("state", "BIEN"),
            rpe=c.get("rpe"),
            nrs=c.get("nrs"),
            red_flags=tuple(c.get("red_flags", [])),
            source=c.get("source", "MANUAL"),
            confidence=float(c.get("confidence", 1.0)),
            confirmed=bool(c.get("confirmed", True)),
        )
        for c in STATE["checkins"]
    ]
    assessments = [Assessment("T0", int(STATE["t0"]), TODAY - timedelta(days=21))]
    if STATE["t1"] is not None:
        assessments.append(Assessment("T1", int(STATE["t1"]), TODAY))

    return Context(
        pilgrim_id="SYNTH-001",
        today=TODAY,
        sessions=sessions,
        checkins=checkins,
        assessments=assessments,
        goal_6mwt=int(STATE["goal"]),
        inactivity_days=compute_inactivity(),
        t1_due=STATE["t1_due"] if t1_due is None else t1_due,
    )


def run_engine(t1_due: bool | None = None) -> dict[str, Any]:
    result = evaluate(build_context(t1_due), CONFIG)
    decision = result.decision.to_dict()
    decision["created_at"] = _now()
    STATE["decisions"].insert(0, decision)

    if decision["action"] not in ("AUCUNE_ACTION", "MAINTENIR_CHARGE"):
        STATE["alerts"].insert(
            0,
            {
                "id": "ALT-" + uuid.uuid4().hex[:8],
                "decision_id": decision["decision_id"],
                "rule_id": decision["rule_id"],
                "action": decision["action"],
                "severity": decision["severity"],
                "justification": decision["explanation"]["fr"],
                "created_at": decision["created_at"],
                "status": "NOUVEAU",
            },
        )
    return decision


def state_response() -> dict[str, Any]:
    return {
        "notice": "DÉMO · DONNÉES SYNTHÉTIQUES UNIQUEMENT",
        "pilgrim": {"id": "SYNTH-001", "pseudonyme": "الحاج أحمد (SYNTH-001)", "age": 63},
        "today": _iso(TODAY),
        "consent": STATE["consent"],
        "sessions": STATE["sessions"],
        "checkins": STATE["checkins"],
        "t0": STATE["t0"],
        "t1": STATE["t1"],
        "goal": STATE["goal"],
        "inactivity_days": compute_inactivity(),
        "applied_duration": STATE["applied_duration"],
        "program_status": STATE["program_status"],
        "session_active": STATE["session_active"],
        "last_voice": STATE["last_voice"],
        "scenario": STATE["scenario"],
        "decisions": STATE["decisions"][:10],
        "alerts": STATE["alerts"][:10],
        "rule_order": CONFIG["engine"]["evaluation_order"],
        "thresholds": CONFIG["thresholds"],
        "red_flags": CONFIG["red_flags"],
    }


# --------------------------------------------------------------------------- #
# Routes API
# --------------------------------------------------------------------------- #
@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return state_response()


@app.post("/api/reset")
def reset() -> dict[str, Any]:
    global STATE
    STATE = new_state()
    return state_response()


@app.post("/api/consent")
def give_consent() -> dict[str, Any]:
    STATE["consent"] = True
    return state_response()


@app.post("/api/session/start")
def start_session() -> dict[str, Any]:
    STATE["session_active"] = True
    return state_response()


@app.post("/api/session/stop")
def stop_session(body: dict[str, Any]) -> dict[str, Any]:
    STATE["session_active"] = False
    flags = [f for f in body.get("red_flags", []) if f in CONFIG["red_flags"]]
    if flags:
        STATE["checkins"].insert(
            0,
            {
                "date": _iso(TODAY),
                "state": "NEED_HELP",
                "rpe": None,
                "nrs": None,
                "red_flags": flags,
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
            },
        )
        STATE["last_activity"] = _iso(TODAY)
        run_engine()
    return state_response()


@app.post("/api/session")
def record_session(body: dict[str, Any]) -> dict[str, Any]:
    rpe = body.get("rpe")
    nrs = body.get("nrs")
    session = {
        "id": "SYNTH-DEMO-" + uuid.uuid4().hex[:6],
        "date": _iso(TODAY),
        "rpe": int(rpe) if rpe is not None else None,
        "nrs": int(nrs) if nrs is not None else None,
        "duration": int(STATE["applied_duration"]),
        "red_flags": [f for f in body.get("red_flags", []) if f in CONFIG["red_flags"]],
        "source": body.get("source", "MANUAL"),
        "confidence": float(body.get("confidence", 1.0)),
        "confirmed": bool(body.get("confirmed", True)),
        "status": "COMPLETED",
    }
    STATE["sessions"].insert(0, session)
    STATE["session_active"] = False
    STATE["last_activity"] = _iso(TODAY)
    decision = run_engine()
    return {"decision": decision, "state": state_response()}


@app.post("/api/voice")
def voice(body: dict[str, Any]) -> dict[str, Any]:
    text = str(body.get("text", ""))
    confirmed = bool(body.get("confirmed", False))
    parsed = parse_darija(text)
    indicators = parsed["indicators"]

    # S0 : les drapeaux ne sont jamais soumis à confirmation.
    if indicators["red_flags"]:
        STATE["checkins"].insert(
            0,
            {
                "date": _iso(TODAY),
                "state": "NEED_HELP",
                "rpe": None,
                "nrs": None,
                "red_flags": indicators["red_flags"],
                "source": "VOICE_DARIJA",
                "confidence": parsed["input"]["asr_confidence"],
                "confirmed": True,
            },
        )
        STATE["last_activity"] = _iso(TODAY)

    rpe_indicator = indicators.get("rpe")
    session_id = None
    if rpe_indicator:
        session_id = "SYNTH-VOICE-" + uuid.uuid4().hex[:6]
        STATE["sessions"].insert(
            0,
            {
                "id": session_id,
                "date": _iso(TODAY),
                "rpe": rpe_indicator["value"],
                "nrs": indicators["nrs"]["value"],
                "duration": int(STATE["applied_duration"]),
                "red_flags": [],
                "source": "VOICE_DARIJA",
                "confidence": rpe_indicator["confidence"],
                "confirmed": confirmed,
                "status": "COMPLETED",
            },
        )
        STATE["last_activity"] = _iso(TODAY)

    STATE["last_voice"] = {"session_id": session_id, "parsed": parsed}
    decision = run_engine()
    return {"parsed": parsed, "decision": decision, "state": state_response()}


@app.post("/api/confirm-voice")
def confirm_voice() -> dict[str, Any]:
    session_id = (STATE.get("last_voice") or {}).get("session_id")
    if not session_id:
        return {"decision": None, "state": state_response()}
    for session in STATE["sessions"]:
        if session["id"] == session_id:
            session["confirmed"] = True
            break
    decision = run_engine()
    return {"decision": decision, "state": state_response()}


@app.post("/api/checkin")
def checkin(body: dict[str, Any]) -> dict[str, Any]:
    state_value = body.get("state", "BIEN")
    nrs = body.get("nrs")
    entry = {
        "date": _iso(TODAY),
        "state": state_value,
        "rpe": None,
        "nrs": int(nrs) if nrs is not None else None,
        "red_flags": [f for f in body.get("red_flags", []) if f in CONFIG["red_flags"]],
        "source": body.get("source", "MANUAL"),
        "confidence": 1.0,
        "confirmed": True,
    }
    STATE["checkins"].insert(0, entry)
    STATE["last_activity"] = _iso(TODAY)
    decision = run_engine()
    return {"decision": decision, "state": state_response()}


@app.post("/api/validate")
def validate(body: dict[str, Any]) -> dict[str, Any]:
    decision_id = body.get("decision_id")
    approved = bool(body.get("approve", False))
    for decision in STATE["decisions"]:
        if decision["decision_id"] == decision_id:
            decision["validation"] = {
                "status": "VALIDE" if approved else "REFUSE",
                "role": body.get("role", "ENCADRANT"),
                "at": _now(),
            }
            action = decision["action"]
            payload = decision.get("payload", {})
            if approved and action in ("PROPOSER_AUGMENTATION_DUREE", "PROPOSER_ALLEGEMENT"):
                proposed = payload.get("duree_proposee_min")
                if proposed:
                    STATE["applied_duration"] = int(proposed)
            elif approved and action == "VALIDER_PROGRAMME":
                STATE["program_status"] = "TERMINE"
            elif approved and action == "PROPOSER_SECOND_CYCLE":
                STATE["program_status"] = "SECOND_CYCLE_PROPOSE"
            break
    for alert in STATE["alerts"]:
        if alert["decision_id"] == decision_id:
            alert["status"] = "TRAITE"
    return state_response()


@app.post("/api/scenario")
def scenario(body: dict[str, Any]) -> dict[str, Any]:
    global STATE
    name = str(body.get("name", "r1"))
    STATE = new_state()
    STATE["scenario"] = name
    STATE["consent"] = True

    if name == "r3":
        STATE["sessions"] = [
            {
                "id": f"SYNTH-R3-{i}",
                "date": _iso(TODAY - timedelta(days=2 - i)),
                "rpe": 7 if i == 0 else 8,
                "nrs": 1,
                "duration": 20,
                "red_flags": [],
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
                "status": "COMPLETED",
            }
            for i in range(2)
        ]
    elif name == "r4":
        STATE["sessions"] = [
            {
                "id": "SYNTH-R4-001",
                "date": _iso(TODAY),
                "rpe": 5,
                "nrs": 5,
                "duration": 20,
                "red_flags": [],
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
                "status": "COMPLETED",
            }
        ]
    elif name == "s0":
        STATE["checkins"] = [
            {
                "date": _iso(TODAY),
                "state": "NEED_HELP",
                "rpe": None,
                "nrs": None,
                "red_flags": ["chest_pain", "vertigo"],
                "source": "MANUAL",
                "confidence": 1.0,
                "confirmed": True,
            }
        ]
        STATE["last_activity"] = _iso(TODAY)
    elif name == "r5":
        STATE["sessions"] = []
        STATE["last_activity"] = _iso(TODAY - timedelta(days=3))
    elif name == "r6":
        # On retire les séances d'exemple pour que R6 ne soit pas masquée par R1.
        STATE["sessions"] = []
        STATE["t1"] = 405
        STATE["t1_due"] = True

    run_engine()
    return state_response()


# --------------------------------------------------------------------------- #
# Fichiers statiques
# --------------------------------------------------------------------------- #
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    print("\n  جاهز — démo locale")
    print("  Ouvrez : http://127.0.0.1:8000\n")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
