/* Núcleo: cálculos e geração das planilhas a partir dos modelos originais. */
(function (root) {
  'use strict';
  var DIARIA = 60, MEIA = 30, HOTEL = 120;
  var MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toUTC(iso) { var p = iso.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function fromUTC(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(iso, n) { return fromUTC(toUTC(iso) + n * 864e5); }
  function diasEntre(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 864e5) + 1; }
  function serial(iso) { return Math.round((toUTC(iso) - Date.UTC(1899, 11, 30)) / 864e5); }
  function weekday(iso) { return new Date(toUTC(iso)).getUTCDay(); } // 0=dom, 6=sab
  function ultimoDia(ano, mes) { return fromUTC(Date.UTC(ano, mes, 0)); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function valorDiaria(t) { return t === 'DIÁRIA' ? DIARIA : t === 'MEIA DIÁRIA' ? MEIA : 0; }
  function brData(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }

  /* ---------- saldo ---------- */
  function saldoAte(st, isoExcl) {
    var s = 0;
    if (st.saldoInicial && st.saldoInicial.valor) s += Number(st.saldoInicial.valor) || 0;
    (st.recebidos || []).forEach(function (r) { if (r.data < isoExcl) s += Number(r.valor) || 0; });
    (st.gastos || []).forEach(function (g) { if (g.data < isoExcl) s -= Number(g.valor) || 0; });
    Object.keys(st.diarias || {}).forEach(function (d) { if (d < isoExcl) s -= valorDiaria(st.diarias[d]); });
    return r2(s);
  }
  function saldoAtual(st) { return saldoAte(st, '9999-12-31'); }

  /* ---------- previsão ---------- */
  function calcPrevisao(p, saldo) {
    var dias = diasEntre(p.ini, p.fim);
    var n = p.equipe.length;
    var hospQtd = Number(p.hospQtd) || 0;
    var hospUnit = p.hospUnit != null && p.hospUnit !== '' ? Number(p.hospUnit) : HOTEL * n;
    var L = {
      hosp: r2(hospQtd * hospUnit),
      comb: r2((Number(p.combQtd) || 0) * (Number(p.combUnit) || 0)),
      d1: dias * DIARIA,
      d2: n >= 2 ? dias * DIARIA : 0,
      d3: n >= 3 ? dias * DIARIA : 0,
      d4: n >= 4 ? dias * DIARIA : 0,
      div: r2(Number(p.diversas) || 0)
    };
    var total = r2(L.hosp + L.comb + L.d1 + L.d2 + L.d3 + L.d4 + L.div);
    var dep1 = r2(total - (L.d2 + L.d3 + L.d4) - saldo);
    var deps = [
      dep1 <= 0 ? 0 : dep1,
      L.d2 > 0 ? L.d2 : 0, L.d3 > 0 ? L.d3 : 0, L.d4 > 0 ? L.d4 : 0
    ].slice(0, n);
    var depTotal = r2(deps.reduce(function (a, b) { return a + b; }, 0));
    return { dias: dias, n: n, hospQtd: hospQtd, hospUnit: hospUnit, L: L, total: total, saldo: saldo, dep1: dep1, deps: deps, depTotal: depTotal };
  }

  /* ---------- prestação ---------- */
  function previsaoDoDia(st, iso) {
    var ps = st.previsoes || [];
    for (var i = ps.length - 1; i >= 0; i--) if (ps[i].ini <= iso && iso <= ps[i].fim) return ps[i];
    return null;
  }
  function montarPrestacao(st, ano, mes) {
    var ini = ano + '-' + pad(mes) + '-01', fim = ultimoDia(ano, mes);
    var receb = [];
    var temAntes = (st.saldoInicial && st.saldoInicial.valor) ||
      (st.recebidos || []).some(function (r) { return r.data < ini; }) ||
      (st.gastos || []).some(function (g) { return g.data < ini; }) ||
      Object.keys(st.diarias || {}).some(function (d) { return d < ini; });
    var saldoAnterior = saldoAte(st, ini);
    if (temAntes) receb.push({ data: addDays(ini, -1), tipo: 'SALDO', valor: saldoAnterior });
    (st.recebidos || []).filter(function (r) { return r.data >= ini && r.data <= fim; })
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; })
      .forEach(function (r) { receb.push({ data: r.data, tipo: r.tipo, valor: Number(r.valor) }); });

    var datas = {};
    Object.keys(st.diarias || {}).forEach(function (d) { if (d >= ini && d <= fim && st.diarias[d]) datas[d] = 1; });
    var gm = (st.gastos || []).filter(function (g) { return g.data >= ini && g.data <= fim; });
    gm.forEach(function (g) { datas[g.data] = 1; });
    var linhas = [];
    Object.keys(datas).sort().forEach(function (d) {
      var dia = (st.diarias || {})[d] || null;
      var c = gm.filter(function (g) { return g.data === d && g.cat === 'COMB'; });
      var h = gm.filter(function (g) { return g.data === d && g.cat === 'HOSP'; });
      var v = gm.filter(function (g) { return g.data === d && g.cat === 'DIV'; });
      var n = Math.max(dia ? 1 : 0, c.length, h.length, v.length, 1);
      var pv = previsaoDoDia(st, d);
      for (var k = 0; k < n; k++) linhas.push({
        data: d, projeto: pv && pv.projeto || '', cliente: pv && pv.cliente || '',
        diaria: k === 0 ? dia : null, comb: c[k] || null, hosp: h[k] || null, div: v[k] || null
      });
    });
    var tot = { dia: 0, comb: 0, hosp: 0, div: 0 };
    linhas.forEach(function (l) {
      tot.dia += valorDiaria(l.diaria);
      if (l.comb) tot.comb += Number(l.comb.valor); if (l.hosp) tot.hosp += Number(l.hosp.valor); if (l.div) tot.div += Number(l.div.valor);
    });
    Object.keys(tot).forEach(function (k) { tot[k] = r2(tot[k]); });
    var recebido = r2(receb.reduce(function (a, r) { return a + r.valor; }, 0));
    var despesas = r2(tot.dia + tot.comb + tot.hosp + tot.div);
    return { ano: ano, mes: mes, ini: ini, fim: fim, receb: receb, linhas: linhas, tot: tot, recebido: recebido, despesas: despesas, saldo: r2(recebido - despesas) };
  }

  /* ---------- XML de células ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colNum(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }
  function ensureCell(xml, ref) {
    var mm = /^([A-Z]+)(\d+)$/.exec(ref), col = colNum(mm[1]), row = mm[2];
    var rre = new RegExp('<row r="' + row + '"[^>]*?(/>|>([\\s\\S]*?)</row>)');
    var rm = rre.exec(xml);
    var cell = '<c r="' + ref + '"/>';
    if (!rm) { // cria a linha na posição certa
      var rows = /<row r="(\d+)"/g, at = xml.indexOf('</sheetData>'), q;
      while ((q = rows.exec(xml))) if (Number(q[1]) > Number(row)) { at = q.index; break; }
      return xml.slice(0, at) + '<row r="' + row + '">' + cell + '</row>' + xml.slice(at);
    }
    if (rm[1] === '/>') { var open = rm[0].slice(0, -2) + '>'; return xml.slice(0, rm.index) + open + cell + '</row>' + xml.slice(rm.index + rm[0].length); }
    var innerStart = rm.index + rm[0].indexOf('>') + 1, inner = rm[2];
    var cre = /<c r="([A-Z]+)\d+"/g, c2, pos = inner.length;
    while ((c2 = cre.exec(inner))) if (colNum(c2[1]) > col) { pos = c2.index; break; }
    return xml.slice(0, innerStart + pos) + cell + xml.slice(innerStart + pos);
  }
  function findCell(xml, ref) {
    var re = new RegExp('<c r="' + ref + '"((?:\\s[^>]*?)?)(/>|>([\\s\\S]*?)</c>)');
    var m = re.exec(xml);
    if (!m) throw new Error('Célula ' + ref + ' não encontrada no modelo');
    var s = /\ss="(\d+)"/.exec(m[1]);
    return { start: m.index, end: m.index + m[0].length, s: s ? ' s="' + s[1] + '"' : '', inner: m[3] || '' };
  }
  function vXml(val) {
    if (val === null || val === undefined) return { t: '', v: '' };
    if (typeof val === 'number') return { t: '', v: '<v>' + (Math.round(val * 1e6) / 1e6) + '</v>' };
    return { t: ' t="str"', v: '<v>' + esc(val) + '</v>' };
  }
  function setVal(xml, ref, val) {
    if (xml.indexOf('<c r="' + ref + '"') < 0) {
      if (val === null || val === undefined || val === '') return xml;
      xml = ensureCell(xml, ref);
    }
    var c = findCell(xml, ref), out;
    if (val === null || val === undefined || val === '') out = '<c r="' + ref + '"' + c.s + '/>';
    else if (typeof val === 'number') out = '<c r="' + ref + '"' + c.s + '><v>' + (Math.round(val * 1e6) / 1e6) + '</v></c>';
    else out = '<c r="' + ref + '"' + c.s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(val) + '</t></is></c>';
    return xml.slice(0, c.start) + out + xml.slice(c.end);
  }
  function setCached(xml, ref, val) {
    var c = findCell(xml, ref);
    var f = /<f[\s\S]*?(?:<\/f>|\/>)/.exec(c.inner);
    if (!f) throw new Error('Célula ' + ref + ' deveria ter fórmula');
    var x = vXml(val);
    var out = '<c r="' + ref + '"' + c.s + x.t + '>' + f[0] + x.v + '</c>';
    return xml.slice(0, c.start) + out + xml.slice(c.end);
  }
  function W(xml) { // pequeno ajudante encadeável
    return {
      x: xml,
      v: function (r, val) { this.x = setVal(this.x, r, val); return this; },
      f: function (r, val) { this.x = setCached(this.x, r, val); return this; }
    };
  }
  function fullCalc(wb) {
    return wb.replace(/<calcPr([^>]*?)\/>/, function (m, a) { return /fullCalcOnLoad/.test(a) ? m : '<calcPr' + a + ' fullCalcOnLoad="1"/>'; });
  }

  /* ---------- montar zip ---------- */
  function b64ToBytes(b64) {
    if (typeof atob === 'function') { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  function zipFrom(JSZip, parts, changed, outType) {
    var z = new JSZip();
    // [Content_Types].xml primeiro
    var keys = Object.keys(parts).sort(function (a, b) { return a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0; });
    keys.forEach(function (k) {
      var p = parts[k];
      if (changed[k] != null) z.file(k, changed[k]);
      else if (p.t === 'x') z.file(k, p.d);
      else z.file(k, b64ToBytes(p.d));
    });
    return z.generateAsync({ type: outType || 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- planilha de PREVISÃO ---------- */
  function gerarPrevisao(JSZip, T, perfil, p, saldo, hojeIso, outType) {
    var c = calcPrevisao(p, saldo);
    var n = c.n, eq = p.equipe;
    var s1 = W(T['xl/worksheets/sheet1.xml'].d);
    var s2 = W(T['xl/worksheets/sheet2.xml'].d);
    s1.v('G1', ' N° PDEM' + (perfil.codigo || ''))
      .v('C6', p.projeto || '').v('C7', p.cliente || '')
      .v('C8', serial(p.ini)).v('G8', serial(p.fim))
      .v('C9', (p.local || '').toUpperCase())
      .v('C10', p.km ? Number(p.km) : '')
      .v('C11', c.dias);
    for (var i = 0; i < 4; i++) s1.v('C' + (12 + i), eq[i] ? eq[i].toUpperCase() : '');
    var hospLabel = c.hospQtd > 0 ? (n === 1 ? 'HOSPEDAGEM 01 PESSOA' : 'HOSPEDAGEM 0' + n + ' PESSOAS') : 'SEM HOSPEDAGEM';
    var f23 = n >= 3 ? c.dias : '0,0', f24 = n >= 4 ? c.dias : '0,0';
    s1.v('A19', hospLabel).v('F19', c.hospQtd).v('G19', c.hospQtd > 0 ? c.hospUnit : 0)
      .v('F20', Number(p.combQtd) || 0).v('G20', Number(p.combUnit) || 0)
      .v('F21', c.dias).v('G21', DIARIA)
      .v('F22', n >= 2 ? c.dias : 0)
      .f('F23', f23).f('F24', f24)
      .v('F25', 1).v('G25', c.L.div)
      .f('H19', c.L.hosp).f('H20', c.L.comb).f('H21', c.L.d1).f('H22', c.L.d2)
      .f('H23', c.L.d3).f('H24', c.L.d4).f('H25', c.L.div).f('H26', 0).f('H27', 0).f('H28', 0)
      .f('H29', c.total)
      .v('H33', saldo).v('H34', 0).v('H35', 0).v('H36', 0)
      .f('H37', r2(-saldo));
    var names = [0, 1, 2, 3].map(function (k) { return eq[k] ? eq[k].toUpperCase() : ''; });
    var d43 = names[0] === '' ? '' : (c.dep1 <= 0 ? '-' : c.dep1);
    var d44 = names[1] === '' ? '' : (c.L.d2 <= 0 ? '' : c.L.d2);
    var d45 = names[2] === '' ? '' : (c.L.d3 <= 0 ? '' : c.L.d3);
    var d46 = names[3] === '' ? '' : (c.L.d4 <= 0 ? '-' : c.L.d4);
    var dsum = [d43, d44, d45, d46].reduce(function (a, b) { return a + (typeof b === 'number' ? b : 0); }, 0);
    s1.f('H39', r2(dsum));
    [d43, d44, d45, d46].forEach(function (d, k) {
      var r = 43 + k, nm = names[k];
      s1.f('A' + r, nm).f('D' + r, d).f('F' + r, nm ? '-' : '').f('H' + r, nm ? '-' : '');
    });
    s1.v('F49', serial(hojeIso)).f('A53', names[0]);
    // LISTA: apenas os nomes da equipe (sem dados pessoais)
    for (var j = 0; j < 4; j++) {
      s2.v('B' + (3 + j), names[j] || '').v('C' + (3 + j), names[j] ? '-' : '').v('D' + (3 + j), names[j] ? '-' : '');
    }
    var changed = {
      'xl/worksheets/sheet1.xml': s1.x, 'xl/worksheets/sheet2.xml': s2.x,
      'xl/workbook.xml': fullCalc(T['xl/workbook.xml'].d)
    };
    return zipFrom(JSZip, T, changed, outType).then(function (data) { return { data: data, calc: c }; });
  }

  /* ---------- planilha de PRESTAÇÃO ---------- */
  var MAXR = 6, MAXL = 31;
  function gerarPrestacao(JSZip, T, perfil, st, ano, mes, hojeIso, outType) {
    var P = montarPrestacao(st, ano, mes);
    if (P.receb.length > MAXR * 2) throw new Error('Mais de ' + (MAXR * 2) + ' valores recebidos no mês: a planilha só tem espaço para ' + (MAXR * 2) + '.');
    if (P.linhas.length > MAXL * 2) throw new Error('Mais de ' + (MAXL * 2) + ' linhas de despesas no mês: a planilha só tem espaço para ' + (MAXL * 2) + '.');
    var nome = (perfil.nome || '').toUpperCase();
    var cidade = (perfil.cidade || 'TERESINA-PI').toUpperCase();
    var assin = cidade + ', ' + brData(hojeIso);
    var sheets = [W(T['xl/worksheets/sheet1.xml'].d), W(T['xl/worksheets/sheet2.xml'].d)];
    var sub = [];
    sheets.forEach(function (s, si) {
      var rec = P.receb.slice(si * MAXR, si * MAXR + MAXR);
      var lin = P.linhas.slice(si * MAXL, si * MAXL + MAXL);
      for (var i = 0; i < MAXR; i++) {
        var r = rec[i], row = 10 + i;
        s.v('A' + row, r ? serial(r.data) : '').v('B' + row, r ? r.tipo : '').v('C' + row, r ? r2(r.valor) : '');
      }
      var t = { rec: 0, dia: 0, comb: 0, hosp: 0, div: 0 };
      rec.forEach(function (r) { t.rec += r.valor; });
      for (var k = 0; k < MAXL; k++) {
        var l = lin[k], rr = 21 + k;
        s.v('A' + rr, l ? serial(l.data) : '').v('B' + rr, l ? l.projeto : '').v('C' + rr, l ? l.cliente : '')
          .v('D' + rr, l && l.diaria ? l.diaria : '')
          .f('E' + rr, l && l.diaria ? valorDiaria(l.diaria) : '')
          .v('F' + rr, l && l.comb ? l.comb.classe : '').v('G' + rr, l && l.comb ? r2(Number(l.comb.valor)) : '')
          .v('H' + rr, l && l.hosp ? l.hosp.classe : '').v('I' + rr, l && l.hosp ? r2(Number(l.hosp.valor)) : '')
          .v('J' + rr, l && l.div ? String(l.div.classe || '').toUpperCase() : '').v('K' + rr, l && l.div ? r2(Number(l.div.valor)) : '');
        if (l) {
          t.dia += valorDiaria(l.diaria);
          if (l.comb) t.comb += Number(l.comb.valor); if (l.hosp) t.hosp += Number(l.hosp.valor); if (l.div) t.div += Number(l.div.valor);
        }
      }
      Object.keys(t).forEach(function (q) { t[q] = r2(t[q]); });
      s.f('C16', t.rec).f('E52', t.dia).f('G52', t.comb).f('I52', t.hosp).f('K52', t.div);
      sub.push(t);
    });
    var s1 = sheets[0], s2 = sheets[1];
    s1.v('G1', 'N° PCEM' + (perfil.codigo || '')).v('C6', MESES[mes - 1]).v('F6', ano).v('I6', nome)
      .f('J10', P.recebido).f('J12', P.despesas).f('J14', P.saldo)
      .v('A54', assin).f('A57', nome);
    s2.v('G1', 'N° PCEM' + (perfil.codigo || ''))
      .f('C6', MESES[mes - 1]).f('F6', ano).f('I6', nome).f('A54', assin).f('A57', nome);
    var changed = {
      'xl/worksheets/sheet1.xml': s1.x, 'xl/worksheets/sheet2.xml': s2.x,
      'xl/workbook.xml': fullCalc(T['xl/workbook.xml'].d)
    };
    return zipFrom(JSZip, T, changed, outType).then(function (data) { return { data: data, P: P }; });
  }

  var API = {
    DIARIA: DIARIA, MEIA: MEIA, HOTEL: HOTEL, MESES: MESES,
    pad: pad, addDays: addDays, diasEntre: diasEntre, serial: serial, weekday: weekday, ultimoDia: ultimoDia,
    r2: r2, valorDiaria: valorDiaria, brData: brData,
    saldoAte: saldoAte, saldoAtual: saldoAtual, calcPrevisao: calcPrevisao, montarPrestacao: montarPrestacao,
    gerarPrevisao: gerarPrevisao, gerarPrestacao: gerarPrestacao
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Core = API;
})(this);
