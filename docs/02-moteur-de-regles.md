# 02 — Spécification technique du moteur de règles (niveau 0)

Source de vérité exécutable : [`config/rules.json`](../config/rules.json).
Implémentation de référence : [`src/rules_engine.py`](../src/rules_engine.py).
Tests : [`tests/test_rules_engine.py`](../tests/test_rules_engine.py) — **28 tests verts**.

## 1. Vue d'ensemble

| Propriété | Réalisation |
| --- | --- |
| Explicable | Chaque décision contient `ruleId`, `ruleVersion`, `preuves`, `explication {fr, ar}` et la `trace` complète des règles évaluées |
| Paramétrable | Aucun seuil codé en dur : tout est dans `config/rules.json` (seuils, pourcentages, SLA, messages, activation) |
| Testable | Fonction pure `evaluate(ctx, config) → EngineResult` ; aucune I/O ; testable en 28 cas dont les valeurs limites |
| Sûr | Règle garde-fou `S0` exécutée en premier et non contournable ; priorité stricte ; confirmation obligatoire pour les sorties vocales non vérifiées |
| Humain | `needs_human_validation = true` sur toute proposition de charge et sur la décision d'aptitude |

## 2. Registre des règles

| Ordre | Code | Condition | Action émise | Validation humaine |
| --- | --- | --- | --- | --- |
| 0 | `S0` | Présence d'au moins un drapeau `chest_pain`, `vertigo`, `unusual_dyspnea`, `acute_joint_pain` | `SUSPENDRE_IMMEDIATEMENT` + alerte CRITIQUE | Non (exécution immédiate), reprise **uniquement humaine** |
| 1 | `R4` | `NRS ≥ 4` sur le signal de douleur le plus fort | `ALERTER_KINE_MEDECIN` + suspension + SLA 5 min | Oui (le clinicien décide de la suite) |
| 2 | `R5` | `inactivity_days ≥ 2` → rappel ; `≥ 3` → appel | `RAPPEL_AUTOMATIQUE` (WhatsApp) / `APPEL_ENCADRANT` | Non pour le rappel, appel par l'humain |
| 3 | `R3` | 2 dernières séances `RPE ≥ 7`, sans drapeau ni douleur ≥ 4 | `PROPOSER_ALLEGEMENT` (−15 %) + notification encadrant | **Oui** |
| 4 | `R1` | 2 dernières séances `RPE ≤ 4` et `NRS < 4` | `PROPOSER_AUGMENTATION_DUREE` (+10 %) | **Oui** |
| 5 | `R2` | Dernier `RPE ∈ [5, 6]` | `MAINTENIR_CHARGE` | Non (aucune modification) |
| 6 | `R6` | Au point `T1` : `6MWT_T1 > 6MWT_T0` **et** `≥ objectif` | `VALIDER_PROGRAMME`, sinon `PROPOSER_SECOND_CYCLE` | **Oui** |
| 7 | `CONFIRM` | Sortie vocale **non confirmée par un appui** OU confiance < 0,65 (filet de sécurité après R2) | `DEMANDER_CONFIRMATION` | Oui |

### Politique de conflit

`PREMIERE_REGLE_TERMINANTE_PAR_PRIORITE` : on évalue dans l'ordre
`S0 > R4 > R5 > R3 > R1 > R2 > CONFIRM > R6`, on s'arrête au premier
déclenchement. Conséquences explicites :

- `S0` > `R4` : une douleur thoracique avec NRS 5 donne **stop immédiat**, pas seulement une alerte douleur.
- `R4` > `R1` : deux séances faciles mais une douleur à 5 donnent alerte, pas progression.
- `R5` > `R3` : si le pèlerin a arrêté 3 jours, l'appel prime sur l'allègement.
- `R6` n'est évaluée qu'au point de contrôle T1 (`t1_due = true`) : elle ne pollue pas les décisions quotidiennes.

## 3. Configuration lisible (équivalent YAML de `rules.json`)

```yaml
engine:
  version: "1.0.0"
  timezone: "Africa/Casablanca"
  evaluation_order: [S0, R4, R5, R3, R1, R2, CONFIRM, R6]
  conflict_policy: PREMIERE_REGLE_TERMINANTE_PAR_PRIORITE
  voice_source_code: VOICE_DARIJA
  min_voice_confidence_for_load_change: 0.65

thresholds:
  rpe_low_max: 4          # R1
  rpe_mid_min: 5          # R2
  rpe_mid_max: 6          # R2
  rpe_high_min: 7         # R3
  nrs_alert_min: 4        # R4
  consecutive_sessions: 2 # R1, R3
  progression_pct: 10     # R1
  regression_pct: 15      # R3
  inactivity_reminder_days: 2  # R5
  inactivity_call_days: 3      # R5
  pain_alert_sla_minutes: 5    # R4

red_flags: [chest_pain, vertigo, unusual_dyspnea, acute_joint_pain]

rules:
  S0: { priority: 0, terminates: true, human_validation: false }
  R4: { priority: 1, terminates: true, human_validation: true  }
  R5: { priority: 2, terminates: true, human_validation: false }
  R3: { priority: 3, terminates: true, human_validation: true  }
  R1: { priority: 4, terminates: true, human_validation: true  }
  R2: { priority: 5, terminates: true, human_validation: false }
  R6: { priority: 6, terminates: true, human_validation: true  }
```

> Modifier un seuil se fait dans `config/rules.json` puis en incrémentant
> `engine.version` : chaque décision conserve la version avec laquelle elle a
> été produite, ce qui rend l'historique auditable.

## 4. Pseudo-code

```text
FONCTION evaluer(contexte, configuration) -> Resultat:
    trace <- []
    POUR CHAQUE ruleId DANS configuration.engine.evaluation_order:
        regle <- configuration.rules[ruleId]
        SI regle.active est faux:
            trace.ajouter({ruleId, evaluee: faux, raison: "DESACTIVEE"})
            CONTINUER

        candidat <- EVALUATEURS[ruleId](contexte, configuration, regle)

        SI candidat est null:
            trace.ajouter({ruleId, evaluee: vrai, declenchee: faux,
                           raison: "CONDITIONS_NON_REMPLIES"})
            CONTINUER

        trace.ajouter({ruleId, evaluee: vrai, declenchee: vrai,
                       action: candidat.action, raison: candidat.explication})
        candidat.trace <- copie(trace)
        candidat.version <- configuration.engine.version
        candidat.validation_humaine <- regle.human_validation
        RETOURNER Resultat(candidat, trace)

    RETOURNER Resultat(decision_sans_action("AUCUNE_ACTION"), trace)


FONCTION eval_R1(contexte, configuration, regle):
    n <- configuration.thresholds.consecutive_sessions
    derniere <- ses dernieres seances TERMINEES (triées par date DESC), prendre n
    SI moins de n seances OU RPE manquant: RETOURNER null
    SI toutes(seance.RPE <= 4) ET toutes(seance.NRS absent ou < 4):
        SI une seance vient de la voix ET (NON confirmee OU confiance < 0.65):
            RETOURNER decision(DEMANDER_CONFIRMATION)   # sécurité
        reference <- duree de la premiere seance disposant d'une duree
        proposee <- arrondi(reference * 1.10)
        RETOURNER decision(PROPOSER_AUGMENTATION_DUREE,
                           chargeUtile = {pourcentage: 10,
                                          duree_reference: reference,
                                          duree_proposee: proposee},
                           preuves = [IDs des 2 seances],
                           explication = template FR/AR avec RPE, n, pct)
    RETOURNER null

# R3 identique avec RPE >= 7 et facteur 0.85 (allègement).
# R4 retient la DOULEUR LA PLUS FORTE (pas seulement la plus récente).
# S0 lit TOUS les signaux, y compris les séances suspendues.
# R6 compare T0/T1 et n'opère qu'au point T1.
```

## 5. Exemple de décision produite

Deux séances à `RPE = 4`, `NRS = 1`, durée 20 min (données synthétiques) :

```json
{
  "rule_id": "R1",
  "rule_version": "1.0.0",
  "action": "PROPOSER_AUGMENTATION_DUREE",
  "severity": "INFO",
  "payload": {
    "rpe": 4,
    "seuil": 4,
    "sessions_consecutives": 2,
    "pourcentage": 10,
    "duree_reference_min": 20,
    "duree_proposee_min": 22,
    "validation_encadrant_requise": true
  },
  "explanation": {
    "fr": "RPE 4/10 ≤ 4 sur 2 séances sans douleur : proposition d'augmentation de 10% de la durée (validation encadrant requise).",
    "ar": "مجهود مُدرك 4/10 ≤ 4 في 2 حصص دون ألم: اقتراح زيادة مدة المشي بـ 10% (بموافقة المؤطر)."
  },
  "status": "PROPOSITION_EN_ATTENTE",
  "needs_human_validation": true,
  "evaluation_trace": [
    { "rule_id": "S0", "matched": false, "reason": "CONDITIONS_NON_REMPLIES" },
    { "rule_id": "R4", "matched": false, "reason": "CONDITIONS_NON_REMPLIES" },
    { "rule_id": "R5", "matched": false, "reason": "CONDITIONS_NON_REMPLIES" },
    { "rule_id": "R3", "matched": false, "reason": "CONDITIONS_NON_REMPLIES" },
    { "rule_id": "R1", "matched": true, "action": "PROPOSER_AUGMENTATION_DUREE" }
  ]
}
```

## 6. Planificateur R5 (découplé de l'ouverture de l'app)

Le moteur ne devine pas l'absence : un job quotidien à 07h00
(`Africa/Casablanca`) calcule `inactivity_days = aujourd'hui - dernière date
avec séance OU check-in` et appelle `evaluate()` avec ce contexte.

```text
JOUR SANS ACTIVITÉ = 0 ou 1 → aucune-action
JOUR SANS ACTIVITÉ = 2      → RAPPEL_AUTOMATIQUE (WhatsApp + push aidant)
JOUR SANS ACTIVITÉ = 3      → APPEL_ENCADRANT (tâche dans son tableau de bord + SMS)
JOUR SANS ACTIVITÉ >= 4     → escalade vers le responsable qualité (hors MVP, prévu v2)
```

Le message de rappel est court, en Darija, avec un bouton unique :
« ألحاج أحمد، واش كاين شي حصة اليوم؟ أضغط هنا ◀️ ».

## 7. Matrice de tests automatiques

| Famille | Cas couverts |
| --- | --- |
| `S0` | drapeau thoracique prioritaire ; drapeau depuis check-in vocal non confirmé ; drapeau sur séance `SUSPENDED` non masqué |
| `R4` | NRS 5 → alerte ; priorité sur R1 ; NRS maximal retenu plutôt que le plus récent ; frontière NRS 3 sans alerte |
| `R5` | J2 rappel WhatsApp ; J3 appel ; J1 silencieux ; priorité sur R3 |
| `R3` | deux RPE ≥ 7 → −15 % (20 → 17 min) ; un seul RPE 7 insuffisant |
| `R1` | deux RPE ≤ 4 sans douleur → +10 % (20 → 22 min) ; RPE mitigé → pas de progression |
| `R2` | RPE 5 et RPE 6 → maintien |
| `R6` | amélioration + objectif → validation ; stagnation → second cycle ; amélioration sous objectif → second cycle ; données manquantes signalées |
| Voix | sortie vocale non confirmée → `DEMANDER_CONFIRMATION` ; sortie confirmée → règle applicable |
| Génie logiciel | paramètre modifié appliqué ; version figée dans la décision ; trace complète ; contexte vide = `AUCUNE_ACTION` |

## 8. Limites assumées

- Le moteur ne calcule pas de V̇O₂max, ne prescrit pas de durée « médicale » et
  ne remplace pas une échelle de Borg validée par un professionnel : il travaille
  sur un RPE simplifié 0–10 renseigné ou confirmé par l'humain.
- La progression de 10 % est une **proposition** plafonnée par le volume maxi
  validé par l'encadrant dans `Cycle` (contrôle applicatif en API, hors moteur).
- En cas de `S0`, la reprise n'est jamais automatique : elle passe par une
  `HumanValidation` de rôle `KINE` ou `MEDECIN`.
