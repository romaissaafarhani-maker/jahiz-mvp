import { useTranslation } from 'react-i18next';

interface Props {
  regles: string[];
}

/** Petit badge « Règle servie » présent sur chaque écran (traçabilité). */
export function BadgeRegle({ regles }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="badge-regle">
      <span className="text-sm font-semibold opacity-80">{t('commun.regleServie')} :</span>
      {regles.map((regle) => (
        <span key={regle} className="badge-regle" dir="ltr">{regle}</span>
      ))}
    </div>
  );
}
