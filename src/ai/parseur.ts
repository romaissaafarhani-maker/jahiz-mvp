import { THRESHOLDS } from '../config';
import type { SymptomCode } from '../data/types';
import type { SignauxParis, SymptomeDetecte, Explication } from './types';

interface RegleSymptome {
  code: SymptomCode;
  /** Au moins un de ces motifs doit être présent (motif d'arrêt explicite). */
  motifs: RegExp[];
  /** Pour les signes génériques (douleur), un contexte explicite est exigé. */
  contexte?: RegExp[];
}

/**
 * Motifs volon tairement larges, orientés RAPPEL.
 * La confirmation de la personne reste obligatoire (niveau 1, configuration).
 */
const REGLES: RegleSymptome[] = [
  {
    code: 'chestPain',
    motifs: [/صدر/, /سدر/, /thorac/i, /chest/i],
    contexte: [/وجع/, /ألم/, /ضغط/, /douleur/i],
  },
  {
    code: 'dizzinessOrSyncope',
    motifs: [/دوخ/, /دخت/, /طحت/, /إغماء/, /vertige/i, /tomb/i, /dizzy/i, /syncope/i],
  },
  {
    code: 'unusualBreathlessness',
    motifs: [/تنفس/, /نتنفس/, /نفس/, /ضاق/, /essouffl/i, /breath/i, /dyspn/i],
  },
  {
    code: 'severeJointPain',
    motifs: [/ركبة/, /مفصل/, /رجل/, /joint/i, /articula/i, /genou/i],
    contexte: [/حاد/, /شديد/, /بزربة/, /aigu/i],
  },
];

const CONTEXTE_EFFORT = /مجهود|جهد|effort/i;
const CONTEXTE_DOULEUR = /ألم|وجع|douleur|pain|mal/i;

/** Extrait une note 1..10 ; ignore le dénominateur « /10 » ou « sur 10 ». */
function extraireNote(texte: string): number | undefined {
  const nombres = [...texte.matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 10);
  if (nombres.length === 0) return undefined;
  return nombres.find((n) => n !== 10) ?? nombres[0];
}

function contient(texte: string, motifs: RegExp[]): boolean {
  return motifs.some((motif) => motif.test(texte));
}

/**
 * Parseur local de niveau 1 (AR / Darija / FR).
 * Il ne prend aucune décision médicale : il produit des signaux à confirmer.
 */
export function parserPhrase(texteBrut: string): SignauxParis {
  const texte = texteBrut.normalize('NFKC').trim();
  const symptomes: SymptomeDetecte[] = [];

  for (const regle of REGLES) {
    const present = contient(texte, regle.motifs);
    const contexteOk = !regle.contexte || contient(texte, regle.contexte);
    if (present && contexteOk) {
      symptomes.push({
        code: regle.code,
        confiance: THRESHOLDS.ia.niveau1.confiance_par_symptome[regle.code],
        source: 'motif-local',
      });
    }
  }

  const note = extraireNote(texte);
  const rpe = CONTEXTE_EFFORT.test(texte) ? note : undefined;
  const nrs = CONTEXTE_DOULEUR.test(texte) ? note : undefined;

  const danger = symptomes.length > 0;
  const ambigu = texte.length < 6 && !danger;
  const confiance = danger
    ? Math.max(...symptomes.map((s) => s.confiance))
    : THRESHOLDS.ia.niveau1.confiance_neutre;

  const codes = symptomes.map((s) => s.code);
  const explication: Explication = danger
    ? {
        fr: `Signaux d'arrêt détectés : ${codes.join(', ')}. À confirmer par la personne avant toute action.`,
        ar: `تم اكتشاف إشارات توقف: ${codes.join('، ')}. يجب تأكيدها من الشخص قبل أي إجراء.`,
      }
    : {
        fr: 'Aucun signal d’arrêt détecté. Analyse locale à confirmer par la personne.',
        ar: 'لم يتم اكتشاف أي إشارة توقف. التحليل محلي ويحتاج تأكيد الشخص.',
      };

  return {
    texte: texteBrut,
    symptomes,
    rpe,
    nrs,
    danger,
    ambigu,
    confiance,
    escalade: danger || (ambiguoOuDanger(ambigu, danger) && THRESHOLDS.ia.niveau1.escalade_si_doute_danger),
    explication,
  };
}

/** Petite fonction nommée pour expliciter la règle d'escalade en cas de doute. */
function ambiguoOuDanger(ambigu: boolean, danger: boolean): boolean {
  return ambigu || danger;
}
