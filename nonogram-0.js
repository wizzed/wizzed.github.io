
(function(){
  'use strict';
  var SLUG = 'wizzed-nonogram';

  var PUZZLES = [
    { name: 'HEART', colors: { r: '#ff4d6d' }, rows: ['.r.r.','rrrrr','rrrrr','.rrr.','..r..'] },
    { name: 'ARROW', colors: { c: '#58e6ff' }, rows: ['..c..','.ccc.','ccccc','..c..','..c..'] },
    { name: 'MUG', colors: { o: '#ffb04d' }, rows: ['oooo.','o..oo','o..oo','o..o.','oooo.'] },
    { name: 'BOAT', colors: { s: '#e8e8ff', h: '#b0763a' }, rows: ['..s..','.ss..','sss..','hhhhh','.hhh.'] },
    { name: 'OLD TV', colors: { t: '#9d7bff' }, rows: ['t...t','.t.t.','ttttt','t...t','ttttt'] },
    { name: 'INVADER', colors: { g: '#6dff6d' }, rows: [
      '..g....g..','...g..g...','..gggggg..','.gg.gg.gg.','gggggggggg',
      'g.gggggg.g','g.g....g.g','...gg.gg..','..g....g..','.g......g.'] },
    { name: 'SKULL', colors: { w: '#f0f0e8' }, rows: [
      '..wwwwww..','.wwwwwwww.','wwwwwwwwww','ww..ww..ww','ww..ww..ww',
      'wwwwwwwwww','wwww..wwww','.wwwwwwww.','.ww.ww.ww.','..wwwwww..'] },
    { name: 'MUSHROOM', colors: { r: '#ff5c5c', t: '#ffe0b0' }, rows: [
      '...rrrr...','..rrrrrr..','.rr.rr.rr.','rrrrrrrrrr','rr.rrrr.rr',
      '...tttt...','...tttt...','...tttt...','..tttttt..','..tttttt..'] },
    { name: 'GHOST', colors: { p: '#ff9de2' }, rows: [
      '...pppp...','.pppppppp.','.p..pp..p.','.pppppppp.','pppppppppp',
      'pppppppppp','pppppppppp','pppppppppp','pppppppppp','p.pp..pp.p'] },
    { name: 'CAT', colors: { c: '#ffb04d' }, rows: [
      '.c......c.','.cc....cc.','.cccccccc.','cccccccccc','cc.cccc.cc',
      'cccccccccc','cccc..cccc','.cccccccc.','..cccccc..','...cccc...'] },
    { name: 'ROCKET', colors: { s: '#cdd6ff', f: '#ff9f2e' }, rows: [
      '....ss....','...ssss...','...s..s...','...ssss...','..ssssss..',
      '..ssssss..','.s.ssss.s.','ss.ssss.ss','...ffff...','....ff....'] }
  ];

  var board = document.getElementById('board');
  var pzNoEl = document.getElementById('pzNo');
  var pzNameEl = document.getElementById('pzName');
  var timeEl = document.getElementById('time');
  var toolBtn = document.getElementById('toolBtn');
  var errBtn = document.getElementById('errBtn');
  var puzzlesBar = document.getElementById('puzzles');
  var overlay = document.getElementById('overlay');
  var winName = document.getElementById('winName');
  var winPic = document.getElementById('winPic');
  var winStats = document.getElementById('winStats');
  var nextBtn = document.getElementById('nextBtn');

  var cur = 0, n = 5;
  var sol = [];                 // solution rows (strings)
  var state = [];               // 0 empty · 1 filled · 2 X
  var rowClues = [], colClues = [];
  var cellEls = [], rowClueEls = [], colClueEls = [];
  var playing = true;
  var startTime = null, timerInt = null, elapsed = 0;
  var touchTool = 1;            // 1 fill, 2 X (tool button, for touch users)
  var showErr = false;

  /* ---------- audio ---------- */
  var AC = null;
  function ac(){
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function beep(freq, dur, type, vol, when){
    var c = ac(); if (!c) return;
    dur = dur || 0.05; type = type || 'square'; vol = vol || 0.035; when = when || 0;
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
  function persist(mut){
    var s = loadSave(); mut(s);
    try { localStorage.setItem(SLUG, JSON.stringify(s)); } catch(e){}
  }

  /* ---------- clues ---------- */
  function lineClues(arr){
    var out = [], run = 0;
    for (var i = 0; i < arr.length; i++){
      if (arr[i]) run++;
      else { if (run) out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  }
  function sameClues(a, b){
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function rowFill(y){ var a = []; for (var x = 0; x < n; x++) a.push(state[y*n+x] === 1); return a; }
  function colFill(x){ var a = []; for (var y = 0; y < n; y++) a.push(state[y*n+x] === 1); return a; }

  /* ---------- board ---------- */
  function fmtTime(s){ s = Math.floor(s); return Math.floor(s/60) + ':' + ('0' + (s%60)).slice(-2); }
  function tick(){
    if (startTime !== null){ elapsed = (Date.now() - startTime)/1000; timeEl.textContent = fmtTime(elapsed); }
  }

  function loadPuzzle(i){
    cur = i;
    var p = PUZZLES[i];
    sol = p.rows;
    n = sol.length;
    state = new Array(n*n).fill(0);
    playing = true;
    startTime = null; elapsed = 0;
    if (timerInt){ clearInterval(timerInt); timerInt = null; }
    timeEl.textContent = '0:00';
    overlay.classList.add('hidden');
    board.classList.remove('won');
    rowClues = []; colClues = [];
    for (var y = 0; y < n; y++) rowClues.push(lineClues(sol[y].split('').map(function(c){ return c !== '.'; })));
    for (var x = 0; x < n; x++){
      var col = [];
      for (var yy = 0; yy < n; yy++) col.push(sol[yy][x] !== '.');
      colClues.push(lineClues(col));
    }
    pzNoEl.textContent = (i+1) + '/' + PUZZLES.length;
    var solved = (loadSave().solved || {})[i];
    pzNameEl.textContent = solved ? p.name : '???';
    buildDom();
    buildPuzzleBar();
    persist(function(s){ s.current = i; });
  }

  function cellSize(){
    var maxRowClue = 1, maxColClue = 1;
    rowClues.forEach(function(c){ if (c.length > maxRowClue) maxRowClue = c.length; });
    colClues.forEach(function(c){ if (c.length > maxColClue) maxColClue = c.length; });
    var availW = Math.min(window.innerWidth - 30, 560);
    var top = board.getBoundingClientRect().top;
    var availH = Math.max(180, window.innerHeight - top - 110);
    var s = Math.floor(Math.min(availW / (n + maxRowClue * .8), availH / (n + maxColClue * .8)));
    return Math.max(15, Math.min(38, s));
  }

  function buildDom(){
    var cs = cellSize();
    document.documentElement.style.setProperty('--cell', cs + 'px');
    board.style.gridTemplateColumns = 'auto repeat(' + n + ', var(--cell))';
    board.style.gridTemplateRows = 'auto repeat(' + n + ', var(--cell))';
    board.style.fontSize = Math.max(9, Math.floor(cs * .42)) + 'px';
    board.innerHTML = '';
    cellEls = []; rowClueEls = []; colClueEls = [];
    board.appendChild(document.createElement('div')); // corner
    for (var x = 0; x < n; x++){
      var cc = document.createElement('div');
      cc.className = 'cluecol' + (n === 10 && x % 5 === 0 && x > 0 ? ' b5' : '');
      colClues[x].forEach(function(v){
        var s = document.createElement('span'); s.textContent = v; cc.appendChild(s);
      });
      board.appendChild(cc);
      colClueEls.push(cc);
    }
    for (var y = 0; y < n; y++){
      var rc = document.createElement('div');
      rc.className = 'cluerow';
      rowClues[y].forEach(function(v){
        var s = document.createElement('span'); s.textContent = v; rc.appendChild(s);
      });
      board.appendChild(rc);
      rowClueEls.push(rc);
      for (var x2 = 0; x2 < n; x2++){
        var c = document.createElement('div');
        c.className = 'cell';
        if (n === 10 && x2 % 5 === 0 && x2 > 0) c.classList.add('b5');
        if (n === 10 && y % 5 === 0 && y > 0) c.classList.add('t5');
        c.dataset.i = y * n + x2;
        board.appendChild(c);
        cellEls.push(c);
      }
    }
    refreshClueDim();
  }

  function renderCell(i){
    var el = cellEls[i], st = state[i];
    el.classList.toggle('f', st === 1);
    el.textContent = st === 2 ? '×' : '';
    var y = Math.floor(i / n), x = i % n;
    el.classList.toggle('wrong', st === 1 && sol[y][x] === '.');
  }

  function refreshClueDim(){
    for (var y = 0; y < n; y++)
      rowClueEls[y].classList.toggle('done', sameClues(lineClues(rowFill(y)), rowClues[y]));
    for (var x = 0; x < n; x++)
      colClueEls[x].classList.toggle('done', sameClues(lineClues(colFill(x)), colClues[x]));
  }

  function setCell(i, val){
    if (state[i] === val) return;
    state[i] = val;
    renderCell(i);
    if (startTime === null && val !== 0){
      startTime = Date.now();
      timerInt = setInterval(tick, 250);
    }
  }

  function checkWin(){
    for (var y = 0; y < n; y++)
      if (!sameClues(lineClues(rowFill(y)), rowClues[y])) return false;
    for (var x = 0; x < n; x++)
      if (!sameClues(lineClues(colFill(x)), colClues[x])) return false;
    return true;
  }

  function onWin(){
    playing = false;
    if (timerInt){ clearInterval(timerInt); timerInt = null; }
    tick();
    board.classList.add('won');
    var p = PUZZLES[cur];
    // reveal in colour
    for (var i = 0; i < n*n; i++){
      var y = Math.floor(i / n), x = i % n;
      var ch = sol[y][x];
      var el = cellEls[i];
      el.textContent = '';
      el.classList.remove('f', 'wrong');
      el.style.background = ch === '.' ? '#101a15' : p.colors[ch];
      if (ch !== '.') el.style.boxShadow = '0 0 8px ' + p.colors[ch];
    }
    pzNameEl.textContent = p.name;
    persist(function(s){
      s.solved = s.solved || {};
      s.solved[cur] = true;
      s.times = s.times || {};
      var t = Math.floor(elapsed);
      if (!s.times[cur] || t < s.times[cur]) s.times[cur] = t;
    });
    // mini picture in panel
    var pc = winPic.getContext('2d');
    var scale = Math.floor(120 / n);
    winPic.width = n * scale; winPic.height = n * scale;
    pc.fillStyle = '#101a15'; pc.fillRect(0, 0, winPic.width, winPic.height);
    for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++){
      var c2 = sol[yy][xx];
      if (c2 !== '.'){ pc.fillStyle = p.colors[c2]; pc.fillRect(xx*scale, yy*scale, scale, scale); }
    }
    winName.textContent = p.name;
    winStats.textContent = 'Solved in ' + fmtTime(elapsed);
    nextBtn.style.display = 'inline-block';
    [523, 659, 784, 988, 1319].forEach(function(f, i2){ beep(f, 0.14, 'square', 0.05, i2 * 0.1); });
    buildPuzzleBar();
    setTimeout(function(){ overlay.classList.remove('hidden'); }, 500);
  }

  function buildPuzzleBar(){
    puzzlesBar.innerHTML = '';
    var solved = loadSave().solved || {};
    PUZZLES.forEach(function(p, i){
      var b = document.createElement('button');
      b.textContent = (solved[i] ? '★ ' : '') + (i + 1) + ' · ' + p.rows.length + '×' + p.rows.length;
      if (solved[i]) b.classList.add('done');
      if (i === cur) b.classList.add('cur');
      b.addEventListener('click', function(){ beep(360, .04); loadPuzzle(i); });
      puzzlesBar.appendChild(b);
    });
  }

  /* ---------- input ---------- */
  var drag = null;        // { val } while painting
  var lpTimer = null, lpCell = -1, lpPrev = 0, downPos = null;

  function cellFromEvent(e){
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.classList && el.classList.contains('cell')) return +el.dataset.i;
    return -1;
  }

  board.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  board.addEventListener('pointerdown', function(e){
    if (!playing) return;
    var i = cellFromEvent(e);
    if (i < 0) return;
    e.preventDefault();
    var tool = (e.pointerType === 'mouse')
      ? (e.button === 2 ? 2 : 1)
      : touchTool;
    var target = (state[i] === tool) ? 0 : tool;
    drag = { val: target, tool: tool };
    lpPrev = state[i];
    setCell(i, target);
    beep(target === 1 ? 520 : target === 2 ? 300 : 240, 0.03, 'square', 0.025);
    refreshClueDim();
    // long-press → X (touch only, when in fill mode)
    if (e.pointerType !== 'mouse' && touchTool === 1){
      lpCell = i;
      downPos = { x: e.clientX, y: e.clientY };
      lpTimer = setTimeout(function(){
        if (lpCell >= 0){
          setCell(lpCell, lpPrev === 2 ? 0 : 2);
          beep(300, 0.05, 'square', 0.03);
          refreshClueDim();
          drag = null;
          if (playing && checkWin()) onWin();
        }
      }, 480);
    }
    if (playing && checkWin()) onWin();
  });

  board.addEventListener('pointermove', function(e){
    if (!playing) return;
    if (downPos && (Math.abs(e.clientX - downPos.x) > 12 || Math.abs(e.clientY - downPos.y) > 12)){
      clearTimeout(lpTimer); lpCell = -1; downPos = null;
    }
    if (!drag) return;
    var i = cellFromEvent(e);
    if (i < 0) return;
    var paintable = (drag.val === 0) ? (state[i] === drag.tool) : (state[i] === 0);
    if (state[i] !== drag.val && paintable){
      setCell(i, drag.val);
      beep(drag.val === 1 ? 520 : 300, 0.02, 'square', 0.015);
      refreshClueDim();
      if (playing && checkWin()) onWin();
    }
  });

  function endDrag(){
    drag = null;
    clearTimeout(lpTimer); lpCell = -1; downPos = null;
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  toolBtn.addEventListener('click', function(){
    touchTool = touchTool === 1 ? 2 : 1;
    toolBtn.textContent = touchTool === 1 ? '✏ TOOL: FILL' : '× TOOL: MARK';
    toolBtn.classList.toggle('off', touchTool === 1);
    beep(touchTool === 1 ? 520 : 340, 0.05);
  });
  errBtn.addEventListener('click', function(){
    showErr = !showErr;
    board.classList.toggle('showerr', showErr);
    errBtn.textContent = showErr ? '⚠ ERROR CHECK: ON' : '⚠ ERROR CHECK: OFF';
    errBtn.classList.toggle('off', !showErr);
    beep(showErr ? 600 : 380, 0.05);
  });
  document.getElementById('clearBtn').addEventListener('click', function(){
    beep(220, 0.06, 'sawtooth', 0.03);
    loadPuzzle(cur);
  });
  document.getElementById('stayBtn').addEventListener('click', function(){
    overlay.classList.add('hidden');
  });
  nextBtn.addEventListener('click', function(){
    loadPuzzle((cur + 1) % PUZZLES.length);
  });

  window.addEventListener('resize', function(){
    if (!board.classList.contains('won')){
      var cs = cellSize();
      document.documentElement.style.setProperty('--cell', cs + 'px');
      board.style.fontSize = Math.max(9, Math.floor(cs * .42)) + 'px';
    }
  });

  /* ---------- boot ---------- */
  var save = loadSave();
  var start = typeof save.current === 'number' ? Math.min(save.current, PUZZLES.length - 1) : 0;
  loadPuzzle(Math.max(0, start));
})();
