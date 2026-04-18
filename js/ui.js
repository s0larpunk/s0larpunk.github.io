window.UI = (function() {

  function parseEmojis(el) {
    if (!el || typeof twemoji === 'undefined') return;
    twemoji.parse(el, {
      folder: 'svg', ext: '.svg',
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
    });
  }

  function t(key, vars) { return window.i18n ? window.i18n.t(key, vars) : key; }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active', 'entering');
    });
    var target = document.getElementById('screen-' + name);
    if (!target) return;
    target.classList.add('active');
    requestAnimationFrame(function() { target.classList.add('entering'); });
    var renders = {
      'welcome': renderWelcome,
      'familiarity': renderFamiliarity,
      'game-intro': function() {},
      'technique': renderTechnique,
      'pregame': renderPreGame,
      'timer-setup': renderTimerSetup,
      'phase1-draw': function() { renderCardDraw(1); },
      'phase1-notepad': function() { renderNotepad(1); },
      'phase2-challenge': renderChallenge,
      'phase2-notepad': function() { renderNotepad(2); },
      'phase3-draw': function() { renderCardDraw(3); },
      'phase3-notepad': function() { renderNotepad(3); },
      'phase4': renderPhase4,
      'export': renderExport
    };
    if (renders[name]) renders[name]();
    parseEmojis(target);
  }

  function showModal(name) {
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('active'); });
    var m = document.getElementById('modal-' + name);
    if (m) m.classList.add('active');
    if (name === 'timer') updateTimerModal();
    if (m) parseEmojis(m);
  }

  function hideModal(name) {
    var m = document.getElementById('modal-' + name);
    if (m) m.classList.remove('active');
  }

  function hideAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('active'); });
  }

  function refreshI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var varsStr = el.getAttribute('data-i18n-vars');
      var vars = {};
      if (varsStr) {
        try {
          var state = window.Game ? window.Game.getState() : {};
          var parsed = JSON.parse(varsStr);
          var dc = (state.drawnCards) || {};
          var lang = window.i18n ? window.i18n.getLang() : 'en';
          if (parsed.value !== undefined && dc.value) parsed.value = dc.value.name[lang] || dc.value.name.en;
          if (parsed.challenge !== undefined && dc.challenge) parsed.challenge = dc.challenge.name[lang] || dc.challenge.name.en;
          if (parsed.tool1 !== undefined && dc.tools && dc.tools[0]) parsed.tool1 = dc.tools[0].name[lang] || dc.tools[0].name.en;
          if (parsed.tool2 !== undefined && dc.tools && dc.tools[1]) parsed.tool2 = dc.tools[1].name[lang] || dc.tools[1].name.en;
          vars = parsed;
        } catch(e) {}
      }
      el.textContent = t(key, vars);
    });
    var lang = window.i18n ? window.i18n.getLang() : 'en';
    document.querySelectorAll('.lang-chip').forEach(function(chip) {
      chip.classList.toggle('active', chip.dataset.lang === lang);
    });
    parseEmojis(document.body);
  }

  function renderWelcome() {
    refreshI18n();
  }

  function renderFamiliarity() {
    refreshI18n();
  }

  function renderGameIntro(mode) {
    var content = document.getElementById('intro-content');
    var continueBtn = document.getElementById('btn-intro-continue');

    if (mode === 'skip') {
      if (window.Game) window.Game.goTo('technique');
      return;
    }

    if (content) content.style.display = 'block';
    if (continueBtn) continueBtn.style.display = 'block';

    if (mode === 'full') {
      if (content) content.innerHTML = '<div class="intro-section">' +
        '<h3>\uD83C\uDF31 ' + t('solarpunk_explainer').split('.')[0] + '</h3>' +
        '<p>' + t('solarpunk_explainer') + '</p>' +
        '</div>' +
        '<div class="intro-section">' +
        '<h3>\uD83C\uDFC4 The 4 Phases</h3>' +
        '<p>' + t('game_phases_explainer') + '</p>' +
        '<ol class="phase-list">' +
        '<li><strong>The Ancestors</strong> \u2014 Draw your Ancestor + Value cards, introduce your character</li>' +
        '<li><strong>The Challenge</strong> \u2014 Face a collective challenge that confronts your values</li>' +
        '<li><strong>Building the World</strong> \u2014 Draw Tool cards and write your ancestor\u2019s story</li>' +
        '<li><strong>Remembrance</strong> \u2014 Weave all stories together into a collective utopia</li>' +
        '</ol>' +
        '</div>' +
        '<div class="intro-section">' +
        '<h3>\uD83C\uDCCF Card Types</h3>' +
        '<div class="card-type-explainers">' +
        '<div class="ctype"><span class="ct-badge ancestor">ANCESTOR</span> Your character archetype \u2014 Builder, Hacker, Elder...</div>' +
        '<div class="ctype"><span class="ct-badge value">VALUE</span> The guiding principle your ancestor lived by</div>' +
        '<div class="ctype"><span class="ct-badge tool">TOOL</span> The strategies and practices they used</div>' +
        '<div class="ctype"><span class="ct-badge challenge">CHALLENGE</span> The systemic problem they worked to overcome</div>' +
        '</div>' +
        '</div>' +
        '<div class="intro-section consent-reminder">' +
        '<h3>\uD83E\uDD1D Before you begin</h3>' +
        '<p>' + t('lines_veils_reminder') + '</p>' +
        '</div>';
    } else {
      if (content) content.innerHTML = '<div class="intro-section">' +
        '<p>' + t('lines_veils_reminder') + '</p>' +
        '<p>' + t('consensus_reminder') + '</p>' +
        '</div>';
    }

    if (content) parseEmojis(content);

    if (continueBtn) {
      continueBtn.onclick = function() {
        if (window.Game) window.Game.goTo('technique');
      };
    }
  }

  function renderTechnique() { refreshI18n(); }

  function renderPreGame() {
    var state = window.Game ? window.Game.getState() : {};
    var el = document.getElementById('player-count-display');
    if (el) el.textContent = state.playerCount || '';
    refreshI18n();
  }

  function renderTimerSetup() {
    var state = window.Game ? window.Game.getState() : {};
    var d = (state.timer && state.timer.durations) ? state.timer.durations : {};
    var valMap = {
      p1w: d.p1w, p1s: d.p1s,
      p2w: d.p2w, p2s: d.p2s,
      p3w: d.p3w, p3s: d.p3s,
      p4w: d.p4w, p4s: d.p4s
    };
    document.querySelectorAll('.timer-val[data-phase]').forEach(function(el) {
      var p = el.dataset.phase;
      var m = el.dataset.mode;
      var key = 'p' + p + (m === 'writing' ? 'w' : 's');
      if (valMap[key] !== undefined) el.textContent = Math.round(valMap[key] / 60);
    });
    refreshI18n();
  }

  function renderCardDraw(phase) {
    var state = window.Game ? window.Game.getState() : {};
    updatePhaseIndicator(phase);
    var dc = state.drawnCards || {};
    if (phase === 1) {
      var aDeck = document.getElementById('ancestor-deck');
      var vDeck = document.getElementById('value-deck');
      if (aDeck && !dc.ancestor) aDeck.classList.add('ready-to-draw');
      if (vDeck && !dc.value) vDeck.classList.add('ready-to-draw');
      var p1Cards = [dc.ancestor, dc.value].filter(Boolean);
      if (p1Cards.length > 0) renderHand(p1Cards, 'hand-phase1');
    } else if (phase === 3) {
      var tDeck = document.getElementById('tool-deck');
      var tools = dc.tools || [];
      if (tDeck && tools.length < 2) tDeck.classList.add('ready-to-draw');
      if (tools.length > 0) renderHand(tools, 'hand-phase3');
    }
  }

  function renderNotepad(phase) {
    var state = window.Game ? window.Game.getState() : {};
    var dc = state.drawnCards || {};
    var np = state.notepad || {};

    var stripId = 'ref-cards-p' + phase;
    var strip = document.getElementById(stripId);
    if (strip) {
      strip.innerHTML = '';
      var refCards = [];
      if (dc.ancestor) refCards.push(dc.ancestor);
      if (dc.value) refCards.push(dc.value);
      if (phase >= 2 && dc.challenge) refCards.push(dc.challenge);
      if (phase >= 3 && dc.tools) dc.tools.forEach(function(c) { refCards.push(c); });
      refCards.forEach(function(card) {
        var mini = window.Cards ? window.Cards.createCardEl(card, true) : document.createElement('div');
        strip.appendChild(mini);
        if (window.Cards) window.Cards.flip(mini);
      });
      parseEmojis(strip);
    }

    var fieldMap = {};
    if (phase === 1) {
      fieldMap = {
        'p1-name': np.p1_name,
        'p1-background': np.p1_background,
        'p1-value': np.p1_value_connection
      };
    } else if (phase === 2) {
      fieldMap = {
        'p2-conflict': np.p2_conflict
      };
    } else if (phase === 3) {
      fieldMap = {
        'p3-approach': np.p3_approach,
        'p3-opposition': np.p3_opposition,
        'p3-risk': np.p3_risk,
        'p3-success': np.p3_success,
        'p3-remaining': np.p3_remaining
      };
    } else if (phase === 4) {
      fieldMap = {
        'p4-fellow': np.p4_fellow,
        'p4-collaboration': np.p4_collaboration,
        'p4-hardship': np.p4_hardship,
        'p4-overcome': np.p4_overcome
      };
    }

    Object.keys(fieldMap).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el.value) el.value = fieldMap[id] || '';
    });

    refreshI18n();
    updatePhaseIndicator(phase);
  }

  function renderChallenge() {
    updatePhaseIndicator(2);
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var dc = state.drawnCards || {};
    if (dc.challenge) {
      renderChallengeCard(dc.challenge);
    }
  }

  function renderPhase4() {
    renderNotepad(4);
    updatePhaseIndicator(4);
  }

  function renderHand(cards, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    cards.filter(Boolean).forEach(function(card, i) {
      var el = window.Cards ? window.Cards.createCardEl(card) : document.createElement('div');
      el.classList.add('card-in-hand');
      var rots = [-3, -1, 1, 3, 0, -2, 2];
      el.style.setProperty('--card-rot', (rots[i % rots.length] || 0) + 'deg');
      container.appendChild(el);
      var explainBtn = el.querySelector('.card-explain-toggle');
      if (explainBtn) {
        explainBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          renderExplainMore(card);
        });
      }
      el.addEventListener('click', function() {
        if (el.closest('[id^="hand-"]') && window.Cards) window.Cards.toggleRedraw(el);
      });
    });
    parseEmojis(container);
  }

  function renderChallengeCard(card) {
    var area = document.getElementById('challenge-card-area');
    var display = document.getElementById('challenge-display');
    if (!area || !card) return;
    area.innerHTML = '';
    var el = window.Cards ? window.Cards.createCardEl(card) : document.createElement('div');
    var explainBtn = el.querySelector('.card-explain-toggle');
    if (explainBtn) {
      explainBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        renderExplainMore(card);
      });
    }
    area.appendChild(el);
    if (display) display.style.display = 'block';
    var modeSelector = document.querySelector('.challenge-mode-selector');
    if (modeSelector) modeSelector.style.display = 'none';
    requestAnimationFrame(function() {
      if (window.Cards) window.Cards.flip(el);
    });
    if (display) parseEmojis(display);
  }

  function renderChallengeGrid() {
    var grid = document.getElementById('challenge-grid');
    if (!grid) return;
    grid.style.display = 'grid';
    var modeSelector = document.querySelector('.challenge-mode-selector');
    if (modeSelector) modeSelector.style.display = 'none';
    grid.innerHTML = '';
    if (!window.DECK || !window.DECK.challenge) return;
    window.DECK.challenge.forEach(function(card) {
      var el = window.Cards ? window.Cards.createCardEl(card) : document.createElement('div');
      el.classList.add('flipped');
      el.addEventListener('click', function() {
        if (window.Game) {
          var state = window.Game.getState();
          var dc = Object.assign({}, state.drawnCards, { challenge: card });
          window.Game.setState({ drawnCards: dc });
        }
        renderChallengeCard(card);
      });
      var explainBtn = el.querySelector('.card-explain-toggle');
      if (explainBtn) {
        explainBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          renderExplainMore(card);
        });
      }
      grid.appendChild(el);
    });
    parseEmojis(grid);
  }

  function renderExplainMore(card) {
    var lang = window.i18n ? window.i18n.getLang() : 'en';
    var emojisEl = document.getElementById('explain-card-emojis');
    var nameEl = document.getElementById('explain-card-name');
    var bodyEl = document.getElementById('explain-card-body');
    var moreEl = document.getElementById('explain-more-text');

    if (emojisEl) emojisEl.textContent = (card.emojis || []).join(' ');
    if (nameEl) nameEl.textContent = card.name[lang] || card.name.en;

    var body = '';
    if (card.type === 'value' && card.definition) {
      body = card.definition[lang] || card.definition.en;
    } else if (card.type === 'tool' && card.quote) {
      body = '"' + (card.quote[lang] || card.quote.en) + '" \u2014 ' + card.author + ', ' + card.year;
    } else if (card.type === 'challenge' && card.description) {
      body = card.description[lang] || card.description.en;
    } else if (card.type === 'ancestor' && card.subtitles) {
      body = (card.subtitles[lang] || card.subtitles.en).join(' \u00B7 ');
    }

    if (bodyEl) bodyEl.textContent = body;
    if (moreEl) moreEl.textContent = card.explainMore ? (card.explainMore[lang] || card.explainMore.en) : '';

    showModal('card-explain');
    var modal = document.getElementById('modal-card-explain');
    if (modal) parseEmojis(modal);
  }

  function renderExport() {
    var state = window.Game ? window.Game.getState() : {};
    var lang = window.i18n ? window.i18n.getLang() : 'en';
    var dc = state.drawnCards || {};
    var np = state.notepad || {};
    var summary = document.getElementById('export-summary');
    if (!summary) return;

    function getName(card) {
      return card ? (card.name[lang] || card.name.en) : '\u2014';
    }

    summary.innerHTML = '<div class="export-section" id="export-card-section">' +
      '<h3>' + t('export_section_ancestor') + '</h3>' +
      '<div class="export-cards-row" id="export-cards-row"></div>' +
      '<div class="export-notepad">' +
      '<p><strong>' + t('p1_name_label') + ':</strong> ' + (np.p1_name || '\u2014') + '</p>' +
      '<p><strong>' + t('p1_background_label') + ':</strong> ' + (np.p1_background || '\u2014') + '</p>' +
      '<p><strong>' + t('p1_value_label', { value: getName(dc.value) }) + ':</strong> ' + (np.p1_value_connection || '\u2014') + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="export-section">' +
      '<h3>' + t('export_section_challenge') + '</h3>' +
      '<div class="export-notepad">' +
      '<p><strong>' + t('p2_conflict_label', { challenge: getName(dc.challenge) }) + ':</strong> ' + (np.p2_conflict || '\u2014') + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="export-section">' +
      '<h3>' + t('phase_building') + '</h3>' +
      '<div class="export-notepad">' +
      '<p><strong>' + t('p3_approach_label', { tool1: getName(dc.tools && dc.tools[0]), tool2: getName(dc.tools && dc.tools[1]) }) + ':</strong> ' + (np.p3_approach || '\u2014') + '</p>' +
      '<p><strong>' + t('p3_opposition_label', { opposition: '...' }) + ':</strong> ' + (np.p3_opposition || '\u2014') + '</p>' +
      '<p><strong>' + t('p3_risk_label') + ':</strong> ' + (np.p3_risk || '\u2014') + '</p>' +
      '<p><strong>' + t('p3_success_label') + ':</strong> ' + (np.p3_success || '\u2014') + '</p>' +
      '<p><strong>' + t('p3_remaining_label') + ':</strong> ' + (np.p3_remaining || '\u2014') + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="export-section">' +
      '<h3>' + t('phase_remembrance') + '</h3>' +
      '<div class="export-notepad">' +
      '<p><strong>' + t('p4_fellow_label') + ':</strong> ' + (np.p4_fellow || '\u2014') + '</p>' +
      '<p><strong>' + t('p4_collaboration_label') + ':</strong> ' + (np.p4_collaboration || '\u2014') + '</p>' +
      '<p><strong>' + t('p4_hardship_label') + ':</strong> ' + (np.p4_hardship || '\u2014') + '</p>' +
      '<p><strong>' + t('p4_overcome_label') + ':</strong> ' + (np.p4_overcome || '\u2014') + '</p>' +
      '</div>' +
      '</div>';

    var cardsRow = document.getElementById('export-cards-row');
    if (cardsRow && window.Cards) {
      var allCards = [dc.ancestor, dc.value, dc.challenge].concat(dc.tools || []).filter(Boolean);
      allCards.forEach(function(card) {
        var el = window.Cards.createCardEl(card);
        el.classList.add('flipped');
        cardsRow.appendChild(el);
      });
    }

    parseEmojis(summary);
  }

  function updatePhaseIndicator(phase) {
    document.querySelectorAll('.phase-indicator').forEach(function(el) {
      el.setAttribute('data-phase', phase);
    });
  }

  function updateTimerBadge(text, isOverrun) {
    var badge = document.getElementById('timer-badge');
    var textEl = document.getElementById('timer-badge-text');
    if (!badge || !textEl) return;
    textEl.textContent = text;
    badge.classList.toggle('overrun', !!isOverrun);
  }

  function _getDuration(phase, mode) {
    var state = window.Game ? window.Game.getState().timer : null;
    if (!state) return 300;
    var key = 'p' + phase + (mode === 'writing' ? 'w' : 's');
    return (state.durations && state.durations[key]) || 300;
  }

  function updateTimerModal() {
    if (!window.Game) return;
    var timerState = window.Game.getState().timer;
    if (!timerState) return;
    var remaining = window.Timer ? window.Timer.getRemaining() : 0;
    var isOverrun = remaining < 0;
    var secs = Math.abs(remaining);
    var mm = String(Math.floor(secs / 60)).padStart(2, '0');
    var ss = String(secs % 60).padStart(2, '0');

    var displayEl = document.getElementById('timer-display');
    if (displayEl) displayEl.textContent = (isOverrun ? '-' : '') + mm + ':' + ss;

    var circle = document.getElementById('timer-ring-circle');
    if (circle) {
      var circ = 2 * Math.PI * 54;
      var dur = _getDuration(timerState.phase, timerState.mode);
      var elapsed = dur - remaining;
      var progress = Math.min(1, Math.max(0, elapsed / dur));
      var offset = circ * progress;
      circle.style.strokeDasharray = circ;
      circle.style.strokeDashoffset = offset;
    }

    var label = document.getElementById('timer-phase-label');
    if (label && window.Timer) label.textContent = window.Timer._label(timerState.phase, timerState.mode);

    var list = document.getElementById('timer-phase-list');
    if (list && window.Timer) {
      var phases = [
        { p: 1, m: 'writing', key: 'p1w' },
        { p: 1, m: 'sharing', key: 'p1s' },
        { p: 2, m: 'writing', key: 'p2w' },
        { p: 2, m: 'sharing', key: 'p2s' },
        { p: 3, m: 'writing', key: 'p3w' },
        { p: 3, m: 'sharing', key: 'p3s' },
        { p: 4, m: 'writing', key: 'p4w' },
        { p: 4, m: 'sharing', key: 'p4s' }
      ];
      list.innerHTML = phases.map(function(ph) {
        var active = ph.p === timerState.phase && ph.m === timerState.mode;
        var mins = Math.round(((timerState.durations && timerState.durations[ph.key]) || 300) / 60);
        return '<div class="timer-phase-item ' + (active ? 'active' : '') + '">' +
          '<span>' + window.Timer._label(ph.p, ph.m) + '</span>' +
          '<span>' + mins + ' min</span>' +
          '</div>';
      }).join('');
    }

    var btn = document.getElementById('btn-timer-toggle');
    if (btn) {
      btn.textContent = timerState.active ? t('btn_pause_timer') : t('btn_start_timer');
      btn.onclick = function() {
        if (timerState.active) {
          if (window.Timer) window.Timer.pause();
        } else {
          if (window.Timer) window.Timer.resume();
        }
        updateTimerModal();
      };
    }
  }

  function bindNotepadFields() {
    document.querySelectorAll('.notepad-field').forEach(function(el) {
      el.addEventListener('input', function() {
        if (!window.Game) return;
        var patch = { notepad: {} };
        patch.notepad[el.name] = el.value;
        window.Game.setState(patch);
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      });
    });
  }

  return {
    showScreen: showScreen,
    showModal: showModal,
    hideModal: hideModal,
    hideAllModals: hideAllModals,
    refreshI18n: refreshI18n,
    parseEmojis: parseEmojis,
    renderWelcome: renderWelcome,
    renderFamiliarity: renderFamiliarity,
    renderGameIntro: renderGameIntro,
    renderTechnique: renderTechnique,
    renderPreGame: renderPreGame,
    renderTimerSetup: renderTimerSetup,
    renderCardDraw: renderCardDraw,
    renderNotepad: renderNotepad,
    renderChallenge: renderChallenge,
    renderPhase4: renderPhase4,
    renderExport: renderExport,
    renderHand: renderHand,
    renderChallengeCard: renderChallengeCard,
    renderChallengeGrid: renderChallengeGrid,
    renderExplainMore: renderExplainMore,
    updatePhaseIndicator: updatePhaseIndicator,
    updateTimerBadge: updateTimerBadge,
    updateTimerModal: updateTimerModal,
    bindNotepadFields: bindNotepadFields
  };
})();
