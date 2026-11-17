import { THRESHOLDS } from '../config';

export const PICTO_EXERCICE: Record<string, string> = {
  marche_progress: '🚶',
  lever_chaise: '🪑',
  releve_sol_assiste: '🧘',
  equilibre: '⚖️',
  station_debout_progressive: '🧍',
};

export const LIBELLE_EXERCICE: Record<string, { fr: string; ar: string }> = {
  marche_progress: { fr: 'Marche progressive', ar: 'مشي تدريجي' },
  lever_chaise: { fr: 'Lever de chaise', ar: 'النهوض من الكرسي' },
  releve_sol_assiste: { fr: 'Relevé du sol assisté', ar: 'القيام من الأرض بمساعدة' },
  equilibre: { fr: 'Équilibre', ar: 'التوازن' },
  station_debout_progressive: { fr: 'Station debout progressive', ar: 'الوقوف التدريجي' },
};

/** Libellés des 5 stations du prompt, pour l'écran T0 et la matrice Jury. */
export const STATIONS = [
  { code: '6MWT', fr: 'Tawaf et Saï — endurance aérobie', ar: 'الطواف والسعي — التحمل الهوائي', test: 'Marche de 6 minutes' },
  { code: 'STAND', fr: 'Arafat — tolérance posturale', ar: 'عرفات — تحمل الوقوف', test: 'Durée maximale de station debout' },
  { code: 'FLOOR', fr: 'Mina et Muzdalifa — hanche/genou', ar: 'منى ومزدلفة — الورك والركبة', test: 'Se relever du sol' },
  { code: 'WALK', fr: 'Jamarat et Tashriq — équilibre', ar: 'الجمرات والتشريق — التوازن', test: 'Lever-marcher chronométré' },
  { code: 'CHAIR', fr: 'Aéroports et transport — membres inférieurs', ar: 'المطارات والنقل — الأطراف السفلى', test: 'Lever de chaise sur 30 s' },
] as const;

export const SEUILS_EVALUATION = THRESHOLDS.evaluation.tests;
