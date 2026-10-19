/* Quiz do Milhão — Fisiologia do Sistema Urinário (protótipo M0, sem build) */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR');
  const LET = ['A', 'B', 'C', 'D'];
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- configuração (ver GDD) ---------- */
  const LADDER = [1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000, 200000, 300000, 400000, 500000, 1000000];
  const CFG = { time: 60, skips: 3, noHelpOnLast: true, suspenseMs: 1500 };
  const tierOf = (i) => (i < 5 ? 'facil' : i < 10 ? 'medio' : i < 15 ? 'dificil' : 'milhao');
  const BANK = (window.QUESTION_BANK && window.QUESTION_BANK.questions) || [];

  /* ---------- áudio (sintetizado, sem arquivos) ---------- */
  const Sfx = (() => {
    let ctx = null, muted = store.get('quiz.muted', false);
    const ensure = () => {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function tone(f, d = 0.12, type = 'sine', v = 0.14, delay = 0, slide = 0) {
      if (muted) return; const c = ensure(); if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.03);
    }
    return {
      unlock: ensure,
      get muted() { return muted; },
      toggle() { muted = !muted; store.set('quiz.muted', muted); return muted; },
      hover() { tone(520, 0.04, 'triangle', 0.05); },
      select() { tone(660, 0.07, 'triangle', 0.14); tone(880, 0.06, 'triangle', 0.08, 0.04); },
      lock() { tone(110, 1.2, 'sawtooth', 0.09, 0, 40); [0, 0.5, 1.0].forEach((d) => { tone(70, 0.12, 'sine', 0.25, d); tone(70, 0.12, 'sine', 0.2, d + 0.16); }); },
      correct() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.09)); tone(1568, 0.5, 'sine', 0.08, 0.4); },
      wrong() { tone(220, 0.7, 'sawtooth', 0.2, 0, -150); tone(110, 0.9, 'square', 0.12, 0.1, -60); },
      tick() { tone(1000, 0.035, 'square', 0.05); },
      flip() { tone(380, 0.09, 'triangle', 0.12, 0, 380); },
      help() { tone(440, 0.1, 'sine', 0.14); tone(660, 0.12, 'sine', 0.14, 0.09); },
      skip() { tone(500, 0.08, 'square', 0.08); tone(750, 0.1, 'square', 0.08, 0.07); },
      win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, i * 0.12)); },
    };
  })();

  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  /* ---------- confete / partículas ---------- */
  const FX = (() => {
    const cv = $('#fx'), cx = cv.getContext('2d');
    let ps = [], raf = 0, dpr = 1;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    addEventListener('resize', resize); resize();
    const COLORS = ['#f5c542', '#ffe08a', '#3b82f6', '#22c55e', '#ffffff', '#ff7ab6'];
    function loop() {
      cx.clearRect(0, 0, cv.width, cv.height);
      ps = ps.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      for (const p of ps) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.992; p.rot += p.vr; p.life -= 1;
        cx.save(); cx.translate(p.x * dpr, p.y * dpr); cx.rotate(p.rot);
        cx.globalAlpha = Math.min(1, p.life / 25); cx.fillStyle = p.c;
        cx.fillRect(-p.s * dpr / 2, -p.s * 0.3 * dpr, p.s * dpr, p.s * 0.6 * dpr); cx.restore();
      }
      raf = ps.length ? requestAnimationFrame(loop) : 0;
      if (!raf) cx.clearRect(0, 0, cv.width, cv.height);
    }
    return {
      burst(x, y, n = 90, power = 1) {
        if (reduced) n = Math.round(n / 5);
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), sp = rand(3, 11) * power;
          ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(2, 6), g: 0.28, s: rand(6, 12), c: COLORS[(Math.random() * COLORS.length) | 0], rot: rand(0, 6), vr: rand(-0.3, 0.3), life: rand(70, 130) });
        }
        if (!raf) raf = requestAnimationFrame(loop);
      },
      rain(ms = 2500) {
        const t0 = performance.now();
        const drop = () => {
          if (performance.now() - t0 > ms) return;
          for (let i = 0; i < 5; i++) ps.push({ x: rand(0, innerWidth), y: -10, vx: rand(-1, 1), vy: rand(2, 5), g: 0.05, s: rand(7, 13), c: COLORS[(Math.random() * COLORS.length) | 0], rot: rand(0, 6), vr: rand(-0.2, 0.2), life: 260 });
          if (!raf) raf = requestAnimationFrame(loop);
          setTimeout(drop, 40);
        }; drop();
      },
    };
  })();

  /* ---------- ranking (local agora; adaptador pronto para backend global) ---------- */
  const Leaderboard = (() => {
    const KEY = 'quiz.urinario.ranking.v1';
    const sorter = (a, b) => b.prize - a.prize || a.helps - b.helps || a.timeMs - b.timeMs || a.date - b.date;
    return {
      mode: 'local', // TODO M3: trocar por 'remote' (Supabase/Firebase/Workers) com validação no servidor
      async list(limit = 20) { return store.get(KEY, []).sort(sorter).slice(0, limit); },
      async submit(entry) {
        const all = store.get(KEY, []); all.push(entry); all.sort(sorter);
        store.set(KEY, all.slice(0, 200));
        return all.indexOf(entry) + 1;
      },
    };
  })();

  /* ---------- estado ---------- */
  const T = { left: CFG.time, last: 0, running: false, paused: 0, raf: 0, lastSec: null };
  let S = null;

  function newSession(name) {
    return {
      name, idx: 0, q: null, opts: [], sel: null, locked: false, busy: false,
      used: new Set(), skipsLeft: CFG.skips, helps: { uni: false, crowd: false, cards: false },
      helpsUsed: 0, gone: new Set(), t0: performance.now(), timeSpent: 0, qStart: 0,
      cardsOrder: shuffle([0, 1, 2, 3]), over: false,
    };
  }
  const won = () => (S.idx > 0 ? LADDER[S.idx - 1] : 0);

  /* ---------- telas ---------- */
  function go(name) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    if (name === 'menu') refreshMenu();
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  async function refreshMenu() {
    const top = (await Leaderboard.list(1))[0];
    $('#bestLine').textContent = top ? `Recorde: ${top.name} — ${brl(top.prize)}` : 'Seja o primeiro no ranking.';
  }

  /* ---------- escada ---------- */
  function buildLadder() {
    const ol = $('#ladder'); ol.innerHTML = '';
    LADDER.forEach((v, i) => {
      const li = el('li'); li.dataset.i = i;
      li.append(el('span', 'n', String(i + 1)), el('span', 'v', brl(v)));
      ol.append(li);
    });
  }
  function paintLadder() {
    $$('#ladder li').forEach((li) => {
      const i = +li.dataset.i;
      li.classList.toggle('done', i < S.idx);
      li.classList.toggle('cur', i === S.idx);
    });
  }

  /* ---------- seleção de pergunta ---------- */
  function pickQuestion(tier) {
    let pool = BANK.filter((q) => q.tier === tier && !S.used.has(q.id));
    if (!pool.length) pool = BANK.filter((q) => q.tier === tier); // esgotou: reaproveita
    return pool[(Math.random() * pool.length) | 0];
  }

  /* ---------- fluxo ---------- */
  function startGame() {
    Sfx.unlock();
    const name = ($('#playerName').value || '').trim() || 'Jogador';
    store.set('quiz.name', name);
    S = newSession(name);
    buildLadder();
    go('game');
    nextQuestion(true);
  }

  async function nextQuestion(first) {
    S.q = pickQuestion(tierOf(S.idx)); S.used.add(S.q.id);
    S.opts = shuffle(S.q.options.map((t, i) => ({ t, ok: i === S.q.answer })));
    S.sel = null; S.locked = false; S.busy = false; S.gone = new Set();
    document.body.classList.remove('suspense');
    renderQuestion(true);
    paintLadder(); updateHud();
    timerStart();
    $('#live').textContent = `Pergunta ${S.idx + 1}, valendo ${brl(LADDER[S.idx])}. ${S.q.text}`;
  }

  function renderQuestion(animate) {
    $('#qnum').textContent = S.idx + 1;
    $('#qcat').textContent = S.q.category;
    $('#qtext').textContent = S.q.text;
    const card = $('#qcard'); card.classList.remove('enter'); void card.offsetWidth; if (animate) card.classList.add('enter');
    const box = $('#options'); box.innerHTML = '';
    S.opts.forEach((o, i) => {
      const b = el('button', 'opt'); b.type = 'button'; b.dataset.i = i;
      b.append(el('span', 'letter', LET[i]), el('span', 'txt', o.t));
      b.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; onOption(i); });
      b.addEventListener('click', (e) => { if (e.detail === 0) onOption(i); }); // teclado/leitor de tela
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !S.locked && !S.gone.has(i)) Sfx.hover(); });
      box.append(b);
    });
    $('#btnConfirm').disabled = true;
  }

  function updateHud() {
    $('#prizeNow').textContent = brl(LADDER[S.idx]);
    const last = S.idx === LADDER.length - 1;
    $('#stakes').innerHTML = '';
    const mk = (cls, label, val) => { const s = el('span', cls); s.append(label + ' ', Object.assign(el('b'), { textContent: brl(val) })); return s; };
    $('#stakes').append(mk('s-bad', 'Errar', 0), mk('s-stop', 'Parar', won()), mk('s-ok', 'Acertar', LADDER[S.idx]));
    // ajudas
    const noHelp = last && CFG.noHelpOnLast;
    $$('.ll').forEach((b) => {
      const k = b.dataset.ll;
      const used = k === 'skip' ? S.skipsLeft <= 0 : S.helps[k];
      b.classList.toggle('used', !!used);
      b.disabled = !!used || noHelp || S.locked || S.busy;
    });
    $('#skipBadge').textContent = S.skipsLeft;
    $('#btnStop').disabled = S.locked || S.busy;
  }

  /* ---------- seleção / confirmação ---------- */
  function onOption(i) {
    if (!S || S.locked || S.busy || S.over || S.gone.has(i)) return;
    Sfx.unlock();
    if (S.sel === i) { confirmAnswer(); return; } // segundo toque = travar
    S.sel = i;
    $$('.opt').forEach((b, k) => b.classList.toggle('sel', k === i));
    $('#btnConfirm').disabled = false;
    Sfx.select(); buzz(8);
  }

  async function confirmAnswer() {
    if (!S || S.locked || S.sel == null || S.busy) return;
    S.locked = true; timerStop(); updateHud();
    const opts = $$('.opt');
    opts.forEach((b) => (b.disabled = true));
    opts[S.sel].classList.add('locked');
    $('#btnConfirm').disabled = true;
    document.body.classList.add('suspense');
    Sfx.lock();
    await sleep(reduced ? 500 : CFG.suspenseMs);
    await reveal();
  }

  async function reveal() {
    const opts = $$('.opt');
    const okIdx = S.opts.findIndex((o) => o.ok);
    opts.forEach((b) => b.classList.remove('locked'));
    document.body.classList.remove('suspense');
    const hit = S.sel === okIdx;
    opts[okIdx].classList.add('right');
    if (!hit && S.sel != null) opts[S.sel].classList.add('wrong');
    if (hit) {
      Sfx.correct(); buzz([20, 40, 20]); flash('ok');
      const r = opts[okIdx].getBoundingClientRect();
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, 110);
      $('#live').textContent = 'Resposta correta!';
      await sleep(reduced ? 600 : 1900);
      if (S.idx === LADDER.length - 1) { S.idx++; return endGame('milhao'); }
      S.idx++;
      nextQuestion();
    } else {
      Sfx.wrong(); buzz([120, 60, 120]); flash('bad'); shake();
      $('#live').textContent = 'Resposta errada.';
      await sleep(reduced ? 800 : 2600);
      endGame(S.timedOut ? 'tempo' : 'errou');
    }
  }

  function flash(kind) { const f = el('div', 'flash ' + kind); document.body.append(f); setTimeout(() => f.remove(), 700); }
  function shake() { if (reduced) return; const s = $('#stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }

  /* ---------- cronômetro ---------- */
  function timerStart() {
    T.left = CFG.time; T.last = performance.now(); T.running = true; T.paused = document.hidden ? 1 : 0; T.lastSec = null; S.qStart = performance.now();
    cancelAnimationFrame(T.raf); T.raf = requestAnimationFrame(timerLoop); paintTimer();
  }
  function timerStop() {
    if (T.running) S.timeSpent += performance.now() - S.qStart;
    T.running = false; cancelAnimationFrame(T.raf);
  }
  function timerPause(on) {
    T.paused = Math.max(0, T.paused + (on ? 1 : -1));
    T.last = performance.now();
  }
  function timerLoop(now) {
    if (!T.running) return;
    if (!T.paused) T.left -= (now - T.last) / 1000;
    T.last = now;
    paintTimer();
    if (T.left <= 0) { T.left = 0; paintTimer(); return timeUp(); }
    T.raf = requestAnimationFrame(timerLoop);
  }
  function paintTimer() {
    const sec = Math.max(0, Math.ceil(T.left));
    $('#timerBar').style.transform = `scaleX(${Math.max(0, T.left / CFG.time)})`;
    $('#timerText').textContent = sec;
    const t = $('.timer'); t.classList.toggle('low', T.left <= 20 && T.left > 10); t.classList.toggle('crit', T.left <= 10);
    if (T.lastSec !== sec) { if (T.lastSec != null && sec <= 10 && sec > 0 && !T.paused) Sfx.tick(); T.lastSec = sec; }
  }
  async function timeUp() {
    if (S.locked) return;
    timerStop(); S.locked = true; S.timedOut = true; S.sel = null;
    closeModal(true);
    $$('.opt').forEach((b) => (b.disabled = true));
    updateHud();
    $('#live').textContent = 'O tempo acabou!';
    await reveal();
  }

  /* ---------- parar ---------- */
  function askStop() {
    if (!S || S.locked || S.busy) return;
    if (S.idx === 0) { return modal((c) => confirmBox(c, 'Parar agora?', 'Você ainda não ganhou nada. Parar encerra o jogo com R$ 0 (sem ranking).', 'Parar', 'Continuar', () => endGame('parou'))); }
    modal((c) => confirmBox(c, 'Parar o jogo?', `Você leva ${brl(won())} para casa e entra no ranking.`, `Parar com ${brl(won())}`, 'Continuar jogando', () => endGame('parou')));
  }
  function confirmBox(c, title, text, yes, no, onYes) {
    c.append(el('h3', '', title), el('p', '', text));
    const row = el('div', 'modal-actions');
    const b1 = el('button', 'btn primary', yes), b2 = el('button', 'btn ghost', no);
    b1.onclick = () => { closeModal(true); onYes(); }; b2.onclick = () => closeModal();
    row.append(b2, b1); c.append(row); setTimeout(() => b2.focus(), 30);
  }

  /* ---------- modal (pausa o relógio) ---------- */
  let modalOpen = false, modalOnClose = null;
  function modal(build, opts = {}) {
    const m = $('#modal'), card = $('#modalCard'); card.innerHTML = '';
    build(card); m.hidden = false; modalOpen = true; modalOnClose = opts.onClose || null;
    if (!opts.keepClock) timerPause(true);
    modalPaused = !opts.keepClock;
  }
  let modalPaused = false;
  function closeModal(silent) {
    if (!modalOpen) return;
    $('#modal').hidden = true; modalOpen = false;
    if (modalPaused) timerPause(false);
    modalPaused = false;
    const cb = modalOnClose; modalOnClose = null; if (cb && !silent) cb();
    updateHud();
  }

  /* ---------- ajudas ---------- */
  function useHelp(kind) {
    if (!S || S.locked || S.busy || S.over || modalOpen) return;
    if (S.idx === LADDER.length - 1 && CFG.noHelpOnLast) return;
    Sfx.unlock();
    if (kind === 'skip') return doSkip();
    if (S.helps[kind]) return;
    S.helps[kind] = true; S.helpsUsed++; Sfx.help(); updateHud();
    if (kind === 'uni') helpUni(); else if (kind === 'crowd') helpCrowd(); else if (kind === 'cards') helpCards();
  }

  function doSkip() {
    if (S.skipsLeft <= 0) return;
    S.skipsLeft--; S.helpsUsed++; Sfx.skip(); buzz(15);
    S.busy = true; updateHud();
    const wasTier = tierOf(S.idx);
    S.q = pickQuestion(wasTier); S.used.add(S.q.id);
    S.opts = shuffle(S.q.options.map((t, i) => ({ t, ok: i === S.q.answer })));
    S.sel = null; S.gone = new Set(); S.busy = false;
    renderQuestion(true); timerStart(); updateHud();
    $('#live').textContent = 'Pergunta trocada. ' + S.q.text;
  }

  function remainingWrong() { return S.opts.map((o, i) => i).filter((i) => !S.opts[i].ok && !S.gone.has(i)); }
  const okIndex = () => S.opts.findIndex((o) => o.ok);

  // Universitários: 3 opiniões, acurácia cai com a dificuldade
  function helpUni() {
    const t = S.idx / (LADDER.length - 1);
    const base = lerp(0.92, 0.45, t);
    const alive = S.opts.map((o, i) => i).filter((i) => !S.gone.has(i));
    const names = ['Ana', 'Bruno', 'Carla'];
    const says = names.map((n) => {
      const p = Math.min(0.97, Math.max(0.2, base + rand(-0.1, 0.1)));
      const knows = Math.random() < p;
      const pick = knows ? okIndex() : remainingWrong()[(Math.random() * remainingWrong().length) | 0];
      const conf = knows && p > 0.8 ? 0 : p > 0.55 ? 1 : 2;
      return { n, pick, conf };
    });
    const phrase = (s) => [`Tenho certeza: é a ${LET[s.pick]}.`, `Acho que é a ${LET[s.pick]}.`, `Não sei bem, chutaria a ${LET[s.pick]}.`][s.conf];
    modal((c) => {
      c.append(el('h3', '', 'Universitários'), el('p', '', 'Eles ouvem a pergunta e opinam, um de cada vez.'));
      const list = el('div', 'students'); c.append(list);
      const rows = says.map((s) => {
        const r = el('div', 'student'); const av = el('div', 'av', s.n[0]); const say = el('div', 'say');
        const nm = el('small', '', s.n); const tx = el('span'); tx.innerHTML = '<span class="dots"></span>';
        say.append(nm, tx); r.append(av, say); list.append(r); return { r, tx, s };
      });
      const row = el('div', 'modal-actions'); const ok = el('button', 'btn primary', 'Entendi'); ok.disabled = true; ok.onclick = () => closeModal(); row.append(ok); c.append(row);
      (async () => {
        for (const x of rows) {
          await sleep(reduced ? 200 : 1100);
          if (!modalOpen) return;
          x.tx.textContent = phrase(x.s); x.r.classList.add('reveal'); Sfx.flip();
        }
        ok.disabled = false; ok.focus();
      })();
    });
  }

  // Plateia: distribuição de votos entre alternativas restantes
  function helpCrowd() {
    const t = S.idx / (LADDER.length - 1);
    const alive = S.opts.map((o, i) => i).filter((i) => !S.gone.has(i));
    let acc = Math.min(0.95, Math.max(0.15, lerp(0.85, 0.35, t) + rand(-0.08, 0.08)));
    const votes = {}; const wrongs = alive.filter((i) => !S.opts[i].ok);
    const weights = wrongs.map(() => rand(0.2, 1)); const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    let total = 0;
    wrongs.forEach((i, k) => { votes[i] = Math.round((1 - acc) * 100 * weights[k] / wsum); total += votes[i]; });
    votes[okIndex()] = Math.max(0, 100 - total);
    // ajuste final para somar 100
    const sum = Object.values(votes).reduce((a, b) => a + b, 0);
    if (sum !== 100) votes[okIndex()] += 100 - sum;
    modal((c) => {
      c.append(el('h3', '', 'Plateia'), el('p', '', 'Os votos das placas A, B, C e D:'));
      const wrap = el('div', 'crowd'); const bars = [];
      for (let i = 0; i < 4; i++) {
        const col = el('div', 'col' + (S.gone.has(i) ? ' off' : ''));
        const bw = el('div', 'bar-wrap'), bar = el('div', 'bar'); bw.append(bar);
        col.append(bw, el('div', 'pc', (votes[i] || 0) + '%'), el('div', 'lt', LET[i])); wrap.append(col); bars.push([bar, votes[i] || 0]);
      }
      c.append(wrap);
      const row = el('div', 'modal-actions'); const ok = el('button', 'btn primary', 'Entendi'); ok.onclick = () => closeModal(); row.append(ok); c.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(([b, v]) => { b.style.height = v + '%'; })));
      setTimeout(() => ok.focus(), 50);
    });
  }

  // Cartas: Rei=0, Ás=1, 2=2, 3=3 alternativas erradas eliminadas
  function helpCards() {
    const LAB = [['K', 'Rei', 0], ['A', 'Ás', 1], ['2', 'Dois', 2], ['3', 'Três', 3]];
    modal((c) => {
      c.append(el('h3', '', 'Cartas'), el('p', '', 'Escolha uma carta. O Rei elimina nada; Ás, 2 e 3 eliminam 1, 2 ou 3 alternativas erradas.'));
      const grid = el('div', 'cards'); const btns = [];
      S.cardsOrder.forEach((v, slot) => {
        const b = el('div', 'card'); b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-label', 'Carta ' + (slot + 1));
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
        const back = el('div', 'b', '?'); const [sym, name, n] = LAB[v];
        const front = el('div', 'f'); front.append(el('span', '', sym), Object.assign(el('small'), { textContent: n === 0 ? 'Nenhuma' : n + ' elimin.' }));
        b.append(back, front); grid.append(b); btns.push(b);
        b.onclick = async () => {
          if (b.dataset.done) return; btns.forEach((x) => (x.dataset.done = '1'));
          Sfx.flip(); b.classList.add('flip');
          await sleep(650);
          const msg = el('p', '', n === 0 ? 'Rei: nenhuma alternativa eliminada.' : `${name}: ${n} alternativa${n > 1 ? 's' : ''} errada${n > 1 ? 's' : ''} eliminada${n > 1 ? 's' : ''}.`);
          c.insertBefore(msg, grid.nextSibling);
          const wr = shuffle(remainingWrong()).slice(0, n);
          wr.forEach((i) => S.gone.add(i));
          if (wr.length) Sfx.skip();
          applyGone();
          // revela as outras cartas
          btns.forEach((x, k) => { if (x !== b) { x.classList.add('flip', 'dim'); } });
          const row = el('div', 'modal-actions'); const ok = el('button', 'btn primary', 'Continuar'); ok.onclick = () => closeModal(); row.append(ok); c.append(row); ok.focus();
        };
      });
      c.append(grid);
    });
  }
  function applyGone() {
    $$('.opt').forEach((b, i) => { b.classList.toggle('gone', S.gone.has(i)); if (S.gone.has(i)) b.disabled = true; });
    if (S.sel != null && S.gone.has(S.sel)) { S.sel = null; $('#btnConfirm').disabled = true; $$('.opt').forEach((b) => b.classList.remove('sel')); }
  }

  /* ---------- fim de jogo ---------- */
  async function endGame(result) {
    if (S.over) return; S.over = true; timerStop(); closeModal(true);
    document.body.classList.remove('suspense');
    const prize = result === 'milhao' ? LADDER[LADDER.length - 1] : result === 'parou' ? won() : 0;
    const eligible = (result === 'parou' && prize > 0) || result === 'milhao';
    const elapsed = S.timeSpent;
    const secs = (ms) => Math.round(ms / 1000) + 's';

    const end = $('.end'); end.classList.toggle('lost', prize === 0);
    $('#endEyebrow').textContent = { milhao: 'Incrível!', parou: 'Você parou', errou: 'Resposta errada', tempo: 'Tempo esgotado' }[result];
    $('#endTitle').textContent = { milhao: 'VOCÊ É MILIONÁRIO!', parou: 'Prêmio garantido', errou: 'Você perdeu tudo', tempo: 'O relógio zerou' }[result];
    $('#endSub').textContent = { milhao: 'Domínio total da fisiologia urinária.', parou: 'Boa decisão: o dinheiro é seu.', errou: 'Mais estudo e a próxima vai ser sua.', tempo: 'Estourou os 60 segundos: perdeu tudo.' }[result];
    const stats = $('#endStats'); stats.innerHTML = '';
    const stat = (k, v) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); stats.append(d); };
    stat('Acertos', String(Math.min(S.idx, 16))); stat('Ajudas', String(S.helpsUsed)); stat('Tempo', secs(elapsed));
    go('end');
    countUp($('#endPrize'), prize);
    if (result === 'milhao') { Sfx.win(); FX.rain(3500); buzz([60, 40, 60, 40, 120]); }
    else if (prize > 0) { Sfx.correct(); FX.burst(innerWidth / 2, innerHeight / 3, 140); }

    let note = el('p', 'muted');
    if (eligible) {
      const pos = await Leaderboard.submit({ name: S.name, prize, correct: S.idx, helps: S.helpsUsed, timeMs: elapsed, result, date: Date.now() });
      store.set('quiz.lastEntry', { name: S.name, prize, date: Date.now() });
      note.textContent = `Você entrou no ranking na posição #${pos}.`;
    } else {
      note.textContent = prize === 0 && result === 'parou' ? 'Sem prêmio, sem ranking.' : 'Só quem para ou chega ao milhão entra no ranking.';
    }
    const old = $('#endNote'); if (old) old.remove(); note.id = 'endNote'; $('#endStats').after(note);
  }

  function countUp(node, target) {
    if (reduced || target === 0) { node.textContent = brl(target); return; }
    const t0 = performance.now(), D = 1300;
    const f = (now) => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      node.textContent = brl(Math.round(target * e / 100) * 100); if (p < 1) requestAnimationFrame(f); else node.textContent = brl(target);
    }; requestAnimationFrame(f);
  }

  async function showRank() {
    const list = await Leaderboard.list(20), ol = $('#rankList'); ol.innerHTML = '';
    const last = store.get('quiz.lastEntry', null);
    $('#rankNote').textContent = Leaderboard.mode === 'local' ? 'Ranking local deste navegador. O ranking global entra no próximo marco.' : '';
    if (!list.length) { const li = el('li'); li.append(el('span'), el('span', 'nm', 'Ninguém no ranking ainda.')); ol.append(li); }
    list.forEach((e, i) => {
      const li = el('li'); if (last && last.date === e.date) li.classList.add('me');
      const nm = el('span', 'nm', e.name); nm.append(el('small', '', `${e.result === 'milhao' ? 'Chegou ao milhão' : 'Parou'} · ${e.helps} ajuda(s) · ${Math.round(e.timeMs / 1000)}s`));
      li.append(el('span', 'pos', String(i + 1)), nm, el('span', 'pr', brl(e.prize))); ol.append(li);
    });
    go('rank');
  }

  /* ---------- eventos ---------- */
  $('#btnPlay').addEventListener('click', startGame);
  $('#playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
  $('#btnRank').addEventListener('click', showRank);
  $('#btnHow').addEventListener('click', () => go('how'));
  $('#btnEndRank').addEventListener('click', showRank);
  $('#btnAgain').addEventListener('click', startGame);
  $('#btnConfirm').addEventListener('click', confirmAnswer);
  $('#btnStop').addEventListener('click', askStop);
  $$('.ll').forEach((b) => b.addEventListener('click', () => useHelp(b.dataset.ll)));
  $('#btnMute').addEventListener('click', () => { $('#btnMute').textContent = Sfx.toggle() ? '🔇' : '🔊'; });
  $('#btnMute').textContent = Sfx.muted ? '🔇' : '🔊';

  addEventListener('keydown', (e) => {
    if (!$('#screen-game').classList.contains('active') || !S) return;
    if (e.key === 'Escape' && modalOpen && /Parar/.test(($('#modalCard h3') || {}).textContent || '')) return closeModal();
    if (modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), idx = 'abcd'.indexOf(k) >= 0 && k.length === 1 ? 'abcd'.indexOf(k) : '1234'.indexOf(k) >= 0 && k.length === 1 ? '1234'.indexOf(k) : -1;
    if (idx >= 0) { e.preventDefault(); onOption(idx); }
    else if (e.key === 'Enter' && S.sel != null && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); confirmAnswer(); }
  });

  // pausa o relógio se a aba perde o foco (evita injustiça)
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (T.running) { T.paused++; } } else { if (T.running && T.paused > 0) { T.paused--; T.last = performance.now(); } } });

  /* ---------- init ---------- */
  $('#playerName').value = store.get('quiz.name', '');
  refreshMenu();
  if (location.hash === '#debug') window.__quiz = { get S() { return S; }, LADDER, T, endGame };
})();
