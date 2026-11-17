export interface OptionVisage {
  value: number;
  emoji: string;
  label: string;
}

interface Props {
  titre: string;
  options: OptionVisage[];
  selection: number | null;
  onSelection: (value: number) => void;
  nom: string;
}

/** Échelle 0–10 avec visage + mot + chiffre : cible ≥ 56 px, pas de geste caché. */
export function EchelleVisages({ titre, options, selection, onSelection, nom }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xl font-bold">{titre}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const actif = selection === o.value;
          return (
            <button
              key={o.value}
              type="button"
              name={nom}
              aria-pressed={actif}
              onClick={() => onSelection(o.value)}
              className={`flex min-h-[56px] min-w-[76px] flex-col items-center justify-center rounded-card border-2 px-2 py-1 text-sm font-bold transition-colors ${
                actif ? 'border-night bg-night text-white' : 'border-night/30 bg-white hover:bg-cream'
              } ${o.value >= 4 && nom === 'nrs' && !actif ? 'text-[var(--danger)]' : ''}`}
            >
              <span aria-hidden="true" className="text-2xl leading-none">{o.emoji}</span>
              <span>{o.label}</span>
              <span dir="ltr">{o.value}/10</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
