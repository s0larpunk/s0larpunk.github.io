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
        '<div class="card-face-back">' +
          '<div class="card-back-pattern"></div>' +
          '<div class="card-back-label">Solarpunk Futures</div>' +
        '</div>' +
        '<div class="card-face-front">' +
          '<div class="card-type-stamp">' + card.type.toUpperCase() + '</div>' +
          '<div class="card-emojis">' + emojis.join(' ') + '</div>' +
          '<div class="card-name">' + _escapeHtml(name) + '</div>' +
          '<div class="card-body">' + _escapeHtml(bodyText) + '</div>' +
          '<button class="card-explain-toggle" type="button">Explain more \u25BE</button>' +
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
        handEl.appendChild(el);

        var explainBtn = el.querySelector('.card-explain-toggle');
        if (explainBtn) {
          explainBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (window.UI) window.UI.renderExplainMore(cardData);
          });
        }

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
        var front = cardEl.querySelector('.card-face-front');
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
    ['redraw-panel', 'redraw-panel-p3'].forEach(function(id) {
      var panel = document.getElementById(id);
      if (panel) panel.style.display = anySelected ? 'block' : 'none';
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

  return {
    createCardEl: createCardEl,
    deal: deal,
    flip: flip,
    toggleRedraw: toggleRedraw,
    getRedrawSelection: getRedrawSelection,
    animateRedraw: animateRedraw,
    renderDeck: renderDeck
  };
})();
