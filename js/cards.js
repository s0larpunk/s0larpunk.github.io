window.Cards = (function() {

  function createCardEl(card, mini) {
    mini = !!mini;
    var lang = window.i18n ? window.i18n.getLang() : 'en';
    var name = card.name[lang] || card.name.en;
    var emojis = card.emojis || ['\uD83C\uDF31', '\uD83C\uDF3F', '\u2728'];

    var bodyText = '';
    if (card.type === 'value' && card.definition) {
      bodyText = card.definition[lang] || card.definition.en;
    } else if (card.type === 'tool' && card.quote) {
      bodyText = '\u201C' + (card.quote[lang] || card.quote.en) + '\u201D';
    } else if (card.type === 'challenge' && card.description) {
      bodyText = card.description[lang] || card.description.en;
    } else if (card.type === 'ancestor' && card.subtitles) {
      bodyText = (card.subtitles[lang] || card.subtitles.en).join(' \u00B7 ');
    }

    var div = document.createElement('div');
    div.className = 'card' + (mini ? ' card-mini' : '');
    div.dataset.type = card.type;
    div.dataset.id = card.id;

    div.innerHTML =
      '<div class="card-inner">' +
        '<div class="card-back">' +
          '<div class="card-back-pattern"></div>' +
          '<div class="card-back-wordmark">Solarpunk Futures</div>' +
        '</div>' +
        '<div class="card-front">' +
          '<div class="card-type-stamp">' + (window.i18n ? window.i18n.t('deck_label_' + card.type) : card.type).toUpperCase() + '</div>' +
          '<div class="card-emojis">' + emojis.join(' ') + '</div>' +
          '<div class="card-name">' + _escapeHtml(name) + '</div>' +
          '<div class="card-body">' + _escapeHtml(bodyText) + '</div>' +
          '<button class="card-explain-toggle" type="button">' + (window.i18n ? window.i18n.t('explain_more') : 'Explain more \u25BE') + '</button>' +
        '</div>' +
      '</div>';

    return div;
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function deal(cardData, deckEl, handEl, delay) {
    delay = delay || 0;
    return new Promise(function(resolve) {
      setTimeout(function() {
        var el = createCardEl(cardData);
        el.classList.add('animating-in');
        handEl.insertBefore(el, handEl.firstChild); // newest card at top

        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) {
          explainBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (window.UI) window.UI.renderExplainMore(cardData);
          });
        }

        // Wire up card click → redraw selection (only when card is in a hand container)
        el.addEventListener('click', function() {
          if (el.closest('[id^="hand-"]') && window.Cards) window.Cards.toggleRedraw(el);
        });

        setTimeout(function() {
          el.classList.remove('animating-in');
          flip(el, resolve);
        }, 500);

        if (deckEl) {
          deckEl.classList.remove('ready-to-draw');
          deckEl.classList.add('dealt');
        }
      }, delay);
    });
  }

  function flip(cardEl, callback) {
    setTimeout(function() {
      cardEl.classList.add('flipped');

      setTimeout(function() {
        var shimmer = document.createElement('div');
        shimmer.className = 'card-shimmer';
        var front = cardEl.querySelector('.card-front');
        if (front) front.appendChild(shimmer);

        if (window.UI) window.UI.parseEmojis(cardEl);

        setTimeout(function() { shimmer.remove(); }, 800);

        if (callback) callback(cardEl);
      }, 600);
    }, 400);
  }

  function toggleRedraw(cardEl) {
    cardEl.classList.toggle('selected-for-redraw');
    var anySelected = document.querySelectorAll('.card.selected-for-redraw').length > 0;
    // Show/hide every redraw panel on the page — only one is in the active screen
    // at any time, so a single visibility toggle works across all techniques.
    var panels = document.querySelectorAll('[id^="redraw-panel"]');
    panels.forEach(function(panel) {
      panel.style.display = anySelected ? 'block' : 'none';
    });
  }

  function getRedrawSelection() {
    return Array.from(document.querySelectorAll('.card.selected-for-redraw')).map(function(el) {
      return el.dataset.id;
    });
  }

  function animateRedraw(oldCardEl, newCardData, deckEl) {
    return new Promise(function(resolve) {
      oldCardEl.classList.remove('flipped', 'selected-for-redraw');
      setTimeout(function() {
        var handEl = oldCardEl.parentElement;
        oldCardEl.remove();
        deal(newCardData, deckEl, handEl, 100).then(resolve);
      }, 400);
    });
  }

  function renderDeck(containerEl, type, count) {
    containerEl.innerHTML = '';
    var max = Math.min(3, count);
    for (var i = 0; i < max; i++) {
      var back = document.createElement('div');
      back.className = 'deck-card-back';
      back.style.transform = 'translate(' + (i * 2) + 'px, ' + (i * -2) + 'px)';
      containerEl.appendChild(back);
    }
    var label = document.createElement('div');
    label.className = 'deck-count';
    label.textContent = count;
    containerEl.appendChild(label);
  }

  // render — alias for createCardEl (used by game.js challenge draw)
  function render(card) { return createCardEl(card); }

  // renderInHand — animate a card into a hand container
  function renderInHand(card, handEl, type) {
    if (!handEl) return;
    deal(card, null, handEl, 0);
  }

  // replaceInHand — swap a card of the same type in the hand
  function replaceInHand(newCard, handEl, type) {
    if (!handEl) return;
    var oldEl = handEl.querySelector('[data-type="' + newCard.type + '"]');
    if (oldEl) {
      oldEl.classList.remove('flipped', 'selected-for-redraw');
      setTimeout(function() {
        oldEl.remove();
        deal(newCard, null, handEl, 100);
      }, 400);
    } else {
      deal(newCard, null, handEl, 0);
    }
  }

  return {
    createCardEl: createCardEl,
    deal: deal,
    flip: flip,
    render: render,
    renderInHand: renderInHand,
    replaceInHand: replaceInHand,
    toggleRedraw: toggleRedraw,
    getRedrawSelection: getRedrawSelection,
    animateRedraw: animateRedraw,
    renderDeck: renderDeck
  };
})();
