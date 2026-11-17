import { THRESHOLDS } from '../config';
import type { ContexteEvaluation, DecisionMoteur } from './types';

/** Règle de sécurité FIXE : aucune logique ne peut la désactiver ou la contourner. */
export const SYMPTOMES_ARRET = THRESHOLDS.arret_immediat.symptomes as readonly string[];

export function symptomesDetectes(ctx: ContexteEvaluation): string[] {
  const courante = ctx.seances[ctx.seances.length - 1];
  if (!courante) return [];
  return courante.symptoms.filter((s) => SYMPTOMES_ARRET.includes(s));
}

export function evaluerArret(ctx: ContexteEvaluation): DecisionMoteur | null {
  const symptomes = symptomesDetectes(ctx);
  if (symptomes.length === 0) return null;
  return {
    ruleId: 'S0',
    decision: 'ARRÊT_IMMÉDIAT',
    reason: {
      fr: `${THRESHOLDS.arret_immediat.message_fr} (signal : ${symptomes.join(', ')}).`,
      ar: `${THRESHOLDS.arret_immediat.message_ar} (العلامة : ${symptomes.join('، ')}).`,
    },
    action: 'ARRET_IMMEDIAT',
    requiresHumanValidation: true, // la reprise doit être levée par un humain
    auditTrail: [
      'S0 : critère d’arrêt immédiat détecté',
      `Symptômes : ${symptomes.join(', ')}`,
      'Aucune suite de séance tant qu’un humain n’a pas levé l’arrêt',
      'Alerte critique envoyée à l’encadrant',
    ],
    severity: 'CRITICAL',
    payload: { symptomes },
  };
}

/** Verrou utilisé par l'UI : arrêt strict, jamais contournable. */
export function peutContinuerSeance(ctx: ContexteEvaluation): boolean {
  return evaluerArret(ctx) === null;
}
