import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { useAppStore } from '../src/store/useAppStore';

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAppStore.getState().reinitialiser();
  useAppStore.getState().setLangue('fr');
});

describe('Navigation et écrans pèlerin', () => {
  it('propose un lien d’évitement clavier et un mode grand texte', () => {
    renderApp('/');
    const lien = screen.getByRole('link', { name: /Aller au contenu principal/i });
    expect(lien).toHaveAttribute('href', '#contenu');
    expect(document.getElementById('contenu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Grand texte/i }));
    expect(document.documentElement).toHaveClass('grand-texte');
  });

  it('expose les 8 écrans plus l’espace Jury', () => {
    renderApp('/');
    const nav = screen.getByRole('navigation', { name: /Navigation des 8 écrans/i });
    expect(within(nav).getAllByRole('link')).toHaveLength(9);
  });

  it('écran 1 — le consentement est exigé avant de continuer', () => {
    renderApp('/');
    const accepter = screen.getByRole('button', { name: /J'accepte/i });
    expect(accepter).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(accepter).toBeEnabled();
    fireEvent.click(accepter);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(useAppStore.getState().consentement).toBe(true);
  });

  it('écran 3 — le programme contient 14 jours et 2 repos', () => {
    renderApp('/programme');
    expect(screen.getAllByText(/Jour\s+\d+/)).toHaveLength(14);
    expect(screen.getAllByText(/Repos/)).toHaveLength(2);
  });

  it('écran 5 — une douleur ≥ 4 déclenche R4 et alimente le journal', () => {
    renderApp('/effort');
    const echelleDouleur = screen.getByRole('group', { name: /Avez-vous mal/i });
    fireEvent.click(within(echelleDouleur).getByRole('button', { name: /4\/10/ }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Envoyer mon ressenti/i }));
    expect(screen.getByTestId('carte-decision')).toHaveTextContent('R4');
    expect(useAppStore.getState().decisions[0]?.ruleId).toBe('R4');
  });

  it('écran 5 — l’analyse IA détecte un danger et exige une confirmation avant S0', () => {
    renderApp('/effort');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Douleur thoracique depuis ce matin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyser la phrase/i }));
    expect(screen.getByRole('heading', { name: /Signaux d'arrêt détectés/i })).toBeInTheDocument();
    expect(useAppStore.getState().aiLog[0]?.evenement).toBe('DEMANDE');
    expect(screen.getByRole('button', { name: /Envoyer mon ressenti/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Confirmer ces signaux/i }));
    expect(useAppStore.getState().aiLog.some((l) => l.evenement === 'ACCEPTE')).toBe(true);
    expect(useAppStore.getState().aiLog.some((l) => l.niveau === 'NIVEAU_2')).toBe(true);
    expect(useAppStore.getState().decisions[0]?.ruleId).toBe('S0');
    expect(screen.getByTestId('arret-plein-ecran')).toBeInTheDocument();
  });

  it('écran 5 — une phrase neutre peut être rejetée sans envoyer d’alerte', () => {
    renderApp('/effort');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'J.ai bien dormi cette nuit' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyser la phrase/i }));
    expect(screen.getByRole('heading', { name: /Analyse locale/i })).toBeInTheDocument();
    expect(screen.queryByText(/Signaux d'arrêt détectés/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Rejeter l'analyse/i }));
    expect(useAppStore.getState().aiLog.some((l) => l.evenement === 'REJETE')).toBe(true);
    expect(useAppStore.getState().decisions).toHaveLength(0);
  });

  it('écran 6 — R6 est proposé après validation humaine', () => {
    renderApp('/progression');
    expect(screen.getByText(/320 m/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Voir la décision de fin de programme/i }));
    const carte = screen.getByTestId('carte-decision');
    expect(carte).toHaveTextContent('R6');
    expect(carte).toHaveTextContent(/Validation humaine requise/i);
  });

  it('écran 8 — le guide ne voit que statut et alertes', () => {
    useAppStore.getState().setRole('guide');
    renderApp('/suivi');
    expect(screen.queryByRole('button', { name: /J'ai besoin d'aide/i })).not.toBeInTheDocument();
    expect(screen.getByText(/aucun détail de santé/i)).toBeInTheDocument();
  });
});

describe('Écrans 2 et 7 — vérification de l’étape 4', () => {
  it('écran 2 — les 5 tests sont enregistrés sous un identifiant fictif', () => {
    renderApp('/t0');
    const champs = screen.getAllByRole('spinbutton');
    expect(champs).toHaveLength(5);
    fireEvent.change(champs[0]!, { target: { value: '330' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer les 5 tests/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/Tests enregistrés/i);
    expect(useAppStore.getState().pelerins[0]?.t0[0]?.value).toBe(330);
  });

  it('écran 7 — les 6 pèlerins synthétiques et la file de validation sont visibles', () => {
    renderApp('/encadrant');
    const identifiants = screen.getAllByText(/SYNTH-P00[1-6]/)
      .map((el) => el.textContent?.match(/SYNTH-P00[1-6]/)?.[0]);
    expect(new Set(identifiants).size).toBe(6);
    expect(screen.getByRole('heading', { name: /Validations en attente/i })).toBeInTheDocument();
    expect(useAppStore.getState().decisions.length).toBeGreaterThan(0);
    const accepter = screen.getAllByRole('button', { name: /Accepter/i })[0];
    if (accepter) {
      fireEvent.click(accepter);
      expect(useAppStore.getState().decisions.some((d) => d.validation === 'ACCEPTE')).toBe(true);
    }
  });

  it('écran 7 — le guide ne voit aucun détail de santé', () => {
    useAppStore.getState().setRole('guide');
    renderApp('/encadrant');
    expect(screen.getByText(/statut et alertes uniquement/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('Espace Jury (étape 6)', () => {
  it('affiche la matrice et rejoue les 5 étapes du scénario Hadj Ahmed', () => {
    renderApp('/jury');
    expect(screen.getByRole('heading', { name: /Espace Jury/i })).toBeInTheDocument();
    expect(screen.getByText(/5\/5/)).toBeInTheDocument();
    expect(screen.getAllByText(/Réussi/i)).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /Rejouer le scénario/i }));
    expect(screen.getByText(/5\/5/)).toBeInTheDocument();
  });
});

describe('Critère d’arrêt immédiat (S0)', () => {
  it('un vertige ouvre l’écran rouge et ne se lève que par un humain', () => {
    renderApp('/seance');
    fireEvent.click(screen.getByRole('button', { name: /J'ai un symptôme/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Vertige/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmer les symptômes/i }));

    expect(screen.getByTestId('arret-plein-ecran')).toBeInTheDocument();
    expect(useAppStore.getState().decisions[0]?.ruleId).toBe('S0');

    fireEvent.click(screen.getByRole('button', { name: /passer en mode encadrant/i }));
    fireEvent.click(screen.getByRole('button', { name: /Je confirme la levée/i }));
    expect(screen.queryByTestId('arret-plein-ecran')).not.toBeInTheDocument();
  });
});
