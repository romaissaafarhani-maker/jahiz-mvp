import thresholds from './thresholds.json';

/** Source de vérité unique : aucun seuil « en dur » ne doit apparaître ailleurs. */
export const THRESHOLDS = thresholds;

export type StatutValidation =
  | 'A_VALIDER_PAR_LE_MEDECIN_REFERENT'
  | 'A_VALIDER_PAR_LE_SPECIALISTE'
  | 'PLACEHOLDER_A_VALIDER_PAR_LE_MEDECIN_REFERENT'
  | 'REGLE_DE_SECURITE_FIXE'
  | 'CONTRAINTE_PRODUIT';

/** Utilitaire d'affichage pour l'espace Jury : rien n'est présenté comme validé. */
export function libelleStatut(statut: string): string {
  const traductions: Record<string, string> = {
    A_VALIDER_PAR_LE_MEDECIN_REFERENT: 'À valider par le médecin référent',
    A_VALIDER_PAR_LE_SPECIALISTE: 'À valider par le spécialiste',
    PLACEHOLDER_A_VALIDER_PAR_LE_MEDECIN_REFERENT: 'Valeur temporaire — à valider par le médecin référent',
    REGLE_DE_SECURITE_FIXE: 'Règle de sécurité fixe — non modifiable',
    CONTRAINTE_PRODUIT: 'Contrainte produit',
  };
  return traductions[statut] ?? statut;
}
