import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { useAppStore } from '../store/useAppStore';

/** Écran 1 — consentement éclairé (loi 09-08), une seule action principale. */
export function Accueil() {
  const { t } = useTranslation();
  const consentement = useAppStore((s) => s.consentement);
  const accepter = useAppStore((s) => s.accepterConsentement);
  const role = useAppStore((s) => s.role);
  const [lu, setLu] = useState(false);

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e1.titre" regles={['Sécurité', 'Loi 09-08']}>
        {t('accueil.intro')}
      </EnteteEcran>

      {role === 'accompagnateur' && (
        <p className="rounded-card border-2 border-[var(--gold)] bg-amber-50 p-4">
          🤝 {t('accueil.accompagnateurNote')}
        </p>
      )}

      <section className="carte space-y-5">
        <h2 className="text-xl font-bold">{t('accueil.consentTitre')}</h2>
        <ul className="list-inside list-disc space-y-2 leading-relaxed">
          {[1, 2, 3, 4].map((n) => <li key={n}>{t(`accueil.consent${n}`)}</li>)}
        </ul>

        <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border-2 border-night/20 p-4">
          <input
            type="checkbox"
            className="h-7 w-7"
            checked={lu || consentement}
            disabled={consentement}
            onChange={(e) => setLu(e.target.checked)}
          />
          <span className="font-bold">{t('accueil.case')}</span>
        </label>

        {!consentement ? (
          <button className="btn-primary w-full" disabled={!lu} onClick={accepter}>
            ✅ {t('ecrans.e1.action')}
          </button>
        ) : (
          <div className="space-y-4">
            <p role="status" className="rounded-card bg-green-50 p-4 font-bold text-[var(--ok)]">
              ✅ {t('commun.continuer')}
            </p>
            <Link to="/programme" className="btn-primary w-full">➡️ {t('ecrans.e3.titre')}</Link>
          </div>
        )}
      </section>

      <p className="text-sm opacity-70">{t('commun.nonMedical')}</p>
    </div>
  );
}
