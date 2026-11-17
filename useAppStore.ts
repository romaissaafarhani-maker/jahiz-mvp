import { create } from 'zustand';
import type { AiLogEntry, Decision, Pilgrim, Role, TestCode } from '../data/types';
import type { Langue } from '../i18n';
import { appliquerLangue } from '../i18n';
import { PELERINS } from '../data/seed';

interface AppState {
  langue: Langue;
  role: Role;
  grandTexte: boolean;
  consentement: boolean;
  pelerins: Pilgrim[];
  decisions: Decision[];
  aiLog: AiLogEntry[];
  setLangue: (l: Langue) => void;
  setRole: (r: Role) => void;
  basculerGrandTexte: () => void;
  accepterConsentement: () => void;
  enregistrerT0: (pilgrimId: string, valeurs: Array<{ code: TestCode; value: number }>) => void;
  ajouterDecision: (d: Decision) => void;
  validerDecision: (id: string, validation: 'ACCEPTE' | 'REJETE', motif?: string) => void;
  ajouterAiLog: (e: AiLogEntry) => void;
  reinitialiser: () => void;
}

const GOUVERNAILLES: Role[] = ['encadrant', 'medecin', 'guide'];
const etatInitial = () => ({
  langue: 'ar' as Langue,
  role: 'pelerin' as Role,
  grandTexte: false,
  consentement: false,
  pelerins: PELERINS.map((p) => ({ ...p, sessions: p.sessions.map((s) => ({ ...s })) })),
  decisions: [] as Decision[],
  aiLog: [] as AiLogEntry[],
});

export const useAppStore = create<AppState>((set) => ({
  ...etatInitial(),
  setLangue: (langue) => {
    appliquerLangue(langue);
    set({ langue });
  },
  setRole: (role) => set({ role }),
  basculerGrandTexte: () =>
    set((s) => {
      document.documentElement.classList.toggle('grand-texte', !s.grandTexte);
      return { grandTexte: !s.grandTexte };
    }),
  accepterConsentement: () => set({ consentement: true }),
  enregistrerT0: (pilgrimId, valeurs) =>
    set((s) => ({
      pelerins: s.pelerins.map((p) =>
        p.id === pilgrimId
          ? {
              ...p,
              t0: valeurs.map((v) => ({
                code: v.code,
                value: v.value,
                unite: p.t0.find((t) => t.code === v.code)?.unite ?? '',
              })),
            }
          : p,
      ),
    })),
  ajouterDecision: (d) => set((s) => ({ decisions: [d, ...s.decisions] })),
  validerDecision: (id, validation, motif) =>
    set((s) => ({
      decisions: s.decisions.map((d) => (d.id === id ? { ...d, validation, motif: motif || d.motif } : d)),
    })),
  ajouterAiLog: (e) => set((s) => ({ aiLog: [e, ...s.aiLog] })),
  reinitialiser: () => {
    const frais = etatInitial();
    document.documentElement.classList.remove('grand-texte');
    appliquerLangue(frais.langue);
    set(frais);
  },
}));

/** Le guide ne voit que statut + alertes, jamais les détails de santé. */
export const estGouvernail = (role: Role): boolean => GOUVERNAILLES.includes(role);
