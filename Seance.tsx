import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { ArretPleinEcran } from '../components/ArretPleinEcran';
import { evaluer } from '../engine';
import type { DecisionMoteur, SeanceInput } from '../engine';
import type { SymptomCode } from '../data/types';
import { contexteDuPelerin, versDecision } from '../data/contexte';
import { useAppStore } from '../store/useAppStore';

const SYMPTOMES: Array<{ code: SymptomCode; cle: string; emoji: string }> = [
  { code: 'chestPain', cle: 'seance.symptomeChest', emoji: '💓' },
  { code: 'dizzinessOrSyncope', cle: 'seance.symptomeDizzy', emoji: '💫' },
  { code: 'unusualBreathlessness', cle: 'seance.symptomeBreath', emoji: '😮' },
  { code: 'severeJointPain', cle: 'seance.symptomeJoint', emoji: '🦵' },
];

/** Écran 4 — séance courte, minuteur non bloquant et critère d'arrêt S0. */
export function Seance() {
  const { t } = useTranslation();
  const pelerin = useAppStore((s) => s.pelerins[0]);
  const role = useAppStore((s) => s.role);
  const ajouterDecision = useAppStore((s) => s.ajouterDecision);

  const [demarree, setDemarree] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [panneau, setPanneau] = useState(false);
  const [symptomes, setSymptomes] = useState<SymptomCode[]>([]);
  const [arret, setArret] = useState<DecisionMoteur | null>(null);

  useEffect(() => {
    if (!demarree) return;
    const id = window.setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [demarree]);

  const basculer = (code: SymptomCode) =>
    setSymptomes((liste) => liste.includes(code) ? liste.filter((s) => s !== code) : [...liste, code]);

  const confirmerSymptomes = () => {
    const seance: SeanceInput = {
      date: new Date().toISOString().slice(0, 10),
      sessionId: `SYNTH-SEANCE-${Date.now()}`,
      completed: false,
      rpe: null,
      nrs: null,
      symptoms: symptomes,
    };
    const decision = evaluer(contexteDuPelerin(pelerin, seance));
    ajouterDecision(versDecision(decision, pelerin.id));
    if (decision.ruleId === 'S0') {
      setArret(decision);
      setDemarree(false);
      setPanneau(false);
    }
  };

  const leverArret = () => {
    setArret(null);
    setSymptomes([]);
    setSecondes(0);
  };

  const peutLever = role === 'encadrant' || role === 'medecin';

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e4.titre" regles={['Matrice', 'S0']}>
        {t('seance.intro')}
      </EnteteEcran>

      <ol className="carte list-inside list-decimal space-y-3 leading-relaxed">
        <li>🧘 <strong>{t('seance.avant')}</strong> — {t('seance.avantTexte')}</li>
        <li>🚶 <strong>{t('seance.pendant')}</strong> — {pelerin.prenom}</li>
        <li>🪑 <strong>{t('seance.apres')}</strong> — {t('seance.apresTexte')}</li>
      </ol>

      {demarree && (
        <p className="carte text-center text-2xl font-bold">
          ⏱ {t('seance.minuteur')} :{' '}
          <span dir="ltr">
            {String(Math.floor(secondes / 60)).padStart(2, '0')}:{String(secondes % 60).padStart(2, '0')}
          </span>
        </p>
      )}

      <button className="btn-primary w-full" onClick={() => setDemarree((d) => !d)}>
        {demarree ? `⏸ ${t('seance.pause')}` : `▶️ ${t('seance.demarrer')}`}
      </button>

      <button className="btn-danger w-full" onClick={() => setPanneau((p) => !p)} aria-expanded={panneau}>
        🛑 {t('seance.jaiUnSymptome')}
      </button>

      {panneau && (
        <section className="carte space-y-4 border-4 border-[var(--danger)]">
          <h2 className="text-xl font-bold">{t('seance.symptomesTitre')}</h2>
          {SYMPTOMES.map((sym) => (
            <label key={sym.code} className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border-2 border-night/20 p-3">
              <input
                type="checkbox"
                className="h-7 w-7"
                checked={symptomes.includes(sym.code)}
                onChange={() => basculer(sym.code)}
              />
              <span>{sym.emoji} {t(sym.cle)}</span>
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn-danger" disabled={symptomes.length === 0} onClick={confirmerSymptomes}>
              🛑 {t('seance.confirmerSymptomes')}
            </button>
            <button className="btn-secondary" onClick={() => { setSymptomes([]); setPanneau(false); }}>
              ✔️ {t('seance.aucunSymptome')}
            </button>
          </div>
        </section>
      )}

      <p className="text-sm opacity-70">{t('commun.nonMedical')}</p>

      {arret && <ArretPleinEcran decision={arret} peutLever={peutLever} surLever={leverArret} />}
    </div>
  );
}
