export type Role = 'pelerin' | 'accompagnateur' | 'encadrant' | 'medecin' | 'guide';
export type Langue = 'ar' | 'fr';
export type SymptomCode = 'chestPain' | 'dizzinessOrSyncope' | 'unusualBreathlessness' | 'severeJointPain';
export type Niveau = 'faible' | 'moyen' | 'bon';
export type TestCode = '6MWT' | 'STAND' | 'FLOOR' | 'WALK' | 'CHAIR';

export interface SessionEntry {
  date: string; // ISO
  sessionId: string;
  completed: boolean;
  rpe: number | null; // 0..10
  nrs: number | null; // 0..10
  symptoms: SymptomCode[];
  durationMin: number;
  exercise: string;
}

export interface TestResult {
  code: TestCode;
  value: number;
  unite: string;
}

export interface Pilgrim {
  id: string; // SYNTH-…
  prenom: string;
  ville: string;
  age: number;
  niveau: Niveau;
  t0: TestResult[];
  t1: TestResult[] | null;
  sessions: SessionEntry[]; // 14 entrées, une par jour
  stopActif: boolean;
}

export interface Decision {
  id: string;
  pilgrimId: string;
  ruleId: 'S0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'AUCUNE';
  decision: string;
  reason: { ar: string; fr: string };
  action: string;
  requiresHumanValidation: boolean;
  auditTrail: string[];
  createdAt: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  score?: number; // priorisation niveau 2
  validation?: 'ACCEPTE' | 'REJETE';
  motif?: string; // motif saisi par l'humain lors d'un rejet
}

export interface AiLogEntry {
  id: string;
  at: string;
  niveau: 'NIVEAU_1' | 'NIVEAU_2';
  evenement: 'DEMANDE' | 'ACCEPTE' | 'REJETE';
  motif?: string;
  contenu: string;
}
