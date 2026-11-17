import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { EchelleVisages } from '../components/EchelleVisages';
import type { OptionVisage } from '../components/EchelleVisages';
import { CarteDecision } from '../components/CarteDecision';
import { ArretPleinEcran } from '../components/ArretPleinEcran';
import { parserPhrase, prioriser } from '../ai';
import type { SignauxParis } from '../ai';
import { evaluer } from '../engine';
import type { DecisionMoteur, SeanceInput } from '../engine';
import { contexteDuPelerin, versDecision } from '../data/contexte';
import { useAppStore } from '../store/useAppStore';

/** Valeurs couvrant tous les seuils de décision (4, 5, 6, 7). */
const VALEURS_RPE = [0, 2, 4, 5, 6, 7, 9, 10];
const VALEURS_NRS = [0, 2, 3, 4, 6, 8, 10];
type ConfirmationIa = 'EN_ATTENTE' | 'ACCEPTE' | 'REJETE';
type EvenementIa = 'DEMANDE' | 'ACCEPTE' | 'REJETE';

/** Écran 5 — effort/douleur, dictée locale, IA niveau 1/2 et confirmation humaine. */
export function Effort() {
  const { t } = useTranslation();
  const pelerin = useAppStore((s) => s.pelerins[0]);
  const langue = useAppStore((s) => s.langue);
  const role = useAppStore((s) => s.role);
  const ajouterDecision = useAppStore((s) => s.ajouterDecision);
  const ajouterAiLog = useAppStore((s) => s.ajouterAiLog);

  const [rpe, setRpe] = useState<number | null>(null);
  const [nrs, setNrs] = useState<number | null>(null);
  const [phrase, setPhrase] = useState('');
  const [analyse, setAnalyse] = useState<SignauxParis | null>(null);
  const [confirmationIa, setConfirmationIa] = useState<ConfirmationIa>('EN_ATTENTE');
  const [confirme, setConfirme] = useState(false);
  const [resultat, setResultat] = useState<DecisionMoteur | null>(null);
  const [arret, setArret] = useState<DecisionMoteur | null>(null);
  const [erreur, setErreur] = useState('');

  const ancrage = (v: number) => v <= 2 ? t('effort.facile') : v <= 5 ? t('effort.moyen') : v <= 8 ? t('effort.difficile') : t('effort.tresDifficile');
  const emojiPour = (v: number) => ['😌', '🙂', '😐', '😣', '😫'][v <= 2 ? 0 : v <= 4 ? 1 : v <= 6 ? 2 : v <= 8 ? 3 : 4];

  const optionsRpe: OptionVisage[] = VALEURS_RPE.map((v) => ({ value: v, emoji: emojiPour(v), label: ancrage(v) }));
  const optionsNrs: OptionVisage[] = VALEURS_NRS.map((v) => ({ value: v, emoji: emojiPour(v), label: ancrage(v) }));

  const journaliser = (evenement: EvenementIa, contenu: string, niveau: 'NIVEAU_1' | 'NIVEAU_2' = 'NIVEAU_1') =>
    ajouterAiLog({
      id: `SYNTH-AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      niveau,
      evenement,
      contenu,
    });

  /** Reconnaissance vocale du navigateur, sans réseau : repli texte si indisponible. */
  const dicter = () => {
    const Constructeur = (window as unknown as Record<string, unknown>).SpeechRecognition
      ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (typeof Constructeur !== 'function') return;
    try {
      const reconnaissance = new (Constructeur as new () => {
        lang: string;
        onresult: (e: { results?: Array<Array<{ transcript?: string }>> }) => void;
        onerror: () => void;
        start: () => void;
      })();
      reconnaissance.lang = 'ar-MA';
      reconnaissance.onresult = (e) => {
        const texte = e.results?.[0]?.[0]?.transcript ?? '';
        if (texte) setPhrase((p) => (p ? `${p} ` : '') + texte);
      };
      reconnaissance.onerror = () => setErreur(t('effort.dicteeIndisponible'));
      reconnaissance.start();
    } catch {
      setErreur(t('effort.dicteeIndisponible'));
    }
  };

  /** Analyse locale de niveau 1 — aucune décision médicale n'est prise. */
  const analyser = () => {
    if (!phrase.trim()) {
      setErreur(t('effort.phraseVide'));
      return;
    }
    const signaux = parserPhrase(phrase);
    setAnalyse(signaux);
    setConfirmationIa('EN_ATTENTE');
    if (signaux.rpe !== undefined) setRpe(signaux.rpe);
    if (signaux.nrs !== undefined) setNrs(signaux.nrs);
    journaliser('DEMANDE', langue === 'ar' ? signaux.explication.ar : signaux.explication.fr);
    setErreur('');
  };

  const accepterAnalyse = () => {
    if (!analyse) return;
    setConfirmationIa('ACCEPTE');
    journaliser('ACCEPTE', langue === 'ar' ? analyse.explication.ar : analyse.explication.fr);
    if (!analyse.danger) return;

    const seance: SeanceInput = {
      date: new Date().toISOString().slice(0, 10),
      sessionId: `SYNTH-IA-${Date.now()}`,
      completed: false,
      rpe: null,
      nrs: null,
      symptoms: analyse.symptomes.map((s) => s.code),
    };
    const decision = evaluer(contexteDuPelerin(pelerin, seance));
    if (decision.ruleId === 'S0') {
      ajouterDecision(versDecision(decision, pelerin.id));
      setArret(decision);
    }
    const priorite = prioriser({
      graviteSymptome: 1,
      niveauDouleur: analyse.nrs ?? 0,
      joursManques: 0,
      tendanceEffort: 0,
    }, decision.ruleId);
    journaliser('DEMANDE', langue === 'ar' ? priorite.explication.ar : priorite.explication.fr, 'NIVEAU_2');
  };

  const rejeterAnalyse = () => {
    if (!analyse) return;
    setConfirmationIa('REJETE');
    journaliser('REJETE', t('effort.analyseRejetee'));
  };

  const envoyer = () => {
    if (rpe === null && nrs === null) {
      setErreur(t('effort.choisir'));
      return;
    }
    const seance: SeanceInput = {
      date: new Date().toISOString().slice(0, 10),
      sessionId: `SYNTH-EFFORT-${Date.now()}`,
      completed: true,
      rpe,
      nrs,
      symptoms: analyse?.danger && confirmationIa === 'ACCEPTE'
        ? analyse.symptomes.map((s) => s.code)
        : [],
    };
    const decision = evaluer(contexteDuPelerin(pelerin, seance));
    ajouterDecision(versDecision(decision, pelerin.id));
    setResultat(decision);
    setErreur('');
  };

  const analyseEnAttente = analyse !== null && confirmationIa === 'EN_ATTENTE';
  const peutLever = role === 'encadrant' || role === 'medecin';

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e5.titre" regles={['R1', 'R2', 'R3', 'R4']}>
        {t('effort.intro')}
      </EnteteEcran>

      <section className="carte space-y-7">
        <EchelleVisages
          titre={t('effort.effortTitre')}
          options={optionsRpe}
          selection={rpe}
          onSelection={setRpe}
          nom="rpe"
        />
        <EchelleVisages
          titre={t('effort.douleurTitre')}
          options={optionsNrs}
          selection={nrs}
          onSelection={setNrs}
          nom="nrs"
        />

        <div className="space-y-3">
          <label htmlFor="phrase-effort" className="text-xl font-bold">{t('effort.voixTitre')}</label>
          <textarea
            id="phrase-effort"
            rows={3}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={t('effort.voixPlaceholder')}
            className="w-full rounded-card border-2 border-night/30 p-4 text-lg"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={dicter}>{t('effort.mic')}</button>
            <button type="button" className="btn-secondary" onClick={analyser}>
              🔍 {t('effort.analyser')}
            </button>
          </div>
        </div>

        {analyse && (
          <section
            role="status"
            className={`space-y-3 rounded-card border-2 p-4 ${analyse.danger ? 'border-[var(--danger)] bg-red-50' : 'border-night/20 bg-amber-50'}`}
          >
            <h2 className="text-lg font-bold">
              {analyse.danger ? `🛑 ${t('effort.risqueDetecte')}` : `🔍 ${t('effort.analyseTitre')}`}
            </h2>
            {analyse.symptomes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {analyse.symptomes.map((s) => (
                  <li key={s.code} className="badge-regle" dir="ltr">
                    {s.code} · {Math.round(s.confiance * 100)}%
                  </li>
                ))}
              </ul>
            )}
            <p>{langue === 'ar' ? analyse.explication.ar : analyse.explication.fr}</p>
            <p className="text-sm opacity-70">
              {t('effort.confiance')} : {Math.round(analyse.confiance * 100)}%
            </p>
            {confirmationIa === 'EN_ATTENTE' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={accepterAnalyse}>
                  ✅ {t('effort.accepterAnalyse')}
                </button>
                <button type="button" className="btn-secondary" onClick={rejeterAnalyse}>
                  ✖️ {t('effort.rejeterAnalyse')}
                </button>
              </div>
            )}
            {confirmationIa === 'ACCEPTE' && (
              <p className="font-bold text-[var(--ok)]">✅ {t('effort.analyseAcceptee')}</p>
            )}
            {confirmationIa === 'REJETE' && (
              <p className="font-bold">{t('effort.analyseRejetee')}</p>
            )}
          </section>
        )}

        {analyseEnAttente && <p role="alert" className="font-bold">⚠️ {t('effort.aConfirmer')}</p>}

        <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border-2 border-night/20 p-4">
          <input
            type="checkbox"
            className="h-7 w-7"
            checked={confirme}
            onChange={(e) => setConfirme(e.target.checked)}
          />
          <span className="font-bold">✔️ {t('effort.confirmer')}</span>
        </label>

        {erreur && <p role="alert" className="font-bold text-[var(--danger)]">{erreur}</p>}

        <button
          className="btn-primary w-full"
          disabled={!confirme || analyseEnAttente || arret !== null}
          onClick={envoyer}
        >
          📤 {t('effort.envoyer')}
        </button>
      </section>

      {resultat && <CarteDecision decision={resultat} />}
      {arret && <ArretPleinEcran decision={arret} peutLever={peutLever} surLever={() => setArret(null)} />}
    </div>
  );
}
