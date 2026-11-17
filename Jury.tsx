import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeRegle } from '../components/BadgeRegle';
import { THRESHOLDS, libelleStatut } from '../config';
import { ORDRE_PRIORITE, evaluer } from '../engine';
import type { ContexteEvaluation, RuleId } from '../engine';
import { PELERINS } from '../data/seed';
import { contexteDuPelerin, versSeanceInput } from '../data/contexte';
import { useAppStore } from '../store/useAppStore';

interface Bilingue { fr: string; ar: string }

const MATRICE: Array<{ exigence: Bilingue; implementation: Bilingue; preuve: string }> = [
  {
    exigence: { fr: '8 écrans, un badge « Règle servie » et une action principale', ar: '٨ شاشات، شارة «القاعدة المطبّقة»، وإجراء رئيسي واحد' },
    implementation: { fr: 'React Router + EnteteEcran + BadgeRegle', ar: 'React Router + EnteteEcran + BadgeRegle' },
    preuve: 'tests/ui.test.tsx',
  },
  {
    exigence: { fr: 'S0 non contournable, levée par un humain', ar: 'توقف فوري لا يمكن تجاوزه، ورفعه بقرار إنساني' },
    implementation: { fr: 'evaluerArret appelé avant toute règle ; bouton de levée réservé', ar: 'يُستدعى التوقف قبل أي قاعدة؛ رفعه محصور بالمؤطر' },
    preuve: 'tests/engine.test.ts',
  },
  {
    exigence: { fr: 'R1 propose sans jamais augmenter automatiquement', ar: 'R1 تقترح دون زيادة تلقائية أبداً' },
    implementation: { fr: 'action PROPOSER + validation humaine obligatoire', ar: 'إجراء اقتراح + مصادقة بشرية إلزامية' },
    preuve: 'src/engine/regles.ts',
  },
  {
    exigence: { fr: 'Aucun seuil inventé en dur', ar: 'لا عتبات مخترعة داخل الكود' },
    implementation: { fr: 'thresholds.json est la source unique, avec statuts A_VALIDER_*', ar: 'thresholds.json هو المصدر الوحيد، بحالات A_VALIDER_*' },
    preuve: 'src/config/thresholds.json',
  },
  {
    exigence: { fr: 'IA locale niveaux 1 et 2, confirmée par la personne', ar: 'ذكاء اصطناعي محلي من المستويين ١ و٢، يؤكده الشخص' },
    implementation: { fr: 'parseur AR/Darija/FR + priorisation pondérée + écran de confirmation', ar: 'محلل عربي/دارجة/فرنسي + أولوية مرجّحة + شاشة تأكيد' },
    preuve: 'tests/ai.test.ts',
  },
  {
    exigence: { fr: 'Loi 09-08 : consentement, données nécessaires, MoBaaS', ar: 'قانون ٠٩-٠٨: موافقة، بيانات ضرورية، إخفاء هوية' },
    implementation: { fr: 'Écran 1, identifiants SYNTH-*, vues pseudonymisées et journal IA', ar: 'الشاشة ١، معرّفات SYNTH-*، عروض مخفاة وسجل للذكاء الاصطناعي' },
    preuve: 'src/pages/Accueil.tsx',
  },
  {
    exigence: { fr: 'Accessibilité senior : RTL, 20 px, 56 px, clavier', ar: 'إتاحة كبار السن: RTL، ٢٠ بكسل، ٥٦ بكسل، لوحة المفاتيح' },
    implementation: { fr: 'styles.css + bascule grand texte + aria-live + reduced-motion', ar: 'styles.css + تكبير النص + aria-live + تقليل الحركة' },
    preuve: 'tests/ui.test.tsx',
  },
];

const NIVEAUX: Array<{ code: string; role: Bilingue; garantie: Bilingue }> = [
  {
    code: '0',
    role: { fr: 'Moteur déterministe S0/R1–R6', ar: 'محرك حتمي S0/R1–R6' },
    garantie: { fr: 'Aucun diagnostic, aucune augmentation automatique.', ar: 'لا تشخيص ولا زيادة تلقائية.' },
  },
  {
    code: '1',
    role: { fr: 'Parseur local AR / Darija / FR', ar: 'محلل محلي عربي / دارجة / فرنسي' },
    garantie: { fr: 'Signaux proposés, toujours confirmés par la personne.', ar: 'إشارات مقترحة، يؤكدها الشخص دائماً.' },
  },
  {
    code: '2',
    role: { fr: 'Priorisation pondérée expliquée', ar: 'أولوية مرجّحة ومُفسَّرة' },
    garantie: { fr: 'Score affiché, priorité de sécurité inchangée.', ar: 'النتيجة معروضة، وأولوية السلامة دون تغيير.' },
  },
  {
    code: '3–4 (perspectives)',
    role: { fr: 'Assistant contextuel / apprentissage', ar: 'مساعد سياقي / تعلّم' },
    garantie: { fr: 'Non implémenté. Nécessite validation réglementaire et données réelles consenties.', ar: 'غير مُنفّذ. يحتاج مصادقة تنظيمية وبيانات حقيقية بموافقة.' },
  },
];

const LIMITES: Bilingue[] = [
  { fr: 'Aucune donnée patient réelle : tous les identifiants commencent par SYNTH-.', ar: 'لا توجد بيانات مرضى حقيقية: كل المعرّفات تبدأ بـ SYNTH-.' },
  { fr: 'Les seuils sont des placeholders à valider par le médecin référent et le spécialiste.', ar: 'العتبات قيم مؤقتة تحتاج مصادقة الطبيب المشرف والمختص.' },
  { fr: 'La priorisation IA n’est pas une décision médicale ; elle n’ajuste jamais la charge.', ar: 'أولوية الذكاء الاصطناعي ليست قراراً طبياً، ولا تعدّل الحمل أبداً.' },
  { fr: 'Le suivi Whatsapp reste un message à copier : aucun envoi automatique.', ar: 'متابعة واتساب تبقى رسالة تُنسخ: لا إرسال تلقائي.' },
  { fr: 'Le guide d’agence ne voit que statut vert/orange/rouge et alertes.', ar: 'دليل الوكالة يرى الحالة أخضر/برتقالي/أحمر والتنبيهات فقط.' },
];

interface EtapeScenario {
  titre: Bilingue;
  contexte: ContexteEvaluation;
  attendu: RuleId;
}

function construireEtapes(): EtapeScenario[] {
  const p = PELERINS[0]!;
  const seances = p.sessions.map(versSeanceInput);
  const jusquA = (n: number, aujourdHui: string) => contexteDuPelerin(
    { ...p, sessions: p.sessions.slice(0, n) },
    undefined,
    { aujourdHui },
  );

  return [
    {
      titre: { fr: 'J5 — deux efforts légers', ar: 'اليوم ٥ — مجهودان خفيفان' },
      contexte: jusquA(5, seances[4]!.date),
      attendu: 'R1',
    },
    {
      titre: { fr: 'J8 — douleur déclarée', ar: 'اليوم ٨ — ألم مُصرَّح به' },
      contexte: jusquA(8, seances[7]!.date),
      attendu: 'R4',
    },
    {
      titre: { fr: 'J9 — vertige : arrêt immédiat', ar: 'اليوم ٩ — دوخة: توقف فوري' },
      contexte: jusquA(9, seances[8]!.date),
      attendu: 'S0',
    },
    {
      titre: { fr: 'Reprise validée par un humain', ar: 'استئناف مصادَق عليه من إنسان' },
      contexte: jusquA(10, seances[9]!.date),
      attendu: 'R2',
    },
    {
      titre: { fr: 'J14 / T1 — objectif atteint', ar: 'اليوم ١٤ / T1 — بلوغ الهدف' },
      contexte: jusquA(13, seances[13]!.date),
      attendu: 'R6',
    },
  ];
}

/** Espace Jury — matrice, règles, scénario rejouable, model card, journal et limites. */
export function Jury() {
  const { t } = useTranslation();
  const langue = useAppStore((s) => s.langue);
  const aiLog = useAppStore((s) => s.aiLog);
  const [resultats, setResultats] = useState(() =>
    construireEtapes().map((etape) => ({ ...etape, decision: evaluer(etape.contexte) })),
  );
  const [derniereExecution, setDerniereExecution] = useState(() => new Date().toLocaleTimeString());

  const afficher = (v: Bilingue) => (langue === 'ar' ? v.ar : v.fr);
  const rejouer = () => {
    setResultats(construireEtapes().map((etape) => ({ ...etape, decision: evaluer(etape.contexte) })));
    setDerniereExecution(new Date().toLocaleTimeString());
  };
  const reussis = resultats.filter((r) => r.decision.ruleId === r.attendu).length;

  return (
    <div className="space-y-8">
      <section className="carte space-y-3">
        <BadgeRegle regles={['0', '1', '2']} />
        <h1 className="text-2xl font-bold">{t('jury.titre')}</h1>
        <p className="text-lg leading-relaxed opacity-80">{t('jury.intro')}</p>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">🔗 {t('jury.matrice')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-night">
                <th className="p-2">{t('jury.matriceCols.exigence')}</th>
                <th className="p-2">{t('jury.matriceCols.implementation')}</th>
                <th className="p-2">{t('jury.matriceCols.preuve')}</th>
              </tr>
            </thead>
            <tbody>
              {MATRICE.map((ligne) => (
                <tr key={ligne.exigence.fr} className="border-b border-night/10 align-top">
                  <td className="p-2 font-semibold">{afficher(ligne.exigence)}</td>
                  <td className="p-2">{afficher(ligne.implementation)}</td>
                  <td className="p-2" dir="ltr"><code>{ligne.preuve}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">⚖️ {t('jury.regles')}</h2>
        <p className="font-bold" dir="ltr">{t('jury.priorite')} : {ORDRE_PRIORITE.join(' > ')}</p>
        <p className="text-sm">{t('jury.reglesIntro')}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-night">
                <th className="p-2">ID</th>
                <th className="p-2">{t('commun.validerParSpecialiste')}</th>
                <th className="p-2">{langue === 'ar' ? 'المعايير' : 'Paramètres'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-night/10">
                <td className="p-2 font-bold" dir="ltr">S0</td>
                <td className="p-2">{libelleStatut(THRESHOLDS.arret_immediat.status)}</td>
                <td className="p-2" dir="ltr"><code>{THRESHOLDS.arret_immediat.symptomes.join(', ')}</code></td>
              </tr>
              {Object.entries(THRESHOLDS.regles).map(([id, regle]) => (
                <tr key={id} className="border-b border-night/10">
                  <td className="p-2 font-bold" dir="ltr">{id}</td>
                  <td className="p-2">{libelleStatut(regle.status)}</td>
                  <td className="p-2" dir="ltr"><code>{JSON.stringify(regle)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">🧪 {t('jury.tests')}</h2>
        <ul className="space-y-2 font-semibold">
          <li>✅ {t('jury.testsTotal')}</li>
          <li>✅ {t('jury.rappel')}</li>
          <li>✅ {t('jury.couverture')}</li>
        </ul>
        <p className="text-sm opacity-70">
          {t('jury.metriques')} · {t('jury.resultats')} : {reussis}/{resultats.length} · {derniereExecution}
        </p>
        <button className="btn-primary" onClick={rejouer}>▶️ {t('jury.lancer')}</button>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">🕒 {t('jury.scenario')}</h2>
        <p>{t('jury.scenarioIntro')}</p>
        <ol className="space-y-3">
          {resultats.map((etape, index) => (
            <li key={index} className="rounded-card border-2 border-night/20 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`font-bold ${etape.decision.ruleId === etape.attendu ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>
                  {etape.decision.ruleId === etape.attendu ? `✅ ${t('jury.reussite')}` : `❌ ${t('jury.echec')}`}
                </span>
                <strong>{afficher(etape.titre)}</strong>
              </div>
              <p className="mt-2" dir="ltr">{t('jury.attendu')} : {etape.attendu} · {t('jury.obtenu')} : {etape.decision.ruleId}</p>
              <p>{langue === 'ar' ? etape.decision.reason.ar : etape.decision.reason.fr}</p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-bold">🔍 {t('decision.audit')}</summary>
                <ol className="mt-2 list-inside list-decimal opacity-80">
                  {etape.decision.auditTrail.map((ligne, i) => <li key={i}>{ligne}</li>)}
                </ol>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">📇 {t('jury.modelCard')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-night">
                <th className="p-2">{t('jury.modelCardCols.niveau')}</th>
                <th className="p-2">{t('jury.modelCardCols.role')}</th>
                <th className="p-2">{t('jury.modelCardCols.garantie')}</th>
              </tr>
            </thead>
            <tbody>
              {NIVEAUX.map((niveau) => (
                <tr key={niveau.code} className="border-b border-night/10 align-top">
                  <td className="p-2 font-bold" dir="ltr">{niveau.code}</td>
                  <td className="p-2">{afficher(niveau.role)}</td>
                  <td className="p-2">{afficher(niveau.garantie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte space-y-4">
        <h2 className="text-xl font-bold">📝 {t('jury.journal')}</h2>
        {aiLog.length === 0 ? (
          <p>{t('jury.journalVide')}</p>
        ) : (
          <ul className="space-y-2">
            {aiLog.map((entree) => (
              <li key={entree.id} className="rounded-card border border-night/20 p-3 text-sm">
                <p className="font-bold" dir="ltr">{entree.niveau} · {entree.evenement} · {entree.at}</p>
                <p>{entree.contenu}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte space-y-3">
        <h2 className="text-xl font-bold">🚧 {t('jury.limites')}</h2>
        <p>{t('jury.limitesIntro')}</p>
        <ul className="list-inside list-disc space-y-2">
          {LIMITES.map((limite) => <li key={limite.fr}>{afficher(limite)}</li>)}
        </ul>
        <p className="text-sm opacity-70">{t('commun.nonMedical')} {t('app.bandeau')}</p>
      </section>
    </div>
  );
}
