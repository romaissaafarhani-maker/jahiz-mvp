import type { Pilgrim, Role, SessionEntry, SymptomCode, TestResult } from './types';
import { PROGRAMME_14_JOURS } from './programme';

/** Identifiants exclusivement SYNTH- : aucune donnée réelle de pèlerin. */
export interface UtilisateurDemo {
  id: string;
  role: Role;
  nom: string;
}

export const UTILISATEURS_DEMO: UtilisateurDemo[] = [
  { id: 'SYNTH-U-ENC', role: 'encadrant', nom: 'Encadrant — APA' },
  { id: 'SYNTH-U-MED', role: 'medecin', nom: 'Médecin référent' },
  { id: 'SYNTH-U-GUI', role: 'guide', nom: "Guide d'agence" },
];

type JourSpec = Partial<Omit<SessionEntry, 'date' | 'sessionId'>> & { jour: number };

/** Construit 14 entrées cohérentes : valeurs par défaut + jours explicités. */
function journal(pilgrimId: string, specs: JourSpec[]): SessionEntry[] {
  const parJour = new Map(specs.map((s) => [s.jour, s]));
  return PROGRAMME_14_JOURS.map((jourProgramme) => {
    const spec = parJour.get(jourProgramme.jour);
    const repos = jourProgramme.type === 'repos';
    const completed = spec?.completed ?? !repos;
    return {
      date: jourProgramme.date,
      sessionId: `SYNTH-${pilgrimId}-J${jourProgramme.jour}`,
      completed,
      rpe: spec?.rpe ?? (completed ? 5 : null),
      nrs: spec?.nrs ?? (completed ? 0 : null),
      symptoms: spec?.symptoms ?? [],
      durationMin: spec?.durationMin ?? jourProgramme.dureeMin,
      exercise: spec?.exercise ?? jourProgramme.exercices[0] ?? 'repos',
    };
  });
}

function tests(base: number): TestResult[] {
  return [
    { code: '6MWT', value: base, unite: 'm' },
    { code: 'STAND', value: 28, unite: 's' },
    { code: 'FLOOR', value: 2, unite: 'niveau' },
    { code: 'WALK', value: 18, unite: 's' },
    { code: 'CHAIR', value: 10, unite: 'reps/30s' },
  ];
}

function t1(base: number): TestResult[] {
  const r = tests(base);
  r[0] = { code: '6MWT', value: base + 45, unite: 'm' }; // démonstration R6
  return r;
}

const SYMPTOMES_ARRET: Record<SymptomCode, string> = {
  chestPain: 'Douleur thoracique déclarée',
  dizzinessOrSyncope: 'Vertige déclaré',
  unusualBreathlessness: 'Essoufflement inhabituel déclaré',
  severeJointPain: 'Douleur articulaire aiguë déclarée',
};

export const PELERINS: Pilgrim[] = [
  {
    id: 'SYNTH-P001', prenom: 'Hadj Ahmed', ville: 'Settat', age: 63, niveau: 'faible',
    t0: tests(320), t1: t1(320), stopActif: false,
    sessions: journal('P001', [
      { jour: 4, rpe: 4, nrs: 0 }, { jour: 5, rpe: 4, nrs: 0 }, // R1
      { jour: 8, rpe: 6, nrs: 5 }, // R4
      { jour: 9, completed: false, rpe: null, nrs: null, symptoms: ['dizzinessOrSyncope'], exercise: SYMPTOMES_ARRET.dizzinessOrSyncope },
      { jour: 11, rpe: 5, nrs: 1 }, { jour: 12, rpe: 5, nrs: 0 }, { jour: 13, rpe: 4, nrs: 0 },
    ]),
  },
  {
    id: 'SYNTH-P002', prenom: 'Hadj Mohamed', ville: 'Settat', age: 68, niveau: 'moyen',
    t0: tests(350), t1: null, stopActif: false,
    sessions: journal('P002', [{ jour: 6, rpe: 7, nrs: 1 }, { jour: 8, rpe: 7, nrs: 1 }]), // R3
  },
  {
    id: 'SYNTH-P003', prenom: 'Hadj Omar', ville: 'Casablanca', age: 65, niveau: 'moyen',
    t0: tests(340), t1: null, stopActif: false,
    sessions: journal('P003', [
      { jour: 2, rpe: 5 }, { jour: 3, rpe: 6 }, { jour: 5, rpe: 5 }, { jour: 6, rpe: 6 },
    ]), // R2
  },
  {
    id: 'SYNTH-P004', prenom: 'Hadj Abdelkader', ville: 'Marrakech', age: 70, niveau: 'faible',
    t0: tests(300), t1: null, stopActif: false,
    sessions: journal('P004', [
      { jour: 11, completed: false, rpe: null, nrs: null },
      { jour: 12, completed: false, rpe: null, nrs: null },
      { jour: 13, completed: false, rpe: null, nrs: null },
      { jour: 14, completed: false, rpe: null, nrs: null },
    ]), // R5 (J+3)
  },
  {
    id: 'SYNTH-P005', prenom: 'Hadj Hassan', ville: 'Fès', age: 66, niveau: 'faible',
    t0: tests(310), t1: null, stopActif: true,
    sessions: journal('P005', [
      { jour: 4, completed: false, rpe: null, nrs: null, symptoms: ['chestPain'], exercise: SYMPTOMES_ARRET.chestPain },
    ]), // arrêt immédiat
  },
  {
    id: 'SYNTH-P006', prenom: 'Hadj Abdulrahman', ville: 'Rabat', age: 64, niveau: 'moyen',
    t0: tests(335), t1: null, stopActif: false,
    sessions: journal('P006', [
      { jour: 3, rpe: 3, nrs: 0 }, { jour: 4, rpe: 3, nrs: 4 },
    ]), // conflit R4 > R1
  },
];

export const PELERIN_REFERENCE = PELERINS[0];
