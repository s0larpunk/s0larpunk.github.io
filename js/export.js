window.Export = (function() {

  function _getCardText(card, lang) {
    if (!card) return '\u2014';
    var name = card.name[lang] || card.name.en;
    var detail = '';
    if (card.type === 'value' && card.definition) {
      detail = card.definition[lang] || card.definition.en;
    } else if (card.type === 'tool' && card.quote) {
      detail = '\u201C' + (card.quote[lang] || card.quote.en) + '\u201D \u2014 ' + card.author;
    } else if (card.type === 'challenge' && card.description) {
      detail = card.description[lang] || card.description.en;
    } else if (card.type === 'ancestor' && card.subtitles) {
      detail = (card.subtitles[lang] || card.subtitles.en).join(', ');
    }
    return detail ? name + ': ' + detail : name;
  }

  function _download(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function _dateStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function txt(state) {
    var lang = state.lang || 'en';
    var dc = state.drawnCards || {};
    var np = state.notepad || {};
    var tools = dc.tools || [];

    var lines = [
      '========================================',
      'SOLARPUNK FUTURES \u2014 SESSION REPORT',
      'Date: ' + _dateStr(),
      '========================================',
      '',
      '--- PHASE 1: THE ANCESTORS ---',
      'Ancestor: ' + _getCardText(dc.ancestor, lang),
      'Value 1: ' + _getCardText(dc.values && dc.values[0], lang),
      'Value 2: ' + _getCardText(dc.values && dc.values[1], lang),
      '',
      "Ancestor's name: " + (np.p1_name || '\u2014'),
      'Background: ' + (np.p1_background || '\u2014'),
      'Value connection: ' + (np.p1_value_connection || '\u2014'),
      '',
      '--- PHASE 2: THE CHALLENGE ---',
      'Challenge: ' + _getCardText(dc.challenge, lang),
      '',
      'Conflict: ' + (np.p2_conflict || '\u2014'),
      '',
      '--- PHASE 3: BUILDING THE WORLD ---',
      'Tool 1: ' + _getCardText(tools[0], lang),
      'Tool 2: ' + _getCardText(tools[1], lang),
      '',
      'Approach: ' + (np.p3_approach || '\u2014'),
      'Opposition: ' + (np.p3_opposition || '\u2014'),
      'Risk: ' + (np.p3_risk || '\u2014'),
      'Success: ' + (np.p3_success || '\u2014'),
      'Remaining work: ' + (np.p3_remaining || '\u2014'),
      '',
      '--- PHASE 4: REMEMBRANCE ---',
      'Fellow ancestor: ' + (np.p4_fellow || '\u2014'),
      'Collaboration: ' + (np.p4_collaboration || '\u2014'),
      'Hardship: ' + (np.p4_hardship || '\u2014'),
      'How they overcame: ' + (np.p4_overcome || '\u2014'),
      '',
      '========================================',
      'Solarpunk Futures by Solarpunk Surf Club',
      'CC BY-NC-SA 4.0 \u2014 thefuture.wtf',
      '========================================'
    ];

    _download(lines.join('\n'), 'solarpunk-futures-' + _dateStr() + '.txt', 'text/plain;charset=utf-8');
  }

  function pdf(state) {
    var jspdfLib = window.jspdf || (typeof jspdf !== 'undefined' ? jspdf : null);
    if (!jspdfLib || !jspdfLib.jsPDF) {
      alert('PDF library not loaded. Please check your internet connection.');
      return;
    }

    var jsPDF = jspdfLib.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var lang = state.lang || 'en';
    var dc = state.drawnCards || {};
    var np = state.notepad || {};
    var tools = dc.tools || [];

    var margin = 20;
    var pageW = 210;
    var contentW = pageW - margin * 2;
    var y = 20;

    function addText(text, opts) {
      opts = opts || {};
      var size = opts.size || 10;
      var bold = opts.bold || false;
      var color = opts.color || '#1a1008';
      var maxW = opts.maxW || contentW;
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color);
      var textStr = text || '\u2014';
      var lines = doc.splitTextToSize(textStr, maxW);
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.4) + 2;
      return y;
    }

    function addLine() {
      doc.setDrawColor('#c45c2b');
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    }

    function checkPage() {
      if (y > 270) { doc.addPage(); y = 20; }
    }

    // PAGE 1
    addText('SOLARPUNK FUTURES', { size: 20, bold: true, color: '#2d5a27' });
    addText('Session Report \u2014 ' + _dateStr(), { size: 10, color: '#c45c2b' });
    y += 5;
    addLine();

    addText('ANCESTOR', { size: 8, bold: true, color: '#6b3a1f' });
    addText(_getCardText(dc.ancestor, lang), { size: 14, bold: true });
    if (dc.ancestor && dc.ancestor.subtitles) {
      addText((dc.ancestor.subtitles[lang] || dc.ancestor.subtitles.en).join(' \u00B7 '), { size: 9 });
    }
    y += 3;

    addText('VALUES', { size: 8, bold: true, color: '#1a6b6b' });
    addText(_getCardText(dc.values && dc.values[0], lang) + ' / ' + _getCardText(dc.values && dc.values[1], lang), { size: 12, bold: true });
    y += 3;

    addText('CHALLENGE', { size: 8, bold: true, color: '#c45c2b' });
    addText(_getCardText(dc.challenge, lang), { size: 14, bold: true });
    y += 5;
    addLine();

    addText("My Ancestor's name:", { size: 9, bold: true });
    addText(np.p1_name, { size: 11 });
    y += 3;
    addText('Background:', { size: 9, bold: true });
    addText(np.p1_background, { size: 10 });
    y += 3;
    addText('Value connection:', { size: 9, bold: true });
    addText(np.p1_value_connection, { size: 10 });
    y += 5;
    addLine();

    var challengeName = (dc.challenge && dc.challenge.name) ? (dc.challenge.name[lang] || dc.challenge.name.en) : '';
    addText('The Challenge \u2014 ' + challengeName, { size: 12, bold: true });
    addText(np.p2_conflict, { size: 10 });

    // PAGE 2
    doc.addPage();
    y = 20;
    addText('ASSEMBLY REPORT \u2014 BUILDING THE WORLD', { size: 14, bold: true, color: '#2d5a27' });
    y += 3;
    addLine();

    var toolNames = [tools[0], tools[1]].filter(Boolean).map(function(c) {
      return c.name[lang] || c.name.en;
    }).join(' + ');
    addText('TOOLS: ' + (toolNames || '\u2014'), { size: 10, bold: true, color: '#2d5a27' });
    y += 3;

    addText('Initial approach:', { size: 9, bold: true });
    addText(np.p3_approach, { size: 10 });
    checkPage();
    y += 2;

    addText('Who opposed:', { size: 9, bold: true });
    addText(np.p3_opposition, { size: 10 });
    checkPage();
    y += 2;

    addText('The risk:', { size: 9, bold: true });
    addText(np.p3_risk, { size: 10 });
    checkPage();
    y += 2;

    addText('Initial success:', { size: 9, bold: true });
    addText(np.p3_success, { size: 10 });
    checkPage();
    y += 2;

    addText('Remaining work:', { size: 9, bold: true });
    addText(np.p3_remaining, { size: 10 });
    checkPage();
    y += 5;
    addLine();

    addText('REMEMBRANCE', { size: 12, bold: true, color: '#2d5a27' });
    y += 3;

    addText('Fellow ancestor:', { size: 9, bold: true });
    addText(np.p4_fellow, { size: 10 });
    checkPage();
    y += 2;

    addText('Collaboration:', { size: 9, bold: true });
    addText(np.p4_collaboration, { size: 10 });
    checkPage();
    y += 2;

    addText('Hardship:', { size: 9, bold: true });
    addText(np.p4_hardship, { size: 10 });
    checkPage();
    y += 2;

    addText('Overcoming:', { size: 9, bold: true });
    addText(np.p4_overcome, { size: 10 });
    checkPage();
    y += 10;

    addText('Solarpunk Futures by Solarpunk Surf Club \u00B7 CC BY-NC-SA 4.0 \u00B7 thefuture.wtf', { size: 8, color: '#888888' });

    doc.save('solarpunk-futures-' + _dateStr() + '.pdf');
  }

  function jpeg(state) {
    var lang = state.lang || 'en';
    var dc = state.drawnCards || {};
    var np = state.notepad || {};

    function getName(c) {
      return c ? (c.name[lang] || c.name.en) : '\u2014';
    }

    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;background:#f4ede0;padding:40px;font-family:Space Grotesk,sans-serif;';

    container.innerHTML =
      '<div style="text-align:center;margin-bottom:24px;">' +
        '<div style="font-size:32px;font-weight:900;color:#2d5a27;letter-spacing:0.05em;">SOLARPUNK FUTURES</div>' +
        '<div style="font-size:14px;color:#c45c2b;margin-top:4px;">Assembly for the Future \u00B7 ' + _dateStr() + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:24px;justify-content:center;margin-bottom:24px;">' +
        _cardBlock(dc.ancestor, lang, '#6b3a1f') +
        _cardBlock(dc.values && dc.values[0], lang, '#1a6b6b') +
        _cardBlock(dc.values && dc.values[1], lang, '#1a6b6b') +
        _cardBlock(dc.challenge, lang, '#c45c2b') +
      '</div>' +
      '<div style="background:#fff;border-radius:8px;padding:20px;border-left:4px solid #2d5a27;">' +
        '<div style="font-weight:700;font-size:16px;color:#2d5a27;margin-bottom:8px;">' + _escapeHtml(np.p1_name || 'My Ancestor') + '</div>' +
        '<div style="font-size:13px;color:#1a1008;line-height:1.6;">' + _escapeHtml(np.p1_background || '') + '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:16px;font-size:11px;color:#888;">Solarpunk Futures \u00B7 CC BY-NC-SA 4.0 \u00B7 thefuture.wtf</div>';

    document.body.appendChild(container);

    html2canvas(container, { backgroundColor: '#f4ede0', scale: 2, useCORS: true }).then(function(canvas) {
      container.remove();
      canvas.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'solarpunk-futures-' + _dateStr() + '.jpg';
        a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      }, 'image/jpeg', 0.92);
    }).catch(function() { container.remove(); });
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _cardBlock(card, lang, color) {
    if (!card) return '';
    var name = card.name[lang] || card.name.en;
    var emojis = (card.emojis || ['\uD83C\uDF31', '\uD83C\uDF3F', '\u2728']).join(' ');
    var sub = '';
    if (card.type === 'value' && card.definition) {
      sub = (card.definition[lang] || card.definition.en).slice(0, 80) + '...';
    } else if (card.type === 'ancestor' && card.subtitles) {
      sub = (card.subtitles[lang] || card.subtitles.en).join(' \u00B7 ');
    } else if (card.type === 'challenge' && card.description) {
      sub = (card.description[lang] || card.description.en).slice(0, 80) + '...';
    }
    return '<div style="background:#fff;border-radius:8px;padding:16px;width:240px;border-top:4px solid ' + color + ';text-align:center;">' +
      '<div style="font-size:10px;font-weight:700;color:' + color + ';letter-spacing:0.1em;margin-bottom:8px;">' + card.type.toUpperCase() + '</div>' +
      '<div style="font-size:20px;margin-bottom:8px;">' + emojis + '</div>' +
      '<div style="font-size:16px;font-weight:700;color:#1a1008;margin-bottom:6px;">' + _escapeHtml(name) + '</div>' +
      '<div style="font-size:11px;color:#666;line-height:1.4;">' + _escapeHtml(sub) + '</div>' +
      '</div>';
  }

  return {
    txt: txt,
    pdf: pdf,
    jpeg: jpeg
  };
})();
