
(function(){
  'use strict';
  var SLUG = 'wizzed-gem-crush';
  var N = 8, NCOLORS = 6;
  var COLORS = ['#ff4d6d', '#ffb04d', '#ffe14d', '#5dff7f', '#58a6ff', '#c58fff'];
  var GLOW   = ['#ff8fa6', '#ffd08f', '#fff0a0', '#a4ffb8', '#9cc9ff', '#e0c4ff'];

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var levelEl = document.getElementById('level');
  var scoreEl = document.getElementById('score');
  var movesEl = document.getElementById('movesLeft');
  var bestEl  = document.getElementById('best');
  var barEl   = document.getElementById('bar');
  var barTxt  = document.getElementById('barTxt');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ovTitle');
  var ovStats = document.getElementById('ovStats');
  var ovBest  = document.getElementById('ovBest');
  var ovBtn   = document.getElementById('ovBtn');

  var CELL = 40, DPR = 1;
  var grid = [];              // grid[r][c] = gem { color, special(0|1row|2col), x, y, scale, pop }
  var phase = 'falling';      // idle | swapping | swapback | popping | falling | over
  var level = 1, score = 0, movesLeft = 20, target = 1500;
  var chain = 1;
  var sel = null;             // {r,c} selected cell
  var swapA = null, swapB = null;
  var popEnd = 0;
  var particles = [], floats = [];
  var banner = null;          // {txt, until}
  var levelOver = false;

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
  function persist(mut){
    var s = loadSave(); mut(s);
    try { localStorage.setItem(SLUG, JSON.stringify(s)); } catch(e){}
    return s;
  }

  /* ---------- board helpers ---------- */
  function newGem(color, x, y){
    return { color: color, special: 0, x: x, y: y, scale: 1, pop: 0 };
  }
  function randColor(){ return Math.floor(Math.random() * NCOLORS); }

  function colorAt(r, c){
    var g = grid[r] && grid[r][c];
    return g ? g.color : -1;
  }

  function fillBoardNoMatch(){
    grid = [];
    for (var r = 0; r < N; r++){
      grid.push([]);
      for (var c = 0; c < N; c++){
        var col;
        do {
          col = randColor();
        } while (
          (c >= 2 && colorAt(r, c-1) === col && colorAt(r, c-2) === col) ||
          (r >= 2 && colorAt(r-1, c) === col && colorAt(r-2, c) === col)
        );
        grid[r].push(newGem(col, c, r - N - 1 - Math.random() * 2));
      }
    }
    if (!hasAvailableMove()) fillBoardNoMatch();
  }

  function wouldMatchAt(r, c){
    var col = grid[r][c].color;
    // horizontal
    var l = 0, x = c - 1;
    while (x >= 0 && colorAt(r, x) === col){ l++; x--; }
    var rr2 = 0; x = c + 1;
    while (x < N && colorAt(r, x) === col){ rr2++; x++; }
    if (l + rr2 + 1 >= 3) return true;
    var u = 0, y = r - 1;
    while (y >= 0 && colorAt(y, c) === col){ u++; y--; }
    var d = 0; y = r + 1;
    while (y < N && colorAt(y, c) === col){ d++; y++; }
    return u + d + 1 >= 3;
  }

  function hasAvailableMove(){
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      if (c < N - 1){
        swapCells(r, c, r, c + 1);
        var ok = wouldMatchAt(r, c) || wouldMatchAt(r, c + 1);
        swapCells(r, c, r, c + 1);
        if (ok) return true;
      }
      if (r < N - 1){
        swapCells(r, c, r + 1, c);
        var ok2 = wouldMatchAt(r, c) || wouldMatchAt(r + 1, c);
        swapCells(r, c, r + 1, c);
        if (ok2) return true;
      }
    }
    return false;
  }

  function swapCells(r1, c1, r2, c2){
    var t = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = t;
  }

  /* ---------- matches ---------- */
  function findRuns(){
    var runs = [];
    var r, c, c0, r0, col;
    for (r = 0; r < N; r++){
      c = 0;
      while (c < N){
        c0 = c; col = grid[r][c].color;
        while (c < N && grid[r][c].color === col) c++;
        if (c - c0 >= 3){
          var cells = [];
          for (var i = c0; i < c; i++) cells.push(r * N + i);
          runs.push({ cells: cells, dir: 'H', len: c - c0 });
        }
      }
    }
    for (c = 0; c < N; c++){
      r = 0;
      while (r < N){
        r0 = r; col = grid[r][c].color;
        while (r < N && grid[r][c].color === col) r++;
        if (r - r0 >= 3){
          var cells2 = [];
          for (var j = r0; j < r; j++) cells2.push(j * N + c);
          runs.push({ cells: cells2, dir: 'V', len: r - r0 });
        }
      }
    }
    return runs;
  }

  function beginPop(runs){
    var popSet = {};
    var spawns = [];
    runs.forEach(function(run){
      run.cells.forEach(function(i){ popSet[i] = true; });
      if (run.len >= 4){
        var at = run.cells[Math.floor(run.cells.length / 2)];
        if (swapA){
          var aIdx = swapA.r * N + swapA.c, bIdx = swapB ? swapB.r * N + swapB.c : -1;
          if (run.cells.indexOf(aIdx) >= 0) at = aIdx;
          else if (run.cells.indexOf(bIdx) >= 0) at = bIdx;
        }
        spawns.push({ idx: at, special: run.dir === 'H' ? 1 : 2 });
      }
    });
    // expand specials caught in the blast (loop until stable)
    var specialsFired = 0, grew = true;
    while (grew){
      grew = false;
      for (var key in popSet){
        var i = +key, r = Math.floor(i / N), c = i % N;
        var gem = grid[r][c];
        if (gem && gem.special && !gem.fired){
          gem.fired = true;
          specialsFired++;
          for (var k2 = 0; k2 < N; k2++){
            var j = (gem.special === 1) ? (r * N + k2) : (k2 * N + c);
            if (!popSet[j]){ popSet[j] = true; grew = true; }
          }
        }
      }
    }
    // gems that become specials survive the pop
    spawns.forEach(function(s){ delete popSet[s.idx]; });

    var count = 0;
    for (var key2 in popSet){
      var i2 = +key2, pr = Math.floor(i2 / N), pc = i2 % N;
      var g2 = grid[pr][pc];
      if (!g2) continue;
      g2.pop = 1;
      count++;
      spawnParticles(pc + .5, pr + .5, g2.color);
    }
    var gained = count * 20 * chain + specialsFired * 100;
    score += gained;
    if (count > 0){
      floats.push({ x: N/2, y: N/2 - 1.2, txt: '+' + gained, life: 1 });
      if (chain > 1) floats.push({ x: N/2, y: N/2, txt: 'CHAIN ×' + chain + '!', life: 1.2 });
      beep(280 + chain * 90 + count * 6, 0.09, 'square', 0.05);
      if (specialsFired) beep(160, 0.22, 'sawtooth', 0.06, 0.03);
    }
    spawns.forEach(function(s){
      var sr = Math.floor(s.idx / N), sc = s.idx % N;
      var sg = grid[sr][sc];
      if (sg){ sg.special = s.special; sg.fired = false; sg.pop = 0; sg.scale = 1.6; }
    });
    updateHud();
    phase = 'popping';
    popEnd = performance.now() + 230;
  }

  function removeAndCollapse(){
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      if (grid[r][c] && grid[r][c].pop) grid[r][c] = null;
    }
    for (var c2 = 0; c2 < N; c2++){
      var stack = [];
      for (var r2 = N - 1; r2 >= 0; r2--){
        if (grid[r2][c2]) stack.push(grid[r2][c2]);
      }
      for (var r3 = N - 1; r3 >= 0; r3--){
        var idx = N - 1 - r3;
        if (idx < stack.length){
          grid[r3][c2] = stack[idx];
        } else {
          var above = idx - stack.length;
          grid[r3][c2] = newGem(randColor(), c2, -1 - above - Math.random() * .4);
        }
      }
    }
    phase = 'falling';
  }

  /* ---------- flow ---------- */
  function settled(){
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      var g = grid[r][c];
      if (!g) return false;
      if (Math.abs(g.x - c) > 0.001 || Math.abs(g.y - r) > 0.001) return false;
    }
    return true;
  }

  function endOfCascade(){
    chain = 1;
    swapA = swapB = null;
    if (levelOver) return;
    if (score >= target){
      levelWon();
      return;
    }
    if (movesLeft <= 0){
      levelFailed();
      return;
    }
    if (!hasAvailableMove()){
      banner = { txt: 'NO MOVES — RESHUFFLE!', until: performance.now() + 1400 };
      reshuffleColors();
      beep(220, .12, 'triangle', .05); beep(330, .12, 'triangle', .05, .13);
    }
    phase = 'idle';
  }

  function reshuffleColors(){
    do {
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
        var g = grid[r][c];
        do { g.color = randColor(); }
        while (
          (c >= 2 && grid[r][c-1].color === g.color && grid[r][c-2].color === g.color) ||
          (r >= 2 && grid[r-1][c].color === g.color && grid[r-2][c].color === g.color)
        );
      }
    } while (!hasAvailableMove());
  }

  function levelWon(){
    phase = 'over'; levelOver = true;
    var bonus = movesLeft * 40;
    score += bonus;
    updateHud();
    var s = persist(function(st){
      st.level = Math.max(st.level || 1, level + 1);
      if (!st.high || score > st.high) { st.high = score; st.highIsNew = true; }
      else st.highIsNew = false;
    });
    bestEl.textContent = s.level;
    ovTitle.textContent = 'LEVEL ' + level + ' COMPLETE!';
    ovTitle.classList.remove('fail');
    ovStats.textContent = 'Score ' + score + ' / ' + target + (bonus ? (' · +' + bonus + ' move bonus') : '');
    ovBest.style.display = s.highIsNew ? 'block' : 'none';
    ovBtn.textContent = 'NEXT LEVEL →';
    [523, 659, 784, 1047, 1319].forEach(function(f, i){ beep(f, 0.15, 'square', 0.05, i * 0.1); });
    setTimeout(function(){ overlay.classList.remove('hidden'); }, 500);
  }

  function levelFailed(){
    phase = 'over'; levelOver = true;
    ovTitle.textContent = 'OUT OF MOVES';
    ovTitle.classList.add('fail');
    ovStats.textContent = 'Score ' + score + ' / ' + target + ' — so close!';
    ovBest.style.display = 'none';
    ovBtn.textContent = '⟳ RETRY LEVEL';
    [392, 330, 262, 196].forEach(function(f, i){ beep(f, 0.16, 'sawtooth', 0.05, i * 0.12); });
    setTimeout(function(){ overlay.classList.remove('hidden'); }, 500);
  }

  function startLevel(lv){
    level = lv;
    target = 800 + lv * 700;
    movesLeft = 20;
    score = 0;
    chain = 1;
    sel = null; swapA = swapB = null;
    particles = []; floats = [];
    levelOver = false;
    overlay.classList.add('hidden');
    fillBoardNoMatch();
    phase = 'falling';
    banner = { txt: 'LEVEL ' + lv + ' — TARGET ' + target, until: performance.now() + 1800 };
    updateHud();
    persist(function(st){ st.playing = lv; });
  }

  function updateHud(){
    levelEl.textContent = level;
    scoreEl.textContent = score;
    movesEl.textContent = movesLeft;
    var pct = Math.min(100, Math.round(score / target * 100));
    barEl.style.width = pct + '%';
    barTxt.textContent = score + ' / ' + target;
  }

  /* ---------- input ---------- */
  function cellAt(ev){
    var rect = cv.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width * N;
    var y = (ev.clientY - rect.top) / rect.height * N;
    var c = Math.floor(x), r = Math.floor(y);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return { r: r, c: c, fx: x, fy: y };
  }

  function trySwap(a, b){
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
    swapA = { r: a.r, c: a.c }; swapB = { r: b.r, c: b.c };
    swapCells(a.r, a.c, b.r, b.c);
    phase = 'swapping';
    sel = null;
    beep(440, 0.05, 'triangle', 0.04);
    return true;
  }

  var dragStart = null;
  cv.addEventListener('pointerdown', function(e){
    e.preventDefault();
    ac();
    if (phase !== 'idle' || levelOver) return;
    var cell = cellAt(e);
    if (!cell) return;
    dragStart = cell;
    if (sel){
      if (sel.r === cell.r && sel.c === cell.c){ sel = null; beep(300, .03); return; }
      if (trySwap(sel, cell)) return;
      sel = { r: cell.r, c: cell.c };
      beep(560, 0.04, 'square', 0.03);
    } else {
      sel = { r: cell.r, c: cell.c };
      beep(560, 0.04, 'square', 0.03);
    }
  });
  cv.addEventListener('pointermove', function(e){
    if (!dragStart || phase !== 'idle' || levelOver) return;
    var cell = cellAt(e);
    if (!cell) return;
    var dx = cell.fx - (dragStart.c + .5), dy = cell.fy - (dragStart.r + .5);
    if (Math.abs(dx) < .55 && Math.abs(dy) < .55) return;
    var t;
    if (Math.abs(dx) > Math.abs(dy)) t = { r: dragStart.r, c: dragStart.c + (dx > 0 ? 1 : -1) };
    else t = { r: dragStart.r + (dy > 0 ? 1 : -1), c: dragStart.c };
    if (t.r < 0 || t.c < 0 || t.r >= N || t.c >= N){ dragStart = null; return; }
    trySwap(dragStart, t);
    dragStart = null;
  });
  window.addEventListener('pointerup', function(){ dragStart = null; });

  ovBtn.addEventListener('click', function(){
    if (ovTitle.classList.contains('fail')) startLevel(level);
    else startLevel(level + 1);
  });

  /* ---------- particles & fx ---------- */
  function spawnParticles(x, y, color){
    for (var i = 0; i < 7; i++){
      var a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 0.45 + Math.random() * 0.3,
        color: COLORS[color]
      });
    }
  }

  /* ---------- render ---------- */
  function sizeCanvas(){
    var top = cv.getBoundingClientRect().top;
    var availH = Math.max(200, window.innerHeight - top - 70);
    var availW = Math.min(window.innerWidth - 30, 480);
    var size = Math.floor(Math.min(availW, availH) / N) * N;
    size = Math.max(224, Math.min(480, size));
    CELL = size / N;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    cv.width = size * DPR;
    cv.height = size * DPR;
  }

  function drawGem(g, c, r){
    var x = (g.x + .5) * CELL, y = (g.y + .5) * CELL;
    var rad = CELL * 0.36 * g.scale;
    if (rad <= 0) return;
    var col = COLORS[g.color], glow = GLOW[g.color];
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = col;
    ctx.shadowBlur = CELL * .28;
    ctx.fillStyle = col;
    ctx.strokeStyle = glow;
    ctx.lineWidth = Math.max(1.5, CELL * .05);
    ctx.beginPath();
    switch (g.color){
      case 0: // circle
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        break;
      case 1: // diamond
        ctx.moveTo(0, -rad); ctx.lineTo(rad, 0); ctx.lineTo(0, rad); ctx.lineTo(-rad, 0);
        ctx.closePath();
        break;
      case 2: // square
        ctx.rect(-rad * .82, -rad * .82, rad * 1.64, rad * 1.64);
        break;
      case 3: // triangle
        ctx.moveTo(0, -rad); ctx.lineTo(rad * .95, rad * .75); ctx.lineTo(-rad * .95, rad * .75);
        ctx.closePath();
        break;
      case 4: // hexagon
        for (var i = 0; i < 6; i++){
          var a = Math.PI / 6 + i * Math.PI / 3;
          var px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      default: // star
        for (var j = 0; j < 10; j++){
          var a2 = -Math.PI / 2 + j * Math.PI / 5;
          var rr = (j % 2 === 0) ? rad : rad * .48;
          var px2 = Math.cos(a2) * rr, py2 = Math.sin(a2) * rr;
          if (j === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    // shine
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.arc(-rad * .3, -rad * .35, rad * .18, 0, Math.PI * 2);
    ctx.fill();
    // special stripes
    if (g.special){
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = Math.max(2, CELL * .07);
      ctx.beginPath();
      var pulse = .55 + .25 * Math.sin(performance.now() / 130);
      ctx.globalAlpha = pulse;
      if (g.special === 1){
        ctx.moveTo(-rad * .9, -rad * .3); ctx.lineTo(rad * .9, -rad * .3);
        ctx.moveTo(-rad * .9, rad * .3);  ctx.lineTo(rad * .9, rad * .3);
      } else {
        ctx.moveTo(-rad * .3, -rad * .9); ctx.lineTo(-rad * .3, rad * .9);
        ctx.moveTo(rad * .3, -rad * .9);  ctx.lineTo(rad * .3, rad * .9);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  var lastT = performance.now();
  function frame(now){
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }

  function update(dt, now){
    // move gems toward their grid slots
    var fallSpeed = 13, slideSpeed = 9;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      var g = grid[r][c];
      if (!g) continue;
      var dx = c - g.x, dy = r - g.y;
      var sx = slideSpeed * dt, sy = (Math.abs(dy) > 0 && phase === 'falling' ? fallSpeed : slideSpeed) * dt;
      if (Math.abs(dx) <= sx) g.x = c; else g.x += Math.sign(dx) * sx;
      if (Math.abs(dy) <= sy) g.y = r; else g.y += Math.sign(dy) * sy;
      if (g.pop) g.scale = Math.max(0, g.scale - dt * 5);
      else if (g.scale > 1) g.scale = Math.max(1, g.scale - dt * 2.4);
    }
    // particles
    for (var i = particles.length - 1; i >= 0; i--){
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0){ particles.splice(i, 1); continue; }
      p.vy += 14 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (var f = floats.length - 1; f >= 0; f--){
      floats[f].life -= dt;
      floats[f].y -= dt * .8;
      if (floats[f].life <= 0) floats.splice(f, 1);
    }

    if (phase === 'swapping' && settled()){
      var runs = findRuns();
      if (runs.length){
        movesLeft--;
        updateHud();
        chain = 1;
        beginPop(runs);
      } else {
        swapCells(swapA.r, swapA.c, swapB.r, swapB.c);
        phase = 'swapback';
        beep(150, 0.12, 'sawtooth', 0.045);
      }
    } else if (phase === 'swapback' && settled()){
      swapA = swapB = null;
      phase = 'idle';
    } else if (phase === 'popping' && now >= popEnd){
      removeAndCollapse();
    } else if (phase === 'falling' && settled()){
      var runs2 = findRuns();
      if (runs2.length){
        chain++;
        swapA = swapB = null;
        beginPop(runs2);
      } else {
        endOfCascade();
      }
    }
  }

  function render(now){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, cv.width / DPR, cv.height / DPR);
    // checkerboard
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++){
      ctx.fillStyle = ((r + c) % 2 === 0) ? '#171427' : '#131022';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
    // selection
    if (sel && phase === 'idle'){
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      var pad = 3 + Math.sin(now / 150) * 1.5;
      ctx.strokeRect(sel.c * CELL + pad, sel.r * CELL + pad, CELL - pad * 2, CELL - pad * 2);
      ctx.restore();
    }
    // gems
    for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++){
      var g = grid[r2][c2];
      if (g) drawGem(g, c2, r2);
    }
    // particles
    particles.forEach(function(p){
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.2));
      ctx.fillStyle = p.color;
      var s = CELL * .09;
      ctx.fillRect(p.x * CELL - s/2, p.y * CELL - s/2, s, s);
    });
    ctx.globalAlpha = 1;
    // floating texts
    floats.forEach(function(f){
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.font = 'bold ' + Math.floor(CELL * .5) + 'px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 10;
      ctx.fillText(f.txt, f.x * CELL, f.y * CELL);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
    // banner
    if (banner){
      if (now > banner.until) banner = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (banner.until - now) / 400);
        ctx.fillStyle = 'rgba(15,15,26,.75)';
        ctx.fillRect(0, CELL * N / 2 - CELL * .8, CELL * N, CELL * 1.6);
        ctx.font = 'bold ' + Math.floor(CELL * .55) + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4fd8';
        ctx.shadowColor = '#ff4fd8';
        ctx.shadowBlur = 16;
        ctx.fillText(banner.txt, CELL * N / 2, CELL * N / 2);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  window.addEventListener('resize', sizeCanvas);

  /* ---------- boot ---------- */
  var save = loadSave();
  bestEl.textContent = save.level || 1;
  sizeCanvas();
  startLevel(Math.max(1, save.playing || save.level || 1));
  requestAnimationFrame(frame);
})();
