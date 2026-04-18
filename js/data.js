// data.js — Solarpunk Futures card database
// Combines partial data files into window.DECK and window.CARD_BY_ID
// Partial files must be loaded first (see index.html script order)

(function () {
  'use strict';

  window.DECK = {
    ancestor:  window._ANCESTORS  || [],
    value:     window._VALUES     || [],
    tool:      (window._TOOLS_A   || []).concat(window._TOOLS_B || []),
    challenge: window._CHALLENGES || []
  };

  window.CARD_BY_ID = {};
  Object.keys(window.DECK).forEach(function (type) {
    window.DECK[type].forEach(function (card) {
      window.CARD_BY_ID[card.id] = card;
    });
  });

  // Convenience: total card count (useful for debugging)
  var total = Object.keys(window.CARD_BY_ID).length;
  console.log('[SF] DECK loaded — ' + total + ' cards total');
})();
