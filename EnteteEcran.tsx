import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeRegle } from './BadgeRegle';

interface Props {
  /** Clé i18n du titre, ex. « ecrans.e3.titre ». */
  titre: string;
  regles: string[];
  children?: ReactNode;
}

/** En-tête commun : badge « Règle servie » + titre + une seule consigne courte. */
export function EnteteEcran({ titre, regles, children }: Props) {
  const { t } = useTranslation();
  return (
    <header className="space-y-3">
      <BadgeRegle regles={regles} />
      <h1 className="text-3xl font-bold leading-tight">{t(titre)}</h1>
      {children && <p className="text-lg leading-relaxed opacity-80">{children}</p>}
    </header>
  );
}
