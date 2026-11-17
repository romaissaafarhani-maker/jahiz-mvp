import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { CarteDecision } from '../components/CarteDecision';
import { evaluer } from '../engine';
import { contexteDuPelerin } from '../data/contexte';
import { THRESHOLDS } from '../config';
import { useAppStore } from '../store/useAppStore';

/** Écran 6 — progression lisible et décision R6 si les critères sont réunis. */
export function Progression() {
  const { t } = useTranslation();
  const pelerin = useAppStore((s) => s.pelerins[0]);
  const [visible, setVisible] = useState(false);

  const decision = useMemo(() => evaluer(contexteDuPelerin(pelerin)), [pelerin]);
  const t0 = pelerin.t0.find((x) => x.code === '6MWT')?.value;
  const t1 = pelerin.t1?.find((x) => x.code === '6MWT')?.value;
  const seancesFaites = pelerin.sessions.filter((s) => s.completed).length;

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e6.titre" regles={['R6']}>
        {t('progression.intro')}
      </EnteteEcran>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="carte text-center">
          <p className="text-sm opacity-70">{t('progression.depart')}</p>
          <p dir="ltr" className="text-3xl font-bold">{t0} m</p>
        </div>
        <div className="carte text-center">
          <p className="text-sm opacity-70">{t('progression.avantDepart')}</p>
          <p dir="ltr" className="text-3xl font-bold">{t1 ?? '—'} m</p>
        </div>
        <div className="carte text-center">
          <p className="text-sm opacity-70">{t('progression.objectif')}</p>
          <p dir="ltr" className="text-3xl font-bold">
            {THRESHOLDS.programme.objectif_6mwt_par_defaut_m} m
          </p>
        </div>
      </div>

      <p className="carte text-center text-lg">📅 {seancesFaites} {t('progression.seancesFaites')}</p>
      <p className="rounded-card bg-green-50 p-4 font-bold text-[var(--ok)]">
        🌱 {t('progression.encouragement')}
      </p>

      <button className="btn-primary w-full" onClick={() => setVisible(true)}>
        🏁 {t('progression.voirR6')}
      </button>

      {visible && (
        <div className="space-y-3" aria-live="polite">
          {decision.ruleId === 'R6' ? (
            <CarteDecision decision={decision} />
          ) : (
            <p className="carte">🌱 {t('progression.pasEncore')}</p>
          )}
        </div>
      )}
    </div>
  );
}
