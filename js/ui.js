window.UI = (function() {

  function parseEmojis(el) {
    if (!el || typeof twemoji === 'undefined') return;
    twemoji.parse(el, {
      folder: 'svg', ext: '.svg',
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
    });
  }

  function t(key, vars) { return window.i18n ? window.i18n.t(key, vars) : key; }

  // BUG 4: game screens where timer badge should be visible
  var GAME_SCREENS = [
    'phase1-draw', 'phase1-notepad',
    'phase2-challenge', 'phase2-notepad',
    'phase3-notepad',
    'phase4', 'export',
    't354-setup', 't354-challenges', 't354-play', 't354-complete',
    't759-challenge', 't759-value', 't759-spark', 't759-action'
  ];

  // Map each screen to its per-screen continue button ID
  var _continueBtnMap = {
    'phase1-draw':      'btn-p1-continue',
    'phase1-notepad':   'btn-p1n-continue',
    'phase2-challenge': 'btn-challenge-confirm',
    'phase2-notepad':   'btn-p2n-continue',
    'phase3-notepad':   'btn-p3n-continue',
    'phase4':           'btn-complete-session',
    't354-setup':       'btn-t354-setup-continue',
    't354-challenges':  'btn-t354-challenges-continue',
    't354-play':        'btn-t354-play-continue',
    't759-challenge':   'btn-t759-challenge-continue',
    't759-value':       'btn-t759-value-continue',
    't759-spark':       'btn-t759-spark-continue',
    't759-action':      'btn-t759-action-continue'
  };

  // Wire the single global continue pill in #persistent-ui to the
  // current screen's local continue button.  Also called whenever the
  // local button's disabled state changes (draw progress, challenge pick).
  function _syncGlobalContinue(screenName) {
    var globalBtn = document.getElementById('btn-continue-global');
    if (!globalBtn) return;
    var localId = _continueBtnMap[screenName];
    if (!localId) { globalBtn.style.display = 'none'; return; }
    var localBtn = document.getElementById(localId);
    if (!localBtn) { globalBtn.style.display = 'none'; return; }

    globalBtn.style.display = '';
    globalBtn.disabled = localBtn.disabled;
    // Replace onclick so there's only ever one handler
    globalBtn.onclick = function() {
      if (!globalBtn.disabled) localBtn.click();
    };
    // Use local button label override for special screens
    if (screenName === 't759-spark') {
      globalBtn.textContent = t('t759_idea_btn', 'I have an idea! →');
    } else if (screenName === 't759-action') {
      globalBtn.textContent = t('t759_action_commit', 'Commit to Action');
    } else {
      // Update label based on timer mode
      _updateContinueBtnLabel(globalBtn);
    }
  }

  // Update the global continue button label to reflect current timer mode
  function _updateContinueBtnLabel(btn) {
    if (!btn) return;
    var t = window.i18n ? window.i18n.t.bind(window.i18n) : function(k, fb) { return fb || k; };
    var timerSt = window.Game ? window.Game.getState().timer : null;
    var timerUsed = timerSt && (timerSt.active || timerSt.elapsed > 0 || timerSt.startedAt !== null);
    if (timerUsed && timerSt.mode === 'writing') {
      btn.textContent = t('btn_start_sharing', 'Start Sharing →');
    } else if (timerUsed && timerSt.mode === 'sharing') {
      btn.textContent = t('btn_continue', 'Continue →');
    } else {
      btn.textContent = t('btn_continue', 'Continue →');
    }
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active', 'entering');
      s.style.display = 'none'; // ensure inline style never fights CSS
    });
    var target = document.getElementById('screen-' + name);
    if (!target) return;
    target.classList.add('active');
    target.style.display = 'flex'; // override any baked-in inline style
    requestAnimationFrame(function() { target.classList.add('entering'); });

    // BUG 4: show/hide timer badge based on screen type
    var timerBadge = document.getElementById('timer-badge');
    if (timerBadge) {
      if (GAME_SCREENS.indexOf(name) !== -1) {
        timerBadge.classList.remove('timer-badge-hidden');
      } else {
        timerBadge.classList.add('timer-badge-hidden');
      }
    }

    // Show/hide mini timer ring alongside badge
    var timerMini = document.getElementById('timer-mini');
    if (timerMini) {
      timerMini.style.display = (GAME_SCREENS.indexOf(name) !== -1) ? 'flex' : 'none';
    }

    // Toggle dark-screen-active on #app for contrast overrides
    var app = document.getElementById('app');
    if (app) {
      var darkScreens = ['phase1-draw', 'phase2-challenge'];
      app.classList.toggle('dark-screen-active', darkScreens.indexOf(name) !== -1);
    }

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
      // phase3-draw removed from active flow (BUG 6)
      'phase3-notepad': function() { renderNotepad(3); },
      'phase4': renderPhase4,
      'export': renderExport,
      't354-setup': renderT354Setup,
      't354-challenges': renderT354Challenges,
      't354-play': renderT354Play,
      't354-complete': function() { refreshI18n(); },
      't759-challenge': renderT759Challenge,
      't759-value': renderT759Value,
      't759-spark': renderT759Spark,
      't759-action': renderT759Action
    };
    _syncGlobalContinue(name);   // wire continue pill before render so disabled syncs correctly
    if (renders[name]) renders[name]();
    parseEmojis(target);
  }

  function showModal(name) {
    document.querySelectorAll('.modal').forEach(function(m) {
      m.classList.remove('active');
      m.style.display = 'none';
    });
    var m = document.getElementById('modal-' + name);
    if (m) {
      m.classList.add('active');
      m.style.display = 'flex';
    }
    if (name === 'timer') updateTimerModal();
    if (m) parseEmojis(m);
  }

  function hideModal(name) {
    var m = document.getElementById('modal-' + name);
    if (m) {
      m.classList.remove('active');
      m.style.display = 'none';
    }
  }

  function hideAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
      m.classList.remove('active');
      m.style.display = 'none';
    });
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
          // BUG 13: populate value1 and value2 from dc.values array
          if (parsed.value1 !== undefined) {
            parsed.value1 = (dc.values && dc.values[0]) ? (dc.values[0].name[lang] || dc.values[0].name.en) : '';
          }
          if (parsed.value2 !== undefined) {
            parsed.value2 = (dc.values && dc.values[1]) ? (dc.values[1].name[lang] || dc.values[1].name.en) : '';
          }
          // Legacy single value support (kept for any stray references)
          if (parsed.value !== undefined && dc.values && dc.values[0]) {
            parsed.value = dc.values[0].name[lang] || dc.values[0].name.en;
          }
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
        '<h3>\uD83C\uDFC4 ' + t('intro_4phases_title') + '</h3>' +
        '<p>' + t('game_phases_explainer') + '</p>' +
        '<ol class="phase-list">' +
        '<li>' + t('intro_phase1_item') + '</li>' +
        '<li>' + t('intro_phase2_item') + '</li>' +
        '<li>' + t('intro_phase3_item') + '</li>' +
        '<li>' + t('intro_phase4_item') + '</li>' +
        '</ol>' +
        '</div>' +
        '<div class="intro-section">' +
        '<h3>\uD83C\uDCCF ' + t('intro_card_types_title') + '</h3>' +
        '<div class="card-type-explainers">' +
        '<div class="ctype"><span class="ct-badge ancestor">' + t('deck_label_ancestor').toUpperCase() + '</span> ' + t('intro_ancestor_type_desc') + '</div>' +
        '<div class="ctype"><span class="ct-badge value">' + t('deck_label_value').toUpperCase() + '</span> ' + t('intro_value_type_desc') + '</div>' +
        '<div class="ctype"><span class="ct-badge tool">' + t('deck_label_tool').toUpperCase() + '</span> ' + t('intro_tool_type_desc') + '</div>' +
        '<div class="ctype"><span class="ct-badge challenge">' + t('deck_label_challenge').toUpperCase() + '</span> ' + t('intro_challenge_type_desc') + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="intro-section consent-reminder">' +
        '<h3>\uD83E\uDD1D ' + t('intro_before_title') + '</h3>' +
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

  // BUG 3: removed playerCount reference
  function renderPreGame() {
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

  // FIX 9: deck visibility gating (called on screen show and after each draw)
  function _updateDeckVisibility(dc) {
    var aDeck = document.getElementById('ancestor-deck');
    var vDeck = document.getElementById('value-deck');
    var tDeck = document.getElementById('tool-deck-p1');
    var continueBtn = document.getElementById('btn-p1-continue');

    var allFiveDrawn = dc.ancestor &&
      (dc.values || []).length >= 2 &&
      (dc.tools || []).length >= 2;

    // Continue pill: disabled until all 5 drawn; also update global pill
    if (continueBtn) continueBtn.disabled = !allFiveDrawn;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = !allFiveDrawn;

    if (allFiveDrawn) {
      if (aDeck) aDeck.style.display = 'none';
      if (vDeck) vDeck.style.display = 'none';
      if (tDeck) tDeck.style.display = 'none';
    } else if (dc.ancestor && (dc.values || []).length < 2) {
      if (aDeck) aDeck.style.display = 'none';
      if (vDeck) vDeck.style.display = '';
      if (tDeck) tDeck.style.display = 'none';
    } else if ((dc.values || []).length >= 2 && (dc.tools || []).length < 2) {
      if (aDeck) aDeck.style.display = 'none';
      if (vDeck) vDeck.style.display = 'none';
      if (tDeck) tDeck.style.display = '';
    } else {
      // No ancestor yet: show ancestor deck only
      if (aDeck) aDeck.style.display = '';
      if (vDeck) vDeck.style.display = 'none';
      if (tDeck) tDeck.style.display = 'none';
    }
  }

  // FIX 9: update draw step instruction text
  function _updateDrawStepInstruction(dc) {
    var el = document.getElementById('draw-step-instruction');
    if (!el) return;
    var allFiveDrawn = dc.ancestor &&
      (dc.values || []).length >= 2 &&
      (dc.tools || []).length >= 2;
    if (allFiveDrawn) {
      el.textContent = t('draw_step_done');
    } else if (!dc.ancestor) {
      el.textContent = t('draw_step_ancestor');
    } else if ((dc.values || []).length === 0) {
      el.textContent = t('draw_step_value1');
    } else if ((dc.values || []).length === 1) {
      el.textContent = t('draw_step_value2');
    } else if ((dc.tools || []).length === 0) {
      el.textContent = t('draw_step_tool1');
    } else if ((dc.tools || []).length === 1) {
      el.textContent = t('draw_step_tool2');
    }
  }

  // always clear hand containers; phase 1 draws all 5 cards
  function renderCardDraw(phase) {
    var state = window.Game ? window.Game.getState() : {};
    updatePhaseIndicator(phase);
    var dc = state.drawnCards || {};

    if (phase === 1) {
      // always clear hand container before re-rendering
      var handEl = document.getElementById('hand-phase1');
      if (handEl) handEl.innerHTML = '';

      // Mark decks as dealt if already maxed
      var aDeck = document.getElementById('ancestor-deck');
      var vDeck = document.getElementById('value-deck');
      var tDeck = document.getElementById('tool-deck-p1');

      if (aDeck) {
        aDeck.classList.toggle('dealt', !!dc.ancestor);
        aDeck.classList.toggle('ready-to-draw', !dc.ancestor);
      }
      if (vDeck) {
        var valCount = (dc.values || []).length;
        vDeck.classList.toggle('dealt', valCount >= 2);
        vDeck.classList.toggle('ready-to-draw', valCount < 2);
      }
      if (tDeck) {
        var toolCount = (dc.tools || []).length;
        tDeck.classList.toggle('dealt', toolCount >= 2);
        tDeck.classList.toggle('ready-to-draw', toolCount < 2);
      }

      // Re-render any already-drawn cards
      var p1Cards = [dc.ancestor].concat(dc.values || []).concat(dc.tools || []).filter(Boolean);
      if (p1Cards.length > 0 && handEl) renderHand(p1Cards, 'hand-phase1');

      // FIX 9: update deck visibility and instruction on screen show/restore
      _updateDeckVisibility(dc);
      _updateDrawStepInstruction(dc);
    }
    // Phase 3 draw screen removed from flow
  }

  // BUG 7: always show ALL drawn cards on every notepad screen
  function renderNotepad(phase) {
    var state = window.Game ? window.Game.getState() : {};
    var dc = state.drawnCards || {};
    var np = state.notepad || {};

    var stripId = 'ref-cards-p' + phase;
    var strip = document.getElementById(stripId);
    if (strip) {
      strip.innerHTML = '';
      // BUG 7: always show all drawn cards from phase 1 onward
      var refCards = [];
      if (dc.ancestor) refCards.push(dc.ancestor);
      (dc.values || []).forEach(function(v) { if (v) refCards.push(v); });
      (dc.tools || []).forEach(function(t) { if (t) refCards.push(t); });
      if (dc.challenge) refCards.push(dc.challenge);
      refCards.forEach(function(card) {
        var mini = window.Cards ? window.Cards.createCardEl(card, true) : document.createElement('div');
        strip.appendChild(mini);
        if (window.Cards) window.Cards.flip(mini);
        // FIX 12: attach explain listener to mini card button
        var explainBtn = mini.querySelector('.card-explain-toggle');
        if (explainBtn) {
          explainBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            renderExplainMore(card);
          });
        }
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
    // keep confirm pill disabled until a challenge is actually selected
    var confirmBtn = document.getElementById('btn-challenge-confirm');
    if (confirmBtn) confirmBtn.disabled = !dc.challenge;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = !dc.challenge;
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
      el.classList.add('flipped'); // already drawn cards show face-up
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
    // scroll challenge screen to top so user sees the card
    var challengeScreen = document.getElementById('screen-phase2-challenge');
    if (challengeScreen) challengeScreen.scrollTop = 0;
    // enable the confirm pill now that a card is selected
    var confirmBtn = document.getElementById('btn-challenge-confirm');
    if (confirmBtn) confirmBtn.disabled = false;
    var globalContinue = document.getElementById('btn-continue-global');
    if (globalContinue) globalContinue.disabled = false;
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

    // BUG 13: use values array for export
    var val1Name = getName(dc.values && dc.values[0]);
    var val2Name = getName(dc.values && dc.values[1]);

    summary.innerHTML = '<div class="export-section" id="export-card-section">' +
      '<h3>' + t('export_section_ancestor') + '</h3>' +
      '<div class="export-cards-row" id="export-cards-row"></div>' +
      '<div class="export-notepad">' +
      '<p><strong>' + t('p1_name_label') + ':</strong> ' + (np.p1_name || '\u2014') + '</p>' +
      '<p><strong>' + t('p1_background_label') + ':</strong> ' + (np.p1_background || '\u2014') + '</p>' +
      '<p><strong>' + t('p1_value_label', { value1: val1Name, value2: val2Name }) + ':</strong> ' + (np.p1_value_connection || '\u2014') + '</p>' +
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
      // BUG 7/13: use values array
      var allCards = [dc.ancestor]
        .concat(dc.values || [])
        .concat([dc.challenge])
        .concat(dc.tools || [])
        .filter(Boolean);
      allCards.forEach(function(card) {
        var el = window.Cards.createCardEl(card);
        el.classList.add('flipped');
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) {
          explainBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            renderExplainMore(card);
          });
        }
        cardsRow.appendChild(el);
      });
    }

    parseEmojis(summary);
  }

  function renderRefCards(cards, el) {
    if (!el) return;
    el.innerHTML = '';
    (cards || []).filter(Boolean).forEach(function(card) {
      var mini = window.Cards ? window.Cards.createCardEl(card, true) : document.createElement('div');
      el.appendChild(mini);
      if (window.Cards) {
        setTimeout(function() { window.Cards.flip(mini); }, 200);
      }
    });
    parseEmojis(el);
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

    // Update data-mode attribute for CSS mode indicator
    var timerSt = window.Game ? window.Game.getState().timer : null;
    badge.setAttribute('data-mode', timerSt ? timerSt.mode : 'writing');

    // Update mini timer ring
    var mini = document.getElementById('timer-mini');
    var miniCircle = document.getElementById('timer-mini-circle');
    var miniTime = document.getElementById('timer-mini-time');
    if (mini && window.Timer) {
      var remaining = window.Timer.getRemaining();
      if (timerSt) {
        var dur = timerSt.durations ? (timerSt.durations['p' + timerSt.phase + (timerSt.mode === 'writing' ? 'w' : 's')] || 300) : 300;
        var secs = Math.abs(remaining);
        var mm = String(Math.floor(secs / 60)).padStart(2, '0');
        var ss = String(secs % 60).padStart(2, '0');
        if (miniTime) miniTime.textContent = (remaining < 0 ? '-' : '') + mm + ':' + ss;
        if (miniCircle) {
          var circ = 106.8;
          var elapsed = dur - remaining;
          var progress = Math.min(1, Math.max(0, elapsed / dur));
          miniCircle.style.strokeDasharray = circ;
          miniCircle.style.strokeDashoffset = circ * (1 - progress);
        }
        mini.classList.toggle('overrun', !!isOverrun);
      }
    }
    // Sync continue button label with current timer mode
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn && globalBtn.style.display !== 'none') _updateContinueBtnLabel(globalBtn);
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

    // Reset button — shows "Reset to XX min" for the current phase/mode
    var resetBtn = document.getElementById('btn-timer-reset');
    if (resetBtn) {
      var resetMins = Math.round(_getDuration(timerState.phase, timerState.mode) / 60);
      resetBtn.textContent = 'Reset to ' + resetMins + ' min';
      resetBtn.onclick = function() {
        if (window.Timer) window.Timer.pause();
        if (window.Game) window.Game.setState({ timer: { elapsed: 0, startedAt: null, active: false } });
        updateTimerModal();
      };
    }

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
      var screenMap = {
        '1writing': 'phase1-notepad',
        '1sharing': 'phase1-notepad',
        '2writing': 'phase2-notepad',
        '2sharing': 'phase2-notepad',
        '3writing': 'phase3-notepad',
        '3sharing': 'phase3-notepad',
        '4writing': 'phase4',
        '4sharing': 'phase4'
      };
      var phaseNames = { 1: 'Ancestors', 2: 'Challenge', 3: 'Building', 4: 'Remembrance' };
      // Gate: phases 2+ require the challenge to have been selected
      var gameState2 = window.Game ? window.Game.getState() : {};
      var challengeReady = !!(gameState2.drawnCards && gameState2.drawnCards.challenge);
      list.innerHTML = '';
      phases.forEach(function(ph) {
        var active = ph.p === timerState.phase && ph.m === timerState.mode;
        var mins = Math.round(((timerState.durations && timerState.durations[ph.key]) || 300) / 60);
        var accessible = ph.p === 1 || challengeReady;
        var targetScreen = accessible ? (screenMap[ph.p + '' + ph.m] || '') : '';
        var phaseTitle = 'Phase ' + ph.p + (phaseNames[ph.p] ? ' \u2014 ' + phaseNames[ph.p] : '');
        var phaseName = phaseTitle + ' \u00B7 ' + (ph.m === 'writing' ? 'Writing' : 'Sharing');

        var item = document.createElement('div');
        item.className = 'timer-phase-item' + (active ? ' active' : '') + (!accessible ? ' locked' : '');

        var info = document.createElement('div');
        info.className = 'timer-phase-info';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'timer-phase-name';
        nameSpan.textContent = phaseName;
        var modeSpan = document.createElement('span');
        modeSpan.className = 'timer-phase-mode';
        modeSpan.textContent = mins + ' min';
        info.appendChild(nameSpan);
        info.appendChild(modeSpan);
        item.appendChild(info);

        if (targetScreen) {
          item.style.cursor = 'pointer';
          var arrow = document.createElement('span');
          arrow.className = 'timer-phase-goto';
          arrow.textContent = '\u2192';
          item.appendChild(arrow);
          // capture phase, mode and screen in closure — fixes sharing navigation
          item.addEventListener('click', (function(tp, tm, ts) {
            return function() {
              if (window.Timer) window.Timer.pause();
              // switch timer to the clicked phase/mode and reset elapsed
              if (window.Game) window.Game.setState({ timer: { phase: tp, mode: tm, elapsed: 0, startedAt: null, active: false } });
              // close modal
              hideModal('timer');
              // only navigate if target screen differs from current screen
              var currentScreen = window.Game ? window.Game.getState().screen : '';
              if (ts && ts !== currentScreen) {
                if (window.Game) window.Game.goTo(ts);
              } else {
                // same screen — just refresh badge and mode class
                if (window.Timer && window.Timer._updateBadge) window.Timer._updateBadge();
              }
              // auto-start the timer for the newly selected phase
              setTimeout(function() {
                if (window.Timer) window.Timer.resume();
              }, 60);
            };
          })(ph.p, ph.m, targetScreen));
        }
        list.appendChild(item);
      });
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

    // show/hide next-phase button based on current screen
    var nextPhaseBtn = document.getElementById('btn-next-phase');
    if (nextPhaseBtn) {
      var gameState = window.Game.getState();
      var nextScreenMap = {
        'phase1-notepad':   'phase2-notepad',
        'phase2-notepad':   'phase3-notepad',
        'phase3-notepad':   'phase4',
        'phase4':           'export'
      };
      var hasNext = !!nextScreenMap[gameState.screen];
      nextPhaseBtn.style.display = hasNext ? '' : 'none';
    }
  }

  // ── Technique 354 render functions ────────────────────────

  function renderT354Setup() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t354 = state.t354 || {};

    // Restore already-drawn cards into hand
    var handEl = document.getElementById('hand-t354-setup');
    if (handEl) handEl.innerHTML = '';

    var existingCards = [];
    if (t354.ancestor) existingCards.push(t354.ancestor);
    if (t354.value) existingCards.push(t354.value);
    if (t354.tool) existingCards.push(t354.tool);

    existingCards.forEach(function(card) {
      if (!handEl || !window.Cards) return;
      var el = window.Cards.createCardEl(card);
      el.classList.add('flipped');
      handEl.appendChild(el);
      var explainBtn = el.querySelector('.card-explain-toggle');
      if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
    });

    // Mark decks empty/ready
    var aDeck = document.getElementById('t354-ancestor-deck');
    var vDeck = document.getElementById('t354-value-deck');
    var tDeck = document.getElementById('t354-tool-deck');
    if (aDeck) { aDeck.classList.toggle('empty', !!t354.ancestor); aDeck.classList.toggle('ready-to-draw', !t354.ancestor); }
    if (vDeck) { vDeck.classList.toggle('empty', !!t354.value); vDeck.classList.toggle('ready-to-draw', !t354.value); }
    if (tDeck) { tDeck.classList.toggle('empty', !!t354.tool); tDeck.classList.toggle('ready-to-draw', !t354.tool); }

    // Sync continue
    var allDrawn = t354.ancestor && t354.value && t354.tool;
    var localBtn = document.getElementById('btn-t354-setup-continue');
    if (localBtn) localBtn.disabled = !allDrawn;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = !allDrawn;
    if (handEl) parseEmojis(handEl);
  }

  function renderT354Challenges() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t354 = state.t354 || {};
    var challenges = t354.challenges || [];

    // Restore drawn challenge cards
    var handEl = document.getElementById('hand-t354-challenges');
    if (handEl) {
      handEl.innerHTML = '';
      challenges.forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card);
        el.classList.add('flipped');
        handEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      parseEmojis(handEl);
    }

    // Update progress dots
    var dots = document.querySelectorAll('#draw-progress-t354 .progress-dot');
    for (var i = 0; i < dots.length; i++) {
      if (i < challenges.length) dots[i].classList.add('filled');
      else dots[i].classList.remove('filled');
    }

    // Deck state — mark empty after 3 drawn
    var deckEl = document.getElementById('t354-challenge-deck');
    if (deckEl) { deckEl.classList.toggle('empty', challenges.length >= 3); deckEl.classList.toggle('ready-to-draw', challenges.length < 3); }

    // Sync continue
    var localBtn = document.getElementById('btn-t354-challenges-continue');
    if (localBtn) localBtn.disabled = challenges.length < 3;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = challenges.length < 3;
  }

  function renderT354Play() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t354 = state.t354 || {};

    // Show hand cards (ancestor + value + tool + extras)
    var handEl = document.getElementById('ref-cards-t354-hand');
    if (handEl) {
      handEl.innerHTML = '';
      var handCards = [];
      if (t354.ancestor) handCards.push(t354.ancestor);
      if (t354.value) handCards.push(t354.value);
      if (t354.tool) handCards.push(t354.tool);
      (t354.extras || []).forEach(function(c) { if (c) handCards.push(c); });
      handCards.forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card, true);
        el.classList.add('flipped');
        handEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      parseEmojis(handEl);
    }

    // Show challenge cards
    var challengeEl = document.getElementById('ref-cards-t354-challenges');
    if (challengeEl) {
      challengeEl.innerHTML = '';
      (t354.challenges || []).forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card, true);
        el.classList.add('flipped');
        challengeEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      parseEmojis(challengeEl);
    }

    // Populate textarea from state
    var textarea = document.getElementById('t354-response');
    if (textarea && !textarea.value) textarea.value = t354.response || '';

    // Restore extras hand
    var extrasEl = document.getElementById('hand-t354-extras');
    if (extrasEl) {
      extrasEl.innerHTML = '';
      (t354.extras || []).forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card);
        el.classList.add('flipped');
        extrasEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      parseEmojis(extrasEl);
    }
  }

  // ── Technique 759 render functions ────────────────────────

  function renderT759Challenge() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t759 = state.t759 || {};

    // Restore drawn challenge card
    var handEl = document.getElementById('hand-t759-challenge');
    if (handEl) {
      handEl.innerHTML = '';
      if (t759.challenge && window.Cards) {
        var el = window.Cards.createCardEl(t759.challenge);
        el.classList.add('flipped');
        handEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(t759.challenge); });
        parseEmojis(handEl);
      }
    }
    // Deck state — empty if drawn, ready-to-draw otherwise
    var t759ChDeck = document.getElementById('t759-challenge-deck');
    if (t759ChDeck) {
      t759ChDeck.classList.toggle('empty', !!t759.challenge);
      t759ChDeck.classList.toggle('ready-to-draw', !t759.challenge);
    }

    // Restore custom textarea
    var textarea = document.getElementById('t759-custom-challenge');
    if (textarea && !textarea.value) textarea.value = t759.customChallenge || '';

    // Sync continue
    var enabled = !!(t759.challenge || (t759.customChallenge && t759.customChallenge.trim()));
    var localBtn = document.getElementById('btn-t759-challenge-continue');
    if (localBtn) localBtn.disabled = !enabled;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = !enabled;
  }

  function renderT759Value() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t759 = state.t759 || {};

    var handEl = document.getElementById('hand-t759-value');
    if (handEl) {
      handEl.innerHTML = '';
      if (t759.value && window.Cards) {
        var el = window.Cards.createCardEl(t759.value);
        el.classList.add('flipped');
        handEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(t759.value); });
        parseEmojis(handEl);
      }
    }
    // Deck state
    var t759ValDeck = document.getElementById('t759-value-deck');
    if (t759ValDeck) {
      t759ValDeck.classList.toggle('empty', !!t759.value);
      t759ValDeck.classList.toggle('ready-to-draw', !t759.value);
    }

    var localBtn = document.getElementById('btn-t759-value-continue');
    if (localBtn) localBtn.disabled = !t759.value;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = !t759.value;
  }

  function renderT759Spark() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t759 = state.t759 || {};
    var lang = window.i18n ? window.i18n.getLang() : 'en';

    // Show challenge + value as mini reference cards
    var refEl = document.getElementById('ref-cards-t759-spark');
    if (refEl) {
      refEl.innerHTML = '';
      var refCards = [];
      if (t759.challenge) refCards.push(t759.challenge);
      if (t759.value) refCards.push(t759.value);
      refCards.forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card, true);
        el.classList.add('flipped');
        refEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      // If custom challenge, show as text
      if (!t759.challenge && t759.customChallenge) {
        var p = document.createElement('p');
        p.className = 'phase-note';
        p.textContent = t759.customChallenge;
        refEl.appendChild(p);
      }
      parseEmojis(refEl);
    }

    // Restore drawn tools hand
    var handEl = document.getElementById('hand-t759-spark');
    if (handEl) {
      handEl.innerHTML = '';
      (t759.tools || []).forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card);
        el.classList.add('flipped');
        handEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      parseEmojis(handEl);
    }

    // Update tool count label
    var countEl = document.getElementById('t759-tool-count');
    if (countEl) {
      var count = (t759.tools || []).length;
      var label = window.i18n ? window.i18n.t('t759_tools_drawn') : 'tools drawn';
      countEl.textContent = count + ' ' + label;
    }

    // Spark continue always enabled
    var localBtn = document.getElementById('btn-t759-spark-continue');
    if (localBtn) localBtn.disabled = false;
    var globalBtn = document.getElementById('btn-continue-global');
    if (globalBtn) globalBtn.disabled = false;
  }

  function renderT759Action() {
    refreshI18n();
    var state = window.Game ? window.Game.getState() : {};
    var t759 = state.t759 || {};

    // Show all cards in a strip
    var refEl = document.getElementById('ref-cards-t759-action');
    if (refEl) {
      refEl.innerHTML = '';
      var allCards = [];
      if (t759.challenge) allCards.push(t759.challenge);
      if (t759.value) allCards.push(t759.value);
      (t759.tools || []).forEach(function(c) { if (c) allCards.push(c); });
      allCards.forEach(function(card) {
        if (!window.Cards) return;
        var el = window.Cards.createCardEl(card, true);
        el.classList.add('flipped');
        refEl.appendChild(el);
        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) explainBtn.addEventListener('click', function(e) { e.stopPropagation(); renderExplainMore(card); });
      });
      // Custom challenge as text if used
      if (!t759.challenge && t759.customChallenge) {
        var p = document.createElement('p');
        p.className = 'phase-note';
        p.style.fontStyle = 'italic';
        p.textContent = t759.customChallenge;
        refEl.insertBefore(p, refEl.firstChild);
      }
      parseEmojis(refEl);
    }

    // Populate textarea
    var textarea = document.getElementById('t759-action-text');
    if (textarea && !textarea.value) textarea.value = t759.action || '';
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
    renderRefCards: renderRefCards,
    renderChallengeCard: renderChallengeCard,
    renderChallengeGrid: renderChallengeGrid,
    renderExplainMore: renderExplainMore,
    updatePhaseIndicator: updatePhaseIndicator,
    updateTimerBadge: updateTimerBadge,
    updateTimerModal: updateTimerModal,
    bindNotepadFields: bindNotepadFields,
    updateDeckVisibility: _updateDeckVisibility,
    updateDrawStepInstruction: _updateDrawStepInstruction,
    syncContinueBtn: _syncGlobalContinue,
    renderT354Setup: renderT354Setup,
    renderT354Challenges: renderT354Challenges,
    renderT354Play: renderT354Play,
    renderT759Challenge: renderT759Challenge,
    renderT759Value: renderT759Value,
    renderT759Spark: renderT759Spark,
    renderT759Action: renderT759Action
  };
})();
