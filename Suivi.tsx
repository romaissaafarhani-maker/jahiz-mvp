import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { useAppStore } from '../store/useAppStore';

type Etat = 'bien' | 'fatigue' | 'besoinAide';
const ETATS: Etat[] = ['bien', 'fatigue', 'besoinAide'];
const COULEURS: Record<Etat, string> = { bien: '🟢', fatigue: '🟠', besoinAide: '🔴' };

/** Écran 8 — suivi quotidien. Le guide ne voit que statut et alertes. */
export function Suivi() {
  const { t } = useTranslation();
  const role = useAppStore((s) => s.role);
  const pelerin = useAppStore((s) => s.pelerins[0]);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [copie, setCopie] = useState(false);
  const estGuide = role === 'guide';

  const message = `${pelerin.prenom} (${pelerin.id}) — ${etat ? t(`suivi.${etat}`) : ''}. ${t('app.bandeau')}`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopie(true);
    } catch {
      setCopie(false);
    }
  };

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e8.titre" regles={['R4']}>
        {t('suivi.intro')}
      </EnteteEcran>

      {!estGuide && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {ETATS.map((e) => (
              <button
                key={e}
                className={`btn-primary flex-col ${etat === e ? '!bg-[var(--gold)]' : ''}`}
                aria-pressed={etat === e}
                onClick={() => { setEtat(e); setEnvoye(false); setCopie(false); }}
              >
                <span aria-hidden="true" className="text-3xl">{COULEURS[e]}</span>
                <span>{t(`suivi.${e}`)}</span>
              </button>
            ))}
          </div>

          <button className="btn-primary w-full" disabled={!etat} onClick={() => setEnvoye(true)}>
            📤 {t('suivi.envoyerEtat')}
          </button>
        </>
      )}

      {envoye && etat && (
        <section className="carte space-y-3" aria-live="polite">
          <h2 className="text-xl font-bold">{t('suivi.statut')}</h2>
          <p className="text-2xl font-bold">{COULEURS[etat]} {t(`suivi.${etat}`)}</p>
          <p className="rounded-card bg-cream p-4">
            {t('suivi.messageWhatsapp')} :<br /><span dir="auto">{message}</span>
          </p>
          <button className="btn-secondary" onClick={copier}>
            📋 {copie ? t('suivi.copie') : t('suivi.copier')}
          </button>
          {etat === 'besoinAide' && (
            <p className="font-bold text-[var(--danger)]">⚠️ {t('suivi.rouge')}</p>
          )}
        </section>
      )}

      {estGuide && (
        <section className="carte space-y-2">
          <p>{t('suivi.guideVue')}</p>
          <p className="font-bold">🟢 {t('suivi.vert')}</p>
          <p className="text-sm opacity-70">{t('suivi.aucuneAlerte')}</p>
        </section>
      )}
    </div>
  );
}
