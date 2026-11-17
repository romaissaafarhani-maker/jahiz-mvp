import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { PROGRAMME_14_JOURS } from '../data/programme';
import { LIBELLE_EXERCICE, PICTO_EXERCICE } from '../data/libelles';
import { THRESHOLDS } from '../config';
import { useAppStore } from '../store/useAppStore';

/** Écran 3 — programme lisible des 14 jours (12 séances + 2 repos). */
export function Programme() {
  const { t } = useTranslation();
  const langue = useAppStore((s) => s.langue);

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e3.titre" regles={['R1', 'R2', 'R3']}>
        {t('programme.intro')}
      </EnteteEcran>

      <section className="carte space-y-1">
        <p className="text-lg font-bold">
          🎯 {t('programme.objectif')} : <span dir="ltr">{THRESHOLDS.programme.objectif_6mwt_par_defaut_m} m</span>
        </p>
        <p className="text-sm opacity-70">{t('commun.validerParSpecialiste')}</p>
      </section>

      <p className="rounded-card border-2 border-[var(--gold)] bg-amber-50 p-4">
        ⏳ {t('programme.propositionEnAttente')}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2" aria-label={t('ecrans.e3.titre')}>
        {PROGRAMME_14_JOURS.map((jour) => (
          <li
            key={jour.jour}
            className={`carte flex flex-wrap items-center gap-3 ${jour.type === 'repos' ? 'opacity-70' : ''}`}
          >
            <span dir="ltr" className="rounded-full bg-night px-3 py-2 font-bold text-white">
              {t('programme.jour')} {jour.jour}
            </span>
            <div className="flex flex-1 flex-wrap gap-2">
              {jour.type === 'repos' ? (
                <span className="font-bold">🛌 {t('programme.repos')}</span>
              ) : (
                jour.exercices.map((exercice) => (
                  <span key={exercice} className="rounded-card bg-cream px-3 py-1 text-sm font-semibold">
                    {PICTO_EXERCICE[exercice]}{' '}
                    {langue === 'ar' ? LIBELLE_EXERCICE[exercice]?.ar : LIBELLE_EXERCICE[exercice]?.fr}
                  </span>
                ))
              )}
            </div>
            {jour.type === 'seance' && (
              <span dir="ltr" className="text-sm font-bold">⏱ {jour.dureeMin} {t('programme.minutes')}</span>
            )}
          </li>
        ))}
      </ul>

      <Link to="/seance" className="btn-primary w-full">▶️ {t('programme.voirSeance')}</Link>
    </div>
  );
}
