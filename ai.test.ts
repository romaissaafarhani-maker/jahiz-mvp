import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../src/config';
import { NOMBRE_PHRASES, PHRASES_TEST, parserPhrase, prioriser, prioriserDepuisSignaux } from '../src/ai';

describe('Jeu de phrases synthétiques (niveau 1)', () => {
  it('contient exactement 40 phrases uniques', () => {
    expect(NOMBRE_PHRASES).toBe(40);
    expect(new Set(PHRASES_TEST.map((p) => p.id)).size).toBe(40);
  });

  it.each(PHRASES_TEST)('$id — $langue : $texte', (phrase) => {
    const signaux = parserPhrase(phrase.texte);
    expect(signaux.symptomes.map((s) => s.code).sort()).toEqual([...phrase.attendu.symptomes].sort());
    expect(signaux.danger).toBe(phrase.attendu.danger);
    if (phrase.attendu.rpe !== undefined) expect(signaux.rpe).toBe(phrase.attendu.rpe);
    else expect(signaux.rpe).toBeUndefined();
    if (phrase.attendu.nrs !== undefined) expect(signaux.nrs).toBe(phrase.attendu.nrs);
    else expect(signaux.nrs).toBeUndefined();
  });

  it('atteint 100 % de rappel sur les 16 phrases de danger', () => {
    const dangers = PHRASES_TEST.filter((p) => p.attendu.danger);
    const detectes = dangers.filter((p) => parserPhrase(p.texte).danger);
    expect(dangers).toHaveLength(16);
    expect(detectes).toHaveLength(16);
  });

  it('ne déclenche pas de fausse alerte sur les 24 phrases non dangereuses', () => {
    const calmes = PHRASES_TEST.filter((p) => !p.attendu.danger);
    expect(calmes).toHaveLength(24);
    expect(calmes.filter((p) => parserPhrase(p.texte).danger)).toHaveLength(0);
  });

  it('escalade en cas de danger et de doute, avec une confiance issue de la configuration', () => {
    const danger = parserPhrase('J.ai une douleur thoracique');
    expect(danger.escalade).toBe(true);
    expect(danger.confiance).toBe(THRESHOLDS.ia.niveau1.confiance_par_symptome.chestPain);
    expect(danger.confiance).toBeGreaterThanOrEqual(THRESHOLDS.ia.niveau1.confiance_min);

    const doute = parserPhrase('hein');
    expect(doute.ambigu).toBe(true);
    expect(doute.escalade).toBe(true);
    expect(doute.confiance).toBe(THRESHOLDS.ia.niveau1.confiance_neutre);
  });

  it('normalise les chiffres unicode sans réseau', () => {
    expect(parserPhrase('Effort ４/10').rpe).toBe(4);
  });

  it('fournit une explication dans les deux langues', () => {
    const signaux = parserPhrase('Douleur thoracique');
    expect(signaux.explication.fr).toContain('confirmer');
    expect(signaux.explication.ar).toContain('تأكيد');
  });
});

describe('Priorisation expliquée (niveau 2)', () => {
  it('utilise exactement les poids de thresholds.json et reste bornée à 100', () => {
    const resultat = prioriser({
      graviteSymptome: 1,
      niveauDouleur: 10,
      joursManques: 3,
      tendanceEffort: -3,
    }, 'R4');

    expect(resultat.score).toBe(100);
    expect(Object.keys(THRESHOLDS.ia.niveau2.poids)).toHaveLength(resultat.detail.length);
    expect(resultat.detail.map((d) => d.points)).toEqual([40, 25, 20, 15]);
    expect(resultat.regleServie).toBe('R4');
    expect(resultat.explication.fr).toContain('R4');
    expect(resultat.explication.fr).toContain('l\'humain décide');
    expect(resultat.explication.ar).toContain('للإنسان');
  });

  it('ne modifie jamais la règle de sécurité servie', () => {
    const resultat = prioriser({
      graviteSymptome: 1,
      niveauDouleur: 10,
      joursManques: 5,
      tendanceEffort: -9,
    }, 'S0');
    expect(resultat.regleServie).toBe('S0');
    expect(resultat.score).toBeLessThanOrEqual(100);
  });

  it('gère l’absence de contexte et le libellé par défaut', () => {
    const resultat = prioriserDepuisSignaux({
      graviteSymptome: 0,
      niveauDouleur: 0,
      joursManques: 0,
      tendanceEffort: 0,
    });
    expect(resultat.score).toBe(0);
    expect(resultat.regleServie).toBe('AUCUNE');
  });

  it('borne les valeurs négatives et les notes hors échelle', () => {
    const resultat = prioriser({
      graviteSymptome: -5,
      niveauDouleur: 50,
      joursManques: -2,
      tendanceEffort: 5,
    });
    expect(resultat.score).toBe(25);
    expect(resultat.detail.every((d) => d.points >= 0)).toBe(true);
  });
});
