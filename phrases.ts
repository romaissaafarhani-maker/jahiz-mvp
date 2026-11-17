import type { SymptomCode } from '../data/types';

export type LanguePhrase = 'ar' | 'darija' | 'fr';

export interface PhraseTest {
  id: string;
  texte: string;
  langue: LanguePhrase;
  attendu: {
    symptomes: SymptomCode[];
    rpe?: number;
    nrs?: number;
    danger: boolean;
  };
}

/** 40 phrases 100 % synthétiques. Aucune donnée de patient réel. */
export const PHRASES_TEST: PhraseTest[] = [
  // 16 phrases de danger — 4 par signal d'arrêt (objectif : rappel 100 %)
  { id: 'SYNTH-PH-01', texte: 'عندي وجع فالصدر من اليوم', langue: 'darija', attendu: { symptomes: ['chestPain'], danger: true } },
  { id: 'SYNTH-PH-02', texte: 'حسّيت بضغط كبير على صدري', langue: 'darija', attendu: { symptomes: ['chestPain'], danger: true } },
  { id: 'SYNTH-PH-03', texte: 'Douleur thoracique depuis ce matin', langue: 'fr', attendu: { symptomes: ['chestPain'], danger: true } },
  { id: 'SYNTH-PH-04', texte: 'ألم حاد في الصدر بعد المشي', langue: 'ar', attendu: { symptomes: ['chestPain'], danger: true } },
  { id: 'SYNTH-PH-05', texte: 'دخت وطحت على الأرض', langue: 'darija', attendu: { symptomes: ['dizzinessOrSyncope'], danger: true } },
  { id: 'SYNTH-PH-06', texte: 'حسّيت بدوخة كبيرة اليوم', langue: 'darija', attendu: { symptomes: ['dizzinessOrSyncope'], danger: true } },
  { id: 'SYNTH-PH-07', texte: "J'ai eu un vertige et je suis tombé", langue: 'fr', attendu: { symptomes: ['dizzinessOrSyncope'], danger: true } },
  { id: 'SYNTH-PH-08', texte: 'قريب من الإغماء', langue: 'ar', attendu: { symptomes: ['dizzinessOrSyncope'], danger: true } },
  { id: 'SYNTH-PH-09', texte: 'نفسي ضاق بزربة', langue: 'darija', attendu: { symptomes: ['unusualBreathlessness'], danger: true } },
  { id: 'SYNTH-PH-10', texte: 'صعوبة تنفس غير معتادة', langue: 'ar', attendu: { symptomes: ['unusualBreathlessness'], danger: true } },
  { id: 'SYNTH-PH-11', texte: "Essoufflement inhabituel aujourd'hui", langue: 'fr', attendu: { symptomes: ['unusualBreathlessness'], danger: true } },
  { id: 'SYNTH-PH-12', texte: 'ما كنقدرش نتنفس مزيان', langue: 'darija', attendu: { symptomes: ['unusualBreathlessness'], danger: true } },
  { id: 'SYNTH-PH-13', texte: 'وجع حاد فالركبة', langue: 'darija', attendu: { symptomes: ['severeJointPain'], danger: true } },
  { id: 'SYNTH-PH-14', texte: 'ألم شديد في المفصل', langue: 'ar', attendu: { symptomes: ['severeJointPain'], danger: true } },
  { id: 'SYNTH-PH-15', texte: 'Douleur articulaire aiguë au genou', langue: 'fr', attendu: { symptomes: ['severeJointPain'], danger: true } },
  { id: 'SYNTH-PH-16', texte: 'وجعتني الرجل بزربة', langue: 'darija', attendu: { symptomes: ['severeJointPain'], danger: true } },

  // 8 phrases d'effort (RPE explicite)
  { id: 'SYNTH-PH-17', texte: 'المجهود كان 4 من 10', langue: 'ar', attendu: { symptomes: [], rpe: 4, danger: false } },
  { id: 'SYNTH-PH-18', texte: 'Effort 6/10 aujourd\'hui', langue: 'fr', attendu: { symptomes: [], rpe: 6, danger: false } },
  { id: 'SYNTH-PH-19', texte: 'مجهودي كان 7 من 10', langue: 'darija', attendu: { symptomes: [], rpe: 7, danger: false } },
  { id: 'SYNTH-PH-20', texte: 'Effort perçu : 5 sur 10', langue: 'fr', attendu: { symptomes: [], rpe: 5, danger: false } },
  { id: 'SYNTH-PH-21', texte: 'المجهود 3/10', langue: 'ar', attendu: { symptomes: [], rpe: 3, danger: false } },
  { id: 'SYNTH-PH-22', texte: 'kayn effort 8/10', langue: 'darija', attendu: { symptomes: [], rpe: 8, danger: false } },
  { id: 'SYNTH-PH-23', texte: 'J\'ai trouvé l\'effort facile, 2/10', langue: 'fr', attendu: { symptomes: [], rpe: 2, danger: false } },
  { id: 'SYNTH-PH-24', texte: 'المجهود 9 من 10', langue: 'ar', attendu: { symptomes: [], rpe: 9, danger: false } },

  // 8 phrases de douleur (NRS explicite)
  { id: 'SYNTH-PH-25', texte: 'الألم 3 من 10', langue: 'ar', attendu: { symptomes: [], nrs: 3, danger: false } },
  { id: 'SYNTH-PH-26', texte: 'Douleur 5/10 dans la jambe', langue: 'fr', attendu: { symptomes: [], nrs: 5, danger: false } },
  { id: 'SYNTH-PH-27', texte: 'الوجع 4 من 10', langue: 'darija', attendu: { symptomes: [], nrs: 4, danger: false } },
  { id: 'SYNTH-PH-28', texte: 'ألم خفيف 2/10', langue: 'ar', attendu: { symptomes: [], nrs: 2, danger: false } },
  { id: 'SYNTH-PH-29', texte: 'Douleur 7 sur 10', langue: 'fr', attendu: { symptomes: [], nrs: 7, danger: false } },
  { id: 'SYNTH-PH-30', texte: 'وجعي 6 من 10', langue: 'darija', attendu: { symptomes: [], nrs: 6, danger: false } },
  { id: 'SYNTH-PH-31', texte: 'الألم 8/10', langue: 'ar', attendu: { symptomes: [], nrs: 8, danger: false } },
  { id: 'SYNTH-PH-32', texte: 'J\'ai mal, 1/10', langue: 'fr', attendu: { symptomes: [], nrs: 1, danger: false } },

  // 8 phrases neutres
  { id: 'SYNTH-PH-33', texte: 'حسّيت بعطش بعد المشي', langue: 'darija', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-34', texte: 'J\'ai bien dormi cette nuit', langue: 'fr', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-35', texte: 'الجو كان حار شوية', langue: 'ar', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-36', texte: 'شربت ماء قبل الحصة', langue: 'darija', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-37', texte: 'La marche était agréable', langue: 'fr', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-38', texte: 'Today I walked slowly', langue: 'fr', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-39', texte: 'كنحب نتمشى فالصباح', langue: 'darija', attendu: { symptomes: [], danger: false } },
  { id: 'SYNTH-PH-40', texte: 'لا يوجد شيء غير عادي', langue: 'ar', attendu: { symptomes: [], danger: false } },
];

export const NOMBRE_PHRASES = PHRASES_TEST.length;
