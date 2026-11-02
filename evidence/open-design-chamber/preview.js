/* WORLD//PATCH design demonstration ONLY.
   Do not ship this script in the game. No physics, solver, server, or Twitch API.
   All counts start at zero; all added votes come from local button presses. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const svgNS = 'http://www.w3.org/2000/svg';
  const baseline = { gravity: 'down', ice: 'on', portals: 'paired', walls: 'solid' };
  const labels = { gravity: 'Gravity', ice: 'Ice', portals: 'Portal pairs', walls: 'Walls' };
  const choices = [
    { id: 1, law: 'gravity', value: 'left', label: 'Gravity: left' },
    { id: 2, law: 'gravity', value: 'right', label: 'Gravity: right' },
    { id: 3, law: 'gravity', value: 'up', label: 'Gravity: up' },
    { id: 4, law: 'gravity', value: 'down', label: 'Gravity: down' },
    { id: 5, law: 'ice', value: 'off', label: 'Ice: off' },
    { id: 6, law: 'ice', value: 'on', label: 'Ice: on' },
    { id: 7, law: 'portals', value: 'crossed', label: 'Portals: 0↔3 / 1↔2' },
    { id: 8, law: 'walls', value: 'wrap', label: 'Walls: wrap' }
  ];
  const scenes = {
    play: { title: 'Your move.', description: 'Explore the chamber under the active laws.', next: 'Open proposals', go: 'proposing', clock: '—', note: 'PLAY' },
    proposing: { title: 'One small change.', description: 'A bounded law. A frozen checkpoint. An escape.', next: 'Open 8-choice vote', go: 'voting', clock: '00:45', note: 'HELD' },
    voting: { title: 'Choose the next law.', description: '8 bounded choices. Votes here are simulated.', next: 'Merge selected law', go: 'merge', clock: '00:30', note: 'HELD' },
    merge: { title: 'One law changes.', description: 'A simulated merge; the player stays put.', next: 'Show witness example', go: 'revealed', clock: '—', note: 'MERGE' },
    revealed: { title: 'An escape, illustrated.', description: 'Read the change. Inspect the witness source.', next: 'Return to play', go: 'play', clock: '—', note: 'REVEAL' },
    paused: { title: 'Chamber on hold.', description: 'The preview is paused. Laws and votes are retained.', next: 'Resume preview', go: 'play', clock: '—', note: 'PAUSED' }
  };
  const witnessPoints = [[172,452],[228,452],[284,452],[340,452],[396,452],[676,228],[732,228],[788,228],[788,172],[788,116]];
  const witnessSymbols = ['S','→','→','K','0','1','→','→','↑','E'];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userReduced = false;
  let state = {
    phase: 'voting', view: 'controller', selected: 1, laws: { ...baseline },
    votes: Object.fromEntries(choices.map((item) => [item.id, 0])), proposals: [],
    receipt: null, step: 0, resume: 'voting', history: ['Fixture loaded'], serial: 0
  };
  let playback = null;
  let feedbackTimer = null;
  let activeFeedbackId = null;
  const seenReceiptIds = new Set();
  const reduced = () => media.matches || userReduced;
  const text = (id, value) => { $(id).textContent = value; };
  const hide = (id, hidden) => { $(id).hidden = hidden; };
  const say = (message) => { text('announcement', message); };
  const selected = () => choices.find((item) => item.id === state.selected);
  const valueLabel = (law, value) => law === 'portals' ? (value === 'crossed' ? '0↔3 / 1↔2' : '0↔1 / 2↔3') : value;
  const exactChange = (receipt) => labels[receipt.law] + ': ' + valueLabel(receipt.law, receipt.before) + ' → ' + valueLabel(receipt.law, receipt.after);
  const totalVotes = () => Object.values(state.votes).reduce((sum, n) => sum + n, 0);

  function make(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function record(message) {
    state.history.unshift(message);
    state.history = state.history.slice(0, 12);
    text('latest-event', message);
    $('event-history').replaceChildren(...state.history.map((entry) => make('li', '', entry)));
  }

  function stopPlayback() {
    window.clearInterval(playback);
    playback = null;
    text('replay-play', 'Play example');
    $('replay-play').setAttribute('aria-pressed', 'false');
  }

  function cancelFeedback() {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
    activeFeedbackId = null;
    hide('merge-confirmation', true);
    hide('merge-flash', true);
    hide('checkpoint-readout', false);
    app.querySelectorAll('.law-change').forEach((node) => node.classList.remove('law-change'));
  }

  // Called for a newly created illustrative receipt, never by render(), vote
  // updates, surface switches, or unrelated snapshots. Deduplication survives
  // cancellation; another unique receipt can still animate later.
  function presentReceipt(receipt) {
    if (!receipt || seenReceiptIds.has(receipt.id)) return;
    seenReceiptIds.add(receipt.id);
    cancelFeedback();
    if (receipt.before === receipt.after) return;
    activeFeedbackId = receipt.id;
    text('merge-confirmation', exactChange(receipt));
    hide('checkpoint-readout', true);
    hide('merge-confirmation', false);
    hide('merge-flash', false);
    app.querySelector('.laws-strip [data-law="' + receipt.law + '"]').classList.add('law-change');
    feedbackTimer = window.setTimeout(() => {
      if (activeFeedbackId === receipt.id) cancelFeedback();
    }, 900);
    say('Simulated merge. ' + exactChange(receipt) + '. No server proof. Player unchanged.');
  }

  function renderLaws() {
    const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
    const gravity = state.laws.gravity;
    text('law-gravity', arrows[gravity] + ' ' + gravity[0].toUpperCase() + gravity.slice(1));
    text('gravity-label', gravity.toUpperCase());
    const directions = { down: 'M0 0V64M-6 56 0 64 6 56', up: 'M0 64V0M-6 8 0 0 6 8', left: 'M0 48H-40M-32 42-40 48-32 54', right: 'M0 48H40M32 42 40 48 32 54' };
    $('gravity-arrow').setAttribute('d', directions[gravity]);
    text('law-ice', state.laws.ice === 'on' ? 'On' : 'Off');
    const pairs = state.laws.portals === 'crossed' ? ['0↔3', '1↔2'] : ['0↔1', '2↔3'];
    $('law-portals').replaceChildren(make('span', 'portal-pair', pairs[0]), document.createTextNode(' / '), make('span', 'portal-pair', pairs[1]));
    text('law-walls', state.laws.walls === 'wrap' ? 'Wrap' : 'Solid');
    $('ice-fixture').style.opacity = state.laws.ice === 'on' ? '1' : '0.18';
    // No player coordinate is changed here, including when a law merges.
  }

  function renderCandidates(restoreFocus) {
    const list = state.phase === 'voting' ? choices : state.phase === 'proposing' ? choices.filter((item) => state.proposals.includes(item.id)) : [];
    app.classList.toggle('dense-ballot', list.length > 2);
    const fragment = document.createDocumentFragment();
    list.forEach((item) => {
      const article = make('article', 'candidate' + (state.selected === item.id ? ' is-selected' : ''));
      article.dataset.candidate = String(item.id);
      article.setAttribute('aria-label', 'Option ' + item.id + '. ' + item.label + '. Illustrative, not verified.');
      const top = make('div', 'candidate-top');
      top.append(make('span', 'candidate-number', String(item.id).padStart(2, '0')), make('span', 'verified-small', 'Example law'));
      if (state.phase === 'proposing' && state.view === 'controller') {
        const remove = make('button', 'candidate-remove', '×');
        remove.type = 'button'; remove.dataset.remove = String(item.id);
        remove.setAttribute('aria-label', 'Remove example ' + item.id + ': ' + item.label);
        top.append(remove);
      }
      const heading = make('h3');
      if (state.view === 'controller') {
        const pick = make('button', 'candidate-pick', item.label);
        pick.type = 'button'; pick.dataset.pick = String(item.id);
        pick.setAttribute('aria-pressed', String(state.selected === item.id));
        pick.setAttribute('aria-label', 'Select option ' + item.id + ': ' + item.label + ' for simulated merge');
        heading.append(pick);
      } else heading.textContent = item.label;
      const bottom = make('div', 'candidate-bottom');
      if (state.view === 'controller' && state.phase === 'voting') {
        const vote = make('button', 'vote-button');
        vote.type = 'button'; vote.dataset.vote = String(item.id);
        vote.setAttribute('aria-label', 'Add one simulated vote for option ' + item.id);
        vote.append(make('code', '', '!vote ' + item.id)); bottom.append(vote);
      } else bottom.append(make('code', '', '!vote ' + item.id));
      bottom.append(make('span', 'vote-count', state.votes[item.id] + ' votes'));
      const track = make('div', 'vote-track');
      track.setAttribute('aria-hidden', 'true');
      const bar = make('span');
      bar.style.setProperty('--vote-share', String(totalVotes() ? state.votes[item.id] / totalVotes() : 0));
      track.append(bar);
      article.append(top, heading, bottom, track);
      fragment.append(article);
    });
    $('candidates').replaceChildren(fragment);
    hide('candidates', list.length === 0);
    hide('ballot-heading', list.length === 0 || state.view === 'broadcast');
    text('ballot-total', String(list.length).padStart(2, '0') + ' / BOUNDED CHOICES');
    text('vote-total', totalVotes() + ' SIMULATED VOTES');
    if (state.phase === 'voting') text('phase-description', '8 choices · ' + totalVotes() + ' simulated votes · no live data');
    if (restoreFocus) {
      const target = $('candidates').querySelector(restoreFocus);
      if (target) target.focus({ preventScroll: true });
      else if (state.phase === 'proposing') $('add-proposal').focus({ preventScroll: true });
    }
  }

  function renderFocus() {
    const item = selected();
    const receipt = state.receipt;
    const law = receipt ? receipt.law : item.law;
    const before = receipt ? receipt.before : state.laws[item.law];
    const after = receipt ? receipt.after : item.value;
    const title = $('law-focus-title');
    title.replaceChildren(document.createTextNode(labels[law] + ' '), make('span', 'law-before', valueLabel(law, before)), document.createTextNode(' → '), make('span', 'law-after', valueLabel(law, after)));
    text('law-focus-kicker', receipt ? 'Last simulated change' : 'Selected change / fixture');
    text('law-focus-copy', receipt && receipt.before === receipt.after ? 'This value was already active. No law changed and no merge cue was triggered.' : 'Only this law changes. The player stays at the frozen checkpoint.');
    text('receipt-id', receipt ? receipt.id + ' (local example)' : 'No merge receipt');
    text('receipt-change', receipt ? exactChange(receipt) : 'No merged law');
    text('receipt-source', receipt ? receipt.id + ' · local fixture · no server proof' : 'C-014 · authored example · no server proof');
    text('receipt-status', 'FIXTURE ONLY');
  }

  function renderWitness() {
    const last = witnessPoints.length - 1;
    const shown = state.phase === 'revealed';
    hide('witness-drawing', !shown);
    const point = witnessPoints[state.step];
    $('witness-marker').setAttribute('transform', 'translate(' + point[0] + ' ' + point[1] + ')');
    $('witness-path').setAttribute('points', witnessPoints.slice(0, state.step + 1).map((p) => p.join(',')).join(' '));
    $('witness-sequence').replaceChildren(...witnessSymbols.map((symbol, i) => {
      const frame = make('span', i === state.step ? 'is-current' : i < state.step ? 'is-past' : '', symbol);
      frame.setAttribute('aria-label', 'Frame ' + i + ': ' + symbol);
      if (i === state.step) frame.setAttribute('aria-current', 'step');
      return frame;
    }));
    text('step-counter', 'FRAME ' + String(state.step).padStart(2, '0') + ' / ' + String(last).padStart(2, '0'));
    text('escape-label', state.step === last ? 'Exit illustrated · not verified' : reduced() ? 'Reduced motion · use step controls' : 'Example ready · no proof loaded');
    $('replay-back').disabled = state.step === 0;
    $('replay-step').disabled = state.step === last;
    $('replay-play').disabled = reduced();
    $('replay-play').title = reduced() ? 'Reduced motion is enabled. Use Back, Step, or Reset.' : 'Play the authored illustration; not an engine replay.';
  }

  function render({ phaseChanged = false } = {}) {
    const scene = scenes[state.phase];
    ['play','proposing','voting','revealed','paused'].forEach((name) => app.classList.remove('phase-' + name));
    app.classList.add('phase-' + (state.phase === 'merge' ? 'revealed' : state.phase));
    app.classList.toggle('overlay', state.view === 'broadcast');
    app.dataset.reducedMotion = String(reduced());
    document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    $('scene-select').value = state.phase;
    text('mode-badge', 'SIMULATION · ' + state.view.toUpperCase());
    if (phaseChanged) {
      const copy = $('phase-copy').cloneNode(false);
      copy.append(make('h2', '', scene.title));
      copy.firstChild.id = 'phase-title';
      $('phase-copy').replaceWith(copy);
    } else text('phase-title', scene.title);
    text('phase-description', scene.description);
    text('countdown-value', scene.clock); text('countdown-note', scene.note);
    text('host-next', scene.next + ' ↗');
    text('host-pause', state.phase === 'paused' ? 'Resume' : 'Pause');
    const rail = state.phase === 'proposing' ? 'proposing' : state.phase === 'voting' ? 'voting' : 'escape';
    app.querySelectorAll('[data-phase-step]').forEach((node) => {
      if (state.phase !== 'paused' && node.dataset.phaseStep === rail) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    renderCandidates();
    const empty = state.phase === 'play' || state.phase === 'paused' || (state.phase === 'proposing' && !state.proposals.length);
    hide('empty-state', !empty);
    text('empty-title', state.phase === 'paused' ? 'Take a breath.' : state.phase === 'play' ? 'The chamber is yours.' : 'The next law starts with chat.');
    text('empty-copy', state.phase === 'paused' ? 'Resume when ready. The last law and every simulated vote are still here.' : state.phase === 'play' ? 'Active laws stay beside the board. Open proposals when it is time for the next change.' : 'No fixture proposals yet. Add an example to inspect the proposal state.');
    hide('proposal-form', state.phase !== 'proposing' || state.view === 'broadcast');
    hide('proposal-status', state.phase !== 'proposing' || state.view === 'broadcast');
    hide('law-focus', !['merge','revealed'].includes(state.phase) && !(state.phase === 'play' && state.receipt));
    hide('replay-card', state.phase !== 'revealed');
    hide('chat-cheatsheet', !['proposing','voting'].includes(state.phase));
    text('receipt-title', state.phase === 'revealed' ? 'Witness source' : state.phase === 'merge' ? 'Merge receipt source' : 'Witness source');
    renderLaws(); renderFocus(); renderWitness();
  }

  function changePhase(next) {
    if (!scenes[next] || next === state.phase) return;
    const previous = state.phase;
    stopPlayback();
    cancelFeedback();
    if (next === 'paused') state.resume = previous;
    state.phase = next;
    if (next === 'revealed') state.step = state.view === 'broadcast' ? witnessPoints.length - 1 : 0;
    if (next === 'merge') {
      const item = selected();
      state.serial += 1;
      state.receipt = { id: 'preview-' + String(state.serial).padStart(3, '0'), law: item.law, before: state.laws[item.law], after: item.value };
      state.laws[item.law] = item.value;
      record(state.receipt.before === state.receipt.after ? 'Selected value already active. No simulated law change.' : 'Simulated merge · ' + exactChange(state.receipt));
    } else record('Preview scene · ' + (next === 'revealed' ? 'witness illustration' : next));
    render({ phaseChanged: true });
    if (next === 'merge') presentReceipt(state.receipt);
    else say(sceneAnnouncement(next));
  }

  function sceneAnnouncement(phase) { return scenes[phase].title + ' Design preview only.'; }

  function changeView(view) {
    if (!['controller','broadcast'].includes(view) || view === state.view) return;
    stopPlayback();
    state.view = view;
    if (state.phase === 'revealed' && view === 'broadcast') state.step = witnessPoints.length - 1;
    // No cancel/present call: changing the review surface does not restart a cue.
    render();
    say(view === 'broadcast' ? 'Broadcast preview. Host controls removed. All ballot options retained.' : 'Controller preview. Simulated host controls available.');
  }

  function applyMotionPreference() {
    if (reduced()) stopPlayback();
    app.dataset.reducedMotion = String(reduced());
    $('reduce-motion').checked = reduced();
    $('reduce-motion').title = media.matches ? 'Your system requests reduced motion; this preference stays enabled.' : 'Remove spatial effects and disable automatic example playback.';
    renderWitness();
  }

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
  $('scene-select').addEventListener('change', (event) => changePhase(event.target.value));
  $('overlay-link').addEventListener('click', (event) => { event.preventDefault(); changeView('broadcast'); document.querySelector('[data-view="controller"]').focus(); });
  $('host-next').addEventListener('click', () => changePhase(state.phase === 'paused' ? state.resume : scenes[state.phase].go));
  $('host-pause').addEventListener('click', () => changePhase(state.phase === 'paused' ? state.resume : 'paused'));
  $('reduce-motion').addEventListener('change', (event) => { userReduced = event.target.checked; applyMotionPreference(); });
  media.addEventListener('change', applyMotionPreference);

  $('candidates').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || state.view !== 'controller') return;
    if (button.dataset.pick) {
      state.selected = Number(button.dataset.pick);
      renderCandidates('[data-pick="' + state.selected + '"]');
      say('Selected example ' + state.selected + '. ' + selected().label);
    } else if (button.dataset.vote && state.phase === 'voting') {
      const id = Number(button.dataset.vote);
      state.votes[id] += 1;
      record('Simulated vote for option ' + id + ' · ' + state.votes[id] + ' total for this option');
      renderCandidates('[data-vote="' + id + '"]');
      say('One simulated vote added to option ' + id + '. No message sent.');
    } else if (button.dataset.remove && state.phase === 'proposing') {
      const id = Number(button.dataset.remove);
      state.proposals = state.proposals.filter((candidate) => candidate !== id);
      record('Removed illustrative proposal ' + id);
      render();
      $('add-proposal').focus({ preventScroll: true });
    }
  });

  choices.forEach((item) => {
    const option = make('option', '', String(item.id).padStart(2, '0') + ' · ' + item.label);
    option.value = String(item.id); $('proposal-select').append(option);
  });
  $('add-proposal').addEventListener('click', () => {
    const id = Number($('proposal-select').value);
    if (state.proposals.includes(id)) {
      text('proposal-status', 'That example is already listed. Choose another bounded law.'); return;
    }
    state.proposals.push(id); state.selected = id;
    record('Added illustrative proposal ' + id);
    text('proposal-status', 'Example added. Its number stays ' + id + ' if another example is removed.');
    render();
  });

  $('replay-play').addEventListener('click', () => {
    if (reduced() || state.phase !== 'revealed' || state.view !== 'controller') return;
    if (playback) { stopPlayback(); return; }
    if (state.step === witnessPoints.length - 1) state.step = 0;
    text('replay-play', 'Pause example'); $('replay-play').setAttribute('aria-pressed', 'true');
    renderWitness();
    playback = window.setInterval(() => {
      state.step = Math.min(state.step + 1, witnessPoints.length - 1);
      renderWitness();
      if (state.step === witnessPoints.length - 1) { stopPlayback(); say('Illustrative exit reached. This is not verified proof.'); }
    }, 650);
  });
  $('replay-back').addEventListener('click', () => { stopPlayback(); state.step = Math.max(0, state.step - 1); renderWitness(); });
  $('replay-step').addEventListener('click', () => { stopPlayback(); state.step = Math.min(witnessPoints.length - 1, state.step + 1); renderWitness(); say('Illustrative frame ' + state.step + '. Not server proof.'); });
  $('replay-reset').addEventListener('click', () => { stopPlayback(); state.step = 0; renderWitness(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });

  function inputFeedback(direction) {
    text('fixture-input', 'Preview input: ' + direction + '. Illustration unchanged; no engine attached.');
  }
  app.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => inputFeedback(button.dataset.direction)));
  $('board-input').addEventListener('keydown', (event) => {
    const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (state.view === 'controller' && keys[event.key]) { event.preventDefault(); inputFeedback(keys[event.key]); }
  });
  $('reset-fixture').addEventListener('click', () => {
    stopPlayback(); cancelFeedback(); seenReceiptIds.clear();
    state = { ...state, phase: 'voting', selected: 1, laws: { ...baseline }, votes: Object.fromEntries(choices.map((item) => [item.id, 0])), proposals: [], receipt: null, step: 0, resume: 'voting', history: [] };
    text('proposal-status', '');
    text('fixture-input', 'Illustration stays fixed. Gameplay belongs to Phaser.');
    record('Fixture reset · all simulated votes cleared');
    render({ phaseChanged: true }); say('Fixture reset. No live data affected.');
  });

  // Optional local bookmark. UI works without navigation or URL writes.
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'broadcast') state.view = 'broadcast';
  const initialScene = params.get('scene');
  render(); applyMotionPreference();
  if (initialScene && scenes[initialScene] && initialScene !== state.phase) changePhase(initialScene);
})();

