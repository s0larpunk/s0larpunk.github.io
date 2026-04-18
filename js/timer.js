window.Timer = (function() {
  var _interval = null;
  var _alertsShown = {};

  function _getState() {
    return window.Game ? window.Game.getState().timer : null;
  }

  function _getDuration(phase, mode) {
    var d = _getState();
    if (!d || !d.durations) return 300;
    var key = 'p' + phase + (mode === 'writing' ? 'w' : 's');
    return d.durations[key] || 300;
  }

  function start() {
    var state = _getState();
    if (!state) return;
    _alertsShown = {};
    if (window.Game) window.Game.setState({ timer: { active: true, startedAt: Date.now(), elapsed: 0 } });
    _interval = setInterval(_tick, 1000);
    _updateBadge();
  }

  function pause() {
    if (!_interval) return;
    clearInterval(_interval);
    _interval = null;
    var elapsed = getElapsed();
    if (window.Game) window.Game.setState({ timer: { active: false, elapsed: elapsed, startedAt: null } });
    _updateBadge();
  }

  function resume() {
    var state = _getState();
    if (!state || state.active) return;
    if (window.Game) window.Game.setState({ timer: { active: true, startedAt: Date.now() } });
    _interval = setInterval(_tick, 1000);
    _updateBadge();
  }

  function reset() {
    clearInterval(_interval);
    _interval = null;
    _alertsShown = {};
    if (window.Game) window.Game.setState({ timer: { active: false, startedAt: null, elapsed: 0 } });
    _updateBadge();
  }

  function getElapsed() {
    var state = _getState();
    if (!state) return 0;
    var saved = state.elapsed || 0;
    if (!state.active || !state.startedAt) return saved;
    return saved + Math.floor((Date.now() - state.startedAt) / 1000);
  }

  function getRemaining() {
    var state = _getState();
    if (!state) return 0;
    var dur = _getDuration(state.phase, state.mode);
    return dur - getElapsed();
  }

  function _tick() {
    var state = _getState();
    if (!state || !state.active) {
      clearInterval(_interval);
      _interval = null;
      return;
    }

    var remaining = getRemaining();
    var isOverrun = remaining < 0;

    _updateBadge();
    if (window.UI && window.UI.updateTimerModal) window.UI.updateTimerModal();

    // 2-minute warning (at 120s remaining)
    var warnKey = 'warn_' + state.phase + '_' + state.mode;
    if (remaining <= 120 && remaining > 118 && !_alertsShown[warnKey]) {
      _alertsShown[warnKey] = true;
      _show2MinNudge(state.phase, state.mode);
    }

    // Phase complete (at 0)
    var doneKey = 'done_' + state.phase + '_' + state.mode;
    if (remaining <= 0 && remaining > -3 && !_alertsShown[doneKey]) {
      _alertsShown[doneKey] = true;
      _showPhaseComplete(state.phase, state.mode);
    }

    // Every 2 minutes when overrun: nudge
    if (isOverrun) {
      var overrunMins = Math.floor(Math.abs(remaining) / 120);
      var nudgeKey = 'nudge_' + state.phase + '_' + state.mode + '_' + overrunMins;
      if (overrunMins > 0 && !_alertsShown[nudgeKey]) {
        _alertsShown[nudgeKey] = true;
        _show2MinNudge(state.phase, state.mode);
      }
    }
  }

  function _updateBadge() {
    var state = _getState();
    if (!state) return;
    var label = _label(state.phase, state.mode);
    var remaining = getRemaining();
    var isOverrun = remaining < 0;
    if (window.UI) window.UI.updateTimerBadge(label, isOverrun);
  }

  function _show2MinNudge(phase, mode) {
    var tFn = window.i18n ? window.i18n.t.bind(window.i18n) : function(k) { return k; };
    var toast = document.createElement('div');
    toast.className = 'toast-notification';
    var remaining = getRemaining();
    toast.textContent = remaining > 0 ? tFn('timer_2min_warning') : tFn('timer_nudge_2min');
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('toast-show'); }, 50);
    setTimeout(function() {
      toast.classList.remove('toast-show');
      setTimeout(function() { toast.remove(); }, 400);
    }, 4000);
  }

  function _showPhaseComplete(phase, mode) {
    var nextPhase = mode === 'writing' ? phase : (phase < 4 ? phase + 1 : null);
    var nextMode = mode === 'writing' ? 'sharing' : 'writing';

    var alert = document.getElementById('modal-phase-alert');
    if (!alert) return;

    var tFn = window.i18n ? window.i18n.t.bind(window.i18n) : function(k) { return k; };

    var alertPhaseName = document.getElementById('alert-phase-name');
    if (alertPhaseName) alertPhaseName.textContent = _label(phase, mode) + ' \u2014 ' + tFn('timer_phase_complete_title');

    var alertMessage = document.getElementById('alert-message');
    if (alertMessage) alertMessage.textContent = tFn('timer_phase_complete_msg');

    var nextBtn = document.getElementById('btn-alert-next');
    if (nextBtn) {
      if (nextPhase) {
        nextBtn.style.display = 'block';
        nextBtn.textContent = tFn('btn_next') + ': ' + _label(nextPhase, nextMode);
        nextBtn.onclick = function() {
          alert.classList.remove('active');
          pause();
          if (window.Game) {
            window.Game.setState({ timer: { phase: nextPhase, mode: nextMode, elapsed: 0, startedAt: null, active: false } });
          }
          _alertsShown = {};
          resume();
        };
      } else {
        nextBtn.style.display = 'none';
      }
    }

    var dismissBtn = document.getElementById('btn-alert-dismiss');
    if (dismissBtn) {
      dismissBtn.onclick = function() { alert.classList.remove('active'); };
    }

    alert.classList.add('active');
  }

  function _label(phase, mode) {
    var tFn = window.i18n ? window.i18n.t.bind(window.i18n) : function(k) { return k; };
    var modeName = mode === 'writing' ? tFn('phase_writing') : tFn('phase_sharing');
    return tFn('phase_' + phase + '_of_4', { phase: phase }) + ' \u00B7 ' + modeName;
  }

  function restore() {
    var state = _getState();
    if (state && state.active && state.startedAt) {
      _interval = setInterval(_tick, 1000);
      _updateBadge();
    }
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    getElapsed: getElapsed,
    getRemaining: getRemaining,
    restore: restore,
    _label: _label,
    _updateBadge: _updateBadge
  };
})();
