import { describe, expect, it } from 'vitest';
import { evaluer, ORDRE_PRIORITE, peutContinuerSeance, reglesDeclenchees } from '../src/engine';
import type { ContexteEvaluation, SeanceInput } from '../src/engine';
import type { SymptomCode } from '../src/data/types';
import { THRESHOLDS } from '../src/config';

const JOUR = (n: number) => `2026-05-${String(n).padStart(2, '0')}`;

function seance(
  jour: number,
  rpe: number | null = 5,
  nrs: number | null = 0,
  symptoms: SymptomCode[] = [],
): SeanceInput {
  return { date: JOUR(jour), sessionId: `SYNTH-TEST-${jour}`, completed: true, rpe, nrs, symptoms };
}

function contexte(seances: SeanceInput[], options: Partial<ContexteEvaluation> = {}): ContexteEvaluation {
  // Par défaut, « aujourd'hui » = lendemain de la dernière séance : ainsi R5
  // ne perturbe pas les tests des autres règles (sauf surcharge explicite).
  const derniereDate = seances.at(-1)?.date ?? '2026-05-01';
  const lendemain = new Date(`${derniereDate}T00:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  return {
    pilgrimId: 'SYNTH-TEST',
    aujourdHui: lendemain.toISOString().slice(0, 10),
    seances,
    ...options,
  };
}

describe('S0 — critères d’arrêt immédiat (fixes, non contournables)', () => {
  const signaux: SymptomCode[] = ['chestPain', 'dizzinessOrSyncope', 'unusualBreathlessness', 'severeJointPain'];

  it.each(signaux)('le signal %s déclenche toujours S0', (signal) => {
    const d = evaluer(contexte([seance(1, 5, 0, [signal])]));
    expect(d.ruleId).toBe('S0');
    expect(d.action).toBe('ARRET_IMMEDIAT');
    expect(d.severity).toBe('CRITICAL');
    expect(d.reason.fr).not.toBe('');
    expect(d.reason.ar).not.toBe('');
  });

  it('S0 bat R4 même avec une douleur ≥ 4', () => {
    const d = evaluer(contexte([seance(1, 6, 5, ['chestPain'])]));
    expect(d.ruleId).toBe('S0');
  });

  it('verrouille la suite de séance', () => {
    expect(peutContinuerSeance(contexte([seance(1, 5, 0, ['vertigo' as SymptomCode])]))).toBe(true); // inconnu = pas un signal officiel
    expect(peutContinuerSeance(contexte([seance(1, 5, 0, ['dizzinessOrSyncope'])]))).toBe(false);
    expect(peutContinuerSeance(contexte([seance(1)]))).toBe(true);
  });
});

describe('R1 — progression proposée', () => {
  it('deux séances RPE ≤ 4 sans douleur proposent +10 %', () => {
    const d = evaluer(contexte([seance(1, 4, 0), seance(2, 4, 1)]));
    expect(d.ruleId).toBe('R1');
    expect(d.action).toBe('PROPOSER_AUGMENTATION_DUREE');
    expect(d.payload?.augmentation_pourcent).toBe(THRESHOLDS.regles.R1.augmentation_duree_pourcent);
  });

  it('cas limite : RPE = 4 déclenche, RPE = 5 ne déclenche pas', () => {
    expect(evaluer(contexte([seance(1, 4), seance(2, 4)])).ruleId).toBe('R1');
    expect(evaluer(contexte([seance(1, 5), seance(2, 5)])).ruleId).toBe('R2');
  });

  it('une seule séance faible ne suffit pas', () => {
    expect(evaluer(contexte([seance(1, 3, 0)])).ruleId).toBe('AUCUNE');
  });

  it('exige toujours une validation humaine (jamais d’augmentation automatique)', () => {
    const d = evaluer(contexte([seance(1, 3), seance(2, 3)]));
    expect(d.requiresHumanValidation).toBe(true);
    expect(d.auditTrail.join(' ')).toContain('validation humaine');
  });

  it('douleur NRS = 4 fait gagner R4 (conflit R4 > R1)', () => {
    const d = evaluer(contexte([seance(1, 3, 0), seance(2, 3, 4)]));
    expect(d.ruleId).toBe('R4');
  });
});

describe('R2 — maintien', () => {
  it('RPE = 5 maintient la charge', () => {
    expect(evaluer(contexte([seance(1, 5)])).action).toBe('MAINTENIR_CHARGE');
  });

  it('RPE = 6 maintient la charge (borne haute)', () => {
    expect(evaluer(contexte([seance(1, 6)])).ruleId).toBe('R2');
  });

  it('RPE = 7 ne maintient pas', () => {
    expect(evaluer(contexte([seance(1, 7)])).ruleId).toBe('AUCUNE');
  });
});

describe('R3 — allègement', () => {
  it('deux séances RPE ≥ 7 réduisent automatiquement', () => {
    const d = evaluer(contexte([seance(1, 7), seance(2, 8)]));
    expect(d.ruleId).toBe('R3');
    expect(d.requiresHumanValidation).toBe(false);
    expect(d.payload?.reduction_pourcent).toBe(THRESHOLDS.regles.R3.reduction_duree_pourcent);
  });

  it('cas limite : RPE = 6 ne déclenche pas R3 (R2 répond)', () => {
    expect(evaluer(contexte([seance(1, 6), seance(2, 6)])).ruleId).not.toBe('R3');
  });

  it('une seule séance élevée ne déclenche pas R3', () => {
    expect(evaluer(contexte([seance(1, 8)])).ruleId).toBe('AUCUNE');
  });
});

describe('R4 — alerte douleur', () => {
  it('NRS = 4 suspend et alerte (borne basse)', () => {
    const d = evaluer(contexte([seance(1, 5, 4)]));
    expect(d.ruleId).toBe('R4');
    expect(d.action).toBe('SUSPENDRE_ET_ALERTER');
  });

  it('NRS = 3 ne déclenche pas R4 (R2 répond)', () => {
    expect(evaluer(contexte([seance(1, 5, 3)])).ruleId).not.toBe('R4');
  });
});

describe('R5 — interruption', () => {
  const dernier = seance(10, 5, 0);
  it('J+2 : rappel automatique', () => {
    const d = evaluer(contexte([dernier], { aujourdHui: JOUR(12) }));
    expect(d.action).toBe('RAPPEL_AUTOMATIQUE');
  });
  it('J+3 : appel de l’encadrant', () => {
    const d = evaluer(contexte([dernier], { aujourdHui: JOUR(13) }));
    expect(d.action).toBe('APPEL_ENCADRANT');
  });
  it('J+5 : proposition de reprise soumise à validation', () => {
    const d = evaluer(contexte([dernier], { aujourdHui: JOUR(15) }));
    expect(d.action).toBe('PROPOSER_REPRISE_CYCLE');
    expect(d.requiresHumanValidation).toBe(true);
  });
  it('J+1 : R5 ne se déclenche pas (une autre règle peut répondre)', () => {
    expect(evaluer(contexte([dernier], { aujourdHui: JOUR(11) })).ruleId).not.toBe('R5');
  });
});

describe('R6 — disponibilité « Jahiz »', () => {
  const base = { t0: 320, t1: 365, objectif6mwt: 360 };
  it('gain ≥ seuil temporaire ET objectif atteint → programme terminé proposé', () => {
    const d = evaluer(contexte([], base));
    expect(d.ruleId).toBe('R6');
    expect(d.requiresHumanValidation).toBe(true);
    expect(d.payload?.seuil_temporaire).toBe(true);
  });
  it('objectif non atteint → aucune action', () => {
    expect(evaluer(contexte([], { ...base, objectif6mwt: 400 })).ruleId).toBe('AUCUNE');
  });
  it('gain insuffisant → aucune action', () => {
    expect(evaluer(contexte([], { ...base, t1: 330 })).ruleId).toBe('AUCUNE');
  });
  it('T1 absent → aucune action', () => {
    expect(evaluer(contexte([], { t0: 320, objectif6mwt: 360 })).ruleId).toBe('AUCUNE');
  });
});

describe('Arbitrage et propiétés globales', () => {
  it('ordre de priorité conforme au prompt', () => {
    expect(ORDRE_PRIORITE).toEqual(['S0', 'R4', 'R5', 'R3', 'R1', 'R2', 'R6']);
  });

  it('R4 bat R5 quand les deux sont déclenchés', () => {
    const d = evaluer(contexte([seance(5, 5, 5)], { aujourdHui: JOUR(9) }));
    expect(d.ruleId).toBe('R4');
  });

  it('reglesDeclenchees expose les conflits mais evaluer arbitre', () => {
    const ctx = contexte([seance(1, 3, 0), seance(2, 3, 4)]);
    // ordre de priorité : R4 avant R1
    expect(reglesDeclenchees(ctx).map((d) => d.ruleId)).toEqual(['R4', 'R1']);
    expect(evaluer(ctx).ruleId).toBe('R4');
  });

  it('contexte vide → décision neutre avec audit', () => {
    const d = evaluer(contexte([]));
    expect(d.ruleId).toBe('AUCUNE');
    expect(d.auditTrail.length).toBeGreaterThan(1);
  });

  it('toute décision a un audit et des messages AR/FR', () => {
    const contextes = [
      contexte([seance(1, 4), seance(2, 4)]),
      contexte([seance(1, 7), seance(2, 7)]),
      contexte([seance(1, 5, 5)]),
      contexte([seance(1, 5, 0, ['chestPain'])]),
    ];
    for (const c of contextes) {
      const d = evaluer(c);
      expect(d.auditTrail.length).toBeGreaterThan(0);
      expect(d.reason.fr.length).toBeGreaterThan(5);
      expect(d.reason.ar.length).toBeGreaterThan(5);
    }
  });

  it('aucune action d’augmentation n’est jamais automatique', () => {
    constAugmentationsPossibles().forEach((c) => {
      const d = evaluer(c);
      if (d.action.includes('AUGMENTATION')) expect(d.requiresHumanValidation).toBe(true);
    });
  });
});

function constAugmentationsPossibles(): ContexteEvaluation[] {
  return [
    contexte([seance(1, 2, 0), seance(2, 2, 0)]),
    contexte([seance(1, 4, 3), seance(2, 4, 3)]),
    contexte([seance(1, 4, 0), seance(2, 4, 0)], { t0: 300, t1: 400, objectif6mwt: 390 }),
  ];
}
