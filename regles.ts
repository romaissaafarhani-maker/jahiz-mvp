import { THRESHOLDS } from '../config';
import type { ContexteEvaluation, DecisionMoteur, Regle, SeanceInput } from './types';

const R = THRESHOLDS.regles;

function seancesCompletees(ctx: ContexteEvaluation): SeanceInput[] {
  return ctx.seances.filter((s) => s.completed && s.rpe !== null);
}

/** Les n dernières séances, du plus récent au plus ancien. */
function dernieres(ctx: ContexteEvaluation, n: number): SeanceInput[] {
  return seancesCompletees(ctx).slice(-n).reverse();
}

function joursDepuis(dateIso: string, aujourdHui: string): number {
  const a = Date.parse(`${aujourdHui}T00:00:00Z`);
  const b = Date.parse(`${dateIso}T00:00:00Z`);
  return Math.max(0, Math.round((a - b) / 86_400_000));
}

function base(ruleId: DecisionMoteur['ruleId'], severity: DecisionMoteur['severity']) {
  return (part: Omit<DecisionMoteur, 'auditTrail' | 'severity' | 'ruleId'> & { auditTrail?: string[] }): DecisionMoteur => ({
    ruleId, severity, ...part, auditTrail: part.auditTrail ?? [],
  });
}

/** R1 — Progression : proposer +10 %, JAMAIS automatique. */
export const evalR1: Regle = (ctx) => {
  const n = R.R1.seances_consecutives;
  const recentes = dernieres(ctx, n);
  if (recentes.length !== n) return null;
  // R1 ne juge que l'effort. La garantie « sans douleur » est assurée
  // globalement par la priorité de R4 : si une douleur ≥ seuil existe,
  // R4 gagne et R1 est bloquée par l'arbitrage (prompt §5.3).
  const ok = recentes.every((s) => s.rpe! <= R.R1.rpe_max);
  if (!ok) return null;
  return base('R1', 'INFO')({
    decision: 'PROPOSER_PROGRESSION',
    reason: {
      fr: `Sur ${n} séances consécutives, l'effort est ≤ ${R.R1.rpe_max}/10. Proposition d'augmentation de ${R.R1.augmentation_duree_pourcent} % — validation de l'encadrant requise. Toute douleur est traitée prioritairement par R4.`,
      ar: `في حصتين متتاليتين المجهود ≤ ${R.R1.rpe_max}/10. اقتراح زيادة ${R.R1.augmentation_duree_pourcent}٪ — يتطلب مصادقة المؤطر. أي ألم تُعالجه القاعدة R4 أولاً.`,
    },
    action: 'PROPOSER_AUGMENTATION_DUREE',
    requiresHumanValidation: R.R1.validation_humaine_obligatoire,
    auditTrail: [
      `R1 : ${n} séances avec RPE ≤ ${R.R1.rpe_max} (absence de douleur garantie par la priorité R4)`,
      `RPE observés : ${recentes.map((s) => s.rpe).join(', ')}`,
      'Aucune augmentation appliquée sans validation humaine',
    ],
    payload: { augmentation_pourcent: R.R1.augmentation_duree_pourcent, validation_requise: true },
  });
};

/** R2 — Maintien : RPE entre 5 et 6. */
export const evalR2: Regle = (ctx) => {
  const courante = seancesCompletees(ctx).at(-1);
  if (!courante || courante.rpe === null) return null;
  if (courante.rpe < R.R2.rpe_min || courante.rpe > R.R2.rpe_max) return null;
  return base('R2', 'INFO')({
    decision: 'MAINTENIR_CHARGE',
    reason: {
      fr: `Effort perçu à ${courante.rpe}/10 (entre ${R.R2.rpe_min} et ${R.R2.rpe_max}) : on garde la même charge.`,
      ar: `المجهود المُدرك ${courante.rpe}/10 (بين ${R.R2.rpe_min} و ${R.R2.rpe_max}) : نُبقي على نفس الحمل.`,
    },
    action: 'MAINTENIR_CHARGE',
    requiresHumanValidation: false,
    auditTrail: [`R2 : RPE ${courante.rpe} dans la plage [${R.R2.rpe_min}, ${R.R2.rpe_max}]`, 'Charge inchangée'],
  });
};

/** R3 — Allègement : automatique car c'est le sens sûr. */
export const evalR3: Regle = (ctx) => {
  const n = R.R3.seances_consecutives;
  const recentes = dernieres(ctx, n);
  if (recentes.length !== n) return null;
  if (!recentes.every((s) => s.rpe! >= R.R3.rpe_min)) return null;
  return base('R3', 'WARNING')({
    decision: 'ALLEGER_SEANCE',
    reason: {
      fr: `${n} séances avec un effort ≥ ${R.R3.rpe_min}/10. Réduction de ${R.R3.reduction_duree_pourcent} % appliquée automatiquement (allègement uniquement) et encadrant notifié.`,
      ar: `${n} حصاتين بمجهود ≥ ${R.R3.rpe_min}/10. تم تقليل المدة ${R.R3.reduction_duree_pourcent}٪ تلقائياً (اتجاه التخفيف فقط) مع تنبيه المؤطر.`,
    },
    action: 'APPLIQUER_ALLEGEMENT',
    requiresHumanValidation: false,
    auditTrail: [
      `R3 : ${n} séances avec RPE ≥ ${R.R3.rpe_min}`,
      `RPE observés : ${recentes.map((s) => s.rpe).join(', ')}`,
      'Allègement automatique autorisé (sens sûr)',
      'Encadrant notifié',
    ],
    payload: { reduction_pourcent: R.R3.reduction_duree_pourcent },
  });
};

/** R4 — Alerte douleur : suspension de l'exercice + alerte humaine. */
export const evalR4: Regle = (ctx) => {
  const courante = ctx.seances.at(-1);
  if (!courante || courante.nrs === null || courante.nrs < R.R4.nrs_min) return null;
  return base('R4', 'WARNING')({
    decision: 'SUSPENDRE_EXERCICE',
    reason: {
      fr: `Douleur déclarée à ${courante.nrs}/10 (seuil ${R.R4.nrs_min}/10). Exercice concerné suspendu et encadrant alerté.`,
      ar: `ألم مُصرَّح به ${courante.nrs}/10 (الحد ${R.R4.nrs_min}/10). تم إيقاف التمرين المعني وتنبيه المؤطر.`,
    },
    action: 'SUSPENDRE_ET_ALERTER',
    requiresHumanValidation: false, // suspension = allègement, décision humaine pour la reprise
    auditTrail: [
      `R4 : NRS ${courante.nrs} ≥ ${R.R4.nrs_min}`,
      'Exercice concerné suspendu',
      'Alerte envoyée à l’encadrant',
      'Reprise décidée par un humain',
    ],
    payload: { nrs: courante.nrs, exercice: courante.sessionId },
  });
};

/** R5 — Interruption : rappel à J2, appel à J3, proposition de reprise au-delà. */
export const evalR5: Regle = (ctx) => {
  const faites = seancesCompletees(ctx);
  if (faites.length === 0) return null;
  const jours = joursDepuis(faites.at(-1)!.date, ctx.aujourdHui);
  if (jours < R.R5.jours_rappel) return null;

  const action = jours === R.R5.jours_rappel
    ? 'RAPPEL_AUTOMATIQUE'
    : jours === R.R5.jours_appel_encadrant
      ? 'APPEL_ENCADRANT'
      : 'PROPOSER_REPRISE_CYCLE';
  const fr = jours === R.R5.jours_rappel
    ? `${R.R5.jours_rappel} jours sans séance : rappel automatique envoyé.`
    : jours === R.R5.jours_appel_encadrant
      ? `${R.R5.jours_appel_encadrant} jours sans séance : appel de l'encadrant déclenché.`
      : `${jours} jours sans séance : proposition de reprendre le cycle, à valider par l'encadrant.`;

  return base('R5', 'WARNING')({
    decision: 'INTERRUPTION_DETECTEE',
    reason: { fr, ar: `انقطاع عن التمارين منذ ${jours} يوماً : إجراء المتابعة مُفعّل.` },
    action,
    requiresHumanValidation: jours > R.R5.jours_appel_encadrant,
    auditTrail: [
      `R5 : ${jours} jour(s) depuis la dernière séance complétée`,
      `Seuil rappel ${R.R5.jours_rappel} j, seuil appel ${R.R5.jours_appel_encadrant} j`,
      `Action : ${action}`,
    ],
    payload: { jours_sans_seance: jours },
  });
};

/** R6 — Disponibilité « Jahiz » : amélioration ET objectif atteint. */
export const evalR6: Regle = (ctx) => {
  if (ctx.t0 == null || ctx.t1 == null || ctx.objectif6mwt == null) return null;
  const gain = ctx.t1 - ctx.t0;
  if (gain < R.R6.amelioration_6mwt_min_m || ctx.t1 < ctx.objectif6mwt) return null;
  return base('R6', 'INFO')({
    decision: 'PROGRAMME_TERMINE',
    reason: {
      fr: `6MWT : ${ctx.t0} m → ${ctx.t1} m (gain ${gain} m) et objectif ${ctx.objectif6mwt} m atteint. Déclaration « Programme terminé » proposée, ou second cycle à discuter. Seuil de gain : valeur temporaire à valider par le médecin référent.`,
      ar: `اختبار المشي: ${ctx.t0} م → ${ctx.t1} م (زيادة ${gain} م) وتم بلوغ الهدف ${ctx.objectif6mwt} م. يُقترح إعلان « انتهاء البرنامج » أو دورة ثانية للنقاش.`,
    },
    action: 'DECLARER_PROGRAMME_TERMINE',
    requiresHumanValidation: true,
    auditTrail: [
      `R6 : gain 6MWT ${gain} m (seuil temporaire ${R.R6.amelioration_6mwt_min_m} m)`,
      `Objectif ${ctx.objectif6mwt} m atteint`,
      'Déclaration soumise à validation humaine',
    ],
    payload: { gain_6mwt_m: gain, seuil_temporaire: true },
  });
};

/** Aucune règle déclenchée : décision neutre, traçable elle aussi. */
export function decisionNeutre(): DecisionMoteur {
  return base('AUCUNE', 'INFO')({
    decision: 'AUCUNE_ACTION',
    reason: { fr: 'Aucune règle déclenchée.', ar: 'لم تُفعّل أي قاعدة.' },
    action: 'AUCUNE_ACTION',
    requiresHumanValidation: false,
    auditTrail: ['Toutes les règles évaluées : aucune déclenchée'],
  });
}
