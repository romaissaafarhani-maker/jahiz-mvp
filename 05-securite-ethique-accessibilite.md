# 05 — Sécurité, éthique et accessibilité (exigences non négociables)

## 1. Données exclusivement synthétiques

| Règle | Mise en œuvre technique |
| --- | --- |
| Aucune donnée réelle dans le MVP | Tous les fixtures portent `estSynthetique: true` et un identifiant `SYNTH-*`. Les environnements de démo n'ont **pas** de connexion à un système d'agence réel. |
| Contrôle automatique | Test CI : échec si un fichier `examples/**` ou `tests/**` contient `estSynthetique` absent/faux, ou un numéro de téléphone `+2126…` non réservé à la doc. |
| Watermark visible | Chaque écran de démonstration affiche un discret `DÉMO · DONNÉES SYNTHÉTIQUES`. |
| Vocaux | Les enregistrements d'exemple sont générés par synthèse vocale ; aucun enregistrement de pèlerin n'est conservé. |
| Agrégats | Les indicateurs qualité sont anonymes et publiés seulement au-delà d'un seuil de k anonymat (k = 5). |

Exemple de garde-fou CI (à intégrer) :

```python
def test_fixtures_are_synthetic():
    data = json.load(open("examples/synthetic_pilgrim.json", encoding="utf-8"))
    assert data["generator"]["synthetic"] is True
    assert data["pilgrim"]["estSynthetique"] is True
    assert data["pilgrim"]["id"].startswith("SYNTH-")
```

## 2. Pas de diagnostic ni de prescription par l'IA

**Rôle du système** : mesurer, comparer à des seuils convenus, **proposer** et
**alerter**. **Rôle humain** : décider.

| Mécanisme | Détail |
| --- | --- |
| Vocabulaire | Messages FORMULÉS en « proposition », « à valider », « veuillez consulter l'encadrant ». Mots interdits dans les sorties : `diagnostic`, `vous souffrez`, `عندك`, `مرضك`, `prescription`, `وصف طبي`. |
| Validation | `Decision.needs_human_validation = true` pour `R1`, `R3`, `R4`, `R6`, `CONFIRM`. Aucune ligne `HumanValidation` → aucune modification de charge appliquée. |
| Objectif | `Cycle.objectif6MWT` est saisi par l'encadrant ; l'IA ne fixe pas la cible. |
| Tests fonctionnels | Les 5 tests sont réalisés par un professionnel ; la plateforme ne fait que les enregistrer et afficher leur évolution. |
| Garde-fou NLP | Le LLM ne produit qu'un JSON validé par schéma ; il ne rédige aucun conseil médical libre. |
| Responsabilité | Chaque écran clinique porte la mention « القرار للمختص / la décision revient au professionnel ». |

## 3. Critères de stop immédiat (`S0`)

| Critère | Code | Expression Darija typique | Comportement |
| --- | --- | --- | --- |
| Douleur / pression thoracique | `chest_pain` | « ضغط فالصدر », « ألم فالصدر » | Arrêt immédiat, appel encadrant + kiné + médecin |
| Vertige / évanouissement | `vertigo` | « دوخة », « راسي كيدور », « غميت » | Idem |
| Essoufflement inhabituel | `unusual_dyspnea` | « ضيق نفس », « ما كنتنفسش مزيان » | Idem |
| Douleur articulaire aiguë | `acute_joint_pain` | « ألم حاد فمفصل », « ركبتي كيوجعني بزاف » | Idem |

Propriétés vérifiées par les tests :

- `S0` est **évalué en premier** et court-circuite toutes les autres règles ;
- un drapeau est détecté même s'il est saisi vocalement avec une faible confiance ;
- un drapeau sur une séance `SUSPENDED` n'est pas masqué ;
- la reprise n'est jamais automatique : elle exige une validation `KINE` ou `MEDECIN`.

## 4. Design centré sur les personnes âgées

| Exigence | Check-list MVP |
| --- | --- |
| Cibles | Boutons ≥ 56 × 56 dp, espacement ≥ 12 dp, zone d'erreur généreuse |
| Texte | Corps ≥ 18 sp, titres ≥ 24 sp, phrases courtes, une idée par ligne |
| Contraste | ≥ 7:1 texte/fond, ≥ 4.5:1 icônes ; jamais de rouge pur sur blanc pour du petit texte |
| Multimodal | Icône **+ texte** **+ voix** ; aucune information portée par la couleur seule |
| Langue | Darija par défaut, arabe standard et français en bascule ; chiffres latins pour les mesures |
| Navigation | Une action principale par écran, pas de menu profond, retour toujours évident |
| Feedback | Vibration + voix + texte à chaque validation ; minuteur visibly large |
| Erreur | « ما فهمتش، قولها مرة أخرى » + bouton réessayer + repli aidant/téléphone |
| Stress | Bouton STOP rouge permanent pendant la séance, sans confirmation en deux temps |
| Connectivité | Mode hors-ligne : file locale, sync différée, indicateur discret ; WhatsApp en repli |

## 5. Confidentialité et audit

- **Consentement versionné** par portée (`SUIVI_SEANCE`, `TRAITEMENT_VOCAL`,
  `ALERTE_ENCADRANT`, `STATISTIQUES_ANONYMES`) ; retrait = arrêt immédiat du
  traitement vocal et des rappels.
- **Minimisation** : ni diagnostic, ni traitement, ni tension, ni poids ; seules
  les mesures fonctionnelles et les déclarations de ressenti sont stockées.
- **Journal immuable** `AuditEvent` : qui a consulté/modifié quoi, quand, avec
  `traceId`. Les décisions et leurs traces sont conservées telles quelles.
- **Chiffrement** au repos (PostgreSQL) et en transit (TLS 1.2+) ; les clés ne
  sont jamais dans le dépôt.
- **Droits** : consultation, export et suppression des données de la personne
  concernée (via l'aidant si délégation explicite).

## 6. Analyse de risques simplifiée

| Risque | Mitigation |
| --- | --- |
| Fausse alerte douleur | Confirmation par question de clarification ; fausse alerte acceptable face au risque manqué (asymétrie assumée) |
| Alerte manquée (faux négatif sur drapeau) | Lexique de drapeaux prioritaire, cases à cocher obligatoires en I4/I5/I8, rappel de l'encadrant |
| Progression dangereuse par erreur NLP | `confirmed` + confiance ≥ 0,65, validation encadrant, plafond de volume |
| Confusion fatigue / douleur | Champs séparés, question de clarification dédiée, aucune inférence NRS depuis « تعب » |
| Réseau indisponible aux Mashâ'ir | File locale + SMS/WhatsApp en repli + déclaration par le guide |
| Mauvaise interprétation du seuil R6 | Affichage « بانتظار قرار المؤطر », jamais « apte » automatiquement |
| Fuite de données réelles | Jeux synthétiques, contrôle CI, pas de connexion production dans le prototype |

## 7. Critères d'acceptation du MVP

- [x] Les 6 règles métier sont implémentées, avec un garde-fou `S0` non contournable.
- [x] Chaque décision est explicable (règle, version, preuves, FR/AR) et tracée.
- [x] Les seuils sont modifiables sans toucher au code.
- [x] 28 tests automatiques passent, y compris les cas limites et les conflits de règles.
- [x] Les 8 interfaces ont une action principale unique et une règle associée.
- [x] L'exemple Darija produit un indicateur structuré avec provenance, ambiguïté et question de suivi.
- [x] Aucun texte généré ne contient de diagnostic ou de prescription.
- [x] Le design senior (taille, contraste, icône + texte, voix, RTL) est spécifié pour les 8 écrans.
- [ ] Test utilisateur encadré avec un prototype haute fidélité (phase suivante).
- [ ] Annotation humaine du jeu de test Darija (phase suivante).
