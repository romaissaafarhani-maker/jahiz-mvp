import type { SymptomCode } from '../data/types';

export interface Explication {
  ar: string;
  fr: string;
}

/** Signal brut produit par le parseur local de niveau 1. */
export interface SymptomeDetecte {
  code: SymptomCode;
  confiance: number;
  source: 'motif-local';
}

export interface SignauxParis {
  texte: string;
  symptomes: SymptomeDetecte[];
  rpe?: number;
  nrs?: number;
  danger: boolean;
  ambigu: boolean;
  confiance: number;
  escalade: boolean;
  explication: Explication;
}

/** Contexte de priorisation de niveau 2 — aucune valeur n'est inventée en dur ici. */
export interface ContextePriorisation {
  graviteSymptome: number; // 0 ou 1
  niveauDouleur: number; // 0..10
  joursManques: number; // >= 0
  tendanceEffort: number; // variation signée ; négatif = baisse de l'effort
}

export interface DetailPriorisation {
  cle: string;
  libelle: Explication;
  points: number;
}

/**
 * Score de priorisation affiché uniquement pour aider l'humain.
 * Il ne modifie JAMAIS l'ordre de sécurité S0 > R4 > R5 > R3 > R1 > R2 > R6.
 */
export interface ResultatPriorisation {
  score: number;
  detail: DetailPriorisation[];
  explication: Explication;
  regleServie: string;
}
