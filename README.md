# جاهز — Jahiz | MVP

Prototype web **statique** de préparation fonctionnelle au Hajj pour des pèlerins âgés.
Démonstration pédagogique : **toutes les données sont synthétiques** (`SYNTH-*`),
aucun diagnostic n'est produit, aucune charge n'est augmentée automatiquement.
**La plateforme propose et alerte ; l'humain décide.**

---

## 1. Démarrage

Prérequis : Node.js 20+.

```powershell
npm install
npm run dev          # http://127.0.0.1:5173
npm test             # suite Vitest
npm run test:coverage
npm run build        # génère dist/
npm run preview      # prévisualise dist/
```

Suite actuelle : **97 tests verts** — 33 moteur, 50 IA, 14 interface.
Couverture `src/engine` + `src/ai` : **100 % des lignes**, branches > 90 %.

L'ancienne démonstration Python (`web/app.py`, `src/rules_engine.py`, `config/rules.json`)
est conservée comme référence historique. Elle n'est pas nécessaire à l'application React.

---

## 2. Ce qui est livré

| Élément | Emplacement |
| --- | --- |
| 8 écrans pèlerin/encadrant | `src/pages/` + routes dans `src/App.tsx` |
| Espace Jury (matrice, règles, scénario, model card, journal, limites) | `src/pages/Jury.tsx` — route `/jury` |
| Moteur déterministe S0 + R1–R6 | `src/engine/` |
| IA locale niveaux 0, 1 et 2 | `src/ai/` |
| Seuils — source de vérité unique | `src/config/thresholds.json` |
| Jeu de 40 phrases synthétiques | `src/ai/phrases.ts` |
| Données de démonstration `SYNTH-*` | `src/data/seed.ts` |
| État, journal IA, rôles | `src/store/useAppStore.ts` |
| Traductions AR (RTL par défaut) / FR | `src/i18n/` |
| Tests | `tests/` |

Les 8 écrans : accueil/consentement, T0, programme 14 jours, séance du jour,
effort et douleur, progression, tableau encadrant, suivi quotidien.
Chaque écran porte un badge « Règle servie » et une seule action principale.

---

## 3. Moteur de règles

Ordre de priorité absolu, identique dans le code et dans l'espace Jury :

```
S0 > R4 > R5 > R3 > R1 > R2 > R6
```

- **S0** : critère d'arrêt immédiat. Évalué avant tout, non contournable, levée réservée à un humain.
- **R1** : 2 séances à RPE ≤ 4 → **proposition** de +10 % avec validation humaine obligatoire.
- **R2** : RPE 5–6 → maintien de la charge.
- **R3** : 2 séances à RPE ≥ 7 → allègement automatique de 15 % (sens sûr).
- **R4** : NRS ≥ 4 → suspension de l'exercice concerné et alerte.
- **R5** : J+2 rappel, J+3 appel encadrant, au-delà proposition de reprise.
- **R6** : gain 6MWT et objectif atteints → fin de programme proposée, validation requise.

Aucun chiffre n'est codé en dur dans le moteur : `src/config/thresholds.json` porte
chaque seuil avec un statut `A_VALIDER_*` ou `PLACEHOLDER_*`. L'espace Jury affiche
ces statuts sans jamais les présenter comme validés.

---

## 4. IA — niveaux 0 à 2

| Niveau | Contenu | Garde-fou |
| --- | --- | --- |
| 0 | Moteur déterministe explicable | Aucune décision médicale |
| 1 | Parseur local AR / Darija / FR (`parserPhrase`) | Signaux proposés, **confirmation obligatoire** dans l'écran 5 ; escalade en cas de doute |
| 2 | Priorisation pondérée expliquée (`prioriser`) | Score affiché, priorité de sécurité inchangée, l'humain décide |
| 3–4 | Perspectives uniquement | Non implémenté, nécessite validation réglementaire |

Métriques affichées dans `/jury` : 40 phrases `SYNTH-PH-01` à `SYNTH-PH-40`,
**100 % de rappel** sur les 16 phrases de danger, aucun appel réseau pendant l'analyse,
confiance et poids lus depuis `thresholds.json`.

Le journal IA enregistre `DEMANDE`, `ACCEPTE` et `REJETE`, avec horodatage et
version du niveau (messages `SYNTH-AI-*`).

---

## 5. Accessibilité senior et conformité

- ArabeRTL par défaut, bascule FR/AR, `lang` et `dir` appliqués au `<html>`.
- Texte de base 20 px, boutons ≥ 56 px, icône **et** libellé, mode grand texte +25 %.
- Contrôles de focus visibles, lien d'évitement clavier, `aria-live`, `aria-pressed`,
  libellés explicites, `prefers-reduced-motion` respecté.
- Mobile-first dès 360 px, bleu nuit `#0B1F3A`, or `#B88A4A`, crème `#F6F3EC`.
- Bandeau permanent « Données fictives — prototype pédagogique ».
- Loi 09-08 : consentement explicite à l'écran 1, finalité limitée au suivi de séances,
  identifiants fictifs, vues de groupe pseudonymisées, rôles (guide = statut et alertes
  uniquement), journal des traitements IA.

---

## 6. Partage — hébergement statique

L'application ne nécessite ni serveur ni base de données. Le build produit `dist/`.

### Netlify

1. Pousser le dépôt sur GitHub.
2. « Add new site → Import an existing project ».
3. Build command : `npm run build` — Publish directory : `dist`.
4. Le fichier `netlify.toml` (et `public/_redirects`) gère les redirections SPA.

### Vercel

1. Importer le dépôt GitHub.
2. Framework : Vite ; Build command : `npm run build` ; Output directory : `dist`.
3. `vercel.json` réécrit les routes vers `/index.html`.

### Cloudflare Pages

1. « Create a project → Connect to Git ».
2. Build command : `npm run build` ; Build output : `dist`.
3. Ajouter une règle de redirection `/* → /index.html` (status 200) pour React Router.

Une fois l'URL générée, elle est partageable telle quelle ; l'espace Jury est accessible
via `/jury`. Aucune donnée saisie n'est envoyée à un serveur : tout reste dans le
navigateur pendant la démonstration.

---

## 7. Limites

- Prototype pédagogique : **aucune utilisation clinique réelle**.
- Tous les seuils sont à valider par le médecin référent et le spécialiste.
- Le score IA est une aide à la priorisation, pas une recommandation médicale.
- La dictée utilise la Web Speech API du navigateur avec repli texte ; la disponibilité
  dépend du navigateur et de la langue du système.
- Le message de suivi Whatsapp est à copier manuellement : aucun envoi automatique.
- Les polices Google sont les seules ressources externes référencées ; le moteur et
  l'analyse IA fonctionnent hors ligne après chargement de l'application.
