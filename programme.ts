import { THRESHOLDS } from '../config';

export interface JourProgramme {
  jour: number; // 1..14
  date: string;
  type: 'seance' | 'repos';
  exercices: string[];
  dureeMin: number;
}

const BASE = '2026-05-20'; // date de départ fictive (saison 1448)

function dateDuJour(jour: number): string {
  const d = new Date(`${BASE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jour - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Programme condensé de 14 jours : 12 séances + 2 repos, 10–25 min.
 * Les exercices sont strictement ceux du prompt. Les durées sont des
 * paramètres de démonstration marqués « À_VALIDER_PAR_LE_SPECIALISTE ».
 */
export const PROGRAMME_14_JOURS: JourProgramme[] = Array.from({ length: THRESHOLDS.programme.jours }, (_, index) => {
  const jour = index + 1;
  const repos = jour === 7 || jour === 14;
  const cycle = jour % 5;
  const exercices = repos
    ? []
    : [
        ['marche_progress', 'lever_chaise'],
        ['releve_sol_assiste', 'equilibre'],
        ['marche_progress', 'station_debout_progressive'],
        ['lever_chaise', 'equilibre'],
        ['marche_progress', 'releve_sol_assiste'],
      ][cycle];
  const dureeMin = repos
    ? 0
    : Math.min(
        THRESHOLDS.programme.duree_max_min,
        THRESHOLDS.programme.duree_min_min + Math.floor((jour - 1) / 3) * 3,
      );

  return { jour, date: dateDuJour(jour), type: repos ? 'repos' : 'seance', exercices, dureeMin };
});

export const DATE_DEBUT = BASE;
