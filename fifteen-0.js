
(function(){
  'use strict';
  var SLUG = 'wizzed-fifteen';
  var boardEl = document.getElementById('board');
  var innerEl = document.getElementById('inner');
  var movesEl = document.getElementById('moves');
  var timeEl  = document.getElementById('time');
  var bestEl  = document.getElementById('best');
  var overlay = document.getElementById('overlay');
  var winStats = document.getElementById('winStats');
  var winBest = document.getElementById('winBest');

  var N = 4;
  var grid = [];        // grid[y][x] = value, 0 = blank
  var tileEls = {};     // value -> element
  var blank = {x:0,y:0};
  var moves = 0, startTime = null, elapsed = 0, timerInt = null;
  var playing = false;

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
  function winJingle(){
    [523, 659, 784, 1047].forEach(function(f, i){ beep(f, 0.16, 'square', 0.05, i * 0.12); });
  }

  /* ---------- storage ---------- */
  function loadBests(){
    try { return JSON.parse(localStorage.getItem(SLUG)) || {}; } catch(e){ return {}; }
  }
  function saveBests(b){ try { localStorage.setItem(SLUG, JSON.stringify(b)); } catch(e){} }
  function showBest(){
    var b = loadBests()[N];
    bestEl.textContent = b ? (b.moves + '') : '—';
  }

  /* ---------- helpers ---------- */
  function fmtTime(s){
    s = Math.floor(s);
    return Math.floor(s/60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function tick(){
    if (startTime !== null) {
      elapsed = (Date.now() - startTime) / 1000;
      timeEl.textContent = fmtTime(elapsed);
    }
  }

  function setTilePos(el, x, y){
    el.style.transform = 'translate(' + (x*100) + '%,' + (y*100) + '%)';
  }

  function buildBoard(){
    boardEl.style.setProperty('--n', N);
    innerEl.innerHTML = '';
    tileEls = {};
    grid = [];
    for (var y = 0; y < N; y++){
      grid.push([]);
      for (var x = 0; x < N; x++){
        var v = y * N + x + 1;
        if (v === N * N) { v = 0; blank = {x:x, y:y}; }
        grid[y].push(v);
        if (v !== 0){
          var el = document.createElement('div');
          el.className = 'tile';
          el.innerHTML = '<div>' + v + '</div>';
          el.dataset.v = v;
          setTilePos(el, x, y);
          (function(val){
            el.addEventListener('pointerdown', function(ev){ ev.preventDefault(); tryClickTile(val); });
          })(v);
          innerEl.appendChild(el);
          tileEls[v] = el;
        }
      }
    }
    markCorrect();
  }

  function findTile(v){
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++)
      if (grid[y][x] === v) return {x:x, y:y};
    return null;
  }

  function markCorrect(){
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++){
      var v = grid[y][x];
      if (v !== 0) tileEls[v].classList.toggle('correct', v === y * N + x + 1);
    }
  }

  /* Slide every tile between (tx,ty) and blank toward blank. Returns tiles moved. */
  function slideFrom(tx, ty, animate){
    var moved = 0;
    if (tx === blank.x && ty !== blank.y){
      var dy = blank.y > ty ? 1 : -1;
      for (var y = blank.y - dy; dy > 0 ? y >= ty : y <= ty; y -= dy){
        var v = grid[y][tx];
        grid[y + dy][tx] = v; grid[y][tx] = 0;
        setTilePos(tileEls[v], tx, y + dy);
        moved++;
      }
      blank = {x: tx, y: ty};
    } else if (ty === blank.y && tx !== blank.x){
      var dx = blank.x > tx ? 1 : -1;
      for (var x = blank.x - dx; dx > 0 ? x >= tx : x <= tx; x -= dx){
        var v2 = grid[ty][x];
        grid[ty][x + dx] = v2; grid[ty][x] = 0;
        setTilePos(tileEls[v2], x + dx, ty);
        moved++;
      }
      blank = {x: tx, y: ty};
    }
    if (moved && animate){
      beep(240 + Math.random() * 60, 0.045, 'square', 0.035);
    }
    return moved;
  }

  function tryClickTile(v){
    if (!playing) return;
    var p = findTile(v);
    if (!p) return;
    var n = slideFrom(p.x, p.y, true);
    if (n > 0) afterMove(n);
  }

  function afterMove(n){
    moves += n;
    movesEl.textContent = moves;
    if (startTime === null){
      startTime = Date.now();
      if (timerInt) clearInterval(timerInt);
      timerInt = setInterval(tick, 250);
    }
    markCorrect();
    if (isSolved()) onWin();
  }

  function isSolved(){
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++){
      var want = (y === N-1 && x === N-1) ? 0 : y * N + x + 1;
      if (grid[y][x] !== want) return false;
    }
    return true;
  }

  /* Shuffle by random blank moves — always solvable. */
  function shuffle(){
    boardEl.classList.add('noanim');
    var last = -1;
    var steps = N * N * 30;
    for (var i = 0; i < steps; i++){
      var dirs = [];
      if (blank.y > 0     && last !== 2) dirs.push(0); // tile above moves down (blank up)
      if (blank.y < N - 1 && last !== 0) dirs.push(2);
      if (blank.x > 0     && last !== 3) dirs.push(1);
      if (blank.x < N - 1 && last !== 1) dirs.push(3);
      var d = dirs[Math.floor(Math.random() * dirs.length)];
      var tx = blank.x + (d === 1 ? -1 : d === 3 ? 1 : 0);
      var ty = blank.y + (d === 0 ? -1 : d === 2 ? 1 : 0);
      slideFrom(tx, ty, false);
      last = d;
    }
    if (isSolved()) { shuffle(); return; }
    // force reflow so re-enabling transitions doesn't animate the scramble
    void boardEl.offsetWidth;
    boardEl.classList.remove('noanim');
    markCorrect();
  }

  function newGame(){
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    moves = 0; startTime = null; elapsed = 0;
    movesEl.textContent = '0';
    timeEl.textContent = '0:00';
    overlay.classList.add('hidden');
    buildBoard();
    shuffle();
    playing = true;
    showBest();
  }

  function onWin(){
    playing = false;
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    tick();
    var bests = loadBests();
    var prev = bests[N];
    var isBest = !prev || moves < prev.moves;
    if (isBest){
      bests[N] = { moves: moves, time: Math.floor(elapsed) };
      saveBests(bests);
    }
    winStats.textContent = moves + ' moves · ' + fmtTime(elapsed) + ' · ' + N + '×' + N;
    winBest.style.display = isBest ? 'block' : 'none';
    showBest();
    winJingle();
    setTimeout(function(){ overlay.classList.remove('hidden'); }, 350);
  }

  /* ---------- input ---------- */
  document.addEventListener('keydown', function(e){
    if (!playing) return;
    var tx = blank.x, ty = blank.y, hit = true;
    switch (e.key){
      case 'ArrowUp':    ty = blank.y + 1; break; // tile below slides up
      case 'ArrowDown':  ty = blank.y - 1; break;
      case 'ArrowLeft':  tx = blank.x + 1; break;
      case 'ArrowRight': tx = blank.x - 1; break;
      default: hit = false;
    }
    if (!hit) return;
    e.preventDefault();
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return;
    var n = slideFrom(tx, ty, true);
    if (n > 0) afterMove(n);
  });

  document.getElementById('shuffleBtn').addEventListener('click', function(){
    beep(180, 0.08, 'sawtooth', 0.03);
    newGame();
  });
  document.getElementById('sizeBtn').addEventListener('click', function(){
    N = (N === 4) ? 3 : 4;
    this.textContent = (N === 4) ? 'EASY 3×3' : 'HARD 4×4';
    document.querySelector('h1').textContent = (N === 4) ? '15 PUZZLE' : '8 PUZZLE';
    beep(500, 0.06, 'square', 0.03);
    newGame();
  });
  document.getElementById('againBtn').addEventListener('click', function(){ newGame(); });

  window.addEventListener('resize', function(){ /* layout is %-based; nothing to do */ });

  newGame();
})();
