import { useTranslation } from 'react-i18next';
import type { DecisionMoteur } from '../engine';
import { THRESHOLDS } from '../config';
import { useAppStore } from '../store/useAppStore';

interface Props {
  decision: DecisionMoteur;
  peutLever: boolean;
  surLever: () => void;
}

/**
 * Écran rouge plein écran : bloque toute suite de séance.
 * La levée est réservée à un humain (encadrant / médecin). Un bouton de
 * démonstration explicitement nommé permet au jury de changer de rôle.
 */
export function ArretPleinEcran({ decision, peutLever, surLever }: Props) {
  const { t } = useTranslation();
  const setRole = useAppStore((s) => s.setRole);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t('arret.titre')}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--danger)] p-5 text-white"
      data-testid="arret-plein-ecran"
    >
      <div className="max-w-2xl space-y-5 py-6 text-center">
        <p aria-hidden="true" className="text-6xl">🛑</p>
        <h1 className="text-4xl font-bold">{t('arret.titre')}</h1>
        <p className="text-2xl font-bold leading-relaxed">{THRESHOLDS.arret_immediat.message_fr}</p>
        <p dir="rtl" className="text-2xl font-bold leading-relaxed">{THRESHOLDS.arret_immediat.message_ar}</p>
        <p className="text-lg opacity-90">{decision.reason.fr}</p>
        <a href="tel:112" className="btn-primary mx-auto bg-white !text-[var(--danger)]">📞 {t('arret.appel')}</a>
        <p className="text-base">🔒 {t('arret.leve')}</p>

        {peutLever ? (
          <button
            className="btn-secondary mx-auto !border-white !bg-white/10 !text-white"
            onClick={surLever}
          >
            ✔️ {t('arret.leverAction')}
          </button>
        ) : (
          <button
            className="mx-auto block min-h-[56px] rounded-card px-4 py-2 text-sm font-bold underline"
            onClick={() => setRole('encadrant')}
          >
            🔧 {t('arret.demoRole')}
          </button>
        )}
      </div>
    </div>
  );
}
