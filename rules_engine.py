"""Moteur de règles explicable de la plateforme Jahiz (جاهز).

Référence exécutable du niveau 0 (obligatoire) :
- deterministic : aucune inférence cachée, aucune prescription automatique ;
- paramétrable : tous les seuils proviennent de config/rules.json ;
- explicable : chaque décision porte la règle, sa version, ses preuves et un
  message FR/Darija ;
- testable : voir tests/test_rules_engine.py.

Règle transversale : le système PROPOSE et ALERTE ; la validation humaine
(encadrant / kinésithérapeute / médecin) est requise avant tout changement de
charge ou toute décision d'aptitude.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Callable, Optional

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "rules.json"


# --------------------------------------------------------------------------- #
# Modèle d'entrée (sous-ensemble synthétique du modèle de données complet)
# --------------------------------------------------------------------------- #
@dataclass
class Session:
    """Une séance enregistrée. source/confidence servent à la traçabilité NLP."""

    id: str
    date: date
    rpe: Optional[int] = None          # Effort perçu 0-10 (Borg simplifié)
    nrs: Optional[int] = None          # Douleur 0-10
    duration_min: Optional[int] = None
    red_flags: tuple[str, ...] = ()
    source: str = "MANUAL"
    confidence: float = 1.0
    confirmed: bool = True
    status: str = "COMPLETED"


@dataclass
class CheckIn:
    """Point quotidien (interface 8)."""

    date: date
    state: str = "OK"                  # OK | FATIGUED | NEED_HELP
    rpe: Optional[int] = None
    nrs: Optional[int] = None
    red_flags: tuple[str, ...] = ()
    source: str = "MANUAL"
    confidence: float = 1.0
    confirmed: bool = True


@dataclass
class Assessment:
    """Test fonctionnel 6MWT réalisé par un professionnel (T0 ou T1)."""

    kind: str                          # "T0" | "T1"
    six_mwt: int                       # distance en mètres
    date: date


@dataclass
class Context:
    """Contexte d'évaluation pour un pèlerin synthétique à une date donnée."""

    pilgrim_id: str
    today: date
    sessions: list[Session] = field(default_factory=list)
    checkins: list[CheckIn] = field(default_factory=list)
    assessments: list[Assessment] = field(default_factory=list)
    goal_6mwt: Optional[int] = None
    inactivity_days: int = 0           # calculé par le planificateur (R5)
    t1_due: bool = False               # R6 n'est évaluée qu'au point de contrôle T1
    red_flags: tuple[str, ...] = ()    # drapeaux explicites (interface 4/8)


# --------------------------------------------------------------------------- #
# Sorties
# --------------------------------------------------------------------------- #
@dataclass
class Decision:
    decision_id: str
    rule_id: str
    rule_label: str
    rule_version: str
    action: str
    severity: str                      # INFO | WARNING | CRITICAL
    payload: dict[str, Any]
    evidence: list[dict[str, Any]]
    explanation_fr: str
    explanation_ar: str
    needs_human_validation: bool
    trace: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision_id": self.decision_id,
            "rule_id": self.rule_id,
            "rule_label": self.rule_label,
            "rule_version": self.rule_version,
            "action": self.action,
            "severity": self.severity,
            "payload": self.payload,
            "evidence": self.evidence,
            "explanation": {"fr": self.explanation_fr, "ar": self.explanation_ar},
            "needs_human_validation": self.needs_human_validation,
            "status": "PROPOSITION_EN_ATTENTE" if self.needs_human_validation else "APPLIQUABLE",
            "trace": self.trace,
        }


@dataclass
class EngineResult:
    decision: Decision
    trace: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"decision": self.decision.to_dict(), "evaluation_trace": self.trace}


# --------------------------------------------------------------------------- #
# Chargement de la configuration (source unique des seuils et des messages)
# --------------------------------------------------------------------------- #
def load_config(path: Path | str | None = None) -> dict[str, Any]:
    """Charge la configuration JSON. Aucun seuil n'est codé en dur dans le moteur."""
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    with cfg_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    required = ("engine", "thresholds", "red_flags", "rules")
    missing = [key for key in required if key not in config]
    if missing:
        raise ValueError(f"Configuration incomplète, clés manquantes : {missing}")
    return config


def _fmt(template: str, **values: Any) -> str:
    """Remplace les placeholders en tolérant une clé absente."""
    try:
        return template.format(**values)
    except KeyError:
        return template


def _new_decision(
    config: dict[str, Any],
    rule_id: str,
    action: str,
    severity: str,
    payload: dict[str, Any],
    evidence: list[dict[str, Any]],
    explanation_fr: str,
    explanation_ar: str,
    rule_id_for_validation: Optional[str] = None,
) -> Decision:
    validation_rule = rule_id_for_validation or rule_id
    rule = config["rules"][validation_rule]
    return Decision(
        decision_id="DEC-" + uuid.uuid4().hex[:12],
        rule_id=validation_rule,
        rule_label=rule["label"],
        rule_version=config["engine"]["version"],
        action=action,
        severity=severity,
        payload=payload,
        evidence=evidence,
        explanation_fr=explanation_fr,
        explanation_ar=explanation_ar,
        needs_human_validation=bool(rule.get("human_validation", False)),
    )


# --------------------------------------------------------------------------- #
# Utilitaires partagés
# --------------------------------------------------------------------------- #
def _completed_sessions(ctx: Context) -> list[Session]:
    return sorted(
        (s for s in ctx.sessions if s.status == "COMPLETED" and s.date <= ctx.today),
        key=lambda s: (s.date, s.id),
        reverse=True,
    )


def _latest_checkin(ctx: Context) -> Optional[CheckIn]:
    items = [c for c in ctx.checkins if c.date <= ctx.today]
    return max(items, key=lambda c: c.date) if items else None


def _evidence_session(session: Session) -> dict[str, Any]:
    return {
        "type": "SESSION",
        "id": session.id,
        "date": session.date.isoformat(),
        "rpe": session.rpe,
        "nrs": session.nrs,
        "duration_min": session.duration_min,
        "source": session.source,
        "confidence": session.confidence,
        "confirmed": session.confirmed,
    }


def _is_load_change_allowed(session: Session, config: dict[str, Any]) -> bool:
    """Une déclaration vocale doit être CONFIRMÉE et suffisamment fiable.

    Les deux conditions sont cumulatives : un appui de confirmation explicite
    (interface 5) ET une confiance >= seuil. Les drapeaux de stop (S0) et la
    douleur (R4) ne passent pas par ce filtre : la sécurité prime.
    """
    voice = config["engine"]["voice_source_code"]
    if session.source != voice:
        return True
    if not session.confirmed:
        return False
    minimum = config["engine"]["min_voice_confidence_for_load_change"]
    return session.confidence >= minimum


def _confirmation_decision(
    config: dict[str, Any], sessions: list[Session]
) -> Decision:
    rule = config["rules"]["CONFIRM"]
    confidence = min(s.confidence for s in sessions)
    return _new_decision(
        config,
        "CONFIRM",
        "DEMANDER_CONFIRMATION",
        "INFO",
        {"confiance": confidence, "sessions": [s.id for s in sessions]},
        [_evidence_session(s) for s in sessions],
        _fmt(rule["messages"]["fr"], confiance=confidence),
        _fmt(rule["messages"]["ar"], confiance=confidence),
    )


# --------------------------------------------------------------------------- #
# Évaluateurs de règles
# --------------------------------------------------------------------------- #
def eval_s0(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """Garde-fou non négociable : drapeaux de stop immédiat."""
    flags = list(ctx.red_flags)
    # S0 lit TOUS les signaux, y compris une séance suspendue : un drapeau de
    # stop ne doit jamais être masqué par le statut d'une séance.
    all_sessions = sorted(ctx.sessions, key=lambda s: (s.date, s.id), reverse=True)
    latest_session = next(iter(all_sessions), None)
    latest_checkin = _latest_checkin(ctx)
    for session in all_sessions:
        flags.extend(session.red_flags)
    for checkin in ctx.checkins:
        flags.extend(checkin.red_flags)
    flags = [f for f in dict.fromkeys(flags) if f in cfg["red_flags"]]
    if not flags:
        return None
    evidence: list[dict[str, Any]] = [{"type": "RED_FLAGS", "flags": flags}]
    if latest_session:
        evidence.append(_evidence_session(latest_session))
    if latest_checkin:
        evidence.append({"type": "CHECKIN", "date": latest_checkin.date.isoformat(), "state": latest_checkin.state})
    return _new_decision(
        cfg,
        "S0",
        "SUSPENDRE_IMMEDIATEMENT",
        "CRITICAL",
        {
            "drapeaux": flags,
            "reprise": "DECISION_HUMAINE_UNIQUEMENT",
            "destinataires": ["ENCADRANT", "KINE", "MEDECIN"],
        },
        evidence,
        _fmt(rule["messages"]["fr"], flags=", ".join(flags)),
        _fmt(rule["messages"]["ar"], flags=", ".join(flags)),
    )


def eval_r4(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """Douleur NRS ≥ seuil : suspension + alerte clinicien sous SLA."""
    t = cfg["thresholds"]
    # Sécurité : on retient la douleur LA PLUS FORTE, pas seulement la plus
    # récente, afin qu'un check-in « je vais bien » ne masque pas une alerte.
    candidates: list[tuple[date, int, Any]] = []
    for session in ctx.sessions:
        if session.nrs is not None:
            candidates.append((session.date, session.nrs, session))
    for checkin in ctx.checkins:
        if checkin.nrs is not None:
            candidates.append((checkin.date, checkin.nrs, checkin))
    if not candidates:
        return None
    signal_date, nrs, signal = max(candidates, key=lambda item: (item[1], item[0]))
    if nrs < t["nrs_alert_min"]:
        return None
    evidence = [
        {
            "type": signal.__class__.__name__.upper(),
            "date": signal_date.isoformat(),
            "nrs": nrs,
            "source": signal.source,
            "confidence": signal.confidence,
            "confirmed": signal.confirmed,
        }
    ]
    return _new_decision(
        cfg,
        "R4",
        "ALERTER_KINE_MEDECIN",
        "CRITICAL",
        {
            "nrs": nrs,
            "suspendre_exercice": True,
            "delai_min": t["pain_alert_sla_minutes"],
            "destinataires": ["KINE", "MEDECIN", "ENCADRANT"],
        },
        evidence,
        _fmt(
            rule["messages"]["fr"],
            nrs=nrs,
            seuil=t["nrs_alert_min"],
            sla=t["pain_alert_sla_minutes"],
        ),
        _fmt(
            rule["messages"]["ar"],
            nrs=nrs,
            seuil=t["nrs_alert_min"],
            sla=t["pain_alert_sla_minutes"],
        ),
    )


def eval_r5(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """Deux jours d'arrêt -> rappel ; troisième jour -> appel de l'encadrant."""
    t = cfg["thresholds"]
    days = ctx.inactivity_days
    if days < t["inactivity_reminder_days"]:
        return None
    if days >= t["inactivity_call_days"]:
        action, channel, severity = "APPEL_ENCADRANT", "APPEL_TELEPHONIQUE", "WARNING"
    else:
        action, channel, severity = "RAPPEL_AUTOMATIQUE", "WHATSAPP", "INFO"
    return _new_decision(
        cfg,
        "R5",
        action,
        severity,
        {
            "jours_sans_seance": days,
            "canal": channel,
            "seuil_rappel": t["inactivity_reminder_days"],
            "seuil_appel": t["inactivity_call_days"],
        },
        [{"type": "INACTIVITY", "jours": days, "as_of": ctx.today.isoformat()}],
        _fmt(rule["messages"]["fr"], jours=days, canal=channel),
        _fmt(rule["messages"]["ar"], jours=days, canal=channel),
    )


def _last_two_evaluator(
    high: bool, action: str, severity: str, label_key: str
) -> Callable[[Context, dict[str, Any], dict[str, Any]], Optional[Decision]]:
    """Fabrique les évaluateurs R3 (RPE élevé) et R1 (RPE faible sans douleur)."""

    def evaluator(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
        t = cfg["thresholds"]
        n = t["consecutive_sessions"]
        sessions = _completed_sessions(ctx)[:n]
        if len(sessions) < n or any(s.rpe is None for s in sessions):
            return None
        if high:
            matched = all(s.rpe >= t["rpe_high_min"] for s in sessions)
            seuil = t["rpe_high_min"]
            pct = t["regression_pct"]
        else:
            matched = all(s.rpe <= t["rpe_low_max"] for s in sessions)
            seuil = t["rpe_low_max"]
            pct = t["progression_pct"]
            matched = matched and all((s.nrs is None or s.nrs < t["nrs_alert_min"]) for s in sessions)
        if not matched:
            return None
        if not all(_is_load_change_allowed(s, cfg) for s in sessions):
            return _confirmation_decision(cfg, sessions)

        latest = sessions[0]
        reference_duration = next(
            (s.duration_min for s in sessions if s.duration_min is not None), None
        )
        # R3 allège, R1 augmente : le signe dépend de la règle, pas du libellé du paramètre.
        factor = (1 - pct / 100) if high else (1 + pct / 100)
        proposed_duration = (
            round(reference_duration * factor) if reference_duration else None
        )
        payload: dict[str, Any] = {
            "rpe": latest.rpe,
            "seuil": seuil,
            "sessions_consecutives": n,
            "pourcentage": pct,
            "duree_reference_min": reference_duration,
            "duree_proposee_min": proposed_duration,
            "validation_encadrant_requise": True,
        }
        if not high:
            payload["sans_douleur"] = True
        dmessages = rule["messages"]
        return _new_decision(
            cfg,
            label_key,
            action,
            severity,
            payload,
            [_evidence_session(s) for s in sessions],
            _fmt(
                dmessages["fr"],
                rpe=latest.rpe,
                seuil=seuil,
                n=n,
                pct=pct,
            ),
            _fmt(
                dmessages["ar"],
                rpe=latest.rpe,
                seuil=seuil,
                n=n,
                pct=pct,
            ),
        )

    return evaluator


eval_r3 = _last_two_evaluator(
    high=True,
    action="PROPOSER_ALLEGEMENT",
    severity="WARNING",
    label_key="R3",
)
eval_r1 = _last_two_evaluator(
    high=False,
    action="PROPOSER_AUGMENTATION_DUREE",
    severity="INFO",
    label_key="R1",
)


def eval_confirm(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """Filet de sécurité : toute sortie vocale non validée est confirmée.

    R1 et R3 portent déjà leur propre contrôle ; ce règle « fourre-tout » couvre
    le cas où une déclaration vocale ne déclenche aucune règle de charge mais
    doit tout de même être confirmée avant d'être conservée telle quelle.
    """
    n = cfg["thresholds"]["consecutive_sessions"]
    recent = _completed_sessions(ctx)[:n]
    untrusted = [s for s in recent if not _is_load_change_allowed(s, cfg)]
    if not untrusted:
        return None
    confidence = min(s.confidence for s in untrusted)
    return _new_decision(
        cfg,
        "CONFIRM",
        "DEMANDER_CONFIRMATION",
        "INFO",
        {"confiance": confidence, "sessions": [s.id for s in untrusted]},
        [_evidence_session(s) for s in untrusted],
        _fmt(rule["messages"]["fr"], confiance=confidence),
        _fmt(rule["messages"]["ar"], confiance=confidence),
    )


def eval_r2(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """RPE dans la plage cible : maintien de la charge."""
    t = cfg["thresholds"]
    sessions = _completed_sessions(ctx)
    if not sessions or sessions[0].rpe is None:
        return None
    latest = sessions[0]
    if not (t["rpe_mid_min"] <= latest.rpe <= t["rpe_mid_max"]):
        return None
    return _new_decision(
        cfg,
        "R2",
        "MAINTENIR_CHARGE",
        "INFO",
        {"rpe": latest.rpe, "charge": "INCHANGEE"},
        [_evidence_session(latest)],
        _fmt(
            rule["messages"]["fr"],
            rpe=latest.rpe,
            min=t["rpe_mid_min"],
            max=t["rpe_mid_max"],
        ),
        _fmt(
            rule["messages"]["ar"],
            rpe=latest.rpe,
            min=t["rpe_mid_min"],
            max=t["rpe_mid_max"],
        ),
    )


def eval_r6(ctx: Context, cfg: dict[str, Any], rule: dict[str, Any]) -> Optional[Decision]:
    """Comparaison T0 -> T1 et objectif : validation ou second cycle.

    R6 ne s'applique qu'au point de contrôle T1 (fin de cycle). Sinon elle ne
    doit pas polluer les décisions quotidiennes avec une alerte « données
    manquantes ».
    """
    if not ctx.t1_due:
        return None
    messages = rule["messages"]
    t0 = next((a for a in ctx.assessments if a.kind == "T0"), None)
    t1 = next((a for a in ctx.assessments if a.kind == "T1"), None)
    if t0 is None or t1 is None or ctx.goal_6mwt is None:
        return _new_decision(
            cfg,
            "R6",
            "DONNEES_INCOMPLETES",
            "WARNING",
            {"t0_present": t0 is not None, "t1_present": t1 is not None, "objectif": ctx.goal_6mwt},
            [],
            messages["missing_fr"],
            messages["missing_ar"],
        )
    evidence = [
        {"type": "ASSESSMENT", "kind": a.kind, "six_mwt": a.six_mwt, "date": a.date.isoformat()}
        for a in (t0, t1)
    ]
    success = t1.six_mwt > t0.six_mwt and t1.six_mwt >= ctx.goal_6mwt
    payload = {
        "t0": t0.six_mwt,
        "t1": t1.six_mwt,
        "objectif": ctx.goal_6mwt,
        "delta": t1.six_mwt - t0.six_mwt,
        "amelioration": t1.six_mwt > t0.six_mwt,
        "objectif_atteint": t1.six_mwt >= ctx.goal_6mwt,
    }
    prefix = "success" if success else "second"
    action = "VALIDER_PROGRAMME" if success else "PROPOSER_SECOND_CYCLE"
    return _new_decision(
        cfg,
        "R6",
        action,
        "INFO" if success else "WARNING",
        payload,
        evidence,
        _fmt(messages[f"{prefix}_fr"], t0=t0.six_mwt, t1=t1.six_mwt, objectif=ctx.goal_6mwt),
        _fmt(messages[f"{prefix}_ar"], t0=t0.six_mwt, t1=t1.six_mwt, objectif=ctx.goal_6mwt),
    )


EVALUATORS: dict[str, Callable[[Context, dict[str, Any], dict[str, Any]], Optional[Decision]]] = {
    "S0": eval_s0,
    "R4": eval_r4,
    "R5": eval_r5,
    "R3": eval_r3,
    "R1": eval_r1,
    "R2": eval_r2,
    "CONFIRM": eval_confirm,
    "R6": eval_r6,
}


# --------------------------------------------------------------------------- #
# Boucle d'évaluation
# --------------------------------------------------------------------------- #
def evaluate(ctx: Context, config: dict[str, Any] | None = None) -> EngineResult:
    """Évalue le contexte et renvoie UNE décision + la trace complète.

    La première règle terminante par ordre de priorité gagne (S0 > R4 > R5 >
    R3 > R1 > R2 > R6). Le garde-fou S0 ne peut jamais être contourné.
    """
    cfg = config or load_config()
    trace: list[dict[str, Any]] = []
    for rule_id in cfg["engine"]["evaluation_order"]:
        rule = cfg["rules"].get(rule_id)
        evaluator = EVALUATORS.get(rule_id)
        if not rule or not evaluator:
            continue
        if not rule.get("enabled", True):
            trace.append({"rule_id": rule_id, "evaluated": False, "reason": "RÈGLE_DÉSACTIVÉE"})
            continue
        candidate = evaluator(ctx, cfg, rule)
        if candidate is None:
            trace.append(
                {
                    "rule_id": rule_id,
                    "evaluated": True,
                    "matched": False,
                    "reason": "CONDITIONS_NON_REMPLIES",
                }
            )
            continue
        candidate.trace = list(trace) + [
            {
                "rule_id": rule_id,
                "evaluated": True,
                "matched": True,
                "action": candidate.action,
                "reason": candidate.explanation_fr,
            }
        ]
        full_trace = candidate.trace
        return EngineResult(decision=candidate, trace=full_trace)
    return EngineResult(
        decision=_new_decision(
            cfg,
            "R2",
            "AUCUNE_ACTION",
            "INFO",
            {},
            [],
            "Aucune règle déclenchée : poursuite du programme sans modification.",
            "لم تُفعل أي قاعدة: مواصلة البرنامج دون تغيير.",
        ),
        trace=trace,
    )


if __name__ == "__main__":
    demo = Context(
        pilgrim_id="SYNTH-001",
        today=date(2026, 11, 17),
        sessions=[
            Session("S-014", date(2026, 11, 16), rpe=4, nrs=1, duration_min=20),
            Session("S-013", date(2026, 11, 15), rpe=4, nrs=1, duration_min=20),
        ],
    )
    print(json.dumps(evaluate(demo).to_dict(), ensure_ascii=False, indent=2))
