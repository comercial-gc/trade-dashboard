/* trade_patch.js (Trade Dashboard) -- correções carregadas pelo Trade_Extra.gs a partir do GitHub,
   para não precisar colar código no Apps Script a cada ajuste.

   09/10/2026 (Paulo): na aba Top Clientes, o "vs 2025" do mês em andamento comparava o parcial
   de 2026 (ex.: 01 a 08/10/2026) com o MÊS INTEIRO de 2025, enquanto o Top Clientes da aba Mês
   compara parcial com parcial. Aqui o mês equivalente de 2025 vira a mesma régua da aba Mês:
   o valor de cada agência que aparece no Top Clientes do mês (topClientesPainel, inclusive a
   regra própria da APPAI) e, para as demais, o total de 2025 proporcional aos dias
   (dia atual / dias do mês), igual ao Apps Script (lerTopClientesPainel). */
(function () {
  if (window.__tradePatchParcial) return;
  window.__tradePatchParcial = true;
  if (typeof D === 'undefined' || typeof cliGetDados !== 'function') return;

  var DIAS_MES_2025 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var kn = function (s) { return String(s || '').trim().toUpperCase(); };
  var alias = function (s) { return typeof cliNormAlias === 'function' ? cliNormAlias(s) : s; };

  var m26 = (D.meses || []).filter(function (m) {
    return m && m.clientes && m.clientes.length && !m.isFechado && m.diaAtual && m.diasMes && m.diaAtual < m.diasMes;
  }).pop();
  if (!m26) return;
  var curto = String(m26.label || '').split('/')[0];
  var m25 = (D.meses2025 || []).filter(function (m) { return m && m.label && m.label.indexOf(curto) === 0; })[0];
  if (!m25) return;

  var tc = m26.topClientesPainel || {};
  var dia = tc.diaAtual || m26.diaAtual;
  var mesIdx = typeof m26.mesIdx === 'number' ? m26.mesIdx : null;
  var diasMes = mesIdx !== null ? DIAS_MES_2025[mesIdx] : m26.diasMes;
  var fator = dia / diasMes;
  var LBL = m25.label + ' até ' + String(dia).padStart(2, '0');

  // valores exatos da aba Mês (Top Clientes do mês), por agência e parque
  var exato = {};
  [['aqua', 'a'], ['bio', 'b'], ['pai', 'p']].forEach(function (par) {
    (tc[par[0]] || []).forEach(function (d) {
      var k = kn(alias(d.n));
      exato[k] = exato[k] || {};
      exato[k][par[1]] = d.v25 || 0;
    });
  });

  var origDados = cliGetDados;
  cliGetDados = function () {
    var r = origDados.apply(this, arguments);
    var usa = function (k) { return (cliParque && cliParque.indexOf) ? cliParque.indexOf(k) >= 0 : true; };
    var vistos = {};
    (m25.clientes || []).forEach(function (c) {
      var n = alias(c.n), k = kn(n), e = exato[k] || {};
      vistos[k] = true;
      var val = 0;
      ['a', 'b', 'p'].forEach(function (pk) {
        if (!usa(pk)) return;
        val += (e[pk] !== undefined) ? e[pk] : Math.round((c[pk] || 0) * fator);
      });
      if (!r.dados[n]) r.dados[n] = {};
      r.dados[n][LBL] = (r.dados[n][LBL] || 0) + val;
    });
    // agência que só tem valor de 2025 pela regra própria (ex.: APPAI) e não está na lista de 2025
    Object.keys(exato).forEach(function (k) {
      if (vistos[k]) return;
      var nome = Object.keys(r.dados).filter(function (n) { return kn(n) === k; })[0];
      if (!nome) return;
      var val = 0;
      ['a', 'b', 'p'].forEach(function (pk) { if (usa(pk) && exato[k][pk] !== undefined) val += exato[k][pk]; });
      r.dados[nome][LBL] = (r.dados[nome][LBL] || 0) + val;
    });
    return r;
  };

  var parcial = { label: LBL, clientes: [], parcial2025: true };
  var origEq = cliGetEquiv2025;
  cliGetEquiv2025 = function (cur) {
    var eq = origEq.apply(this, arguments);
    var temAtual = (cur || []).indexOf(m26) >= 0;
    return eq.map(function (m) { return (temAtual && m === m25) ? parcial : m; });
  };

  var origPer = cliGetPeriodo;
  cliGetPeriodo = function () {
    var r = origPer.apply(this, arguments);
    if (r && r.yoy && r.cur && r.cur[0] === m26 && r.prev && r.prev.length) {
      r.prev = [parcial];
      r.prevLabel = LBL;
      r.yoyIncompleto = false;
    }
    return r;
  };

  // carregado depois da primeira renderização: redesenha a aba de clientes já com a régua nova
  try { if (typeof cliRenderAtivo === 'function') cliRenderAtivo(); } catch (e) { if (window.console) console.warn('trade_patch', e); }
})();
