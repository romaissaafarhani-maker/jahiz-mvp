import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnteteEcran } from '../components/EnteteEcran';
import { evaluer, reglesDeclenchees } from '../engine';
import { contexteDuPelerin, versDecision } from '../data/contexte';
import { useAppStore } from '../store/useAppStore';

type Couleur = 'vert' | 'orange' | 'rouge';
const COULEURS: Record<Couleur, string> = { vert: '🟢', orange: '🟠', rouge: '🔴' };

/** Écran 7 — tableau encadrant : statuts, alertes et validations humaines. */
export function Encadrant() {
  const { t } = useTranslation();
  const langue = useAppStore((s) => s.langue);
  const role = useAppStore((s) => s.role);
  const pelerins = useAppStore((s) => s.pelerins);
  const decisions = useAppStore((s) => s.decisions);
  const ajouterDecision = useAppStore((s) => s.ajouterDecision);
  const validerDecision = useAppStore((s) => s.validerDecision);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const estGuide = role === 'guide';

  // Alimente la file une seule fois avec les propositions nécessitant un humain.
  useEffect(() => {
    if (useAppStore.getState().decisions.length > 0) return;
    pelerins.forEach((p) => {
      reglesDeclenchees(contexteDuPelerin(p))
        .filter((d) => d.requiresHumanValidation)
        .forEach((d) => ajouterDecision(versDecision(d, p.id)));
    });
  }, [pelerins, ajouterDecision]);

  const lignes = useMemo(() => pelerins.map((p) => {
    const principale = evaluer(contexteDuPelerin(p));
    const couleur: Couleur = p.stopActif || principale.ruleId === 'S0'
      ? 'rouge'
      : ['R4', 'R5', 'R3'].includes(principale.ruleId) ? 'orange' : 'vert';
    return { p, principale, couleur };
  }), [pelerins]);

  const enAttente = decisions.filter((d) => d.requiresHumanValidation && !d.validation);

  return (
    <div className="space-y-6">
      <EnteteEcran titre="ecrans.e7.titre" regles={['R3', 'R4', 'R5']}>
        {estGuide ? t('encadrant.guideOnly') : t('encadrant.intro')}
      </EnteteEcran>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t('encadrant.statut')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {lignes.map(({ p, principale, couleur }) => (
            <li key={p.id} className="carte flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className="text-2xl">{COULEURS[couleur]}</span>
              <div className="flex-1">
                <p className="font-bold" dir="ltr">
                  {estGuide ? p.id : `${p.prenom} · ${p.id}`}
                </p>
                {!estGuide && (
                  <p className="text-sm opacity-80">
                    {langue === 'ar' ? principale.reason.ar : principale.reason.fr}
                  </p>
                )}
              </div>
              <span className="badge-regle" dir="ltr">{principale.ruleId}</span>
            </li>
          ))}
        </ul>
      </section>

      {!estGuide && (
        <section className="carte space-y-4">
          <h2 className="text-xl font-bold">📋 {t('encadrant.file')}</h2>
          {enAttente.length === 0 ? (
            <p>{t('encadrant.aucune')}</p>
          ) : (
            enAttente.map((d) => (
              <article key={d.id} className="space-y-3 rounded-card border-2 border-night/20 p-4">
                <p className="font-bold" dir="ltr">{d.ruleId} · {d.pilgrimId}</p>
                <p>{langue === 'ar' ? d.reason.ar : d.reason.fr}</p>
                <input
                  type="text"
                  aria-label={t('decision.motif')}
                  placeholder={t('decision.motif')}
                  className="min-h-[56px] w-full rounded-card border-2 border-night/30 px-4"
                  value={motifs[d.id] ?? ''}
                  onChange={(e) => setMotifs((m) => ({ ...m, [d.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => validerDecision(d.id, 'ACCEPTE')}>
                    ✅ {t('decision.accepter')}
                  </button>
                  <button className="btn-secondary" onClick={() => validerDecision(d.id, 'REJETE', motifs[d.id])}>
                    ✖️ {t('decision.rejeter')}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      <p className="text-sm opacity-70">{t('commun.nonMedical')}</p>
    </div>
  );
}
