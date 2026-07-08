
(function(){
  'use strict';
  var SLUG = 'wizzed-simon';
  var TONES = [392.0, 329.63, 261.63, 196.0]; // G4 E4 C4 G3
  var pads = [0,1,2,3].map(function(i){ return document.getElementById('p' + i); });
  var simonEl  = document.getElementById('simon');
  var roundEl  = document.getElementById('round');
  var bestEl   = document.getElementById('best');
  var roundNum = document.getElementById('roundNum');
  var statusEl = document.getElementById('status');
  var startBtn = document.getElementById('startBtn');
  var strictToggle = document.getElementById('strictToggle');
  var overlay  = document.getElementById('overlay');
  var overStats = document.getElementById('overStats');
  var overBest  = document.getElementById('overBest');

  var seq = [], pos = 0;
  var state = 'idle';       // idle | playing | input | over
  var strict = false;
  var best = 0, prevBest = 0;
  var timeouts = [];

  /* ---------- audio ---------- */
  var AC = null;
  function ac(){
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, vol){
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.01);
    g.gain.setValueAtTime(vol || 0.06, t + dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function buzz(){
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.5);
  }

  /* ---------- storage ---------- */
  function loadBest(){
    try { var s = JSON.parse(localStorage.getItem(SLUG)) || {}; return s.best || 0; }
    catch(e){ return 0; }
  }
  function saveBest(b){ try { localStorage.setItem(SLUG, JSON.stringify({ best: b })); } catch(e){} }

  /* ---------- helpers ---------- */
  function later(fn, ms){ timeouts.push(setTimeout(fn, ms)); }
  function clearTimers(){ timeouts.forEach(clearTimeout); timeouts = []; }

  function litDur(){ return Math.max(160, 420 - seq.length * 18); }
  function gapDur(){ return Math.max(90, 220 - seq.length * 8); }

  function flash(i, dur){
    pads[i].classList.add('lit');
    tone(TONES[i], Math.min(dur, 400) / 1000, 'square', 0.06);
    later(function(){ pads[i].classList.remove('lit'); }, dur);
  }

  function setStatus(txt, num){
    statusEl.textContent = txt;
    if (num !== undefined) roundNum.textContent = num;
  }

  function playSequence(){
    state = 'playing';
    simonEl.classList.remove('your-turn');
    setStatus('WATCH...', seq.length);
    roundEl.textContent = seq.length;
    var d = litDur(), g = gapDur();
    seq.forEach(function(padIdx, i){
      later(function(){ flash(padIdx, d); }, 500 + i * (d + g));
    });
    later(function(){
      state = 'input';
      pos = 0;
      simonEl.classList.add('your-turn');
      setStatus('YOUR TURN');
    }, 500 + seq.length * (d + g));
  }

  function extend(){
    seq.push(Math.floor(Math.random() * 4));
    playSequence();
  }

  function startGame(){
    clearTimers();
    pads.forEach(function(p){ p.classList.remove('lit'); });
    overlay.classList.add('hidden');
    ac(); // unlock audio on this user gesture
    prevBest = best;
    seq = [];
    startBtn.textContent = '⟳ RESTART';
    extend();
  }

  function padPress(i){
    if (state === 'idle' || state === 'over'){
      // free-play twinkle so the board feels alive pre-game
      flash(i, 180);
      return;
    }
    if (state !== 'input') return;
    if (i === seq[pos]){
      flash(i, 200);
      pos++;
      if (pos === seq.length){
        state = 'playing';
        simonEl.classList.remove('your-turn');
        var streak = seq.length;
        roundEl.textContent = streak;
        if (streak > best){ best = streak; bestEl.textContent = best; saveBest(best); }
        setStatus('GOOD!');
        later(extend, 850);
      }
    } else {
      wrong(i);
    }
  }

  function wrong(i){
    buzz();
    pads.forEach(function(p){ p.classList.add('lit'); });
    later(function(){ pads.forEach(function(p){ p.classList.remove('lit'); }); }, 350);
    var completed = seq.length - 1;
    if (strict){
      state = 'over';
      simonEl.classList.remove('your-turn');
      setStatus('GAME OVER', '×');
      overStats.textContent = 'Streak: ' + completed + ' round' + (completed === 1 ? '' : 's') + ' (strict mode)';
      overBest.style.display = (completed > 0 && completed > prevBest) ? 'block' : 'none';
      later(function(){ overlay.classList.remove('hidden'); }, 700);
    } else {
      state = 'playing';
      simonEl.classList.remove('your-turn');
      setStatus('OOPS — WATCH AGAIN');
      later(playSequence, 1100);
    }
  }

  /* ---------- wiring ---------- */
  pads.forEach(function(p, i){
    p.addEventListener('pointerdown', function(ev){ ev.preventDefault(); padPress(i); });
  });
  document.addEventListener('keydown', function(e){
    var k = { '1':0, '2':1, '3':2, '4':3 }[e.key];
    if (k !== undefined) padPress(k);
  });
  startBtn.addEventListener('click', startGame);
  document.getElementById('retryBtn').addEventListener('click', startGame);
  strictToggle.addEventListener('click', function(){
    strict = !strict;
    strictToggle.classList.toggle('on', strict);
    tone(strict ? 660 : 440, 0.08, 'square', 0.04);
  });

  /* idle attract shimmer */
  var attractIdx = 0;
  setInterval(function(){
    if (state !== 'idle') return;
    pads[attractIdx % 4].classList.add('lit');
    (function(i){ setTimeout(function(){ pads[i].classList.remove('lit'); }, 260); })(attractIdx % 4);
    attractIdx++;
  }, 900);

  best = loadBest();
  bestEl.textContent = best;
})();
