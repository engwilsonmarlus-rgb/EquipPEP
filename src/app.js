(function () {
  'use strict';
  var C = window.Core;
  var USER = 'admin0000', PASS = 'admin0000'; // login provisório da fase de teste
  var LS_STATE = 'pcapp_state_v1', LS_LOGIN = 'pcapp_login_v1';
  var CLASSES_COMB = ['MOBILIZAÇÃO', 'DESLOCAMENTO', 'DESMOBILIZAÇÃO'];
  var CLASSES_HOSP = ['HOSP. 01 PESSOA', 'HOSP. 02 PESSOAS', 'HOSP. 03 PESSOAS', 'HOSP. 04 PESSOAS'];
  var SUG_DIV = ['PEDÁGIO', 'PAPELARIA', 'ESTACIONAMENTO'];
  var TIPOS_REC = ['DEPÓSITO CAJU', 'PIX', 'DINHEIRO'];
  var CAT = { DIA: { n: 'Diária', ic: '📅' }, COMB: { n: 'Combustível', ic: '⛽' }, HOSP: { n: 'Hospedagem', ic: '🏨' }, DIV: { n: 'Diversas', ic: '🧾' } };
  var DSEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  /* ---------- utilidades ---------- */
  function $(s) { return document.querySelector(s); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + C.pad(d.getMonth() + 1) + '-' + C.pad(d.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function num(s) {
    if (typeof s === 'number') return s;
    s = String(s || '').trim().replace(/\s|R\$/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isNaN(n) ? 0 : n;
  }
  function fmtNum(n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function dBR(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function dCurto(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function proxSabado(iso) { var wd = C.weekday(iso); return C.addDays(iso, (6 - wd + 7) % 7); }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  /* ---------- estado ---------- */
  function blank() { return { v: 1, updatedAt: 0, apagados: {}, diariasUpd: {}, perfilUpd: 0, perfil: { nome: '', codigo: '', cidade: 'TERESINA-PI' }, saldoInicial: null, recebidos: [], gastos: [], diarias: {}, previsoes: [] }; }
  function load() { try { var s = JSON.parse(lsGet(LS_STATE)); if (s && s.v) return Object.assign(blank(), s); } catch (e) { } return blank(); }
  var st = load(); st.perfil.codigo = ''; st.perfil.cidade = 'TERESINA-PI';
  function save() {
    try { var cur = JSON.parse(lsGet(LS_STATE)); if (cur && cur.v) st = merge(st, cur); } catch (e) { }
    st.updatedAt = Date.now(); lsSet(LS_STATE, JSON.stringify(st)); cloudPush();
  }
  function setDiaria(d, v) { if (v) st.diarias[d] = v; else delete st.diarias[d]; st.diariasUpd = st.diariasUpd || {}; st.diariasUpd[d] = Date.now(); }
  function apagar(lista, id) { st[lista] = st[lista].filter(function (x) { return x.id !== id; }); st.apagados = st.apagados || {}; st.apagados[id] = Date.now(); }
  /* junta dois estados (outro aparelho/aba/nuvem) sem perder lançamentos */
  function merge(a, b) {
    a = Object.assign(blank(), a); b = Object.assign(blank(), b);
    var out = blank(), ap = Object.assign({}, a.apagados || {});
    Object.keys(b.apagados || {}).forEach(function (k) { ap[k] = Math.max(ap[k] || 0, b.apagados[k]); });
    out.apagados = ap;
    ['gastos', 'recebidos', 'previsoes'].forEach(function (L) {
      var m = {}, ord = [];
      (a[L] || []).concat(b[L] || []).forEach(function (x) {
        var u = x.upd || x.criado || 0, cur = m[x.id];
        if (!cur) ord.push(x.id);
        if (!cur || u > (cur.upd || cur.criado || 0)) m[x.id] = x;
      });
      out[L] = ord.map(function (k) { return m[k]; }).filter(function (x) { return !ap[x.id]; });
    });
    var ad = a.diariasUpd || {}, bd = b.diariasUpd || {}, dv = {}, du = {}, ds = {};
    [a.diarias || {}, b.diarias || {}, ad, bd].forEach(function (o) { Object.keys(o).forEach(function (k) { ds[k] = 1; }); });
    Object.keys(ds).sort().forEach(function (d) {
      var ua = ad[d] || 0, ub = bd[d] || 0;
      if (!ua && !ub) { var v0 = (a.diarias || {})[d] || (b.diarias || {})[d]; if (v0) dv[d] = v0; return; }
      var v = (ub > ua ? b : a).diarias[d]; if (v) dv[d] = v; du[d] = Math.max(ua, ub);
    });
    out.diarias = dv; out.diariasUpd = du;
    var pa = a.perfilUpd || 0, pb = b.perfilUpd || 0, ps = pb > pa ? b : a;
    if (pa === pb && !(a.perfil && a.perfil.nome) && b.perfil && b.perfil.nome) ps = b;
    out.perfil = ps.perfil; out.saldoInicial = ps.saldoInicial; out.perfilUpd = Math.max(pa, pb);
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return out;
  }
  function softRender() { if (!sheet && view !== 'novaPrev' && logged) render(); }
  window.addEventListener('storage', function (e) {
    if (e.key !== LS_STATE || !e.newValue) return;
    try { var m = merge(st, JSON.parse(e.newValue)); if (JSON.stringify(m) !== JSON.stringify(st)) { st = m; softRender(); } } catch (x) { }
  });
  var logged = lsGet(LS_LOGIN) === '1';
  var hist = [], view = 'home', mesSel = null, fp = null, sheet = null;

  /* ---------- nuvem (conta claude.ai) e downloads ---------- */
  var cloud = { db: null, uid: null, assets: null, dl: null, status: 'local' };
  function ref() { return cloud.db.doc('data/users/' + cloud.uid + '/estado'); }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'timeout' }); }, ms); })]); }
  async function initCaps(tries) {
    if (!(window.claude && window.claude.use)) {
      if ((tries || 0) < 20) return setTimeout(function () { initCaps((tries || 0) + 1); }, 250);
      setSync(); return;
    }
    try { cloud.dl = await claude.use('downloads'); } catch (e) { }
    try {
      var user = await claude.use('user'), db = await claude.use('db');
      if (user && db) { var id = await user.id(); if (id) { cloud.db = db; cloud.uid = id; } }
    } catch (e) { }
    try { cloud.assets = await claude.use('assets'); } catch (e) { }
    if (cloud.db) await cloudPull();
    setSync(); render();
  }
  async function cloudPull() {
    cloud.status = 'saving'; setSync();
    try {
      var snap = await withTimeout(ref().get(), 10000);
      var d = snap.exists ? snap.data() : null;
      if (d && d.json) { st = merge(st, JSON.parse(d.json)); lsSet(LS_STATE, JSON.stringify(st)); }
      cloud.status = 'ok';
      if (!d || !d.json || JSON.stringify(st) !== JSON.stringify(merge(JSON.parse(d.json), {}))) doPush();
    } catch (e) { cloud.status = 'err'; }
    setSync();
    try {
      ref().onSnapshot(function (snap) {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        var d = snap.data(); if (!d || !d.json) return;
        var m = merge(st, JSON.parse(d.json));
        if (JSON.stringify(m) !== JSON.stringify(st)) { st = m; lsSet(LS_STATE, JSON.stringify(st)); softRender(); }
      }, function () { });
    } catch (e) { }
  }
  var pushT = null, pushing = false, again = false;
  function cloudPush() { if (!cloud.db) return; clearTimeout(pushT); pushT = setTimeout(doPush, 1200); }
  async function doPush() {
    if (!cloud.db) return;
    if (pushing) { again = true; return; }
    pushing = true; cloud.status = 'saving'; setSync();
    try {
      try {
        var snap = await withTimeout(ref().get(), 10000);
        if (snap.exists && snap.data() && snap.data().json) {
          var m = merge(st, JSON.parse(snap.data().json));
          if (JSON.stringify(m) !== JSON.stringify(st)) { st = m; lsSet(LS_STATE, JSON.stringify(st)); softRender(); }
        }
      } catch (e1) { }
      await ref().set({ json: JSON.stringify(st), updatedAt: st.updatedAt }); cloud.status = 'ok';
    }
    catch (e) { cloud.status = (e && e.code === 'quota_exceeded') ? 'cheio' : 'err'; }
    pushing = false; setSync();
    if (again) { again = false; doPush(); }
  }
  function syncTxt() {
    if (!cloud.db) return '📱 Salvo neste aparelho';
    return { ok: '☁️ Salvo na nuvem', saving: '⏳ Salvando…', err: '⚠️ Sem conexão – salvo no aparelho', cheio: '⚠️ Nuvem cheia', local: '📱 Neste aparelho' }[cloud.status] || '';
  }
  function setSync() { var e = $('#sync'); if (e) e.textContent = syncTxt(); }
  async function baixar(nome, data) {
    if (!cloud.dl) { // fora do claude.ai (ex.: GitHub Pages): download normal do navegador
      try {
        var blob = data instanceof Blob ? data : new Blob([data]);
        var u = URL.createObjectURL(blob), el = document.createElement('a');
        el.href = u; el.download = nome; document.body.appendChild(el); el.click(); el.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
        toast('Arquivo baixado'); return true;
      } catch (e) { toast('Não foi possível baixar o arquivo'); return false; }
    }
    try { await cloud.dl.save({ filename: nome, data: data }); toast('Arquivo baixado'); return true; }
    catch (e) { toast(e && e.code === 'declined' ? 'Download cancelado' : 'Não foi possível baixar (' + ((e && e.code) || 'erro') + ')'); return false; }
  }

  /* ---------- fotos (IndexedDB + nuvem) ---------- */
  var idbP = null;
  function idb() {
    if (!idbP) idbP = new Promise(function (res, rej) {
      try { var r = indexedDB.open('pcapp', 1); r.onupgradeneeded = function () { r.result.createObjectStore('fotos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }
      catch (e) { rej(e); }
    });
    return idbP;
  }
  async function fotoPut(id, blob) { try { var d = await idb(); await new Promise(function (res, rej) { var tx = d.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put(blob, id); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); return true; } catch (e) { return false; } }
  async function fotoGetLocal(id) { try { var d = await idb(); return await new Promise(function (res) { var rq = d.transaction('fotos').objectStore('fotos').get(id); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; }); } catch (e) { return null; } }
  async function fotoDel(id) { try { var d = await idb(); d.transaction('fotos', 'readwrite').objectStore('fotos').delete(id); } catch (e) { } }
  async function fotoBlob(g) {
    if (g.foto) { var b = await fotoGetLocal(g.foto); if (b) return b; }
    if (g.asset) { try { var r = await fetch('/_blob/' + g.asset); if (r.ok) return await r.blob(); } catch (e) { } }
    return null;
  }
  var urlCache = {};
  async function fotoUrl(g) {
    var k = g.foto || g.asset; if (!k) return null;
    if (urlCache[k]) return urlCache[k];
    if (g.foto) { var b = await fotoGetLocal(g.foto); if (b) return (urlCache[k] = URL.createObjectURL(b)); }
    if (g.asset) return (urlCache[k] = '/_blob/' + g.asset);
    return null;
  }
  async function hydrateThumbs() {
    var imgs = document.querySelectorAll('img[data-g]');
    for (var i = 0; i < imgs.length; i++) {
      var g = st.gastos.find(function (x) { return x.id === imgs[i].getAttribute('data-g'); });
      if (g) { var u = await fotoUrl(g); if (u) { imgs[i].src = u; imgs[i].style.display = ''; } }
    }
  }
  /* PDF escaneado → imagem (pdf.js carregado só quando precisa) */
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var pdfP = null;
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function pdfLib() {
    if (!pdfP) pdfP = loadScript(PDFJS + 'pdf.min.js').then(function () { return loadScript(PDFJS + 'pdf.worker.min.js'); })
      .then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; return window.pdfjsLib; })
      .catch(function (e) { pdfP = null; throw e; });
    return pdfP;
  }
  function ehPdf(file) { return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''); }
  async function pdfParaImagem(file) {
    var lib = await pdfLib();
    var doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    var n = Math.min(doc.numPages, 6), cs = [];
    for (var i = 1; i <= n; i++) {
      var page = await doc.getPage(i), v0 = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: Math.min(2, 1600 / Math.max(v0.width, v0.height)) });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise; cs.push(c);
    }
    var W = Math.max.apply(null, cs.map(function (c) { return c.width; })), H = cs.reduce(function (s, c) { return s + c.height; }, 0);
    var k = Math.min(1, 9000 / H), out = document.createElement('canvas');
    out.width = Math.round(W * k); out.height = Math.round(H * k);
    var o = out.getContext('2d'), y = 0; o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
    cs.forEach(function (c) { o.drawImage(c, 0, y, c.width * k, c.height * k); y += c.height * k; });
    return await new Promise(function (r) { out.toBlob(r, 'image/jpeg', 0.8); });
  }
  async function comprimir(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = url; });
      var w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, 1600 / Math.max(w, hh));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.72); });
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- campo de data com calendário ---------- */
  function dateField(id, v, fn, pre, post) {
    return '<button type="button" class="i dbtn" id="' + id + '" data-v="' + (v || '') + '"' + (fn ? ' data-fn="' + fn + '"' : '') +
      ' data-pre="' + h(JSON.stringify(pre || [])) + '" data-post="' + h(JSON.stringify(post || [])) + '" onclick="A.cal(this)">' +
      '<span>' + (v ? dBR(v) : 'Escolher') + '</span><span class="cico">📅</span></button>';
  }
  var MES_N = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var cal = null;
  function calRender() {
    var old = document.getElementById('calov'); if (old) old.remove();
    if (!cal) return;
    var y = cal.y, m = cal.m, first = C.weekday(y + '-' + C.pad(m) + '-01'), last = +C.ultimoDia(y, m).slice(8), hj = hoje();
    var cells = '';
    for (var i = 0; i < first; i++) cells += '<span></span>';
    for (var d = 1; d <= last; d++) {
      var iso = y + '-' + C.pad(m) + '-' + C.pad(d);
      cells += '<button class="cd' + (iso === cal.v ? ' sel' : '') + (iso === hj ? ' hj' : '') + '" onclick="A.calPick(\'' + iso + '\')">' + d + '</button>';
    }
    var div = document.createElement('div'); div.id = 'calov'; div.className = 'ov calov';
    div.onclick = function (e) { if (e.target === div) A.calFechar(); };
    div.innerHTML = '<div class="sheet cal"><div class="mnav"><button onclick="A.calMes(-1)">‹</button><b>' + MES_N[m - 1] + ' ' + y + '</b><button onclick="A.calMes(1)">›</button></div>' +
      '<div class="cgrid cw">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
      '<div class="cgrid">' + cells + '</div>' +
      '<div class="row"><button class="btn sec" onclick="A.calPick(\'' + hj + '\')">Hoje</button><button class="btn sec" onclick="A.calFechar()">Cancelar</button></div></div>';
    document.body.appendChild(div);
  }

  /* ---------- telas ---------- */
  function shell(body) {
    var tabs = [['home', '🏠', 'Início'], ['prevs', '📝', 'Previsões'], ['prest', '📊', 'Prestação'], ['ajustes', '⚙️', 'Ajustes']];
    var back = view !== 'home' ? '<button class="voltar" onclick="A.voltar()">‹ Voltar</button>' : '';
    return '<header class="top">' + back + '<h1>EquipPEP</h1><span class="sync" id="sync">' + syncTxt() + '</span></header>' +
      '<div class="wrap">' + body + '</div>' +
      '<nav class="bot">' + tabs.map(function (t) { return '<button class="' + (view === t[0] ? 'on' : '') + '" onclick="A.go(\'' + t[0] + '\')"><span class="ic">' + t[1] + '</span>' + t[2] + '</button>'; }).join('') + '</nav>';
  }
  function vLogin() {
    return '<div class="login"><div class="logo">💼</div><h2 style="text-align:center">EquipPEP</h2><p class="muted" style="text-align:center">Previsão e prestação de contas · Engemaximo<br>versão de teste</p>' +
      '<label class="f">Usuário</label><input class="i" id="lu" autocomplete="username" autocapitalize="none">' +
      '<label class="f">Senha</label><input class="i" id="lp" type="password" autocomplete="current-password">' +
      '<div class="err" id="le"></div><button class="btn" onclick="A.login()">Entrar</button></div>';
  }
  function vSetup() {
    var ult = C.addDays(hoje().slice(0, 8) + '01', -1);
    return '<header class="top"><h1>Primeiro acesso</h1></header><div class="wrap">' +
      '<div class="card"><h3 style="margin-top:0">Seus dados</h3><p class="muted">Só o que vai no cabeçalho das planilhas.</p>' +
      '<label class="f">Seu nome completo (líder da equipe)</label><input class="i" id="s_nome">' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">Saldo que ficou com você</h3><p class="muted">O saldo final da última prestação entregue (do mês passado). Se não tiver, deixe 0. Depois lance os gastos deste mês.</p>' +
      '<div class="row"><div><label class="f">Valor (R$)</label><input class="i" id="s_sal" inputmode="decimal" value="0,00"></div>' +
      '<div><label class="f">Data do saldo</label>' + dateField('s_sald', ult) + '</div></div></div>' +
      '<button class="btn" onclick="A.setup()">Começar</button></div>';
  }
  function itemGasto(g) {
    var c = CAT[g.cat];
    var foto = (g.foto || g.asset) ? '<img class="thumb" data-g="' + g.id + '" style="display:none" alt="">' : '<span class="ib" title="Sem foto">📷</span>';
    return '<div class="it" onclick="A.gasto(\'' + g.id + '\')" style="cursor:pointer">' + foto +
      '<div class="tt"><b>' + c.ic + ' ' + h(g.classe || c.n) + '</b><span class="muted">' + dBR(g.data) + ' · ' + c.n + '</span></div>' +
      '<span class="vv neg">-' + money(g.valor) + '</span></div>';
  }
  function itemRec(r) {
    return '<div class="it" onclick="A.receb(\'' + r.id + '\')" style="cursor:pointer"><span class="ib">💵</span><div class="tt"><b>' + h(r.tipo) + '</b><span class="muted">' + dBR(r.data) + '</span></div><span class="vv pos">+' + money(r.valor) + '</span></div>';
  }
  /* diárias lançadas depois do último depósito confirmado (zera a cada novo depósito) */
  function ultimoReceb() {
    return st.recebidos.slice().sort(function (x, y) { return (y.criado || 0) - (x.criado || 0); })[0] || null;
  }
  function diariasDesde(ts) {
    var tot = 0, nD = 0, nM = 0, du = st.diariasUpd || {};
    Object.keys(st.diarias).forEach(function (d) {
      if ((du[d] || 0) <= ts) return;
      var v = C.valorDiaria(st.diarias[d]); tot += v; if (v === C.DIARIA) nD++; else if (v) nM++;
    });
    return { tot: C.r2(tot), txt: fmtQtd(nD, nM) };
  }
  function fmtQtd(nD, nM) {
    var t = [nD ? nD + (nD > 1 ? ' diárias' : ' diária') : '', nM ? nM + (nM > 1 ? ' meias' : ' meia') : ''].filter(Boolean).join(' + ');
    return t || 'nenhuma lançada';
  }
  function qtdDiarias(ini, fim) {
    var nD = 0, nM = 0;
    Object.keys(st.diarias).forEach(function (d) { if (d >= ini && d <= fim) { if (st.diarias[d] === 'DIÁRIA') nD++; else if (st.diarias[d] === 'MEIA DIÁRIA') nM++; } });
    var t = [nD ? nD + (nD > 1 ? ' diárias' : ' diária') : '', nM ? nM + (nM > 1 ? ' meias' : ' meia') : ''].filter(Boolean).join(' + ');
    return t || 'nenhuma lançada';
  }
  function vHome() {
    var hj = hoje();
    var ano = +hj.slice(0, 4), mes = +hj.slice(5, 7), P = C.montarPrestacao(st, ano, mes);
    var mesN = C.MESES[mes - 1].charAt(0) + C.MESES[mes - 1].slice(1).toLowerCase();
    var gastoSemD = C.r2(P.tot.comb + P.tot.hosp + P.tot.div), saldoSemD = C.r2(P.recebido - gastoSemD);
    var ur = ultimoReceb(), dd = diariasDesde(ur ? (ur.criado || 0) : 0);
    var b = '<div class="grid2 saldos">' +
      '<div class="card saldo"><div class="lbl">Saldo − Diárias</div><div class="val">' + money(P.saldo) + '</div>' +
      '<div class="sub">diárias do mês ' + money(P.tot.dia) + '</div></div>' +
      '<div class="card saldo dia" onclick="A.go(\'prest\')" style="cursor:pointer"><div class="lbl">Diárias</div><div class="val">' + money(dd.tot) + '</div>' +
      '<div class="sub">' + dd.txt + (ur ? '<br>desde o depósito de ' + dCurto(ur.data) : '') + '</div></div></div>' +
      '<div class="card fech"><span>' + mesN + ': saldo<br><small class="muted">recebido ' + money(P.recebido) + ' · gastos ' + money(gastoSemD) + '</small></span><b>' + money(saldoSemD) + '</b></div>';
    var pv = (st.previsoes || []).filter(function (p) { return p.fim >= hj; }).sort(function (a, b) { return a.ini < b.ini ? -1 : 1; })[0];
    if (pv) {
      var c = C.calcPrevisao(pv, pv.saldoUsado);
      b += '<div class="card"><div class="muted">' + (pv.ini <= hj ? 'Semana em andamento' : 'Próxima semana') + '</div><b>' + dCurto(pv.ini) + ' a ' + dCurto(pv.fim) + ' · ' + h(pv.local) + '</b>' +
        '<div class="muted">' + pv.equipe.map(h).join(', ') + '</div>' +
        (pv.depositoRecebido ? '<div class="muted" style="margin-top:6px">✅ Depósito recebido</div>' :
          (c.dep1 > 0 ? '<button class="btn sec" onclick="A.recebiDep(\'' + pv.id + '\')">Recebi o depósito de ' + money(c.dep1) + '</button>' : '')) + '</div>';
    }
    b += '<div class="grid2">' +
      '<button class="big" onclick="A.novaPrev()"><span class="ic">📝</span>Nova previsão</button>' +
      '<button class="big" onclick="A.gasto()"><span class="ic">⛽</span>Lançar gasto</button>' +
      '<button class="big" onclick="A.receb()"><span class="ic">💵</span>Recebi dinheiro</button>' +
      '<button class="big" onclick="A.go(\'prest\')"><span class="ic">📊</span>Prestação do mês</button></div>';
    var ult = st.gastos.map(function (g) { return { t: 'g', d: g.data, o: g, k: g.criado || 0 }; })
      .concat(st.recebidos.map(function (r) { return { t: 'r', d: r.data, o: r, k: r.criado || 0 }; }))
      .sort(function (a, b) { return b.k - a.k; }).slice(0, 6);
    var ini = P.ini, fim = P.fim, nD = 0, nM = 0;
    Object.keys(st.diarias).forEach(function (d) { if (d >= ini && d <= fim) { if (st.diarias[d] === 'DIÁRIA') nD++; else if (st.diarias[d] === 'MEIA DIÁRIA') nM++; } });
    var itDia = (nD || nM) ? '<div class="it" onclick="A.go(\'prest\')" style="cursor:pointer"><span class="ib">📅</span><div class="tt"><b>Diárias de ' + C.MESES[mes - 1].charAt(0) + C.MESES[mes - 1].slice(1).toLowerCase() + '</b><span class="muted">' +
      [nD ? nD + (nD > 1 ? ' diárias' : ' diária') : '', nM ? nM + (nM > 1 ? ' meias' : ' meia') : ''].filter(Boolean).join(' + ') + '</span></div><span class="vv neg">-' + money(P.tot.dia) + '</span></div>' : '';
    b += '<h3>Últimos lançamentos</h3><div class="card list">' + itDia + (ult.length ? ult.map(function (x) { return x.t === 'g' ? itemGasto(x.o) : itemRec(x.o); }).join('') : (itDia ? '' : '<p class="muted" style="margin:0">Nada lançado ainda.</p>')) + '</div>';
    return shell(b);
  }

  /* previsão */
  function novoFp() {
    var ini = proxSabado(hoje());
    return { ini: ini, fim: C.addDays(ini, 6), local: '', equipe: [st.perfil.nome || ''], combQtd: '200', combUnit: '7,00', km: '', hospQtd: '0', hospUnit: '', diversas: '0,00', projeto: '', cliente: '' };
  }
  function fpObj() {
    return {
      ini: fp.ini, fim: fp.fim, local: fp.local.trim(), equipe: fp.equipe.map(function (s) { return s.trim(); }),
      combQtd: num(fp.combQtd), combUnit: num(fp.combUnit), km: fp.km ? num(fp.km) : '', hospQtd: num(fp.hospQtd),
      hospUnit: fp.hospUnit === '' ? null : num(fp.hospUnit), diversas: num(fp.diversas), projeto: fp.projeto.trim(), cliente: fp.cliente.trim()
    };
  }
  function resumoPrev() {
    var p = fpObj();
    if (!p.ini || !p.fim || p.fim < p.ini) return '<p class="err">Confira o período: a data final está antes da inicial.</p>';
    var saldo = C.saldoAte(st, p.ini), c = C.calcPrevisao(p, saldo);
    var s = '<div class="sum"><span>Combustível</span><b>' + money(c.L.comb) + '</b></div>' +
      '<div class="sum"><span>Diárias (' + c.dias + ' dias × ' + c.n + ' pessoa' + (c.n > 1 ? 's' : '') + ')</span><b>' + money(c.L.d1 + c.L.d2 + c.L.d3 + c.L.d4) + '</b></div>' +
      (c.L.hosp ? '<div class="sum"><span>Hospedagem</span><b>' + money(c.L.hosp) + '</b></div>' : '') +
      (c.L.div ? '<div class="sum"><span>Diversas</span><b>' + money(c.L.div) + '</b></div>' : '') +
      '<div class="sum t"><span>Total da previsão</span><span>' + money(c.total) + '</span></div>' +
      '<div class="sum"><span>Saldo que já está com você</span><b class="' + (saldo >= 0 ? 'neg' : 'pos') + '">' + (saldo >= 0 ? '-' : '+') + money(Math.abs(saldo)) + '</b></div>';
    s += '<div class="dep"><b>Depósitos</b>' + p.equipe.map(function (n, i) {
      var v = c.deps[i] || 0;
      return '<div class="sum"><span>' + h(n || ('Colaborador ' + (i + 1))) + '</span><b>' + (v > 0 ? money(v) : 'nada a depositar') + '</b></div>';
    }).join('') + '</div>';
    return s;
  }
  function vNovaPrev() {
    var n = fp.equipe.length, dias = (fp.ini && fp.fim && fp.fim >= fp.ini) ? C.diasEntre(fp.ini, fp.fim) : 0;
    var b = '<h2>Nova previsão</h2><p class="muted">Semana de sábado a sexta. Mude as datas só se for diferente.</p>' +
      '<div class="card"><div class="row"><div><label class="f">Início</label>' + dateField('p_ini', fp.ini, 'fpIni') + '</div>' +
      '<div><label class="f">Fim</label>' + dateField('p_fim', fp.fim, 'fpSet', ['fim'], [true]) + '</div></div>' +
      '<p class="muted" style="margin:8px 0 0">' + dias + ' dias de serviço</p>' +
      '<label class="f">Local (cidade-UF)</label><input class="i" value="' + h(fp.local) + '" placeholder="Ex.: Goiânia-GO" oninput="A.fpSet(\'local\',this.value)"></div>' +
      '<div class="card"><label class="f" style="margin-top:0">Quantas pessoas na equipe?</label><div class="stepper"><button onclick="A.fpN(-1)">−</button><span>' + n + '</span><button onclick="A.fpN(1)">+</button></div>' +
      fp.equipe.map(function (nm, i) { return '<label class="f">' + (i === 0 ? 'Você (líder)' : 'Pessoa ' + (i + 1)) + '</label><input class="i" value="' + h(nm) + '" placeholder="Nome completo" oninput="A.fpEq(' + i + ',this.value)">'; }).join('') + '</div>' +
      '<div class="card"><b>Combustível</b><div class="row"><div><label class="f">Litros</label><input class="i" inputmode="decimal" value="' + h(fp.combQtd) + '" oninput="A.fpSet(\'combQtd\',this.value)"></div>' +
      '<div><label class="f">R$ por litro</label><input class="i" inputmode="decimal" value="' + h(fp.combUnit) + '" oninput="A.fpSet(\'combUnit\',this.value)"></div></div>' +
      '<details><summary>Mais opções (hospedagem, km, projeto…)</summary>' +
      '<div class="row"><div><label class="f">Diárias de hotel</label><input class="i" inputmode="numeric" value="' + h(fp.hospQtd) + '" oninput="A.fpSet(\'hospQtd\',this.value)"></div>' +
      '<div><label class="f">R$ por diária de hotel</label><input class="i" inputmode="decimal" placeholder="' + fmtNum(C.HOTEL * n) + '" value="' + h(fp.hospUnit) + '" oninput="A.fpSet(\'hospUnit\',this.value)"></div></div>' +
      '<label class="f">Despesas diversas (R$)</label><input class="i" inputmode="decimal" value="' + h(fp.diversas) + '" oninput="A.fpSet(\'diversas\',this.value)">' +
      '<label class="f">Deslocamento (km)</label><input class="i" inputmode="numeric" value="' + h(fp.km) + '" oninput="A.fpSet(\'km\',this.value)">' +
      '<label class="f">Projeto</label><input class="i" value="' + h(fp.projeto) + '" placeholder="Ex.: Comissionamento/Manutenção" oninput="A.fpSet(\'projeto\',this.value)">' +
      '<label class="f">Cliente</label><input class="i" value="' + h(fp.cliente) + '" placeholder="Ex.: Equatorial" oninput="A.fpSet(\'cliente\',this.value)">' +
      '</details></div>' +
      '<div class="card" id="resumo">' + resumoPrev() + '</div>' +
      '<button class="btn lar" onclick="A.salvarPrev()">Salvar previsão</button>' +
      '<button class="btn sec" onclick="A.go(\'prevs\')">Cancelar</button>';
    return shell(b);
  }
  function vPrevs() {
    var ps = (st.previsoes || []).slice().sort(function (a, b) { return a.ini < b.ini ? 1 : -1; });
    var b = '<h2>Previsões</h2><button class="btn lar" onclick="A.novaPrev()">📝 Nova previsão</button>';
    b += ps.length ? ps.map(function (p) {
      var c = C.calcPrevisao(p, p.saldoUsado);
      return '<div class="card"><b>' + dCurto(p.ini) + ' a ' + dCurto(p.fim) + ' · ' + h(p.local) + '</b><div class="muted">' + p.equipe.map(h).join(', ') + '</div>' +
        '<div class="sum"><span>Total</span><b>' + money(c.total) + '</b></div><div class="sum"><span>Seu depósito</span><b>' + (c.dep1 > 0 ? money(c.dep1) : '—') + '</b></div>' +
        (p.depositoRecebido ? '<div class="muted">✅ Depósito recebido</div>' : (c.dep1 > 0 ? '<button class="btn sec" onclick="A.recebiDep(\'' + p.id + '\')">Recebi o depósito</button>' : '')) +
        '<div class="row"><button class="btn" onclick="A.baixarPrev(\'' + p.id + '\')">⬇️ Planilha</button><button class="btn vm" onclick="A.excluirPrev(\'' + p.id + '\')">Excluir</button></div></div>';
    }).join('') : '<p class="muted">Nenhuma previsão ainda.</p>';
    return shell(b);
  }

  /* prestação */
  function vPrest() {
    if (!mesSel) mesSel = { ano: +hoje().slice(0, 4), mes: +hoje().slice(5, 7) };
    var a = mesSel.ano, m = mesSel.mes, P = C.montarPrestacao(st, a, m);
    var ini = P.ini, fim = P.fim;
    var b = '<div class="mnav" style="margin-top:8px"><button onclick="A.mes(-1)">‹</button><b>' + C.MESES[m - 1] + ' ' + a + '</b><button onclick="A.mes(1)">›</button></div>' +
      '<div class="card"><div class="sum"><span>Recebido</span><b class="pos">' + money(P.recebido) + '</b></div><div class="sum"><span>Gasto</span><b class="neg">' + money(P.despesas) + '</b></div>' +
      '<div class="sum t"><span>Saldo</span><span>' + money(P.saldo) + '</span></div>' +
      (P.receb.length > 12 || P.linhas.length > 62 ? '<div class="banner">A planilha só tem espaço para 12 recebimentos e 62 linhas de despesa. Este mês passou do limite.</div>' : '') + '</div>' +
      '<button class="btn lar" onclick="A.baixarPrest()">⬇️ Baixar planilha de prestação</button>' +
      '<button class="btn sec" onclick="A.baixarPdf()">📎 Baixar fotos das notas (PDF)</button>';
    var recMes = st.recebidos.filter(function (x) { return x.data >= ini && x.data <= fim; }).sort(function (x, y) { return x.data < y.data ? -1 : x.data > y.data ? 1 : (x.criado || 0) - (y.criado || 0); });
    var sAnt = P.receb.length && P.receb[0].tipo === 'SALDO' ? P.receb[0] : null;
    b += '<h3>Recebimentos</h3><div class="card list">' + (sAnt || recMes.length ?
      (sAnt ? '<div class="it"><span class="ib">↩️</span><div class="tt"><b>Saldo do mês anterior</b><span class="muted">' + dBR(sAnt.data) + '</span></div><span class="vv">' + money(sAnt.valor) + '</span></div>' : '') +
      recMes.map(itemRec).join('') : '<p class="muted" style="margin:0">Nada recebido neste mês.</p>') + '<button class="btn sec" onclick="A.receb()">+ Recebi dinheiro</button></div>';
    var datas = {};
    Object.keys(st.diarias).forEach(function (d) { if (d >= ini && d <= fim && st.diarias[d]) datas[d] = 1; });
    st.gastos.forEach(function (g) { if (g.data >= ini && g.data <= fim) datas[g.data] = 1; });
    var ds = Object.keys(datas).sort();
    b += '<h3>Dias e gastos</h3><p class="muted" style="margin:0">Toque na diária para trocar: Diária → Meia → Sem diária.</p><div class="card">' +
      (ds.length ? ds.map(function (d) {
        var di = st.diarias[d];
        var chip = '<button class="dchip ' + (di === 'DIÁRIA' ? 'd' : di === 'MEIA DIÁRIA' ? 'm' : '') + '" onclick="A.ciclaDiaria(\'' + d + '\')">' + (di === 'DIÁRIA' ? 'Diária R$ 60' : di === 'MEIA DIÁRIA' ? 'Meia R$ 30' : 'Sem diária') + '</button>';
        var gs = st.gastos.filter(function (g) { return g.data === d; });
        return '<div class="day">' + DSEM[C.weekday(d)] + ' ' + dCurto(d) + ' ' + chip + '</div><div class="list">' + gs.map(itemGasto).join('') + '</div>';
      }).join('') : '<p class="muted" style="margin:0">Nenhum dia com diária ou gasto. Lance as diárias em Lançar gasto → Diária.</p>') +
      '<div class="row"><button class="btn sec" onclick="A.gasto()">+ Gasto</button><button class="btn sec" onclick="A.addDiaria()">+ Diária</button></div></div>';
    return shell(b);
  }
  function vAjustes() {
    var si = st.saldoInicial || { valor: 0, data: C.addDays(hoje().slice(0, 8) + '01', -1) };
    var b = '<h2>Ajustes</h2><div class="card"><label class="f" style="margin-top:0">Seu nome completo</label><input class="i" id="a_nome" value="' + h(st.perfil.nome) + '">' +
      '<div class="row"><div><label class="f">Saldo inicial (R$)</label><input class="i" id="a_sal" inputmode="decimal" value="' + fmtNum(si.valor) + '"></div><div><label class="f">Até o dia</label>' + dateField('a_sald', si.data) + '</div></div>' +
      '<button class="btn" onclick="A.salvarAjustes()">Salvar</button></div>' +
      '<div class="card"><b>Cópia de segurança</b><p class="muted">' + (cloud.db ? 'Seus lançamentos já ficam salvos na sua conta. ' : '') + 'O backup leva tudo, inclusive as fotos, num arquivo que você pode guardar no Drive ou no WhatsApp.</p>' +
      '<button class="btn sec" onclick="A.backup()">⬇️ Baixar backup</button>' +
      '<label class="btn sec" style="text-align:center">⬆️ Restaurar backup<input type="file" accept=".json,application/json" style="display:none" onchange="A.restaurar(this.files[0])"></label></div>' +
      '<button class="btn vm" onclick="A.sair()">Sair</button>' +
      '<p class="muted" style="text-align:center;margin-top:16px">Versão de teste · login provisório</p>';
    return shell(b);
  }

  /* folhas (modais) */
  function vSheet() {
    if (!sheet) return '';
    var s = sheet, b = '';
    if (s.tipo === 'gasto') {
      var g = s.g;
      b = '<h2 style="margin-top:0">' + (s.edit ? 'Editar gasto' : 'Lançar gasto') + '</h2>' +
        '<div class="chips">' + (s.edit ? ['COMB', 'HOSP', 'DIV'] : ['DIA', 'COMB', 'HOSP', 'DIV']).map(function (k) { return '<button class="chip ' + (g.cat === k ? 'on' : '') + '" onclick="A.gCat(\'' + k + '\')">' + CAT[k].ic + ' ' + CAT[k].n + '</button>'; }).join('') + '</div>';
      if (g.cat === 'DIA') {
        var dOpts = [['DIÁRIA', 'Diária R$ 60'], ['MEIA DIÁRIA', 'Meia R$ 30'], ['NENHUMA', 'Sem diária']];
        b += '<label class="f">Dia</label>' + dateField('g_dia', g.data, 'gDiaData') + '' +
          '<label class="f">Diária desse dia</label><div class="chips">' + dOpts.map(function (o) { return '<button class="chip ' + (g.classe === o[0] ? 'on' : '') + '" onclick="A.gSet(\'classe\',\'' + o[0] + '\',true)">' + o[1] + '</button>'; }).join('') + '</div>' +
          
          '<button class="btn vd" onclick="A.gSalvarDiaria()">Salvar</button><button class="btn sec" onclick="A.fechar()">Cancelar</button>';
        return '<div class="ov" onclick="if(event.target===this)A.fechar()"><div class="sheet">' + b + '</div></div>';
      }
      if (g.cat === 'COMB') b += '<label class="f">Tipo</label><div class="chips">' + CLASSES_COMB.map(function (c) { return '<button class="chip ' + (g.classe === c ? 'on' : '') + '" onclick="A.gSet(\'classe\',\'' + c + '\',true)">' + c.charAt(0) + c.slice(1).toLowerCase() + '</button>'; }).join('') + '</div>';
      if (g.cat === 'HOSP') b += '<label class="f">Para quantas pessoas</label><div class="chips">' + CLASSES_HOSP.map(function (c, i) { return '<button class="chip ' + (g.classe === c ? 'on' : '') + '" onclick="A.gSet(\'classe\',\'' + c + '\',true)">' + (i + 1) + ' pessoa' + (i ? 's' : '') + '</button>'; }).join('') + '</div>';
      if (g.cat === 'DIV') b += '<label class="f">O que foi</label><input class="i" id="g_desc" value="' + h(g.classe || '') + '" placeholder="Ex.: Pedágio" oninput="A.gSet(\'classe\',this.value)"><div class="chips" style="margin-top:8px">' + SUG_DIV.map(function (c) { return '<button class="chip" onclick="A.gSet(\'classe\',\'' + c + '\',true)">' + c.charAt(0) + c.slice(1).toLowerCase() + '</button>'; }).join('') + '</div>';
      b += '<div class="row"><div><label class="f">Valor (R$)</label><input class="i" id="g_val" inputmode="decimal" placeholder="0,00" value="' + h(g.valorTxt || '') + '" oninput="A.gSet(\'valorTxt\',this.value)"></div>' +
        '<div><label class="f">Data</label>' + dateField('g_data', g.data, 'gSet', ['data']) + '</div></div>' +
        '<label class="f">' + (s.prev || g.foto || g.asset ? 'Trocar foto da nota' : 'Foto da nota') + '</label><div class="row">' +
        '<label class="btn sec" style="text-align:center;margin-top:0">📷 Tirar foto<input type="file" accept="image/*" capture="environment" style="display:none" onchange="A.gFoto(this.files[0])"></label>' +
        '<label class="btn sec" style="text-align:center;margin-top:0">📁 Galeria ou PDF<input type="file" accept="image/*,application/pdf,.pdf" style="display:none" onchange="A.gFoto(this.files[0])"></label></div>' +
        (s.prev ? '<img class="foto" src="' + s.prev + '" alt="">' : ((g.foto || g.asset) ? '<img class="foto" data-g="' + g.id + '" style="display:none" alt="">' : '')) +
        '<div class="err" id="g_err"></div>' +
        '<button class="btn vd" onclick="A.gSalvar()">Salvar</button>' +
        (s.edit ? '<button class="btn vm" onclick="A.gExcluir()">Excluir gasto</button>' : '') +
        '<button class="btn sec" onclick="A.fechar()">Cancelar</button>';
    } else if (s.tipo === 'receb') {
      var r = s.r;
      b = '<h2 style="margin-top:0">' + (s.edit ? 'Editar recebimento' : 'Recebi dinheiro') + '</h2><div class="chips">' +
        TIPOS_REC.map(function (t) { return '<button class="chip ' + (r.tipo === t ? 'on' : '') + '" onclick="A.rSet(\'tipo\',\'' + t + '\',true)">' + t.charAt(0) + t.slice(1).toLowerCase() + '</button>'; }).join('') + '</div>' +
        '<div class="row"><div><label class="f">Valor (R$)</label><input class="i" inputmode="decimal" placeholder="0,00" value="' + h(r.valorTxt || '') + '" oninput="A.rSet(\'valorTxt\',this.value)"></div>' +
        '<div><label class="f">Data</label>' + dateField('r_data', r.data, 'rSet', ['data']) + '</div></div>' +
        '<div class="err" id="r_err"></div><button class="btn vd" onclick="A.rSalvar()">Salvar</button>' +
        (s.edit ? '<button class="btn vm" onclick="A.rExcluir()">Excluir</button>' : '') +
        '<button class="btn sec" onclick="A.fechar()">Cancelar</button>';
    } else if (s.tipo === 'diaria') {
      b = '<h2 style="margin-top:0">Adicionar diária</h2><label class="f">Dia</label>' + dateField('d_dia', hoje()) + '' +
        '<div class="chips" style="margin-top:12px"><button class="chip on" id="d_t1" onclick="A.dTipo(1)">Diária R$ 60</button><button class="chip" id="d_t2" onclick="A.dTipo(2)">Meia R$ 30</button></div>' +
        '<button class="btn vd" onclick="A.dSalvar()">Adicionar</button><button class="btn sec" onclick="A.fechar()">Cancelar</button>';
    } else if (s.tipo === 'confirm') {
      b = '<h2 style="margin-top:0">' + h(s.titulo) + '</h2><p>' + h(s.msg) + '</p><button class="btn vm" onclick="A.confirmOk()">' + h(s.ok || 'Confirmar') + '</button><button class="btn sec" onclick="A.fechar()">Cancelar</button>';
    }
    return '<div class="ov" onclick="if(event.target===this)A.fechar()"><div class="sheet">' + b + '</div></div>';
  }

  function render() {
    var app = $('#app');
    if (!logged) { app.innerHTML = vLogin(); bindLogin(); return; }
    if (!st.perfil.nome) { app.innerHTML = vSetup(); return; }
    var body = view === 'prevs' ? vPrevs() : view === 'novaPrev' ? vNovaPrev() : view === 'prest' ? vPrest() : view === 'ajustes' ? vAjustes() : vHome();
    app.innerHTML = body + vSheet();
    hydrateThumbs();
  }
  function rerenderSheet() {
    var ov = document.querySelector('.ov'); if (ov) ov.remove();
    if (sheet) { var d = document.createElement('div'); d.innerHTML = vSheet(); document.body.querySelector('#app').appendChild(d.firstChild); hydrateThumbs(); }
  }
  function bindLogin() {
    ['#lu', '#lp'].forEach(function (s) { var e = $(s); if (e) e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') A.login(); }); });
  }

  /* ---------- ações ---------- */
  var confirmCb = null;
  function confirmar(titulo, msg, ok, cb) { sheet = { tipo: 'confirm', titulo: titulo, msg: msg, ok: ok }; confirmCb = cb; rerenderSheet(); }
  var A = window.A = {
    cal: function (el) {
      var v = el.dataset.v || hoje();
      cal = { el: el, v: el.dataset.v, y: +v.slice(0, 4), m: +v.slice(5, 7) }; calRender();
    },
    calMes: function (d) { cal.m += d; if (cal.m < 1) { cal.m = 12; cal.y--; } if (cal.m > 12) { cal.m = 1; cal.y++; } calRender(); },
    calFechar: function () { cal = null; calRender(); },
    calPick: function (iso) {
      var el = cal.el; cal = null; calRender();
      el.dataset.v = iso; el.firstChild.textContent = dBR(iso);
      var fn = el.dataset.fn;
      if (fn && A[fn]) A[fn].apply(null, JSON.parse(el.dataset.pre || '[]').concat([iso]).concat(JSON.parse(el.dataset.post || '[]')));
    },
    login: function () {
      var u = $('#lu').value.trim(), p = $('#lp').value;
      if (u === USER && p === PASS) { logged = true; lsSet(LS_LOGIN, '1'); view = 'home'; render(); }
      else $('#le').textContent = 'Usuário ou senha incorretos';
    },
    sair: function () { logged = false; lsDel(LS_LOGIN); render(); },
    setup: function () {
      var nome = $('#s_nome').value.trim(); if (!nome) { toast('Digite seu nome'); return; }
      st.perfilUpd = Date.now(); st.perfil = { nome: nome, codigo: '', cidade: 'TERESINA-PI' };
      var v = num($('#s_sal').value); st.saldoInicial = v ? { valor: v, data: $('#s_sald').dataset.v || C.addDays(hoje(), -1) } : null;
      save(); render();
    },
    go: function (v) { if (v !== view) hist.push(view); if (v === 'home') hist = []; view = v; sheet = null; render(); window.scrollTo(0, 0); },
    voltar: function () { if (sheet) return A.fechar(); view = hist.pop() || 'home'; if (view === 'novaPrev' && !fp) view = 'prevs'; render(); window.scrollTo(0, 0); },
    mes: function (d) { var m = mesSel.mes + d, a = mesSel.ano; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } mesSel = { ano: a, mes: m }; render(); },

    /* previsão */
    novaPrev: function () { fp = novoFp(); A.go('novaPrev'); },
    fpSet: function (k, v, full) { fp[k] = v; if (full) render(); else { var r = $('#resumo'); if (r) r.innerHTML = resumoPrev(); } },
    fpIni: function (v) { fp.ini = v; if (v) fp.fim = C.addDays(v, 6); render(); },
    fpN: function (d) { var n = Math.max(1, Math.min(4, fp.equipe.length + d)); while (fp.equipe.length < n) fp.equipe.push(''); fp.equipe.length = n; render(); },
    fpEq: function (i, v) { fp.equipe[i] = v; var r = $('#resumo'); if (r) r.innerHTML = resumoPrev(); },
    salvarPrev: async function () {
      var p = fpObj();
      if (!p.ini || !p.fim || p.fim < p.ini) return toast('Confira as datas do período');
      if (!p.local) return toast('Digite o local');
      if (p.equipe.some(function (n) { return !n; })) return toast('Preencha o nome de todos da equipe');
      p.id = uid(); p.criado = Date.now(); p.upd = Date.now(); p.criadoDia = hoje(); p.saldoUsado = C.saldoAte(st, p.ini); p.depositoRecebido = false;
      st.previsoes.push(p); save();
      view = 'prevs'; render(); window.scrollTo(0, 0);
      toast('Previsão salva. Para baixar a planilha, toque em ⬇️ Planilha.');
    },
    baixarPrev: async function (id) {
      var p = st.previsoes.find(function (x) { return x.id === id; }); if (!p) return;
      try {
        var r = await C.gerarPrevisao(JSZip, tpl().pd, st.perfil, p, p.saldoUsado, p.criadoDia || hoje(), 'blob');
        var nomes = p.equipe.map(function (n) { return n.split(/\s+/).slice(0, 2).join(' '); }).join(' ');
        var m = +p.ini.slice(5, 7);
        await baixar(slug('PREVISAO DE DESPESAS ' + nomes + ' ' + C.MESES[m - 1] + ' ' + p.ini.slice(0, 4) + ' ' + dCurto(p.ini).replace('/', '-')) + '.xlsx', r.data);
      } catch (e) { toast('Erro ao gerar a planilha: ' + (e.message || e)); }
    },
    recebiDep: function (id) {
      var p = st.previsoes.find(function (x) { return x.id === id; }); if (!p) return;
      var c = C.calcPrevisao(p, p.saldoUsado);
      sheet = { tipo: 'receb', edit: false, depDe: id, r: { id: uid(), tipo: 'DEPÓSITO CAJU', valorTxt: fmtNum(c.dep1), data: hoje() } }; rerenderSheet();
    },
    excluirPrev: function (id) {
      confirmar('Excluir previsão?', 'Os gastos e diárias lançados continuam na prestação.', 'Excluir', function () {
        var p = st.previsoes.find(function (x) { return x.id === id; }); if (!p) return;
        apagar('previsoes', id); save(); render();
      });
    },

    /* gastos */
    gasto: function (id) {
      var g0 = id && st.gastos.find(function (x) { return x.id === id; });
      sheet = g0 ? { tipo: 'gasto', edit: true, g: Object.assign({}, g0, { valorTxt: fmtNum(g0.valor) }) }
        : { tipo: 'gasto', edit: false, g: { id: uid(), cat: 'DIA', classe: st.diarias[hoje()] || 'DIÁRIA', valorTxt: '', data: hoje() } };
      rerenderSheet();
    },
    gCat: function (k) { sheet.g.cat = k; sheet.g.classe = k === 'DIA' ? (st.diarias[sheet.g.data] || 'DIÁRIA') : ''; rerenderSheet(); },
    gDiaData: function (v) { sheet.g.data = v; sheet.g.classe = st.diarias[v] || 'DIÁRIA'; rerenderSheet(); },
    gSalvarDiaria: function () {
      var g = sheet.g; if (!g.data) return;
      setDiaria(g.data, g.classe === 'NENHUMA' ? null : g.classe); save(); sheet = null; render();
      toast(g.classe === 'NENHUMA' ? 'Diária removida de ' + dCurto(g.data) : (g.classe === 'MEIA DIÁRIA' ? 'Meia diária' : 'Diária') + ' salva em ' + dCurto(g.data));
    },
    gSet: function (k, v, re) { sheet.g[k] = v; if (re) rerenderSheet(); },
    gFoto: async function (file) {
      if (!file) return;
      if (ehPdf(file)) toast('Lendo o PDF…');
      try { var b = ehPdf(file) ? await pdfParaImagem(file) : await comprimir(file); sheet.blob = b; if (sheet.prev) URL.revokeObjectURL(sheet.prev); sheet.prev = URL.createObjectURL(b); rerenderSheet(); }
      catch (e) { toast(ehPdf(file) ? 'Não consegui ler esse PDF (precisa de internet na 1ª vez)' : 'Não consegui abrir essa imagem'); }
    },
    gSalvar: async function () {
      var g = sheet.g, v = num(g.valorTxt), e = $('#g_err');
      if (!g.classe) { e.textContent = g.cat === 'DIV' ? 'Diga o que foi o gasto' : 'Escolha o tipo'; return; }
      if (!(v > 0)) { e.textContent = 'Digite o valor'; return; }
      var obj = { id: g.id, cat: g.cat, classe: String(g.classe).trim().toUpperCase(), valor: C.r2(v), data: g.data, foto: g.foto || null, asset: g.asset || null, criado: g.criado || Date.now(), upd: Date.now() };
      var blob = sheet.blob;
      if (blob) { var fid = 'f_' + uid(); if (await fotoPut(fid, blob)) { if (obj.foto) fotoDel(obj.foto); obj.foto = fid; obj.asset = null; } }
      var i = st.gastos.findIndex(function (x) { return x.id === obj.id; });
      if (i >= 0) st.gastos[i] = obj; else st.gastos.push(obj);
      save(); sheet = null; render(); toast('Gasto salvo');
      if (blob && cloud.assets) {
        try { var up = await cloud.assets.upload(blob); var gg = st.gastos.find(function (x) { return x.id === obj.id; }); if (gg) { gg.asset = up.id; gg.upd = Date.now(); save(); } } catch (err) { }
      }
    },
    gExcluir: function () {
      var id = sheet.g.id;
      confirmar('Excluir gasto?', 'Esse gasto sai da prestação.', 'Excluir', function () {
        var g = st.gastos.find(function (x) { return x.id === id; }); if (g && g.foto) fotoDel(g.foto);
        apagar('gastos', id); save(); render();
      });
    },

    /* recebimentos */
    receb: function (id) {
      var r0 = id && st.recebidos.find(function (x) { return x.id === id; });
      sheet = r0 ? { tipo: 'receb', edit: true, r: Object.assign({}, r0, { valorTxt: fmtNum(r0.valor) }) }
        : { tipo: 'receb', edit: false, r: { id: uid(), tipo: 'DEPÓSITO CAJU', valorTxt: '', data: hoje() } };
      rerenderSheet();
    },
    rSet: function (k, v, re) { sheet.r[k] = v; if (re) rerenderSheet(); },
    rSalvar: function () {
      var r = sheet.r, v = num(r.valorTxt);
      if (!(v > 0)) { $('#r_err').textContent = 'Digite o valor'; return; }
      var obj = { id: r.id, tipo: r.tipo, valor: C.r2(v), data: r.data, criado: r.criado || Date.now(), upd: Date.now() };
      var i = st.recebidos.findIndex(function (x) { return x.id === obj.id; });
      if (i >= 0) st.recebidos[i] = obj; else st.recebidos.push(obj);
      if (sheet.depDe) { var p = st.previsoes.find(function (x) { return x.id === sheet.depDe; }); if (p) { p.depositoRecebido = true; p.upd = Date.now(); } }
      save(); sheet = null; render(); toast('Recebimento salvo');
    },
    rExcluir: function () {
      var id = sheet.r.id;
      confirmar('Excluir recebimento?', 'Esse valor sai da prestação.', 'Excluir', function () { apagar('recebidos', id); save(); render(); });
    },

    /* diárias */
    ciclaDiaria: function (d) {
      var t = st.diarias[d];
      setDiaria(d, t === 'DIÁRIA' ? 'MEIA DIÁRIA' : t === 'MEIA DIÁRIA' ? null : 'DIÁRIA');
      save(); render();
    },
    addDiaria: function () { A.gasto(); A.gCat('DIA'); },
    dTipo: function (t) { sheet.t = t; $('#d_t1').className = 'chip' + (t === 1 ? ' on' : ''); $('#d_t2').className = 'chip' + (t === 2 ? ' on' : ''); },
    dSalvar: function () { var d = $('#d_dia').dataset.v; if (!d) return; setDiaria(d, sheet.t === 2 ? 'MEIA DIÁRIA' : 'DIÁRIA'); save(); sheet = null; render(); },

    /* prestação */
    baixarPrest: async function () {
      try {
        var r = await C.gerarPrestacao(JSZip, tpl().pc, st.perfil, st, mesSel.ano, mesSel.mes, hoje(), 'blob');
        await baixar(slug('PCEM' + (st.perfil.codigo || '') + '-01 ' + st.perfil.nome.split(/\s+/).slice(0, 2).join(' ') + ' ' + C.MESES[mesSel.mes - 1] + ' ' + mesSel.ano) + '.xlsx', r.data);
      } catch (e) { toast(e.message || 'Erro ao gerar a planilha'); }
    },
    baixarPdf: async function () {
      var a = mesSel.ano, m = mesSel.mes, ini = a + '-' + C.pad(m) + '-01', fim = C.ultimoDia(a, m);
      var gs = st.gastos.filter(function (g) { return g.data >= ini && g.data <= fim && (g.foto || g.asset); }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
      if (!gs.length) return toast('Nenhuma foto de nota neste mês');
      if (!window.jspdf) return toast('Gerador de PDF não carregou. Verifique a internet.');
      toast('Montando o PDF…');
      try {
        var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), first = true, n = 0;
        for (var i = 0; i < gs.length; i++) {
          var g = gs[i], blob = await fotoBlob(g); if (!blob) continue;
          var url = await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(blob); });
          var img = await new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = url; });
          if (!first) doc.addPage(); first = false; n++;
          doc.setFontSize(12); doc.text(dBR(g.data) + '  ·  ' + CAT[g.cat].n + '  ·  ' + (g.classe || '') + '  ·  ' + money(g.valor), 10, 12);
          var maxW = 190, maxH = 270, k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
          doc.addImage(url, 'JPEG', 10 + (maxW - img.naturalWidth * k) / 2, 18, img.naturalWidth * k, img.naturalHeight * k);
        }
        if (!n) return toast('Não encontrei as fotos neste aparelho');
        await baixar(slug('COMPROVANTES ' + st.perfil.nome.split(/\s+/).slice(0, 2).join(' ') + ' ' + C.MESES[m - 1] + ' ' + a) + '.pdf', doc.output('blob'));
      } catch (e) { toast('Erro ao montar o PDF'); }
    },

    /* ajustes / backup */
    salvarAjustes: function () {
      var nome = $('#a_nome').value.trim(); if (!nome) return toast('Digite seu nome');
      st.perfilUpd = Date.now(); st.perfil = { nome: nome, codigo: '', cidade: 'TERESINA-PI' };
      var v = num($('#a_sal').value); st.saldoInicial = v ? { valor: v, data: $('#a_sald').dataset.v } : null;
      save(); toast('Salvo'); render();
    },
    backup: async function () {
      var fotos = {};
      for (var i = 0; i < st.gastos.length; i++) {
        var g = st.gastos[i]; if (!g.foto) continue;
        var b = await fotoGetLocal(g.foto); if (!b) continue;
        fotos[g.foto] = await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
      }
      await baixar('BACKUP_PRESTACAO_' + slug(st.perfil.nome.split(/\s+/)[0]) + '_' + hoje() + '.json', JSON.stringify({ app: 'prestacao-contas', st: st, fotos: fotos }));
    },
    restaurar: async function (file) {
      if (!file) return;
      try {
        var j = JSON.parse(await file.text()); if (!j || !j.st || !j.st.v) throw 0;
        confirmar('Restaurar backup?', 'Os lançamentos do backup serão juntados aos que já estão no app.', 'Restaurar', async function () {
          for (var k in (j.fotos || {})) { var b = await (await fetch(j.fotos[k])).blob(); await fotoPut(k, b); }
          st = Object.assign(blank(), j.st); save(); view = 'home'; render(); toast('Backup restaurado');
        });
      } catch (e) { toast('Arquivo de backup inválido'); }
    },
    fechar: function () { if (sheet && sheet.prev) URL.revokeObjectURL(sheet.prev); sheet = null; confirmCb = null; rerenderSheet(); },
    confirmOk: function () { var cb = confirmCb; sheet = null; confirmCb = null; rerenderSheet(); if (cb) cb(); }
  };

  var T = null;
  function tpl() { if (!T) T = JSON.parse(document.getElementById('tpl').textContent); return T; }

  render();
  initCaps(0);
})();
