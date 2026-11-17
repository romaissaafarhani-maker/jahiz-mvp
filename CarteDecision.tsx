import { useTranslation } from 'react-i18next';
import type { DecisionMoteur } from '../engine';
import { useAppStore } from '../store/useAppStore';

interface Props {
  decision: DecisionMoteur;
  surValidation?: (approuve: boolean, motif?: string) => void;
}

export function CarteDecision({ decision, surValidation }: Props) {
  const { t } = useTranslation();
  const langue = useAppStore((s) => s.langue);
  const couleur = decision.severity === 'CRITICAL'
    ? 'border-[var(--danger)] bg-red-50'
    : decision.severity === 'WARNING'
      ? 'border-[var(--gold)] bg-amber-50'
      : 'border-night/20 bg-white';

  return (
    <section className={`rounded-card border-l-8 border-2 ${couleur} p-5 shadow-card`} data-testid="carte-decision">
      <p className="mb-1 text-sm font-bold uppercase opacity-70">{t('decision.titre')}</p>
      <p className="text-xl font-bold" dir="ltr">{decision.ruleId} · {decision.action}</p>
      <p className="mt-2" dir={langue === 'ar' ? 'rtl' : 'ltr'}>
        {langue === 'ar' ? decision.reason.ar : decision.reason.fr}
      </p>
      <p className="mt-2 text-sm font-semibold">
        {decision.requiresHumanValidation ? `⚠️ ${t('decision.requisValidation')}` : `✅ ${t('decision.appliable')}`}
      </p>

      {decision.auditTrail.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold">🔍 {t('decision.audit')}</summary>
          <ol className="mt-2 list-inside list-decimal space-y-1 opacity-80">
            {decision.auditTrail.map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ol>
        </details>
      )}

      {surValidation && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => surValidation(true)}>✅ {t('decision.accepter')}</button>
          <button className="btn-secondary" onClick={() => surValidation(false)}>✖️ {t('decision.rejeter')}</button>
        </div>
      )}
    </section>
  );
}
