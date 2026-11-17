import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { STATIONS, SEUILS_EVALUATION } from '../data/libelles';
import type { Niveau, TestCode } from '../data/types';
import { useAppStore } from '../store/useAppStore';

/** Retourne le niveau indicatif d'une valeur, uniquement à partir de thresholds.json. */
function niveauPour(code: TestCode, valeur: number): Niveau {
  const niveaux = SEUILS_EVALUATION[code].niveaux as Record<string, { min?: number; max?: number }>;
  if (valeur <= (niveaux.faible.max ?? Infinity)) return 'faible';
  if (valeur >= (niveaux.bon.min ?? Infinity)) return 'bon';
  return 'moyen';
}

const COULEUR_NIVEAU: Record<Niveau, string> = {
  faible: 'bg-amber-50 text-[#7a4b00]',
  moyen: 'bg-blue-50 text-[#174a7e]',
  bon: 'bg-green-50 text-[var(--ok)]',
};

/** Écran 2 — les 5 tests d'évaluation initiale, sans aucune conclusion médicale. */
export function T0() {
  const { t } = useTranslation();
  const langue = useAppStore((s) => s.langue);
  const pelerin = useAppStore((s) => s.pelerins[0]);
  const enregistrer = useAppStore((s) => s.enregistrerT0);

  const [valeurs, setValeurs] = useState<Record<string, number>>(() =>
    Object.fromEntries(pelerin.t0.map((test) => [test.code, test.value])),
  );
  const [enregistre, setEnregistre] = useState(false);

  const enregistrerTous = () => {
    enregistrer(
      pelerin.id,
      STATIONS.map((station) => ({ code: station.code as TestCode, value: valeurs[station.code] ?? 0 })),
    );
    setEnregistre(true);
  };

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e2.titre" regles={['T0']}>
        {t('t0.intro')}
      </EnteteEcran>

      <ul className="space-y-4">
        {STATIONS.map((station) => {
          const valeur = valeurs[station.code] ?? 0;
          const niveau = niveauPour(station.code as TestCode, valeur);
          const unite = SEUILS_EVALUATION[station.code as TestCode].unite;
          return (
            <li key={station.code} className="carte space-y-3">
              <div>
                <p className="text-lg font-bold">{langue === 'ar' ? station.ar : station.fr}</p>
                <p className="text-sm opacity-70" dir="ltr">{station.code} · {station.test}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={`test-${station.code}`} className="font-semibold">{t('t0.valeur')}</label>
                <input
                  id={`test-${station.code}`}
                  type="number"
                  min={0}
                  className="min-h-[56px] w-32 rounded-card border-2 border-night/30 px-4 text-lg"
                  value={valeur}
                  onChange={(e) => {
                    setValeurs((v) => ({ ...v, [station.code]: Number(e.target.value) }));
                    setEnregistre(false);
                  }}
                />
                <span dir="ltr" className="font-semibold opacity-80">{unite}</span>
                <span className={`rounded-card px-3 py-1 text-sm font-bold ${COULEUR_NIVEAU[niveau]}`}>
                  {t(`t0.niveau.${niveau}`)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="rounded-card bg-amber-50 p-4 text-sm">{t('t0.attention')}</p>

      <button className="btn-primary w-full" onClick={enregistrerTous}>
        💾 {t('ecrans.e2.action')}
      </button>

      {enregistre && (
        <p role="status" className="rounded-card bg-green-50 p-4 font-bold text-[var(--ok)]">
          ✅ {t('t0.enregistre')}
        </p>
      )}
    </div>
  );
}
