
(function(){
  'use strict';
  var SLUG = 'wizzed-lights-out';
  var SIZE = 5, CELLS = SIZE * SIZE;
  var gridEl  = document.getElementById('grid');
  var levelEl = document.getElementById('level');
  var movesEl = document.getElementById('moves');
  var parEl   = document.getElementById('par');
  var bestEl  = document.getElementById('best');
  var hintBtn = document.getElementById('hintBtn');
  var overlay = document.getElementById('overlay');
  var winStats = document.getElementById('winStats');
  var winPerfect = document.getElementById('winPerfect');

  var lights = [];            // boolean per cell
  var solution = {};          // set (object) of cell indexes that solve the puzzle
  var initial = [];           // starting layout for reset
  var initialSolution = {};
  var level = 1, moves = 0, par = 3, hintsLeft = 3;
  var cellEls = [];
  var playing = true;

  /* ---------- audio ---------- */
  var AC = null;
  function ac(){
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function beep(freq, dur, type, vol, when){
    var c = ac(); if (!c) return;
    dur = dur || 0.06; type = type || 'square'; vol = vol || 0.04; when = when || 0;
    var t = c.currentTime + when;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---------- storage ---------- */
  function loadSave(){
    try { return JSON.parse(localStorage.getItem(SLUG)) || {}; } catch(e){ return {}; }
  }
  function persist(){
    var s = loadSave();
    s.level = level;
    s.best = Math.max(s.best || 1, level);
    try { localStorage.setItem(SLUG, JSON.stringify(s)); } catch(e){}
    bestEl.textContent = s.best;
  }

  /* ---------- game ---------- */
  function buildGrid(){
    gridEl.innerHTML = '';
    cellEls = [];
    for (var i = 0; i < CELLS; i++){
      var d = document.createElement('div');
      d.className = 'cell';
      (function(idx){
        d.addEventListener('pointerdown', function(ev){ ev.preventDefault(); press(idx); });
      })(i);
      gridEl.appendChild(d);
      cellEls.push(d);
    }
  }

  function toggle(i){
    lights[i] = !lights[i];
    cellEls[i].classList.toggle('on', lights[i]);
  }

  function applyPress(i){
    var x = i % SIZE, y = Math.floor(i / SIZE);
    toggle(i);
    if (x > 0)        toggle(i - 1);
    if (x < SIZE - 1) toggle(i + 1);
    if (y > 0)        toggle(i - SIZE);
    if (y < SIZE - 1) toggle(i + SIZE);
  }

  function clearHints(){
    for (var i = 0; i < CELLS; i++) cellEls[i].classList.remove('hintmark');
  }

  function press(i){
    if (!playing) return;
    clearHints();
    applyPress(i);
    // pressing a cell toggles its membership in the remaining solution set
    if (solution[i]) delete solution[i]; else solution[i] = true;
    moves++;
    movesEl.textContent = moves;
    beep(lights[i] ? 520 : 340, 0.05, 'square', 0.035);
    if (isDark()) onWin();
  }

  function isDark(){
    for (var i = 0; i < CELLS; i++) if (lights[i]) return false;
    return true;
  }

  function pressCountForLevel(lv){
    return Math.min(2 + lv, 13);
  }

  function generate(){
    lights = [];
    for (var i = 0; i < CELLS; i++){ lights.push(false); cellEls[i].classList.remove('on'); }
    solution = {};
    var want = pressCountForLevel(level);
    var pool = [];
    for (var j = 0; j < CELLS; j++) pool.push(j);
    // shuffle pool
    for (var k = pool.length - 1; k > 0; k--){
      var r = Math.floor(Math.random() * (k + 1));
      var tmp = pool[k]; pool[k] = pool[r]; pool[r] = tmp;
    }
    for (var p = 0; p < want; p++){
      applyPress(pool[p]);
      solution[pool[p]] = true;
    }
    if (isDark()){ generate(); return; }   // quiet pattern fluke — regenerate
    par = want;
    initial = lights.slice();
    initialSolution = {};
    for (var s in solution) initialSolution[s] = true;
  }

  function startLevel(fresh){
    playing = true;
    moves = 0; hintsLeft = 3;
    movesEl.textContent = '0';
    hintBtn.textContent = '💡 HINT (3)';
    hintBtn.disabled = false;
    levelEl.textContent = level;
    overlay.classList.add('hidden');
    clearHints();
    if (fresh) generate();
    else {
      // restore initial layout
      for (var i = 0; i < CELLS; i++){
        lights[i] = initial[i];
        cellEls[i].classList.toggle('on', lights[i]);
      }
      solution = {};
      for (var s in initialSolution) solution[s] = true;
    }
    parEl.textContent = par;
    persist();
  }

  function onWin(){
    playing = false;
    [440, 554, 659, 880].forEach(function(f, i){ beep(f, 0.15, 'square', 0.05, i * 0.11); });
    winStats.textContent = 'Level ' + level + ' cleared in ' + moves + ' moves (par ' + par + ')';
    winPerfect.style.display = (moves <= par) ? 'block' : 'none';
    setTimeout(function(){ overlay.classList.remove('hidden'); }, 300);
  }

  function hint(){
    if (!playing || hintsLeft <= 0) return;
    var keys = Object.keys(solution);
    if (keys.length === 0) return;
    clearHints();
    var pick = keys[Math.floor(Math.random() * keys.length)];
    cellEls[+pick].classList.add('hintmark');
    hintsLeft--;
    hintBtn.textContent = '💡 HINT (' + hintsLeft + ')';
    if (hintsLeft === 0) hintBtn.disabled = true;
    beep(700, 0.09, 'triangle', 0.045);
  }

  hintBtn.addEventListener('click', hint);
  document.getElementById('resetBtn').addEventListener('click', function(){
    beep(220, 0.07, 'sawtooth', 0.03);
    startLevel(false);
  });
  document.getElementById('newBtn').addEventListener('click', function(){
    beep(300, 0.07, 'sawtooth', 0.03);
    startLevel(true);
  });
  document.getElementById('nextBtn').addEventListener('click', function(){
    level++;
    startLevel(true);
  });

  /* ---------- boot ---------- */
  buildGrid();
  var save = loadSave();
  level = Math.max(1, save.level || 1);
  bestEl.textContent = save.best || 1;
  startLevel(true);
})();
