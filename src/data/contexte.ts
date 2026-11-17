import { THRESHOLDS } from '../config';
import type { ContexteEvaluation, DecisionMoteur, SeanceInput } from '../engine';
import type { Decision, Pilgrim, SessionEntry } from './types';

export function versSeanceInput(s: SessionEntry): SeanceInput {
  return {
    date: s.date,
    sessionId: s.sessionId,
    completed: s.completed,
    rpe: s.rpe,
    nrs: s.nrs,
    symptoms: s.symptoms,
  };
}

/** Construit le contexte du moteur à partir d'un pèlerin synthétique. */
export function contexteDuPelerin(
  p: Pilgrim,
  seanceSupplementaire?: SeanceInput,
  options: { aujourdHui?: string } = {},
): ContexteEvaluation {
  const seances = p.sessions.map(versSeanceInput);
  if (seanceSupplementaire) seances.push(seanceSupplementaire);
  const t0 = p.t0.find((t) => t.code === '6MWT')?.value ?? null;
  const t1 = p.t1?.find((t) => t.code === '6MWT')?.value ?? null;
  return {
    pilgrimId: p.id,
    aujourdHui: options.aujourdHui ?? seances.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
    seances,
    t0,
    t1,
    objectif6mwt: THRESHOLDS.programme.objectif_6mwt_par_defaut_m,
  };
}

/** Convertit une décision du moteur (sans identifiant) en décision horodatée pour le store. */
export function versDecision(decision: DecisionMoteur, pilgrimId: string): Decision {
  return {
    id: `SYNTH-DEC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pilgrimId,
    ruleId: decision.ruleId,
    decision: decision.decision,
    reason: decision.reason,
    action: decision.action,
    requiresHumanValidation: decision.requiresHumanValidation,
    auditTrail: decision.auditTrail,
    createdAt: new Date().toISOString(),
    severity: decision.severity,
  };
}
