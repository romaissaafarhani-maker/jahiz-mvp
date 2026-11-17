import type { SymptomCode } from '../data/types';

export type RuleId = 'S0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'AUCUNE';

export interface SeanceInput {
  date: string; // ISO AAAA-MM-JJ
  sessionId: string;
  completed: boolean;
  rpe: number | null; // 0..10, null si non renseigné
  nrs: number | null; // 0..10, null si non renseigné
  symptoms: SymptomCode[];
}

export interface ContexteEvaluation {
  pilgrimId: string;
  aujourdHui: string; // ISO
  /** Historique complet, y compris la séance courante ; l'ordre est imposé par l'appelant. */
  seances: SeanceInput[];
  t0?: number | null; // 6MWT initial (m)
  t1?: number | null; // 6MWT avant départ (m)
  objectif6mwt?: number | null;
}

export interface DecisionMoteur {
  ruleId: RuleId;
  decision: string;
  reason: { ar: string; fr: string };
  action: string;
  requiresHumanValidation: boolean;
  auditTrail: string[];
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  payload?: Record<string, unknown>;
}

export type Regle = (ctx: ContexteEvaluation) => DecisionMoteur | null;
