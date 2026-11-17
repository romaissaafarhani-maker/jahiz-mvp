"""Tests automatiques du moteur de règles Jahiz (niveau 0).

Exécution :  python -m unittest discover -s tests -v
Toutes les données utilisées ici sont SYNTHÉTIQUES (préfixe SYNTH-).
"""

from __future__ import annotations

import copy
import unittest
from datetime import date, timedelta

from src.rules_engine import (
    Assessment,
    CheckIn,
    Context,
    Session,
    evaluate,
    load_config,
)

TODAY = date(2026, 11, 17)


def ctx(**overrides):
    params = {"pilgrim_id": "SYNTH-001", "today": TODAY}
    params.update(overrides)
    return Context(**params)


def sessions(*values, duration=20, source="MANUAL", confidence=1.0, confirmed=True, nrs=1):
    """Construit des séances consécutives ; values = listes (rpe, nrs) ou rpe."""
    result = []
    for index, value in enumerate(values):
        rpe, pain = value if isinstance(value, tuple) else (value, nrs)
        result.append(
            Session(
                id=f"S-{len(values) - index:03d}",
                date=TODAY - timedelta(days=len(values) - 1 - index),
                rpe=rpe,
                nrs=pain,
                duration_min=duration,
                source=source,
                confidence=confidence,
                confirmed=confirmed,
            )
        )
    return result


class RuleEngineTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config()

    def decision(self, context, config=None):
        return evaluate(context, config or self.config).decision

    # ------------------------------------------------------------------ S0 --
    def test_s0_chest_pain_overrides_everything(self):
        context = ctx(
            sessions=sessions((4, 1), (9, 6)) + [],
            red_flags=("chest_pain",),
        )
        decision = self.decision(context)
        self.assertEqual(decision.rule_id, "S0")
        self.assertEqual(decision.action, "SUSPENDRE_IMMEDIATEMENT")
        self.assertEqual(decision.severity, "CRITICAL")
        self.assertIn("chest_pain", decision.payload["drapeaux"])
        self.assertEqual(decision.payload["reprise"], "DECISION_HUMAINE_UNIQUEMENT")

    def test_s0_detected_from_daily_checkin(self):
        checkin = CheckIn(
            date=TODAY,
            state="NEED_HELP",
            red_flags=("vertigo",),
            source="VOICE_DARIJA",
            confidence=0.4,
            confirmed=False,
        )
        decision = self.decision(ctx(checkins=[checkin]))
        self.assertEqual(decision.rule_id, "S0")
        self.assertIn("vertigo", decision.payload["drapeaux"])

    def test_s0_not_masked_by_suspended_status(self):
        flagged = Session(
            "S-X", TODAY, rpe=9, nrs=8,
            red_flags=("unusual_dyspnea",), status="SUSPENDED",
        )
        self.assertEqual(self.decision(ctx(sessions=[flagged])).rule_id, "S0")

    # ------------------------------------------------------------------ R4 --
    def test_r4_pain_suspends_and_alerts(self):
        decision = self.decision(ctx(sessions=sessions((5, 5))))
        self.assertEqual(decision.rule_id, "R4")
        self.assertEqual(decision.action, "ALERTER_KINE_MEDECIN")
        self.assertTrue(decision.payload["suspendre_exercice"])
        self.assertEqual(decision.payload["delai_min"], 5)
        self.assertTrue(decision.needs_human_validation)

    def test_r4_wins_over_r1_progression(self):
        decision = self.decision(ctx(sessions=sessions((4, 1), (4, 5))))
        self.assertEqual(decision.rule_id, "R4")

    def test_r4_uses_highest_pain_not_latest(self):
        context = ctx(
            sessions=sessions((5, 7), duration=20),
            checkins=[CheckIn(date=TODAY, nrs=0)],
        )
        self.assertEqual(self.decision(context).payload["nrs"], 7)

    def test_r4_boundary_nrs_3_is_not_an_alert(self):
        self.assertEqual(self.decision(ctx(sessions=sessions((5, 3)))).rule_id, "R2")

    # ------------------------------------------------------------------ R5 --
    def test_r5_day_two_whatsapp_reminder(self):
        decision = self.decision(ctx(inactivity_days=2))
        self.assertEqual(decision.rule_id, "R5")
        self.assertEqual(decision.action, "RAPPEL_AUTOMATIQUE")
        self.assertEqual(decision.payload["canal"], "WHATSAPP")

    def test_r5_day_three_encadrant_call(self):
        decision = self.decision(ctx(inactivity_days=3))
        self.assertEqual(decision.action, "APPEL_ENCADRANT")
        self.assertEqual(decision.payload["canal"], "APPEL_TELEPHONIQUE")

    def test_r5_before_one_day_is_silent(self):
        self.assertEqual(self.decision(ctx(inactivity_days=1)).action, "AUCUNE_ACTION")

    def test_r5_priority_over_r3(self):
        context = ctx(sessions=sessions(8, 8), inactivity_days=3)
        self.assertEqual(self.decision(context).rule_id, "R5")

    # ---------------------------------------------------------- R3 / R1/R2 --
    def test_r3_two_high_rpe_lightens_next_session(self):
        decision = self.decision(ctx(sessions=sessions(7, 8, duration=20)))
        self.assertEqual(decision.rule_id, "R3")
        self.assertEqual(decision.action, "PROPOSER_ALLEGEMENT")
        self.assertEqual(decision.payload["pourcentage"], 15)
        self.assertEqual(decision.payload["duree_proposee_min"], 17)
        self.assertTrue(decision.needs_human_validation)

    def test_r3_requires_two_consecutive_high_sessions(self):
        self.assertEqual(self.decision(ctx(sessions=sessions(7))).action, "AUCUNE_ACTION")

    def test_r1_two_low_rpe_without_pain_increases_duration(self):
        decision = self.decision(ctx(sessions=sessions(4, 4, duration=20)))
        self.assertEqual(decision.rule_id, "R1")
        self.assertEqual(decision.action, "PROPOSER_AUGMENTATION_DUREE")
        self.assertEqual(decision.payload["pourcentage"], 10)
        self.assertEqual(decision.payload["duree_proposee_min"], 22)
        self.assertTrue(decision.payload["sans_douleur"])

    def test_r2_mid_rpe_maintains_load(self):
        for rpe in (5, 6):
            with self.subTest(rpe=rpe):
                decision = self.decision(ctx(sessions=sessions(rpe)))
                self.assertEqual(decision.rule_id, "R2")
                self.assertEqual(decision.action, "MAINTENIR_CHARGE")
                self.assertFalse(decision.needs_human_validation)

    def test_r1_is_not_triggered_by_mixed_rpe_but_r2_maintains(self):
        # Le dernier RPE est 6 : R2 (maintien) s'applique, jamais R1.
        decision = self.decision(ctx(sessions=sessions(4, 6)))
        self.assertEqual(decision.rule_id, "R2")
        self.assertEqual(decision.action, "MAINTENIR_CHARGE")

    # ------------------------------------------------------------------ R6 --
    def test_r6_success_validates_program(self):
        context = ctx(
            goal_6mwt=400,
            t1_due=True,
            assessments=[
                Assessment("T0", 350, TODAY - timedelta(days=21)),
                Assessment("T1", 405, TODAY),
            ],
        )
        decision = self.decision(context)
        self.assertEqual(decision.rule_id, "R6")
        self.assertEqual(decision.action, "VALIDER_PROGRAMME")
        self.assertEqual(decision.payload["delta"], 55)
        self.assertTrue(decision.needs_human_validation)

    def test_r6_no_improvement_proposes_second_cycle(self):
        context = ctx(
            goal_6mwt=400,
            t1_due=True,
            assessments=[
                Assessment("T0", 350, TODAY - timedelta(days=21)),
                Assessment("T1", 350, TODAY),
            ],
        )
        self.assertEqual(self.decision(context).action, "PROPOSER_SECOND_CYCLE")

    def test_r6_improved_but_below_goal_proposes_second_cycle(self):
        context = ctx(
            goal_6mwt=400,
            t1_due=True,
            assessments=[
                Assessment("T0", 350, TODAY - timedelta(days=21)),
                Assessment("T1", 380, TODAY),
            ],
        )
        decision = self.decision(context)
        self.assertEqual(decision.action, "PROPOSER_SECOND_CYCLE")
        self.assertTrue(decision.payload["amelioration"])
        self.assertFalse(decision.payload["objectif_atteint"])

    def test_r6_missing_data_is_reported(self):
        context = ctx(
            assessments=[Assessment("T0", 350, TODAY)],
            goal_6mwt=400,
            t1_due=True,
        )
        self.assertEqual(self.decision(context).action, "DONNEES_INCOMPLETES")

    # -------------------------------------------------- Darija / traçabilité --
    def test_unconfirmed_voice_does_not_change_load(self):
        context = ctx(
            sessions=sessions(7, 7, source="VOICE_DARIJA", confidence=0.42, confirmed=False)
        )
        decision = self.decision(context)
        self.assertEqual(decision.rule_id, "CONFIRM")
        self.assertEqual(decision.action, "DEMANDER_CONFIRMATION")

    def test_high_confidence_but_unconfirmed_voice_still_needs_confirmation(self):
        context = ctx(
            sessions=sessions(7, 7, source="VOICE_DARIJA", confidence=0.95, confirmed=False)
        )
        self.assertEqual(self.decision(context).rule_id, "CONFIRM")

    def test_unconfirmed_voice_mixed_with_manual_session_is_confirmed(self):
        # Voix RPE 7 + séance manuelle RPE 4 : aucune règle de charge ne
        # déclenche, mais le filet CONFIRM doit demander validation du texte.
        voice = sessions(7, source="VOICE_DARIJA", confidence=0.72, confirmed=False)
        manual = sessions(4, source="MANUAL")
        self.assertEqual(
            self.decision(ctx(sessions=voice + manual)).rule_id,
            "CONFIRM",
        )

    def test_confirmed_voice_can_feed_r3(self):
        context = ctx(
            sessions=sessions(7, 7, source="VOICE_DARIJA", confidence=0.91, confirmed=True)
        )
        self.assertEqual(self.decision(context).rule_id, "R3")

    def test_confirmed_but_low_confidence_voice_needs_confirmation(self):
        context = ctx(
            sessions=sessions(7, 7, source="VOICE_DARIJA", confidence=0.40, confirmed=True)
        )
        self.assertEqual(self.decision(context).rule_id, "CONFIRM")

    def test_trace_contains_all_evaluated_rules(self):
        result = evaluate(ctx(sessions=sessions(4, 4)))
        evaluated = [entry["rule_id"] for entry in result.trace if entry.get("evaluated")]
        self.assertIn("S0", evaluated)
        self.assertIn("R4", evaluated)
        self.assertEqual(result.decision.rule_id, "R1")

    def test_config_parameter_change_is_applied(self):
        tuned = copy.deepcopy(self.config)
        tuned["thresholds"]["progression_pct"] = 5
        decision = self.decision(ctx(sessions=sessions(4, 4, duration=20)), tuned)
        self.assertEqual(decision.payload["pourcentage"], 5)
        self.assertEqual(decision.payload["duree_proposee_min"], 21)

    def test_config_version_is_stamped_on_decision(self):
        decision = self.decision(ctx(inactivity_days=2))
        self.assertEqual(decision.rule_version, self.config["engine"]["version"])

    def test_empty_context_is_noop(self):
        self.assertEqual(self.decision(ctx()).action, "AUCUNE_ACTION")


if __name__ == "__main__":
    unittest.main(verbosity=2)
