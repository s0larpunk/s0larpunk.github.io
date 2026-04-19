/**
 * game.js — Solarpunk Futures state machine
 * Exposes window.Game. All internals are IIFE-scoped.
 */

window.Game = (function () {
  'use strict';

  const STORAGE_KEY = 'sf_session_v1';
  const VERSION = 1;

  // Seconds per phase/mode key: p{phase}{w|s}
  const DEFAULT_STATE = {
    version: VERSION,
    screen: 'welcome',
    lang: 'en',
    solarpunkLevel: null,
    technique: '001',
    phase: 0,
    drawnCards: {
      ancestor: null,
      values: [],   // BUG 6/13: was drawnCards.value (single), now array of up to 2
      tools: [],
      challenge: null
    },
    notepad: {
      p1_name: '',
      p1_background: '',
      p1_value_connection: '',
      p2_conflict: '',
      p3_approach: '',
      p3_opposition: '',
      p3_risk: '',
      p3_success: '',
      p3_remaining: '',
      p4_fellow: '',
      p4_collaboration: '',
      p4_hardship: '',
      p4_overcome: ''
    },
    timer: {
      durations: {
        p1w: 300,  // 5 min
        p1s: 600,  // 10 min
        p2w: 300,  // 5 min
        p2s: 900,  // 15 min
        p3w: 420,  // 7 min
        p3s: 780,  // 13 min
        p4w: 420,  // 7 min
        p4s: 780   // 13 min
      },
      active: false,
      phase: 1,
      mode: 'writing',
      startedAt: null,
      elapsed: 0
    },
    linesVeils: false,
    challengeMode: 'random',
    completed: false
  };

  let _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const _handlers = {};

  // ──────────────────────────────────────────────────────────
  // Deep merge helper: mutates target with values from source
  // ──────────────────────────────────────────────────────────
  function deepMerge(target, source) {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
      return source !== undefined ? source : target;
    }
    const out = Object.assign({}, target);
    Object.keys(source).forEach(function (key) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target !== null &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        Object.prototype.hasOwnProperty.call(target, key) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        out[key] = deepMerge(target[key], source[key]);
      } else {
        out[key] = source[key];
      }
    });
    return out;
  }

  // ──────────────────────────────────────────────────────────
  // Drawn-card deduplication set
  // ──────────────────────────────────────────────────────────
  let _drawnIds = new Set();

  function _rebuildDrawnIds() {
    _drawnIds.clear();
    var dc = _state.drawnCards;
    if (dc.ancestor) _drawnIds.add(dc.ancestor.id);
    // BUG 6/13: values is now an array
    if (dc.values) dc.values.forEach(function (v) { if (v) _drawnIds.add(v.id); });
    if (dc.tools) dc.tools.forEach(function (t) { if (t) _drawnIds.add(t.id); });
    if (dc.challenge) _drawnIds.add(dc.challenge.id);
  }

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────
  var Game = {

    getState: function () {
      return JSON.parse(JSON.stringify(_state));
    },

    setState: function (patch) {
      _state = deepMerge(_state, patch);
      this.saveState();
      this.emit('stateChange', _state);
    },

    loadState: function () {
      try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return false;
        var parsed = JSON.parse(saved);
        if (parsed.version !== VERSION) return false;
        // Migrate old single drawnCards.value to values array
        if (parsed.drawnCards && parsed.drawnCards.value !== undefined) {
          var oldVal = parsed.drawnCards.value;
          parsed.drawnCards.values = oldVal ? [oldVal] : [];
          delete parsed.drawnCards.value;
        }
        _state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        _rebuildDrawnIds();
        return true;
      } catch (e) {
        return false;
      }
    },

    saveState: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
      } catch (e) { /* quota exceeded or private mode */ }
    },

    resetState: function () {
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      _drawnIds.clear();
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      this.emit('stateChange', _state);
    },

    hasSavedSession: function () {
      try {
        var s = localStorage.getItem(STORAGE_KEY);
        if (!s) return false;
        var p = JSON.parse(s);
        return p.version === VERSION && p.screen !== 'welcome';
      } catch (e) {
        return false;
      }
    },

    drawCard: function (type) {
      if (!window.DECK || !window.DECK[type]) return null;
      var deck = window.DECK[type];
      var available = deck.filter(function (c) { return !_drawnIds.has(c.id); });
      if (!available.length) return null;
      var card = available[Math.floor(Math.random() * available.length)];
      _drawnIds.add(card.id);
      return card;
    },

    drawCards: function (type, n) {
      var result = [];
      for (var i = 0; i < n; i++) {
        var c = this.drawCard(type);
        if (c) result.push(c);
      }
      return result;
    },

    reDrawCard: function (oldId, type) {
      _drawnIds.delete(oldId);
      return this.drawCard(type);
    },

    // BUG 9: update timer phase/mode based on screen
    goTo: function (screen) {
      _state.screen = screen;

      // Map screen to timer phase number (mode is managed by timer itself)
      var screenPhaseMap = {
        'phase1-draw':      1,
        'phase1-notepad':   1,
        'phase2-challenge': 2,
        'phase2-notepad':   2,
        'phase3-notepad':   3,
        'phase4':           4
      };
      if (screenPhaseMap[screen] !== undefined) {
        var newPhase = screenPhaseMap[screen];
        if (_state.timer.phase !== newPhase) {
          // Phase changed: reset elapsed, reset to writing mode
          _state.timer = Object.assign({}, _state.timer, {
            phase: newPhase,
            mode: 'writing',
            elapsed: 0,
            startedAt: _state.timer.active ? Date.now() : null
          });
        }
        // If same phase, leave timer state completely untouched
      }

      this.saveState();
      this.emit('screenChange', screen);
      if (window.UI) window.UI.showScreen(screen);
      // Update timer badge after screen change
      if (window.Timer && window.Timer._updateBadge) window.Timer._updateBadge();
    },

    on: function (event, fn) {
      if (!_handlers[event]) _handlers[event] = [];
      _handlers[event].push(fn);
    },

    off: function (event, fn) {
      if (_handlers[event]) {
        _handlers[event] = _handlers[event].filter(function (h) { return h !== fn; });
      }
    },

    emit: function (event, data) {
      (_handlers[event] || []).forEach(function (fn) {
        try { fn(data); } catch (e) { console.error('Game event handler error:', e); }
      });
    }
  };

  return Game;
})();


// ════════════════════════════════════════════════════════════
//  DOMContentLoaded — wire everything up
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ── helpers ────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function showEl(el) { if (el) el.style.display = ''; }
  function hideEl(el) { if (el) el.style.display = 'none'; }

  // advancePhase: if timer was started and mode is 'writing', switch to sharing (stay on screen).
  // If not using timer, or already in sharing mode, navigate to nextScreen.
  function advancePhase(nextScreen) {
    var st = window.Game ? window.Game.getState() : null;
    if (!st) { if (nextScreen && window.Game) window.Game.goTo(nextScreen); return; }
    var t = st.timer;
    var timerUsed = t.active || t.elapsed > 0 || t.startedAt !== null;
    if (timerUsed && t.mode === 'writing') {
      // switch to sharing, reset elapsed, stay on current screen
      if (window.Timer) window.Timer.pause();
      window.Game.setState({ timer: { mode: 'sharing', elapsed: 0, startedAt: null, active: false } });
      setTimeout(function() { if (window.Timer) window.Timer.resume(); }, 60);
    } else {
      // timer not in use, or already sharing — proceed to next screen
      if (nextScreen) window.Game.goTo(nextScreen);
    }
  }

  function showModal(id) {
    var el = $(id);
    if (el) { el.style.display = 'flex'; }
  }
  function hideModal(id) {
    var el = $(id);
    if (el) { el.style.display = 'none'; }
  }

  // ── 1. Language bootstrap ──────────────────────────────────
  var defaultLang = navigator.language && navigator.language.startsWith('ru') ? 'ru' : 'en';
  if (window.i18n) window.i18n.setLang(defaultLang);

  // ── 2. Session restore or fresh start ─────────────────────
  var hasSaved = window.Game.hasSavedSession();
  if (hasSaved) {
    window.Game.loadState();
    var savedState = window.Game.getState();
    // Apply saved language
    if (savedState.lang && window.i18n) window.i18n.setLang(savedState.lang);
    // Refresh i18n before showing overlay
    if (window.UI && window.UI.refreshI18n) window.UI.refreshI18n();
    showEl($('overlay-resume'));
  } else {
    if (window.UI && window.UI.refreshI18n) window.UI.refreshI18n();
    window.Game.goTo('welcome');
  }

  // Twemoji parse after initial render
  if (window.twemoji) twemoji.parse(document.body);

  // ── 3. Persistent UI ──────────────────────────────────────

  // Language button
  var langBtn = $('lang-btn');
  if (langBtn) langBtn.addEventListener('click', function () { showModal('modal-lang'); });

  // Menu / restart button
  var menuBtn = $('menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', function () { showModal('modal-restart'); });

  // Timer badge
  var timerBadge = $('timer-badge');
  if (timerBadge) timerBadge.addEventListener('click', function () {
    showModal('modal-timer');
    if (window.UI && window.UI.updateTimerModal) window.UI.updateTimerModal();
  });

  // ── 4. Back buttons (delegated) ────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-back[data-target]');
    if (btn) {
      var target = btn.getAttribute('data-target');
      window.Game.goTo(target);
    }
  });

  // ── 5. Resume overlay ─────────────────────────────────────
  var btnResume = $('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', function () {
      hideEl($('overlay-resume'));
      var st = window.Game.getState();
      if (window.UI) window.UI.showScreen(st.screen);
      // Restore timer interval if it was running before the page reload
      if (window.Timer) window.Timer.restore();
    });
  }

  var btnFresh = $('btn-fresh');
  if (btnFresh) {
    btnFresh.addEventListener('click', function () {
      hideEl($('overlay-resume'));
      window.Game.resetState();
      window.Game.goTo('welcome');
    });
  }

  // ── 6. Restart modal ──────────────────────────────────────
  var btnConfirmRestart = $('btn-confirm-restart');
  if (btnConfirmRestart) {
    btnConfirmRestart.addEventListener('click', function () {
      window.Game.resetState();
      // FIX 2: clear all notepad textarea values in DOM
      document.querySelectorAll('.notepad-field').forEach(function(ta) { ta.value = ''; });
      hideModal('modal-restart');
      window.Game.goTo('welcome');
    });
  }

  var btnConfirmQuit = $('btn-confirm-quit');
  if (btnConfirmQuit) {
    btnConfirmQuit.addEventListener('click', function () {
      hideModal('modal-restart');
    });
  }

  var btnCancelRestart = $('btn-cancel-restart');
  if (btnCancelRestart) {
    btnCancelRestart.addEventListener('click', function () { hideModal('modal-restart'); });
  }

  // ── 7. Modal close buttons & backdrop clicks ───────────────
  var modalCloseIds = [
    { close: 'btn-close-timer',   modal: 'modal-timer' },
    { close: 'btn-close-lang',    modal: 'modal-lang' },
    { close: 'btn-close-explain', modal: 'modal-card-explain' },
    { close: 'btn-alert-dismiss', modal: 'modal-phase-alert' }
  ];
  modalCloseIds.forEach(function (pair) {
    var btn = $(pair.close);
    if (btn) btn.addEventListener('click', function () { hideModal(pair.modal); });
  });

  // Backdrop clicks close their parent modal
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop')) {
      var modal = e.target.closest('.modal');
      if (modal) modal.style.display = 'none';
    }
  });

  // ── 8. Welcome screen ─────────────────────────────────────
  var btnBegin = $('btn-begin');
  if (btnBegin) {
    btnBegin.addEventListener('click', function () { window.Game.goTo('familiarity'); });
  }

  var btnSkipAll = $('btn-skip-all');
  if (btnSkipAll) {
    btnSkipAll.addEventListener('click', function () { window.Game.goTo('technique'); });
  }

  // ── 9. Familiarity screen ──────────────────────────────────
  var familiarityOptions = document.getElementById('familiarity-options');
  if (familiarityOptions) {
    familiarityOptions.addEventListener('click', function (e) {
      var card = e.target.closest('.option-card[data-level]');
      if (!card) return;
      var level = card.getAttribute('data-level');
      window.Game.setState({ solarpunkLevel: level });
      if (level === 'deep') {
        window.Game.goTo('technique');
      } else {
        window.Game.goTo('game-intro');
        // auto-render appropriate intro after short delay (screen transition needs to complete)
        // level 'new' or 'curious' → full intro; level 'familiar' → brief intro
        setTimeout(function() {
          var mode = (level === 'familiar') ? 'brief' : 'full';
          if (window.UI && window.UI.renderGameIntro) window.UI.renderGameIntro(mode);
        }, 80);
      }
    });
  }

  // ── 10. Game-intro screen ─────────────────────────────────
  var btnIntroFull = $('btn-intro-full');
  var btnIntroBrief = $('btn-intro-brief');
  var btnIntroSkip = $('btn-intro-skip');
  var introContent = $('intro-content');
  var btnIntroContinue = $('btn-intro-continue');

  function showIntroContinue() {
    if (btnIntroContinue) showEl(btnIntroContinue);
  }

  if (btnIntroFull) {
    btnIntroFull.addEventListener('click', function () {
      if (window.UI && window.UI.renderGameIntro) window.UI.renderGameIntro('full', introContent);
      if (introContent) showEl(introContent);
      showIntroContinue();
    });
  }
  if (btnIntroBrief) {
    btnIntroBrief.addEventListener('click', function () {
      if (window.UI && window.UI.renderGameIntro) window.UI.renderGameIntro('brief', introContent);
      if (introContent) showEl(introContent);
      showIntroContinue();
    });
  }
  if (btnIntroSkip) {
    btnIntroSkip.addEventListener('click', function () {
      window.Game.goTo('technique');
    });
  }
  if (btnIntroContinue) {
    btnIntroContinue.addEventListener('click', function () {
      window.Game.goTo('technique');
    });
  }

  // ── 11. Technique screen ──────────────────────────────────
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.technique-card[data-technique]');
    if (!card) return;
    if (card.classList.contains('coming-soon')) return;
    var technique = card.getAttribute('data-technique');
    window.Game.setState({ technique: technique });
    window.Game.goTo('pregame');
  });

  // ── 12. Pregame screen ────────────────────────────────────

  // Lines & Veils checkbox
  var checkLinesVeils = $('check-lines-veils');
  if (checkLinesVeils) {
    checkLinesVeils.addEventListener('change', function () {
      window.Game.setState({ linesVeils: this.checked });
    });
  }

  // BUG 3: playerCount stepper removed

  var btnBeginGame = $('btn-begin-game');
  if (btnBeginGame) {
    btnBeginGame.addEventListener('click', function () {
      // Sync lines/veils checkbox state before advancing
      if (checkLinesVeils) window.Game.setState({ linesVeils: checkLinesVeils.checked });
      window.Game.goTo('timer-setup');
    });
  }

  // ── 13. Timer setup screen ────────────────────────────────

  // Phase/mode key helper: p1w, p1s, p2s, etc.
  function timerKey(phase, mode) {
    return 'p' + phase + (mode === 'writing' ? 'w' : 's');
  }

  // Seconds → minutes display (rounded)
  function secsToMins(secs) { return Math.round(secs / 60); }

  // Sync timer-val spans to state
  function refreshTimerTable() {
    var st = window.Game.getState();
    document.querySelectorAll('.timer-val').forEach(function (span) {
      var phase = span.getAttribute('data-phase');
      var mode = span.getAttribute('data-mode');
      var key = timerKey(phase, mode);
      if (st.timer.durations[key] !== undefined) {
        span.textContent = secsToMins(st.timer.durations[key]);
      }
    });
  }

  // Timer stepper clicks
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.timer-stepper');
    if (!btn) return;
    var phase = btn.getAttribute('data-phase');
    var mode = btn.getAttribute('data-mode');
    var dir = parseInt(btn.getAttribute('data-dir'), 10);
    var key = timerKey(phase, mode);
    var st = window.Game.getState();
    var current = st.timer.durations[key] || 60;
    var newVal = Math.max(60, current + dir * 60); // min 1 min, step 1 min
    var patch = { timer: { durations: {} } };
    patch.timer.durations[key] = newVal;
    window.Game.setState(patch);
    refreshTimerTable();
  });

  var btnAllStart = $('btn-all-start');
  if (btnAllStart) {
    btnAllStart.addEventListener('click', function () {
      window.Game.setState({
        phase: 1,
        timer: {
          active: true,
          phase: 1,
          mode: 'writing',
          startedAt: Date.now(),
          elapsed: 0
        }
      });
      window.Game.goTo('phase1-draw');
      if (window.Timer && window.Timer.start) window.Timer.start();
    });
  }

  // ── 14. Phase 1 Draw screen (BUG 6: draws 5 cards total) ──

  // handleDeckClick: handles ancestor, value (up to 2), tool (up to 2)
  function handleDeckClick(deckEl) {
    var type = deckEl.getAttribute('data-type');
    if (!type) return;

    var st = window.Game.getState();
    var dc = JSON.parse(JSON.stringify(st.drawnCards));

    // Enforce limits per type
    if (type === 'ancestor') {
      if (dc.ancestor) return; // already drawn
    } else if (type === 'value') {
      if ((dc.values || []).length >= 2) return; // max 2
    } else if (type === 'tool') {
      if ((dc.tools || []).length >= 2) return; // max 2
    }

    var card = window.Game.drawCard(type);
    if (!card) return;

    if (type === 'ancestor') {
      dc.ancestor = card;
      deckEl.classList.add('dealt');
      deckEl.classList.remove('ready-to-draw');
    } else if (type === 'value') {
      if (!dc.values) dc.values = [];
      dc.values.push(card);
      if (dc.values.length >= 2) {
        deckEl.classList.add('dealt');
        deckEl.classList.remove('ready-to-draw');
      }
    } else if (type === 'tool') {
      if (!dc.tools) dc.tools = [];
      dc.tools.push(card);
      if (dc.tools.length >= 2) {
        deckEl.classList.add('dealt');
        deckEl.classList.remove('ready-to-draw');
      }
    }

    window.Game.setState({ drawnCards: dc });

    // Render card in hand
    if (window.Cards && window.Cards.renderInHand) {
      window.Cards.renderInHand(card, $('hand-phase1'), type);
    }

    // Update progress dots
    _updateP1Progress();

    // FIX 9: update deck visibility and instruction text after draw
    var updated = window.Game.getState();
    if (window.UI) {
      window.UI.updateDeckVisibility(updated.drawnCards);
      window.UI.updateDrawStepInstruction(updated.drawnCards);
    }
  }

  function _updateP1Progress() {
    var st = window.Game.getState();
    var dc = st.drawnCards;
    var dots = document.querySelectorAll('#draw-progress-p1 .progress-dot');
    dots.forEach(function (dot) {
      var forType = dot.getAttribute('data-for');
      if (forType === 'ancestor' && dc.ancestor) dot.classList.add('filled');
      if (forType === 'value1' && (dc.values || []).length >= 1) dot.classList.add('filled');
      if (forType === 'value2' && (dc.values || []).length >= 2) dot.classList.add('filled');
      if (forType === 'tool1' && (dc.tools || []).length >= 1) dot.classList.add('filled');
      if (forType === 'tool2' && (dc.tools || []).length >= 2) dot.classList.add('filled');
    });
  }

  // Deck stack clicks (delegated) — Phase 1 only now
  document.addEventListener('click', function (e) {
    var stack = e.target.closest('.deck-stack');
    if (!stack) return;
    var screenP1 = $('screen-phase1-draw');
    if (screenP1 && screenP1.style.display !== 'none' && screenP1.contains(stack)) {
      handleDeckClick(stack);
    }
    // Phase 3 draw screen removed from flow (BUG 6)
  });

  // btn-p1-continue: drawing phase — writing mode → sharing mode → challenge selection
  var btnP1Continue = $('btn-p1-continue');
  if (btnP1Continue) {
    btnP1Continue.addEventListener('click', function () {
      advancePhase('phase2-challenge');
    });
  }

  // FIX 7: Redraw uses card ID to find exact DOM element, not type (avoids replacing wrong card)
  var btnDoRedraw = $('btn-do-redraw');
  if (btnDoRedraw) {
    btnDoRedraw.addEventListener('click', function () {
      if (!window.Cards || !window.Cards.getRedrawSelection) return;
      var selectedIds = window.Cards.getRedrawSelection();
      if (!selectedIds.length) return;

      var st = window.Game.getState();
      var dc = JSON.parse(JSON.stringify(st.drawnCards));
      var handEl = $('hand-phase1');

      selectedIds.forEach(function (cardId) {
        var oldEl = document.querySelector('.card[data-id="' + cardId + '"]');
        var type = oldEl ? oldEl.dataset.type : null;
        if (!type) return;

        var newCard = window.Game.reDrawCard(cardId, type);
        if (!newCard) return;

        // Update state object
        if (type === 'ancestor') {
          dc.ancestor = newCard;
        } else if (type === 'value') {
          var valIdx = (dc.values || []).findIndex(function (v) { return v && v.id === cardId; });
          if (valIdx !== -1) dc.values[valIdx] = newCard;
        } else if (type === 'tool') {
          var toolIdx = (dc.tools || []).findIndex(function (t) { return t && t.id === cardId; });
          if (toolIdx !== -1) dc.tools[toolIdx] = newCard;
        }

        // Animate: flip out old, deal new
        if (oldEl && handEl) {
          window.Cards.animateRedraw(oldEl, newCard, null);
        }
      });

      window.Game.setState({ drawnCards: dc });
    });
  }

  // ── 15. Phase 1 Notepad screen ────────────────────────────
  var btnP1nContinue = $('btn-p1n-continue');
  if (btnP1nContinue) {
    btnP1nContinue.addEventListener('click', function () {
      advancePhase('phase2-notepad');
    });
  }

  // ── 16. Phase 2 Challenge screen ──────────────────────────
  var btnChallengeRandom = $('btn-challenge-random');
  if (btnChallengeRandom) {
    btnChallengeRandom.addEventListener('click', function () {
      var card = window.Game.drawCard('challenge');
      if (!card) return;
      var st = window.Game.getState();
      var dc = JSON.parse(JSON.stringify(st.drawnCards));
      dc.challenge = card;
      window.Game.setState({ drawnCards: dc, challengeMode: 'random' });

      if (window.UI && window.UI.renderChallengeCard) window.UI.renderChallengeCard(card);
    });
  }

  var btnChallengePreselect = $('btn-challenge-preselect');
  if (btnChallengePreselect) {
    btnChallengePreselect.addEventListener('click', function () {
      window.Game.setState({ challengeMode: 'preselect' });
      var grid = $('challenge-grid');
      if (grid && window.UI && window.UI.renderChallengeGrid) {
        window.UI.renderChallengeGrid(grid, function (card) {
          var st = window.Game.getState();
          var dc = JSON.parse(JSON.stringify(st.drawnCards));
          dc.challenge = card;
          window.Game.setState({ drawnCards: dc });

          var area = $('challenge-card-area');
          if (area && window.Cards && window.Cards.render) {
            area.innerHTML = '';
            area.appendChild(window.Cards.render(card));
          }
          hideEl(grid);
          showEl($('challenge-display'));
        });
      }
      showEl(grid);
      hideEl($('challenge-display'));
    });
  }

  // FIX 7: after challenge confirmed, go to phase1-notepad (character intro writing)
  var btnChallengeConfirm = $('btn-challenge-confirm');
  if (btnChallengeConfirm) {
    btnChallengeConfirm.addEventListener('click', function () {
      window.Game.goTo('phase1-notepad');
    });
  }

  // ── 17. Phase 2 Notepad screen ────────────────────────────
  var btnP2nContinue = $('btn-p2n-continue');
  if (btnP2nContinue) {
    btnP2nContinue.addEventListener('click', function () {
      advancePhase('phase3-notepad');
    });
  }

  // ── 18. Phase 3 Draw screen — REMOVED FROM FLOW (BUG 6) ───
  // Screen HTML kept but flow never navigates here.
  // Redraw for tools now handled within Phase 1 draw.

  // ── 19. Phase 3 Notepad screen ────────────────────────────
  var btnP3nContinue = $('btn-p3n-continue');
  if (btnP3nContinue) {
    btnP3nContinue.addEventListener('click', function () {
      advancePhase('phase4');
    });
  }

  // ── 20. Phase 4 screen ────────────────────────────────────
  var btnCompleteSession = $('btn-complete-session');
  if (btnCompleteSession) {
    btnCompleteSession.addEventListener('click', function () {
      var st = window.Game ? window.Game.getState() : null;
      var t = st ? st.timer : null;
      var timerUsed = t && (t.active || t.elapsed > 0 || t.startedAt !== null);
      if (timerUsed && t.mode === 'writing') {
        // switch to sharing mode, stay on phase4
        if (window.Timer) window.Timer.pause();
        window.Game.setState({ timer: { mode: 'sharing', elapsed: 0, startedAt: null, active: false } });
        setTimeout(function() { if (window.Timer) window.Timer.resume(); }, 60);
      } else {
        // sharing done — export
        window.Game.setState({ completed: true });
        window.Game.goTo('export');
        if (window.UI && window.UI.renderExport) window.UI.renderExport(window.Game.getState());
      }
    });
  }

  // ── 21. Export screen ─────────────────────────────────────
  var btnPlayAgain = $('btn-play-again');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', function () {
      window.Game.resetState();
      window.Game.goTo('welcome');
    });
  }

  var btnExportTxt = $('btn-export-txt');
  if (btnExportTxt) {
    btnExportTxt.addEventListener('click', function () {
      if (window.Export && window.Export.txt) window.Export.txt(window.Game.getState());
    });
  }

  var btnExportPdf = $('btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', function () {
      if (window.Export && window.Export.pdf) window.Export.pdf(window.Game.getState());
    });
  }

  var btnExportJpeg = $('btn-export-jpeg');
  if (btnExportJpeg) {
    btnExportJpeg.addEventListener('click', function () {
      if (window.Export && window.Export.jpeg) window.Export.jpeg(window.Game.getState());
    });
  }

  // ── 22. Auto-save all notepad textareas ───────────────────
  var notepadForms = document.querySelectorAll('.notepad-form');
  notepadForms.forEach(function (form) {
    form.addEventListener('input', function (e) {
      var ta = e.target;
      if (ta.tagName !== 'TEXTAREA') return;
      var fieldName = ta.name;
      if (!fieldName) return;
      var patch = { notepad: {} };
      patch.notepad[fieldName] = ta.value;
      window.Game.setState(patch);
    });
  });

  // ── 23. Language chips (modal + welcome screen) ───────────
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.lang-chip[data-lang]');
    if (!chip) return;
    if (chip.classList.contains('disabled')) return;
    var lang = chip.getAttribute('data-lang');
    if (window.i18n) window.i18n.setLang(lang);
    window.Game.setState({ lang: lang });
    if (window.UI && window.UI.refreshI18n) window.UI.refreshI18n();
    hideModal('modal-lang');

    // Update active state on all lang chips
    document.querySelectorAll('.lang-chip[data-lang]').forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-lang') === lang);
    });

    // FIX 13: re-render export screen if currently visible
    var currentState = window.Game.getState();
    if (currentState.screen === 'export' && window.UI && window.UI.renderExport) {
      window.UI.renderExport();
    }

    if (window.twemoji) twemoji.parse(document.body);
  });

  // ── 25. Timer modal toggle ────────────────────────────────
  var btnTimerToggle = $('btn-timer-toggle');
  if (btnTimerToggle) {
    btnTimerToggle.addEventListener('click', function () {
      var st = window.Game.getState();
      if (st.timer.active) {
        if (window.Timer && window.Timer.pause) window.Timer.pause();
        window.Game.setState({ timer: { active: false } });
      } else {
        if (window.Timer && window.Timer.resume) window.Timer.resume();
        window.Game.setState({ timer: { active: true, startedAt: Date.now() } });
      }
    });
  }

  // "Next Phase" button in timer modal
  var btnNextPhase = $('btn-next-phase');
  if (btnNextPhase) {
    btnNextPhase.addEventListener('click', function () {
      var st = window.Game.getState();
      var nextScreenMap = {
        'phase1-notepad':   'phase2-notepad',
        'phase2-notepad':   'phase3-notepad',
        'phase3-notepad':   'phase4',
        'phase4':           'export'
      };
      var nextScreen = nextScreenMap[st.screen];
      if (nextScreen) {
        hideModal('modal-timer');
        window.Game.goTo(nextScreen);
      }
    });
  }

  // ── 26. Phase-alert modal next button ─────────────────────
  var btnAlertNext = $('btn-alert-next');
  if (btnAlertNext) {
    btnAlertNext.addEventListener('click', function () {
      hideModal('modal-phase-alert');
      var nextScreen = btnAlertNext.getAttribute('data-next-screen');
      if (nextScreen) window.Game.goTo(nextScreen);
    });
  }

  // ── 27. Restore notepad values if resuming ─────────────────
  function restoreNotepadValues() {
    var st = window.Game.getState();
    var n = st.notepad;
    Object.keys(n).forEach(function (key) {
      var fieldName = key;
      var el = document.querySelector('textarea[name="' + fieldName + '"]');
      if (el && n[key]) el.value = n[key];
    });
    // Restore lines/veils
    if (checkLinesVeils) checkLinesVeils.checked = !!st.linesVeils;
    // Restore timer table values
    refreshTimerTable();
  }

  if (hasSaved) restoreNotepadValues();

  // ── 28. Listen for stateChange to keep UI in sync ──────────
  window.Game.on('stateChange', function (st) {
    // Keep timer badge updated
    var badge = $('timer-badge-text');
    if (badge && window.Timer && window.Timer.getDisplay) {
      badge.textContent = window.Timer.getDisplay();
    }
    // BUG 10: update next-phase button visibility in timer modal
    _updateNextPhaseBtn(st.screen);
  });

  function _updateNextPhaseBtn(screen) {
    var btn = $('btn-next-phase');
    if (!btn) return;
    var gameNotepadScreens = ['phase1-notepad', 'phase2-notepad', 'phase3-notepad', 'phase4'];
    if (gameNotepadScreens.indexOf(screen) !== -1) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }

  // ── 29. Initial i18n pass ─────────────────────────────────
  if (window.UI && window.UI.refreshI18n) window.UI.refreshI18n();
  refreshTimerTable();
});
