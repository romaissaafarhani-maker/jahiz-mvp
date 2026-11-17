import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/useAppStore';
import { Accueil } from './pages/Accueil';
import { T0 } from './pages/T0';
import { Encadrant } from './pages/Encadrant';
import { Programme } from './pages/Programme';
import { Seance } from './pages/Seance';
import { Effort } from './pages/Effort';
import { Progression } from './pages/Progression';
import { Suivi } from './pages/Suivi';
import { Jury } from './pages/Jury';
import type { Role } from './data/types';

const ECRANS = [
  { chemin: '/', cle: 'e1', regles: ['Sécurité', 'Loi 09-08'] },
  { chemin: '/t0', cle: 'e2', regles: ['T0'] },
  { chemin: '/programme', cle: 'e3', regles: ['R1', 'R2', 'R3'] },
  { chemin: '/seance', cle: 'e4', regles: ['Matrice', 'S0'] },
  { chemin: '/effort', cle: 'e5', regles: ['R1', 'R2', 'R3', 'R4'] },
  { chemin: '/progression', cle: 'e6', regles: ['R6'] },
  { chemin: '/encadrant', cle: 'e7', regles: ['R3', 'R4', 'R5'] },
  { chemin: '/suivi', cle: 'e8', regles: ['R4'] },
] as const;

const ROLES: Role[] = ['pelerin', 'accompagnateur', 'encadrant', 'medecin', 'guide'];

function Coquille() {
  const { t } = useTranslation();
  const { langue, role, grandTexte, setLangue, setRole, basculerGrandTexte, reinitialiser } = useAppStore();

  return (
    <div className="min-h-screen">
      <a href="#contenu" className="skip-link">{t('commun.allerContenu')}</a>
      <div className="bandeau" role="note">
        <strong>{t('app.bandeau')}</strong> · {t('app.bandeauComplement')}
      </div>

      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div>
          <p className="text-2xl font-bold" dir="rtl">{t('app.nom')}</p>
          <p className="text-sm opacity-80">{t('app.sousTitre')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            {t('demo.role')}
            <select
              className="min-h-[56px] rounded-card border-2 border-night bg-white px-3"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label={t('demo.role')}
            >
              {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </select>
          </label>
          <button className="btn-secondary text-sm" onClick={() => setLangue(langue === 'ar' ? 'fr' : 'ar')}>
            🌐 {langue === 'ar' ? 'FR' : 'العربية'}
          </button>
          <button className="btn-secondary text-sm" onClick={basculerGrandTexte} aria-pressed={grandTexte}>
            🔠 {t('demo.grandTexte')}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 md:grid-cols-[240px_1fr]">
        <nav aria-label="Navigation des 8 écrans" className="carte h-fit md:sticky md:top-4">
          <p className="mb-3 text-sm font-bold uppercase opacity-70">8 écrans</p>
          <ul className="space-y-1">
            {ECRANS.map((e) => (
              <li key={e.cle}>
                <NavLink
                  to={e.chemin}
                  end={e.chemin === '/'}
                  className={({ isActive }) =>
                    `block min-h-[56px] rounded-card px-3 py-2 text-sm font-semibold ${
                      isActive ? 'bg-night text-white' : 'hover:bg-gold/10'
                    }`
                  }
                >
                  {t(`nav.${e.cle}`)}
                </NavLink>
              </li>
            ))}
          </ul>
          <Link to="/jury" className="btn-secondary mt-4 w-full text-sm">⚖️ {t('demo.jury')}</Link>
        </nav>

        <main id="contenu" tabIndex={-1} aria-live="polite"><Outlet /></main>
      </div>

      <footer className="border-t border-black/10 bg-white px-4 py-5 text-center text-sm">
        <Link to="/jury" className="font-bold underline">{t('demo.jury')}</Link>
        <span className="mx-3 opacity-40">·</span>
        <button onClick={reinitialiser} className="underline">↺ {t('demo.reinitialiser')}</button>
        <p className="mt-2 opacity-70">{t('app.bandeau')}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Coquille />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/t0" element={<T0 />} />
        <Route path="/programme" element={<Programme />} />
        <Route path="/seance" element={<Seance />} />
        <Route path="/effort" element={<Effort />} />
        <Route path="/progression" element={<Progression />} />
        <Route path="/encadrant" element={<Encadrant />} />
        <Route path="/suivi" element={<Suivi />} />
        <Route path="/jury" element={<Jury />} />
      </Route>
    </Routes>
  );
}
