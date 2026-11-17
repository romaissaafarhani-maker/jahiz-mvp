"""Adaptateur Darija déterministe pour la démo web.

Version simplifiée et sans dépendance du pipeline décrit dans
docs/04-darija-nlp.md. Il ne décide jamais : il produit des indicateurs
structurés avec provenance et ambiguïtés, puis le moteur de règles tranche.
Toutes les phrases d'exemple sont synthétiques.
"""

from __future__ import annotations

import re
from typing import Any

RPE_BANDS: list[tuple[list[str], int, str, float, str]] = [
    (["ما كاين حتى تعب", "تعب خفيف", "تعب قليل", "مرتاح"], 2, "FAIBLE", 0.82, "légère"),
    (["تعب متوسط", "تعب عادي", "كيهضريني شوية"], 5, "MODERE", 0.78, "modérée"),
    (["تعب كبير", "تعبت بزاف", "كاين تعب قوي", "صعب"], 7, "ELEVE", 0.72, "importante"),
    (["ما قدرتش", "تعبت بزاف بزاف", "وصلت للحد"], 9, "TRES_ELEVE", 0.70, "très forte"),
]

PAIN_PATTERNS = ["ألم", "وجع", "كيوجعني", "حسيت بوجع", "ألم مستمر"]
PAIN_INTENSITY = [
    (["حاد", "ما كدرتش"], 9),
    (["بزاف"], 7),
    (["متوسط"], 4),
    (["شوي", "قليل"], 2),
]

RED_FLAGS: dict[str, list[str]] = {
    "chest_pain": ["ضغط فالصدر", "ألم فالصدر", "صدري كيوجعني", "حسيت بضغط فالصدر"],
    "vertigo": ["دوخة", "راسي كيدور", "غميت", "دخت"],
    "unusual_dyspnea": ["ضيق نفس", "ما كنتنفسش مزيان", "نفسي قصير", "التنفس صعيب عليا"],
    "acute_joint_pain": ["ألم حاد فمفصل", "ركبتي كيوجعني بزاف", "ألم حاد فالركبة"],
}

BODY_SITES: dict[str, list[str]] = {
    "LEGS": ["فالرجلين", "الرجلين", "الساقين", "فالساقين"],
    "CHEST": ["فالصدر", "الصدر", "صدري"],
    "JOINTS": ["المفاصل", "ركبتي", "فالركبة"],
    "HEAD": ["راسي", "الراس"],
}

TODAY_PATTERNS = ["اليوم", "النهار", "هذا النهار"]
HELP_PATTERNS = ["كاين مساعدة", "حتاج المؤطر", "ما قدرتش نمشي"]


def _first_match(text: str, patterns: list[str]) -> tuple[str, int] | None:
    for pattern in patterns:
        index = text.find(pattern)
        if index >= 0:
            return pattern, index
    return None


def parse_darija(raw_text: str, asr_confidence: float = 0.93) -> dict[str, Any]:
    """Transforme une phrase Darija en indicateurs structurés (synthétiques)."""
    text = re.sub(r"\s+", " ", raw_text or "").strip()
    provenance: list[dict[str, Any]] = []

    rpe_value = None
    rpe_band = None
    rpe_confidence = None
    rpe_label_fr = None
    for patterns, value, band, confidence, label in RPE_BANDS:
        match = _first_match(text, patterns)
        if match:
            token, index = match
            rpe_value, rpe_band, rpe_confidence, rpe_label_fr = value, band, confidence, label
            provenance.append(
                {
                    "span": [index, index + len(token) - 1],
                    "text": token,
                    "maps_to": "rpe",
                }
            )
            break

    pain_match = _first_match(text, PAIN_PATTERNS)
    nrs_value = None
    nrs_reason: str | None = None
    if pain_match:
        token, index = pain_match
        provenance.append(
            {"span": [index, index + len(token) - 1], "text": token, "maps_to": "nrs"}
        )
        nrs_value = 4
        for patterns, intensity in PAIN_INTENSITY:
            if _first_match(text, patterns):
                nrs_value = intensity
                break
    else:
        nrs_reason = "تعب = fatigue ; aucun lexème de douleur (ألم / وجع) détecté"

    red_flags: list[str] = []
    for code, patterns in RED_FLAGS.items():
        match = _first_match(text, patterns)
        if match:
            token, index = match
            red_flags.append(code)
            provenance.append(
                {"span": [index, index + len(token) - 1], "text": token, "maps_to": "red_flags"}
            )

    body_sites: list[dict[str, Any]] = []
    for site, patterns in BODY_SITES.items():
        match = _first_match(text, patterns)
        if match:
            token, index = match
            body_sites.append(
                {
                    "value": site,
                    "label_darija": token,
                    "confidence": 0.88,
                    "span": [index, index + len(token) - 1],
                }
            )
            provenance.append(
                {"span": [index, index + len(token) - 1], "text": token, "maps_to": "body_site"}
            )

    today = _first_match(text, TODAY_PATTERNS)
    if today:
        token, index = today
        provenance.append(
            {"span": [index, index + len(token) - 1], "text": token, "maps_to": "temporal"}
        )

    if red_flags:
        state = "NEED_HELP"
    elif _first_match(text, HELP_PATTERNS):
        state = "NEED_HELP"
    elif rpe_value is not None or nrs_value is not None:
        state = "FATIGUED"
    else:
        state = "BIEN"

    if rpe_label_fr:
        french = f"J'ai ressenti une fatigue {rpe_label_fr} aujourd'hui."
    elif nrs_value is not None:
        french = "J'ai ressenti une douleur."
    elif red_flags:
        french = "J'ai ressenti un symptôme nécessitant un arrêt immédiat."
    else:
        french = "J'ai déclaré mon état du jour."
    if body_sites:
        labels = {"LEGS": "dans les jambes", "CHEST": "dans la poitrine", "JOINTS": "au niveau des articulations", "HEAD": "au niveau de la tête"}
        french += " Siège : " + ", ".join(labels.get(s["value"], s["value"]) for s in body_sites) + "."

    follow_ups: list[dict[str, str]] = []
    if nrs_value is None and not red_flags:
        follow_ups.append(
            {
                "darija": "واش كاين ألم ولا وجع؟",
                "fr": "Y a-t-il une douleur ?",
                "maps_to": "nrs",
            }
        )
    if not red_flags:
        follow_ups.append(
            {
                "darija": "واش حسّيتي بضغط فالصدر ولا دوخة؟",
                "fr": "Avez-vous eu une douleur thoracique ou un vertige ?",
                "maps_to": "red_flags",
            }
        )

    return {
        "input": {
            "raw_text": raw_text,
            "modality": "VOICE_DARIJA",
            "language": "ary-MA",
            "asr_confidence": asr_confidence,
            "synthetic": True,
        },
        "normalization": {"arabic": text, "french": french},
        "indicators": {
            "intent": "ARRETER_SEANCE" if red_flags else "DECLARER_ETAT",
            "state": {"value": state, "confidence": 0.86},
            "rpe": (
                None
                if rpe_value is None
                else {
                    "value": rpe_value,
                    "scale": "0-10",
                    "band": rpe_band,
                    "confidence": rpe_confidence,
                    "source_span": provenance[0]["span"],
                    "confirmed_by_user": False,
                }
            ),
            "nrs": {"value": nrs_value, "confidence": 0.80 if nrs_value else None, "reason": nrs_reason},
            "body_site": [
                {
                    "value": s["value"],
                    "label_darija": s["label_darija"],
                    "confidence": s["confidence"],
                    "source_span": s["span"],
                }
                for s in body_sites
            ],
            "temporal": {"value": "TODAY" if today else "UNKNOWN"},
            "red_flags": red_flags,
        },
        "provenance": provenance,
        "ambiguities": [
            "Le ressenti est subjectif : la valeur RPE est une estimation, pas une mesure.",
            "La fatigue des jambes peut être musculaire ou articulaire ; le type n'est pas précisé.",
        ]
        if rpe_value is not None
        else [],
        "follow_up_questions": follow_ups,
    }
