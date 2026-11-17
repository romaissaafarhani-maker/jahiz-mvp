import { evaluerArret } from './arret';
import { decisionNeutre, evalR1, evalR2, evalR3, evalR4, evalR5, evalR6 } from './regles';
import type { ContexteEvaluation, DecisionMoteur, Regle } from './types';

/** Ordre de priorité absolu (prompt §5.3). S0 est hors classement : il court-circuite tout. */
export const ORDRE_PRIORITE = ['S0', 'R4', 'R5', 'R3', 'R1', 'R2', 'R6'] as const;

const REGLES: Array<{ id: string; evaluer: Regle }> = [
  { id: 'R4', evaluer: evalR4 },
  { id: 'R5', evaluer: evalR5 },
  { id: 'R3', evaluer: evalR3 },
  { id: 'R1', evaluer: evalR1 },
  { id: 'R2', evaluer: evalR2 },
  { id: 'R6', evaluer: evalR6 },
];

/**
 * Arbitrage : première règle déclenchante par priorité.
 * Garantie : aucune règle ne peut augmenter la charge sans validation humaine,
 * et le critère d'arrêt n'est jamais évalué après les autres.
 */
export function evaluer(ctx: ContexteEvaluation): DecisionMoteur {
  const trace: string[] = [];

  const arret = evaluerArret(ctx);
  if (arret) {
    return { ...arret, auditTrail: ['S0 évalué en premier (priorité absolue)', ...arret.auditTrail] };
  }
  trace.push('S0 : aucun symptôme d’arrêt');

  for (const { id, evaluer: regle } of REGLES) {
    const decision = regle(ctx);
    if (decision) return { ...decision, auditTrail: [...trace, ...decision.auditTrail] };
    trace.push(`${id} : non déclenchée`);
  }

  const neutre = decisionNeutre();
  return { ...neutre, auditTrail: [...trace, ...neutre.auditTrail] };
}

/** Toutes les règles déclenchées, sans arbitrage — utilisé par l'espace Jury. */
export function reglesDeclenchees(ctx: ContexteEvaluation): DecisionMoteur[] {
  const sortie: DecisionMoteur[] = [];
  const arret = evaluerArret(ctx);
  if (arret) sortie.push(arret);
  for (const { evaluer: regle } of REGLES) {
    const d = regle(ctx);
    if (d) sortie.push(d);
  }
  return sortie;
}
