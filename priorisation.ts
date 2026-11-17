import { THRESHOLDS } from '../config';
import type { ContextePriorisation, DetailPriorisation, Explication, ResultatPriorisation } from './types';

const bornes = (v: number) => Math.min(1, Math.max(0, v));

const LIBELLES: Record<string, Explication> = {
  gravite_symptome: { fr: 'Gravité des symptômes signalés', ar: 'خطورة الأعراض المُبلّغ عنها' },
  niveau_douleur: { fr: 'Niveau de douleur déclaré', ar: 'مستوى الألم المُصرّح به' },
  jours_manques: { fr: 'Jours de séance manqués', ar: 'أيام الحصص الفائتة' },
  tendance_effort: { fr: 'Tendance à la baisse de l’effort', ar: 'اتجاه انخفاض المجهود' },
};

/**
 * Priorisation de niveau 2 : calcul expliqué à partir des poids de thresholds.json.
 * Le score est un aide à la décision humaine, jamais une règle de sécurité.
 */
export function prioriser(
  contexte: ContextePriorisation,
  regleServie = 'AUCUNE',
): ResultatPriorisation {
  const poids = THRESHOLDS.ia.niveau2.poids;
  const sousScores: Record<string, number> = {
    gravite_symptome: bornes(contexte.graviteSymptome),
    niveau_douleur: bornes(contexte.niveauDouleur / 10),
    jours_manques: bornes(contexte.joursManques / 3),
    tendance_effort: bornes(-contexte.tendanceEffort / 3),
  };

  const detail: DetailPriorisation[] = Object.keys(poids).map((cle) => ({
    cle,
    libelle: LIBELLES[cle] ?? { fr: cle, ar: cle },
    points: Math.round(poids[cle as keyof typeof poids] * (sousScores[cle] ?? 0)),
  }));

  const score = detail.reduce((total, d) => total + d.points, 0);
  const resume = detail.map((d) => `${d.cle}: ${d.points}`).join(' · ');

  const explication: Explication = {
    fr: `Score ${score}/100 — ${resume}. La priorité de sécurité ${regleServie} reste inchangée ; l'humain décide.`,
    ar: `النتيجة ${score}/100 — ${resume}. أولوية السلامة ${regleServie} لا تتغير؛ القرار للإنسان.`,
  };

  return { score, detail, explication, regleServie };
}

export function prioriserDepuisSignaux(
  contexte: ContextePriorisation & { regleServie?: string },
): ResultatPriorisation {
  return prioriser(contexte, contexte.regleServie ?? 'AUCUNE');
}
