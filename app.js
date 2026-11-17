/* Jahiz — démo web locale. Toutes les données affichées sont synthétiques. */

const SCREENS = [
  { id: 1, label: 'Accueil & consentement', rule: 'Sécurité · consentement', render: renderS1 },
  { id: 2, label: 'Évaluation initiale T0', rule: 'R6 · référence', render: renderS2 },
  { id: 3, label: 'Programme semaines 1–3', rule: 'R1 · R2 · R3', render: renderS3 },
  { id: 4, label: 'Séance du jour', rule: 'S0 · R1/R3 appliquées', render: renderS4 },
  { id: 5, label: 'Effort & douleur', rule: 'R1 → R4 · S0', render: renderS5 },
  { id: 6, label: 'Mon progrès', rule: 'R6', render: renderS6 },
  { id: 7, label: 'Tableau de bord encadrant', rule: 'R3 · R4 · R5', render: renderS7 },
  { id: 8, label: 'Registre quotidien', rule: 'R4 · R5 · S0', render: renderS8 },
];

const FLAG_LABELS = {
  chest_pain: '🫀 ألم/ضغط فالصدر · douleur thoracique',
  vertigo: '🌀 دوخة · vertige',
  unusual_dyspnea: '😮 ضيق نفس · essoufflement inhabituel',
  acute_joint_pain: '🦵 ألم حاد فمفصل · douleur articulaire aiguë',
};

const WEIGHTS = {
  SUSPENDRE_IMMEDIATEMENT: 100,
  ALERTER_KINE_MEDECIN: 90,
  APPEL_ENCADRANT: 50,
  RAPPEL_AUTOMATIQUE: 35,
  DEMANDER_CONFIRMATION: 30,
  PROPOSER_SECOND_CYCLE: 25,
  PROPOSER_ALLEGEMENT: 40,
  PROPOSER_AUGMENTATION_DUREE: 20,
  VALIDER_PROGRAMME: 15,
  MAINTENIR_CHARGE: 5,
};

const SCENARIO_LABELS = {
  r1: 'R1 · +10 % proposé',
  r3: 'R3 · −15 % proposé',
  r4: 'R4 · douleur NRS 5',
  s0: 'S0 · stop immédiat',
  r5: 'R5 · 3 jours sans séance',
  r6: 'R6 · T1 = 405 m',
};

let state = null;
let current = 1;
let form = { rpe: null, nrs: null, checkinState: 'BIEN', flags: [] };
let voiceResult = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

async function api(path, method = 'GET', body = null) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function refresh() {
  state = await api('/api/state');
  render();
}

async function act(path, method = 'POST', body = null) {
  try {
    const result = await api(path, method, body);
    if (result.parsed) voiceResult = result.parsed;
    await refresh();
    return result;
  } catch (error) {
    toast(`Erreur : ${error.message}`);
    return null;
  }
}

function renderNav() {
  document.getElementById('nav').innerHTML =
    '<h2>Les 8 écrans</h2>' +
    SCREENS.map((s) => `
      <button class="${current === s.id ? 'active' : ''}" data-action="go" data-screen="${s.id}">
        ${s.id}. ${esc(s.label)}
        <span class="nav-rule">${esc(s.rule)}</span>
      </button>`).join('');
}

function render() {
  if (!state) return;
  renderNav();
  const screen = SCREENS.find((s) => s.id === current) || SCREENS[0];
  document.getElementById('app').innerHTML = screen.render(state);
}

function flagBoxes() {
  return (state.red_flags || []).map((code) => `
    <label class="check">
      <input type="checkbox" name="flag" value="${code}" ${form.flags.includes(code) ? 'checked' : ''}>
      ${FLAG_LABELS[code] || code}
    </label>`).join('');
}

function readFlags() {
  return Array.from(document.querySelectorAll('input[name="flag"]:checked')).map((el) => el.value);
}

function decisionCard(decision) {
  if (!decision) return '<p class="muted">Aucune décision pour le moment. Enregistrez une séance ou choisissez un scénario.</p>';
  const trace = (decision.trace || []).map((t) => `
    <li class="trace-rule ${t.matched ? 'matched' : ''}">
      <b>${esc(t.rule_id)}</b> — ${esc(t.matched ? t.action : t.reason)}
    </li>`).join('');
  return `
    <div class="decision ${esc(decision.severity.toLowerCase())}">
      <div class="rule">${esc(decision.rule_id)} · ${esc(decision.action)}</div>
      <p>${esc(decision.explanation.fr)}</p>
      <p class="ar small">${esc(decision.explanation.ar)}</p>
      <div class="meta">
        ${decision.needs_human_validation ? '⚠️ Validation humaine requise' : '✅ Appliable'} ·
        version ${esc(decision.rule_version)} · ${esc(decision.created_at || '')}
        ${decision.validation ? ` · ${esc(decision.validation.status)}` : ''}
      </div>
      <details><summary>Trace d'explication (${(decision.trace || []).length} règles évaluées)</summary><ol>${trace}</ol></details>
    </div>`;
}

function latestDecision() {
  return state.decisions && state.decisions.length ? state.decisions[0] : null;
}

/* ------------------------------------------------------------------ I1 -- */
function renderS1() {
  return `
    <section class="card">
      <h1 class="ar" dir="rtl">مرحبا بكم في جاهز</h1>
      <p class="lead">Votre compagnon de préparation fonctionnelle pour le Hajj 1448.</p>
      <div class="box">
        <h2>Comment ça marche ?</h2>
        <div class="grid">
          <div>① <b class="ar small" dir="rtl">تقييم بسيط</b><br><span class="muted">Évaluation initiale T0 par l'encadrant</span></div>
          <div>② <b class="ar small" dir="rtl">تمارين كل يوم</b><br><span class="muted">Séances courtes, semaines 1 à 3</span></div>
          <div>③ <b class="ar small" dir="rtl">متابعة مع المؤطر</b><br><span class="muted">Alertes et validation humaine</span></div>
        </div>
      </div>
      <h2>الموافقة · Consentement (version 1.0)</h2>
      <label class="check">
        <input type="checkbox" id="consentBox" ${state.consent ? 'checked' : ''}>
        <span>J'accepte le suivi des séances, la saisie vocale en Darija et les alertes vers mon encadrant.<br>
        <span class="ar small" dir="rtl">أوافق على متابعة التمارين والتسجيل الصوتي وتنبيه المؤطر.</span></span>
      </label>
      <div class="row">
        <button class="btn" data-action="consent" ${state.consent ? 'disabled' : ''}>✅ أنا موافق · Je commence</button>
        <button class="btn ghost" data-action="go" data-screen="2">Voir l'évaluation T0 →</button>
      </div>
      <p class="muted">Scénario actuel : <b>${esc(SCENARIO_LABELS[state.scenario] || state.scenario)}</b></p>
    </section>`;
}

/* ------------------------------------------------------------------ I2 -- */
function renderS2() {
  const tests = [
    ['مشي 6 دقائق · 6MWT', `${state.t0} m`, 'Indicateur principal de R6'],
    ['النهوض من الكرسي 30ث · Sit-to-stand', '11 fois', 'Force des membres inférieurs'],
    ['الوقوف على رجل واحدة · Unilateral stance', '8 s', 'Équilibre statique'],
    ['القيام من الأرض · Get-up from floor', 'Partiel', 'Hanche / genou'],
    ['المشي والنهوض الموقوت · Timed up-and-go', '12 s', 'Mobilité dynamique'],
  ];
  return `
    <section class="card">
      <h1>Évaluation initiale <span class="ar small" dir="rtl">التقييم الأولي T0</span></h1>
      <p class="lead">Réalisée par l'encadrant — la plateforme enregistre, elle ne diagnostique pas.</p>
      <table>
        <thead><tr><th>Test fonctionnel</th><th>Résultat (synthétique)</th><th>Capacité visée</th></tr></thead>
        <tbody>${tests.map((t) => `<tr><td>${esc(t[0])}</td><td><b>${esc(t[1])}</b></td><td class="muted">${esc(t[2])}</td></tr>`).join('')}</tbody>
      </table>
      <div class="box" style="margin-top:16px">
        <label class="field">Objectif 6MWT à T1 (fixé par l'encadrant, jamais par l'IA)</label>
        <b style="font-size:28px">${state.goal} m</b>
        <p class="muted">R6 comparera T0 = ${state.t0} m, T1 = ${state.t1 === null ? 'non mesuré' : state.t1 + ' m'} et cet objectif.</p>
      </div>
      <div class="row">
        <button class="btn" data-action="save-t0">💾 حفظ التقييم T0</button>
        <button class="btn ghost" data-action="go" data-screen="3">Voir le programme →</button>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ I3 -- */
function renderS3() {
  const weeks = [
    ['1', 'بناء الأساس · construction de la base', 'MARCHE · STATION · LEVER_SOL'],
    ['2', 'تدرّج المشي · progression de la marche', 'MARCHE · ESCALIERS · RÉCUPÉRATION'],
    ['3', 'محاكاة أيام المناسك · simulation', 'JOURS CONSÉCUTIFS · HYDRATATION'],
  ];
  const pending = (state.alerts || []).find((a) => ['PROPOSER_AUGMENTATION_DUREE', 'PROPOSER_ALLEGEMENT'].includes(a.action) && a.status === 'NOUVEAU');
  return `
    <section class="card">
      <h1>Programme des semaines <span class="ar small" dir="rtl">برنامجي</span></h1>
      <p class="lead">La charge affichée est celle <b>validée par l'encadrant</b>, pas la proposition brute du moteur.</p>
      ${pending ? `<div class="decision warning"><div class="rule">⏳ Proposition en attente de validation</div><p>${esc(pending.justification)}</p></div>` : ''}
      <div class="grid">
        ${weeks.map((w) => `
          <div class="box">
            <b>Semaine ${w[0]}</b>
            <p class="ar small" dir="rtl">${esc(w[1])}</p>
            <p class="muted">${esc(w[2])}</p>
          </div>`).join('')}
      </div>
      <div class="box" style="margin-top:16px">
        <h2>Séance de marche du jour</h2>
        <p>Durée programmée : <b style="font-size:30px">${state.applied_duration} min</b>
          <span class="muted">(référence initiale : 20 min)</span></p>
      </div>
      <button class="btn" data-action="go" data-screen="4">🚶 ابدأ حصة اليوم · Démarrer la séance</button>
    </section>`;
}

/* ------------------------------------------------------------------ I4 -- */
function renderS4() {
  return `
    <section class="card">
      <h1>Séance du jour <span class="ar small" dir="rtl">حصة اليوم</span></h1>
      <p class="lead">Durée : ${state.applied_duration} min · ${state.session_active ? '● séance en cours' : ' ○ séance non démarrée'}</p>
      <div class="box">
        <h3>① قبل · avant</h3><p>🥛 Boire de l'eau · <span class="ar small" dir="rtl">اشرب الماء</span></p>
        <h3>② 🚶 المشي · marche</h3><p>Marcher à pas lents pendant ${state.applied_duration} min</p>
        <h3>③ 🧍 الوقوف · station debout</h3><p>30 secondes, transfert de poids</p>
        <h3>④ 🧘 النهوض من الأرض · lever du sol</h3><p>Avec appui si nécessaire</p>
      </div>
      <div class="box stop" style="margin-top:16px">
        <h2 style="color:var(--danger);margin-top:0">🚩 علامات التوقف · critères de stop immédiat</h2>
        ${flagBoxes()}
        <p class="muted">Cocher un drapeau puis appuyer sur STOP déclenche S0 immédiatement, sans confirmation supplémentaire.</p>
        <div class="row">
          <button class="btn danger" data-action="session-stop">🛑 أوقف فورًا · STOP</button>
          <button class="btn" data-action="session-start">▶ Démarrer</button>
        </div>
      </div>
      <button class="btn ghost" data-action="go" data-screen="5">✅ أكملت الحصة · J'ai terminé →</button>
    </section>`;
}

/* ------------------------------------------------------------------ I5 -- */
function renderS5() {
  const rpeOptions = [[2, '😊 خفيف', 'légère'], [5, '😐 متوسط', 'modérée'], [7, '😓 صعب', 'importante'], [9, '🥵 صعب بزاف', 'très forte']];
  const nrsOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return `
    <section class="card">
      <h1>Enregistrement de l'effort et de la douleur</h1>
      <p class="lead">كيف كانت الحصة؟ · Une seule action : envoyer.</p>
      <h2>المجهود · RPE (0–10)</h2>
      <div class="row">
        ${rpeOptions.map(([v, ar, fr]) => `<button class="pill ${form.rpe === v ? 'selected' : ''}" data-action="pick-rpe" data-value="${v}">${ar}<br><span class="muted">${v}/10 · ${fr}</span></button>`).join('')}
      </div>
      <h2>الألم · NRS (0–10)</h2>
      <div class="row">
        ${nrsOptions.map((v) => `<button class="pill ${form.nrs === v ? 'selected' : ''}" style="min-width:62px" data-action="pick-nrs" data-value="${v}">${v}${v >= 4 ? ' ❗' : ''}</button>`).join('')}
      </div>
      <div class="box stop" style="margin-top:16px">
        <h3 style="margin-top:0">🚩 Drapeaux de stop immédiat</h3>
        ${flagBoxes()}
      </div>
      <h2>🎙 Saisie vocale en Darija</h2>
      <label class="field">Dites ou écrivez votre ressenti</label>
      <textarea id="voiceText" dir="rtl" placeholder="راني حسيت بتعب كبير اليوم فالرجلين">${esc(state.last_voice?.parsed?.input?.raw_text || 'راني حسيت بتعب كبير اليوم فالرجلين')}</textarea>
      <div class="row">
        <button class="btn ghost small" data-action="fill-example">Exemple Darija</button>
        <button class="btn" data-action="submit-voice">🎙 Analyser la voix</button>
        ${state.last_voice?.parsed?.indicators?.rpe && !state.sessions.find((s) => s.id === state.last_voice.session_id)?.confirmed
          ? '<button class="btn warn" data-action="confirm-voice">✔️ تأكيد · Confirmer</button>' : ''}
      </div>
      <div class="row" style="margin-top:18px">
        <button class="btn" data-action="submit-effort">✅ إرسال · Envoyer la séance</button>
        <button class="btn ghost" data-action="go" data-screen="6">Voir mon progrès →</button>
      </div>
      <h2>Décision du moteur</h2>
      ${decisionCard(latestDecision())}
      ${voiceResult ? `
        <details class="box" style="margin-top:12px">
          <summary><b>Sortie structurée de l'adaptateur Darija</b></summary>
          <p class="ar" dir="rtl">${esc(voiceResult.input.raw_text)}</p>
          <p>${esc(voiceResult.normalization.french)}</p>
          <pre style="white-space:pre-wrap;font-size:14px;background:#f4f7f9;padding:12px;border-radius:10px">${esc(JSON.stringify(voiceResult.indicators, null, 2))}</pre>
        </details>` : ''}
    </section>`;
}

/* ------------------------------------------------------------------ I6 -- */
function renderS6() {
  const t1 = state.t1;
  const max = Math.max(state.goal, state.t0, t1 || 0, 1);
  const ratio = (v) => `${Math.round((v / max) * 100)}%`;
  return `
    <section class="card">
      <h1>Mon progrès <span class="ar small" dir="rtl">تقدّمي</span></h1>
      <p class="lead">Test de marche 6 minutes · indicateur de la règle R6.</p>
      <div class="box">
        <b>T0 · début</b> — ${state.t0} m
        <div class="bar"><i style="width:${ratio(state.t0)}"></i></div>
        <b>T1 · fin de cycle</b> — ${t1 === null ? 'non mesuré' : t1 + ' m'}
        <div class="bar goal"><i style="width:${ratio(t1 || 0)}"></i></div>
        <b>Objectit fixé par l'encadrant</b> — ${state.goal} m
        <p class="muted">${t1 === null ? 'Le scénario R6 permet de mesurer T1.' : `Delta : ${t1 - state.t0} m · objectif ${t1 >= state.goal ? 'atteint' : 'non atteint'}.`}</p>
      </div>
      <div class="grid" style="margin-top:14px">
        <div class="stat"><b>${state.sessions.filter((s) => s.status === 'COMPLETED').length}</b><span>séances enregistrées</span></div>
        <div class="stat"><b>${state.applied_duration}</b><span>min de marche programmées</span></div>
        <div class="stat"><b>${esc(state.program_status)}</b><span>statut du programme</span></div>
      </div>
      <div class="decision"><div class="rule">R6 · Aptitude / fin de programme</div>
        <p>La mention « جاهز نهائيًا · programme terminé » n'apparaît qu'après validation humaine de la décision R6.</p>
      </div>
      <button class="btn ghost" data-action="go" data-screen="7">Voir le tableau de bord →</button>
    </section>`;
}

/* ------------------------------------------------------------------ I7 -- */
function renderS7() {
  const alerts = (state.alerts || []).slice().map((a) => {
    const created = Date.parse(a.created_at || '') || Date.now();
    const minutes = Math.max(0, Math.round((Date.now() - created) / 60000));
    return { ...a, score: (WEIGHTS[a.action] || 10) + minutes };
  }).sort((x, y) => y.score - x.score);

  return `
    <section class="card">
      <h1>Tableau de bord de l'encadrant</h1>
      <p class="lead">لوحة المؤطر · Qui traiter en premier, et pourquoi ? Tri calculé à partir des décisions du moteur.</p>
      <div class="row">
        ${['CRITICAL', 'WARNING', 'INFO'].map((sev) => {
          const n = alerts.filter((a) => a.severity === sev).length;
          return `<div class="stat"><b>${n}</b><span>${sev}</span></div>`;
        }).join('')}
        <div class="stat"><b>${state.inactivity_days} j</b><span>sans séance</span></div>
      </div>
      <h2>Scénarios de démonstration</h2>
      <div class="row">
        ${Object.keys(SCENARIO_LABELS).map((name) => `
          <button class="btn small ${state.scenario === name ? '' : 'ghost'}" data-action="scenario" data-name="${name}">${esc(SCENARIO_LABELS[name])}</button>`).join('')}
        <button class="btn ghost small" data-action="reset">↺ Réinitialiser</button>
      </div>
      <h2>Cas prioritaires</h2>
      ${alerts.length === 0 ? '<p class="muted">Aucun cas en attente.</p>' : alerts.map((a) => {
        const decision = (state.decisions || []).find((d) => d.decision_id === a.decision_id);
        const canValidate = decision && decision.needs_human_validation && !decision.validation;
        return `
          <div class="alert ${a.severity === 'CRITICAL' ? 'critical' : ''}">
            <div class="score">${a.score}</div>
            <div>
              <div class="rule">${esc(a.rule_id)} · ${esc(a.action)}</div>
              <div class="muted">${esc(a.created_at || '')} · priorité = poids(action) + ancienneté</div>
              <p class="why">${esc(a.justification)}</p>
              <div class="row">
                <button class="btn ghost small" data-action="go" data-screen="5">Voir preuves</button>
                ${canValidate ? `
                  <button class="btn small" data-action="validate" data-id="${esc(a.decision_id)}" data-approve="true">✅ Valider</button>
                  <button class="btn danger small" data-action="validate" data-id="${esc(a.decision_id)}" data-approve="false">✖️ Refuser</button>` : ''}
                ${a.status === 'TRAITE' ? '<span class="muted">✔️ traité</span>' : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
      <h2>Dernière décision — trace complète</h2>
      ${decisionCard(latestDecision())}
    </section>`;
}

/* ------------------------------------------------------------------ I8 -- */
function renderS8() {
  const options = [
    ['BIEN', '🟢 بخير', 'Je vais bien'],
    ['FATIGUED', '🟡 تعبان', 'Je suis fatigué'],
    ['NEED_HELP', '🔴 كاين مساعدة', "J'ai besoin d'aide"],
  ];
  return `
    <section class="card">
      <h1>Registre quotidien <span class="ar small" dir="rtl">التسجيل اليومي</span></h1>
      <p class="lead">كيفاش نتا اليوم؟ · Un appui suffit, même sans savoir lire.</p>
      <div class="grid">
        ${options.map(([v, ar, fr]) => `
          <button class="pill ${form.checkinState === v ? 'selected' : ''}" style="min-height:96px;font-size:22px" data-action="pick-checkin" data-value="${v}">
            ${ar}<br><span class="muted">${fr}</span>
          </button>`).join('')}
      </div>
      <h2>Avez-vous mal ? (NRS)</h2>
      <div class="row">
        ${[0, 2, 4, 7].map((v) => `<button class="pill ${form.nrs === v ? 'selected' : ''}" data-action="pick-nrs" data-value="${v}">${v}${v >= 4 ? ' ❗' : ''}</button>`).join('')}
      </div>
      <div class="box stop" style="margin-top:16px">
        <h3 style="margin-top:0">🚩 Drapeaux de stop immédiat</h3>
        ${flagBoxes()}
      </div>
      <button class="btn" data-action="submit-checkin">✅ إرسال حالة اليوم</button>
      <p class="muted">Dernière activité : ${esc(state.last_activity || '—')} · ${state.inactivity_days} jour(s) sans séance.
        R5 : rappel WhatsApp à J2, appel de l'encadrant à J3.</p>
      <h2>Décision</h2>
      ${decisionCard(latestDecision())}
    </section>`;
}

/* --------------------------------------------------------------- Events -- */
document.getElementById('app').addEventListener('change', (event) => {
  if (event.target && event.target.name === 'flag') form.flags = readFlags();
});

// Écoute globale : les boutons d'action sont dans #app, mais la navigation
// entre les 8 écrans se trouve dans #nav. Un seul listener sur document couvre
// les deux sans dépendre de la zone de rendu.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  switch (action) {
    case 'go':
      current = Number(button.dataset.screen);
      render();
      break;
    case 'consent': {
      const box = document.getElementById('consentBox');
      if (!box || !box.checked) { toast('Veuillez cocher la case de consentement.'); break; }
      await act('/api/consent');
      toast('Consentement enregistré — version 1.0.');
      break;
    }
    case 'save-t0':
      toast('T0 enregistré (jeu de données synthétique).');
      break;
    case 'reset':
      await act('/api/reset');
      form = { rpe: null, nrs: null, checkinState: 'BIEN', flags: [] };
      voiceResult = null;
      toast('Démo réinitialisée.');
      break;
    case 'scenario':
      await act('/api/scenario', 'POST', { name: button.dataset.name });
      form = { rpe: null, nrs: null, checkinState: 'BIEN', flags: [] };
      toast(`Scénario ${SCENARIO_LABELS[button.dataset.name]} chargé.`);
      break;
    case 'session-start':
      await act('/api/session/start');
      toast('Séance démarrée.');
      break;
    case 'session-stop': {
      const flags = readFlags();
      await act('/api/session/stop', 'POST', { red_flags: flags });
      toast(flags.length ? 'S0 déclenché : arrêt immédiat et alerte critique.' : 'Séance interrompue (aucun drapeau coché).');
      break;
    }
    case 'pick-rpe':
      form.rpe = Number(button.dataset.value);
      render();
      break;
    case 'pick-nrs':
      form.nrs = Number(button.dataset.value);
      render();
      break;
    case 'pick-checkin':
      form.checkinState = button.dataset.value;
      render();
      break;
    case 'submit-effort': {
      const flags = readFlags();
      if (form.rpe === null && form.nrs === null && flags.length === 0) {
        toast('Choisissez au moins un effort, une douleur ou un drapeau.');
        break;
      }
      await act('/api/session', 'POST', { rpe: form.rpe, nrs: form.nrs, red_flags: flags, source: 'MANUAL' });
      form.rpe = null; form.nrs = null; form.flags = [];
      toast('Séance enregistrée — décision mise à jour.');
      break;
    }
    case 'fill-example': {
      const area = document.getElementById('voiceText');
      if (area) { area.value = 'راني حسيت بتعب كبير اليوم فالرجلين'; area.focus(); }
      break;
    }
    case 'submit-voice': {
      const area = document.getElementById('voiceText');
      const text = area ? area.value.trim() : '';
      if (!text) { toast('Saisissez une phrase en Darija.'); break; }
      await act('/api/voice', 'POST', { text, confirmed: false });
      toast('Voix analysée — indicateurs structurés affichés ci-dessous.');
      break;
    }
    case 'confirm-voice':
      await act('/api/confirm-voice');
      toast('Déclaration vocale confirmée — règle réévaluée.');
      break;
    case 'submit-checkin': {
      const flags = readFlags();
      await act('/api/checkin', 'POST', { state: form.checkinState, nrs: form.nrs, red_flags: flags, source: 'MANUAL' });
      form.nrs = null; form.flags = [];
      toast('État du jour enregistré.');
      break;
    }
    case 'validate': {
      await act('/api/validate', 'POST', {
        decision_id: button.dataset.id,
        approve: button.dataset.approve === 'true',
        role: 'ENCADRANT',
      });
      toast('Décision humaine enregistrée.');
      break;
    }
    default:
      break;
  }
});

refresh().catch((error) => toast(`Impossible de charger la démo : ${error.message}`));
