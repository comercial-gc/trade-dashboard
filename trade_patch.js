/* 13/10/2026 (Paulo: "Top Clientes muito inconsistente"). Três correções na aba Top Clientes,
   aplicadas antes da correção de parcial x parcial mais abaixo:

   1) Nomes de agência unificados. Desde ago/26 os clientes vêm do bruto em maiúsculas, antes
      vinham da planilha com outra grafia, então a mesma agência aparecia 2 ou 3 vezes (ex.:
      "Tour in Rio" e "TOUR IN RIO", "RIO MAXIMO" e "RIO MAXIMO VIAGENS E TURISMO LTDA", nome com
      CPF no fim ou acento quebrado). A chave de agrupamento ignora maiúscula/minúscula, acento,
      pontuação, CPF/CNPJ e sufixo societário (LTDA, ME, EIRELI, S.A.); TRADE_UNIFICAR junta os
      casos de nome curto x nome completo aprovados. O nome exibido é a grafia com mais bilhetes.
   2) Meses de 2025 sem o total do Trade/parque: com 12 meses (ou personalizado que pega 2025) o
      ranking e a aba Por agência davam erro no meio da conta e a tela ficava com os números do
      filtro anterior (por isso "12 meses fica tudo igual"). Agora o mês de 2025 usa real25/par25
      do mesmo mês guardado no ano vigente.
   3) Por agência: agência sem venda nos parques marcados não redesenhava a tela (ficava o
      número antigo). Agora mostra zerado com aviso. */
(function () {
  if (window.__tradePatchClientes) return;
  window.__tradePatchClientes = true;
  if (typeof D === 'undefined' || typeof cliGetDados !== 'function') return;

  // ---------- 1) unificação de nomes ----------
  var SUFIXOS = /\b(LTDA|LIMITADA|ME|EPP|EIRELI|EIRELLI|SA|S A|SOCIEDADE ANONIMA)\b/g;
  function chave(n) {
    var s = String(n || '').replace(/�/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    s = s.replace(/\d{8,}/g, ' ').replace(/[^A-Z0-9& ]/g, ' ').replace(SUFIXOS, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  // nome curto -> nome completo (chaves já normalizadas). Só casos conferidos: mesma empresa.
  var TRADE_UNIFICAR = {
    'RIO MAXIMO': 'RIO MAXIMO VIAGENS E TURISMO',
    'ARENA VIPS': 'ARENA VIPS AGENCIA DE VIAGENS E LOCADORA DE VEICUL',
    'GABRIEL AU BRESIL': 'GABRIEL AU BRESIL AGENCE DE VOYAGE',
    'RIO ALTERNATIVE TOUR': 'RIO ALTERNATIVE TOUR VIAGENS E TURISMO',
    'RIO BY BUZIOS': 'RIO BY BUZIOS TURISMO',
    'M G DE LIMA TURISMO': 'M G DE LIMA TURISMO E LOCADORA',
    'GRAMADO PROMOCAO DE VENDAS EM RECUPERACAO J': 'GRAMADO PROMOCAO DE VENDAS'
  };
  var aliasOriginal = cliNormAlias;
  function grupo(n) {
    var orig = aliasOriginal(n);
    var k = chave(orig);
    // nome que é só CNPJ/número ou só pontuação ("60701521006481", "-") não tem o que unificar:
    // cada um é uma agência diferente e fica com o próprio nome
    if (k.replace(/[^A-Z]/g, '').length < 2) return '#' + String(orig).trim();
    return TRADE_UNIFICAR[k] || k;
  }
  // nome exibido de cada grupo = grafia com mais bilhetes (todos os meses, todos os parques)
  var volume = {}, exibir = {};
  (D.meses2025 || []).concat(D.meses || []).forEach(function (m) {
    (m.clientes || []).forEach(function (c) {
      var nome = aliasOriginal(c.n), g = grupo(c.n);
      var v = (c.a || 0) + (c.b || 0) + (c.p || 0);
      volume[g] = volume[g] || {};
      volume[g][nome] = (volume[g][nome] || 0) + v;
    });
  });
  Object.keys(volume).forEach(function (g) {
    var nomes = Object.keys(volume[g]);
    nomes.sort(function (a, b) { return volume[g][b] - volume[g][a]; });
    exibir[g] = nomes[0];
  });
  cliNormAlias = function (n) {
    var g = grupo(n);
    return exibir[g] || aliasOriginal(n);
  };
  window.cliNormAlias = cliNormAlias;

  // ---------- 2) meses de 2025 sem aqua/bio/pai ----------
  function mesVigenteDe(m) {
    var curto = String(m.label || '').split('/')[0];
    return (D.meses || []).filter(function (x) { return x && x.label && x.label.indexOf(curto) === 0 && x.aqua; })[0];
  }
  function somaParques(m, campo26, campo25) {
    var src = m, suf = campo26;
    if (!m.aqua) { src = mesVigenteDe(m); suf = campo25; if (!src) return 0; }
    else if (m.aqua[campo26] === undefined) suf = campo25;
    var p = cliParque || [];
    return (p.indexOf('a') >= 0 ? (src.aqua[suf] || 0) : 0) + (p.indexOf('b') >= 0 ? ((src.bio || {})[suf] || 0) : 0) + (p.indexOf('p') >= 0 ? ((src.pai || {})[suf] || 0) : 0);
  }
  _cliMonthTrade = function (m) { return somaParques(m, 'real26', 'real25'); };
  _cliMonthPark = function (m) { return somaParques(m, 'par26', 'par25'); };
  window._cliMonthTrade = _cliMonthTrade;
  window._cliMonthPark = _cliMonthPark;

  // ---------- 3) Por agência sem venda nos parques marcados ----------
  var renderAgOriginal = cliRenderAgencia;
  cliRenderAgencia = function () {
    var sel = document.getElementById('cli-ag-sel');
    var ag = sel ? sel.value : '';
    var dados = cliGetDados().dados;
    var tem = ag && dados[ag] && Object.keys(dados[ag]).some(function (k) { return dados[ag][k] > 0; });
    if (ag && !tem) {
      ['cli-ag-bar', 'cli-ag-delta'].forEach(function (id) { try { cliDestroyChart(id); } catch (e) {} });
      var k = document.getElementById('cli-ag-kpis');
      if (k) k.innerHTML = '<div class="cli-kpi-card"><div class="cli-kpi-label">Total no período</div><div class="cli-kpi-val">0</div><div class="cli-kpi-sub">' + ag + ' não tem venda em ' + cliNomeParques() + '. Marque outro parque no filtro.</div></div>';
      var ins = document.getElementById('cli-ag-insights');
      if (ins) ins.innerHTML = '';
      return;
    }
    return renderAgOriginal.apply(this, arguments);
  };
  window.cliRenderAgencia = cliRenderAgencia;

  // ---------- 4) export segue o filtro de parques da tela ----------
  // Antes o XLSX somava sempre AquaRio + BioParque + Paineiras, e a tela só os parques ligados:
  // a mesma agência aparecia com números diferentes no export e no ranking. Durante o export
  // os parques desligados são zerados numa cópia e o dado original volta logo depois.
  if (typeof exportarTopClientesXLSX === 'function') {
    var exportOriginal = exportarTopClientesXLSX;
    exportarTopClientesXLSX = function () {
      var p = cliParque || [], guardado = [];
      (D.meses2025 || []).concat(D.meses || []).forEach(function (m) {
        (m.clientes || []).forEach(function (c) {
          guardado.push([c, c.a, c.b, c.p]);
          if (p.indexOf('a') < 0) c.a = 0;
          if (p.indexOf('b') < 0) c.b = 0;
          if (p.indexOf('p') < 0) c.p = 0;
        });
      });
      try { return exportOriginal.apply(this, arguments); }
      finally { guardado.forEach(function (g) { g[0].a = g[1]; g[0].b = g[2]; g[0].p = g[3]; }); }
    };
    window.exportarTopClientesXLSX = exportarTopClientesXLSX;
  }

  try { if (typeof cliRenderAtivo === 'function') cliRenderAtivo(); } catch (e) { if (window.console) console.warn('trade_patch', e); }
})();

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
