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
      value: null,
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
    playerCount: 3,
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
    if (dc.value) _drawnIds.add(dc.value.id);
    if (dc.tools) dc.tools.forEach(function (t) { _drawnIds.add(t.id); });
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

    goTo: function (screen) {
      _state.screen = screen;
      this.saveState();
      this.emit('screenChange', screen);
      if (window.UI) window.UI.showScreen(screen);
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
  if (timerBadge) timerBadge.addEventListener('click', function () { showModal('modal-timer'); });

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
      window.Game.goTo('game-intro');
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

  // Player count stepper
  var playerCountDisplay = $('player-count-display');
  var MIN_PLAYERS = 2;
  var MAX_PLAYERS = 8;

  function updatePlayerDisplay() {
    var st = window.Game.getState();
    if (playerCountDisplay) playerCountDisplay.textContent = st.playerCount;
  }

  var btnPlayersMinus = $('btn-players-minus');
  var btnPlayersPlus = $('btn-players-plus');
  if (btnPlayersMinus) {
    btnPlayersMinus.addEventListener('click', function () {
      var st = window.Game.getState();
      if (st.playerCount > MIN_PLAYERS) {
        window.Game.setState({ playerCount: st.playerCount - 1 });
        updatePlayerDisplay();
      }
    });
  }
  if (btnPlayersPlus) {
    btnPlayersPlus.addEventListener('click', function () {
      var st = window.Game.getState();
      if (st.playerCount < MAX_PLAYERS) {
        window.Game.setState({ playerCount: st.playerCount + 1 });
        updatePlayerDisplay();
      }
    });
  }

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

  // ── 14. Phase 1 Draw screen ───────────────────────────────

  // Track what has been drawn in this draw session
  var _p1DrawnTypes = {};

  function handleDeckClick(deckEl) {
    var type = deckEl.getAttribute('data-type');
    if (!type) return;

    // For phase 1: ancestor & value (one each)
    var card = window.Game.drawCard(type);
    if (!card) return;

    var st = window.Game.getState();
    var newDrawn = JSON.parse(JSON.stringify(st.drawnCards));

    if (type === 'ancestor') {
      newDrawn.ancestor = card;
    } else if (type === 'value') {
      newDrawn.value = card;
    }
    window.Game.setState({ drawnCards: newDrawn });

    // Render card in hand
    if (window.Cards && window.Cards.renderInHand) {
      window.Cards.renderInHand(card, $('hand-phase1'), type);
    }

    // Update progress dots
    _updateP1Progress();

    // Show continue when both drawn
    var updated = window.Game.getState();
    if (updated.drawnCards.ancestor && updated.drawnCards.value) {
      showEl($('btn-p1-continue'));
    }
  }

  function _updateP1Progress() {
    var st = window.Game.getState();
    var dots = document.querySelectorAll('#draw-progress-p1 .progress-dot');
    dots.forEach(function (dot) {
      var forType = dot.getAttribute('data-for');
      if (forType === 'ancestor' && st.drawnCards.ancestor) dot.classList.add('filled');
      if (forType === 'value' && st.drawnCards.value) dot.classList.add('filled');
    });
    // Show redraw panel once at least one card is drawn
    if (st.drawnCards.ancestor || st.drawnCards.value) {
      showEl($('redraw-panel'));
    }
  }

  // Deck stack clicks (delegated)
  document.addEventListener('click', function (e) {
    var stack = e.target.closest('.deck-stack');
    if (!stack) return;
    var screenP1 = $('screen-phase1-draw');
    var screenP3 = $('screen-phase3-draw');
    if (screenP1 && screenP1.style.display !== 'none' && screenP1.contains(stack)) {
      handleDeckClick(stack);
    }
    if (screenP3 && screenP3.style.display !== 'none' && screenP3.contains(stack)) {
      handleDeckClickP3(stack);
    }
  });

  var btnP1Continue = $('btn-p1-continue');
  if (btnP1Continue) {
    btnP1Continue.addEventListener('click', function () {
      // Populate ref cards strip
      if (window.UI && window.UI.renderRefCards) {
        var st = window.Game.getState();
        window.UI.renderRefCards([st.drawnCards.ancestor, st.drawnCards.value], $('ref-cards-p1'));
      }
      window.Game.goTo('phase1-notepad');
    });
  }

  // Redraw (phase 1)
  var _selectedForRedraw = new Set();
  var btnDoRedraw = $('btn-do-redraw');
  if (btnDoRedraw) {
    btnDoRedraw.addEventListener('click', function () {
      _selectedForRedraw.forEach(function (cardId) {
        var st = window.Game.getState();
        var dc = JSON.parse(JSON.stringify(st.drawnCards));
        if (dc.ancestor && dc.ancestor.id === cardId) {
          var newCard = window.Game.reDrawCard(cardId, 'ancestor');
          if (newCard) {
            dc.ancestor = newCard;
            if (window.Cards && window.Cards.replaceInHand) window.Cards.replaceInHand(newCard, $('hand-phase1'), 'ancestor');
          }
        }
        if (dc.value && dc.value.id === cardId) {
          var newCard2 = window.Game.reDrawCard(cardId, 'value');
          if (newCard2) {
            dc.value = newCard2;
            if (window.Cards && window.Cards.replaceInHand) window.Cards.replaceInHand(newCard2, $('hand-phase1'), 'value');
          }
        }
        window.Game.setState({ drawnCards: dc });
      });
      _selectedForRedraw.clear();
    });
  }

  // Card selection for redraw (delegated)
  document.addEventListener('click', function (e) {
    var cardEl = e.target.closest('.hand-card[data-card-id]');
    if (!cardEl) return;
    var id = cardEl.getAttribute('data-card-id');
    if (_selectedForRedraw.has(id)) {
      _selectedForRedraw.delete(id);
      cardEl.classList.remove('selected-for-redraw');
    } else {
      _selectedForRedraw.add(id);
      cardEl.classList.add('selected-for-redraw');
    }
  });

  // ── 15. Phase 1 Notepad screen ────────────────────────────
  var btnP1nContinue = $('btn-p1n-continue');
  if (btnP1nContinue) {
    btnP1nContinue.addEventListener('click', function () {
      window.Game.goTo('phase2-challenge');
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

      var area = $('challenge-card-area');
      if (area && window.Cards && window.Cards.render) {
        area.innerHTML = '';
        area.appendChild(window.Cards.render(card));
      }
      showEl($('challenge-display'));
      hideEl($('challenge-grid'));
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

  var btnChallengeConfirm = $('btn-challenge-confirm');
  if (btnChallengeConfirm) {
    btnChallengeConfirm.addEventListener('click', function () {
      if (window.UI && window.UI.renderRefCards) {
        var st = window.Game.getState();
        window.UI.renderRefCards([st.drawnCards.challenge], $('ref-cards-p2'));
      }
      window.Game.goTo('phase2-notepad');
    });
  }

  // ── 17. Phase 2 Notepad screen ────────────────────────────
  var btnP2nContinue = $('btn-p2n-continue');
  if (btnP2nContinue) {
    btnP2nContinue.addEventListener('click', function () {
      window.Game.goTo('phase3-draw');
    });
  }

  // ── 18. Phase 3 Draw screen ───────────────────────────────
  function handleDeckClickP3(deckEl) {
    var st = window.Game.getState();
    var tools = (st.drawnCards.tools || []).slice();
    if (tools.length >= 2) return; // already have both
    var card = window.Game.drawCard('tool');
    if (!card) return;
    tools.push(card);
    window.Game.setState({ drawnCards: Object.assign({}, st.drawnCards, { tools: tools }) });

    if (window.Cards && window.Cards.renderInHand) {
      window.Cards.renderInHand(card, $('hand-phase3'), 'tool');
    }

    _updateP3Progress();
    var updated = window.Game.getState();
    if (updated.drawnCards.tools && updated.drawnCards.tools.length >= 2) {
      showEl($('btn-p3-continue'));
    }
  }

  function _updateP3Progress() {
    var st = window.Game.getState();
    var tools = st.drawnCards.tools || [];
    var dots = document.querySelectorAll('#draw-progress-p3 .progress-dot');
    dots.forEach(function (dot, i) {
      if (tools[i]) dot.classList.add('filled');
    });
    if (tools.length > 0) showEl($('redraw-panel-p3'));
  }

  // Redraw (phase 3)
  var _selectedForRedrawP3 = new Set();
  var btnDoRedrawP3 = $('btn-do-redraw-p3');
  if (btnDoRedrawP3) {
    btnDoRedrawP3.addEventListener('click', function () {
      _selectedForRedrawP3.forEach(function (cardId) {
        var st = window.Game.getState();
        var dc = JSON.parse(JSON.stringify(st.drawnCards));
        var idx = dc.tools.findIndex(function (t) { return t.id === cardId; });
        if (idx !== -1) {
          var newCard = window.Game.reDrawCard(cardId, 'tool');
          if (newCard) {
            dc.tools[idx] = newCard;
            if (window.Cards && window.Cards.replaceInHand) window.Cards.replaceInHand(newCard, $('hand-phase3'), 'tool-' + idx);
          }
        }
        window.Game.setState({ drawnCards: dc });
      });
      _selectedForRedrawP3.clear();
    });
  }

  var btnP3Continue = $('btn-p3-continue');
  if (btnP3Continue) {
    btnP3Continue.addEventListener('click', function () {
      if (window.UI && window.UI.renderRefCards) {
        var st = window.Game.getState();
        window.UI.renderRefCards(st.drawnCards.tools, $('ref-cards-p3'));
      }
      window.Game.goTo('phase3-notepad');
    });
  }

  // ── 19. Phase 3 Notepad screen ────────────────────────────
  var btnP3nContinue = $('btn-p3n-continue');
  if (btnP3nContinue) {
    btnP3nContinue.addEventListener('click', function () {
      if (window.UI && window.UI.renderRefCards) {
        var st = window.Game.getState();
        var allCards = [st.drawnCards.ancestor, st.drawnCards.value, st.drawnCards.challenge]
          .concat(st.drawnCards.tools || [])
          .filter(Boolean);
        window.UI.renderRefCards(allCards, $('ref-cards-p4'));
      }
      window.Game.goTo('phase4');
    });
  }

  // ── 20. Phase 4 screen ────────────────────────────────────
  var btnCompleteSession = $('btn-complete-session');
  if (btnCompleteSession) {
    btnCompleteSession.addEventListener('click', function () {
      window.Game.setState({ completed: true });
      window.Game.goTo('export');
      if (window.UI && window.UI.renderExport) window.UI.renderExport(window.Game.getState());
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

    if (window.twemoji) twemoji.parse(document.body);
  });

  // ── 24. Close lang modal explicit btn ─────────────────────
  // (already handled in modalCloseIds above via btn-close-lang)

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
      // Convert notepad key to form field name attribute (they match)
      var fieldName = key;
      var el = document.querySelector('textarea[name="' + fieldName + '"]');
      if (el && n[key]) el.value = n[key];
    });
    // Restore player count
    if (playerCountDisplay) playerCountDisplay.textContent = st.playerCount;
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
    // Keep player count display in sync
    if (playerCountDisplay) playerCountDisplay.textContent = st.playerCount;
  });

  // ── 29. Initial i18n pass ─────────────────────────────────
  if (window.UI && window.UI.refreshI18n) window.UI.refreshI18n();
  refreshTimerTable();
});
