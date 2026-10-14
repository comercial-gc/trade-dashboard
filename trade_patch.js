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
    'GRAMADO PROMOCAO DE VENDAS EM RECUPERACAO J': 'GRAMADO PROMOCAO DE VENDAS',
    // 13/10/2026, aprovados pelo Paulo no mapa agencias_similares.xlsx
    'MARINHO': 'MARINHO TURISMO BUZIOS',
    'INTERTOURING AG DE VIAG E TUR': 'INTERTOURING AGENCIA DE VIAGEM E TURISMO',
    '3B TOUR AND TRAVEL': '3B TOUR',
    'HEADOUT': 'HEADOUT EXPERIENCES',
    'VOYAGEZRIO': 'AGENCIA DE TURISMO VOYAGEZ RIO',
    'RIO RADICAL TURISMO DE AVENTURA': 'RIO RADICAL ECOTURISMO'
    // NÃO juntar (Paulo, 13/10): RIO CARIOCA TOUR x CARIOCA TOUR; TOUR RJ x RJ TOUR; DISCOVERY RIO
    // TOUR / Rio Tour / GUANABARA RIO TOUR / RIO TOUR VIP / BY RIO TOUR TURISMO (todas separadas)
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
  // Acento quebrado na origem ("ANT?NIO CARLOS GOMES"): o caractere perdido vira qualquer letra
  // e o nome junta com a grafia correta, se existir UMA só que case (ex.: "ANTONIO CARLOS GOMES").
  var todosNomes = {};
  (D.meses2025 || []).concat(D.meses || []).forEach(function (m) {
    (m.clientes || []).forEach(function (c) { todosNomes[aliasOriginal(c.n)] = true; });
  });
  var QUEBRADO = '�';
  var chavesLimpas = {};
  Object.keys(todosNomes).forEach(function (n) { if (n.indexOf(QUEBRADO) < 0) chavesLimpas[chave(n)] = true; });
  Object.keys(todosNomes).forEach(function (n) {
    if (n.indexOf(QUEBRADO) < 0) return;
    // chave com '#' no lugar de cada letra perdida; casa com chave limpa do mesmo tamanho que só
    // difere nessas posições
    var m = chave(n.split(QUEBRADO).join('QQQ')).split('QQQ').join('#');
    var achou = Object.keys(chavesLimpas).filter(function (k) {
      if (k.length !== m.length) return false;
      for (var i = 0; i < k.length; i++) if (m[i] !== '#' && m[i] !== k[i]) return false;
      return true;
    });
    if (achou.length === 1) TRADE_UNIFICAR[chave(n)] = TRADE_UNIFICAR[achou[0]] || achou[0];
  });

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
    // grafia sem caractere quebrado na frente; entre elas, a com mais bilhetes
    nomes.sort(function (a, b) {
      var qa = a.indexOf(QUEBRADO) >= 0 ? 1 : 0, qb = b.indexOf(QUEBRADO) >= 0 ? 1 : 0;
      return qa - qb || volume[g][b] - volume[g][a];
    });
    // acento quebrado que sobrou sem outra grafia: "JO?O" e "SEBASTI?O" viram JOÃO / SEBASTIÃO
    // (Paulo, 13/10/2026). Só a final "?O" de palavra, que nesses nomes é sempre "ÃO".
    exibir[g] = nomes[0].split(QUEBRADO + 'O ').join('ÃO ').replace(new RegExp(QUEBRADO + 'O$'), 'ÃO');
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

/* 14/10/2026 (Paulo: corrigir números errados do Dash do Trade, auditoria de UX de 14/10).
   Tudo aqui é pós-processamento: as funções originais continuam rodando e este bloco corrige
   o que elas desenham. Reaplica sozinho na troca de mês, de aba e do botão do BioParque,
   porque envolve as funções globais que esses fluxos chamam (renderMes, initAcum, initHist,
   initImm, buildMobContent).

   T1  Intel. de Mercado: a linha Paineiras usava só os bilhetes Trade (jan/25 = 92.846). Agora
       usa a visitação total do parque (D.histPar25/26.pai, jan/25 = 184.208) e a captação
       Paineiras / Cristo Redentor é calculada com ela.
   T2  Intel. de Mercado: mês sem dado (Cristo out a dez/26 vinha 0) aparece "-", sem "0" nem
       "▼ 100,0%".
   T3  Total Grupo respeita o botão do BioParque em todos os totais (Acumulado desktop e mobile,
       card TOTAL 2025 do Histórico, hero e totais mobile da aba Mês). O total também passa a
       ser a soma dos parques exibidos (o total que vinha da planilha não fechava com os cards).
   T4  Aba Mês: "+4.711 bilhetes" sob "OUT/2025 REF." era texto fixo; agora é Realizado 2026
       menos o mesmo período de 2025 (parques visíveis).
   T5  Histórico: cards "2026 (10m)" comparavam com 2025 fechado; agora comparam com o mesmo
       período de 2025 (mesmos números da aba Acumulado; parque com o mesmo corte de dias).
   T6  Atingimento sem seta de variação: "181% do OBZ (+81%)".
   T7  Variação: sinal e cor calculados antes de arredondar; |v| < 1% com 1 casa decimal.
   T14 Decimal com vírgula em todas as abas (texto e gráficos).
   T15 Sem travessão em texto visível (título "X (travessão) Y" vira "X: Y"; valor vazio vira "-"). */
(function () {
  if (window.__tradePatchNumeros) return;
  window.__tradePatchNumeros = true;
  if (typeof D === 'undefined' || typeof renderMes !== 'function') return;

  var MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var aviso = function (onde, e) { if (window.console) console.warn('trade_patch ' + onde, e); };
  var $ = function (id) { return document.getElementById(id); };
  var n0 = function (v) { return Math.round(v || 0).toLocaleString('pt-BR'); };
  var num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
  function bioMes(label) { return !_bioSaiuDoGrupo(label || ''); }
  function bioGlobal() { return !bioOcultoManual; }

  // ---------- formatação ----------
  // variação em %: sinal e cor pelo valor exato; abaixo de 1% mostra 1 casa (T7)
  function varPct(v) {
    if (v === null || v === undefined || !isFinite(v)) return { txt: '-', up: null };
    var a = Math.abs(v);
    var s = (a < 1 ? a.toFixed(1) : String(Math.round(a))).replace('.', ',');
    if (v > 0) return { txt: '▲ ' + s + '%', up: true };
    if (v < 0) return { txt: '▼ ' + s + '%', up: false };
    return { txt: '0%', up: null };
  }
  function dPct(a, b) { return b > 0 ? (a - b) / b * 100 : null; }
  function setVar(id, v, sufixo) {
    var el = typeof id === 'string' ? $(id) : id;
    if (!el) return;
    var f = varPct(v);
    el.textContent = f.txt + (f.up === null && f.txt === '-' ? '' : (sufixo || ''));
    el.classList.remove('up', 'dn', 'down');
    if (f.up === true) el.classList.add('up');
    if (f.up === false) el.classList.add('dn');
  }
  // atingimento (T6): "181% do OBZ (+81%)"
  function ating(x) {
    var X = Math.round(x), Y = X - 100;
    return X + '% do OBZ (' + (Y > 0 ? '+' : Y < 0 ? '-' : '') + Math.abs(Y) + '%)';
  }
  function setAting(id, x) {
    var el = $(id);
    if (!el) return;
    if (x === null || !isFinite(x)) { el.textContent = '-'; return; }
    el.textContent = ating(x);
    el.classList.remove('up', 'dn');
    el.classList.add(Math.round(x) >= 100 ? 'up' : 'dn');
  }

  // ---------- T14 / T15 / T6 em todo texto da página ----------
  var RX_TESTE = /[\u2014\u2013]|\d\.\d{1,2}\s*(%|p\.p)|[▲▼]\s*\d+(?:[.,]\d+)?%\s*(do\s+)?(OBZ|proj)/;
  function normalizar(s) {
    if (!s || !RX_TESTE.test(s)) return s;
    // decimal com ponto antes de % ou p.p. ("15.6%", "21.08%", "0.3p.p."). Milhar (3 dígitos) não casa.
    s = s.replace(/(\d)\.(\d{1,2})(?=\s*(?:%|p\.p))/g, '$1,$2');
    // atingimento com seta
    var X = function (t) { return parseFloat(t.replace(',', '.')); };
    s = s.replace(/\(\s*[▲▼]\s*(\d+(?:,\d+)?)%\s*(?:do\s+)?OBZ\s*\)/g, function (m, x) {
      var v = Math.round(X(x)), y = v - 100;
      return '(' + v + '% do OBZ, ' + (y > 0 ? '+' : y < 0 ? '-' : '') + Math.abs(y) + '%)';
    });
    s = s.replace(/[▲▼]\s*(\d+(?:,\d+)?)%\s*(?:do\s+)?OBZ/g, function (m, x) { return ating(X(x)); });
    s = s.replace(/[▲▼]\s*(\d+(?:,\d+)?)%\s*proj\./g, function (m, x) { return 'Proj.: ' + ating(X(x)); });
    // travessão: entre termos vira ":"; sozinho (valor vazio) vira "-"
    s = s.replace(/(\S)[ \u00a0]+\u2014[ \u00a0]+/g, '$1: ').replace(/\u2014/g, '-');
    s = s.replace(/[ \u00a0]+\u2013[ \u00a0]+/g, ' - ').replace(/\u2013/g, '-');
    return s;
  }
  window.tradeNormalizarTexto = normalizar;
  var PULAR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var ATRS = ['title', 'data-tip', 'aria-label', 'placeholder'];
  function fixTexto(no) {
    var p = no.parentNode;
    if (!p || PULAR[p.nodeName]) return;
    var v = no.nodeValue, n = normalizar(v);
    if (n !== v) no.nodeValue = n;
  }
  function fixAtrs(el) {
    for (var i = 0; i < ATRS.length; i++) {
      var a = el.getAttribute && el.getAttribute(ATRS[i]);
      if (a) { var n = normalizar(a); if (n !== a) el.setAttribute(ATRS[i], n); }
    }
  }
  function fixArvore(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { fixTexto(raiz); return; }
    if (raiz.nodeType !== 1 || PULAR[raiz.nodeName]) return;
    fixAtrs(raiz);
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false), no;
    while ((no = w.nextNode())) {
      if (no.nodeType === 3) fixTexto(no);
      else if (!PULAR[no.nodeName]) fixAtrs(no);
    }
  }
  try {
    new MutationObserver(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var mu = lista[i];
        if (mu.type === 'characterData') fixTexto(mu.target);
        else if (mu.type === 'attributes') fixAtrs(mu.target);
        else for (var j = 0; j < mu.addedNodes.length; j++) fixArvore(mu.addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS });
  } catch (e) { aviso('observer', e); }
  if (document.title) document.title = normalizar(document.title);
  // texto desenhado nos gráficos (centro das roscas, eixos, legendas e tooltips do Chart.js)
  try {
    var C2D = CanvasRenderingContext2D.prototype;
    ['fillText', 'strokeText', 'measureText'].forEach(function (k) {
      var orig = C2D[k];
      C2D[k] = function (t) {
        if (typeof t === 'string') { var a = Array.prototype.slice.call(arguments); a[0] = normalizar(t); return orig.apply(this, a); }
        return orig.apply(this, arguments);
      };
    });
  } catch (e) { aviso('canvas', e); }

  // ---------- T3: total do acumulado = soma dos parques exibidos ----------
  // O total da planilha não fechava com os cards (out/26: 685.892 x 95.595 + 22.904 + 569.998
  // = 688.497). O total com Bio passa a ser a soma das partes; sem Bio, AquaRio + Paineiras.
  function somaAcum(ac, comBio) {
    var a = ac.aqua || {}, b = ac.bio || {}, p = ac.pai || {};
    return { r26: num(a.r26) + num(p.r26) + (comBio ? num(b.r26) : 0), r25: num(a.r25) + num(p.r25) + (comBio ? num(b.r25) : 0) };
  }
  (D.meses || []).map(function (m) { return m && m.acum; }).concat([D.acum]).forEach(function (ac) {
    if (!ac || !ac.aqua || !ac.pai || !ac.total) return;
    var t = somaAcum(ac, true);
    ac.total.r26 = t.r26; ac.total.r25 = t.r25;
  });

  // T7 na origem: deltaYoY vinha inteiro da planilha (-0,3% virava 0 e aparecia "▲ 0%"). Recalcula
  // pelo Realizado 2026 x 2025 do próprio mês: inteiro a partir de 1%, 1 casa abaixo disso.
  function deltaExato(o) {
    if (!o || !(num(o.real25) > 0)) return;
    var d = (num(o.real26 || o.real) - o.real25) / o.real25 * 100;
    o.deltaYoY = Math.abs(d) < 1 ? Math.round(d * 10) / 10 : Math.round(d);
    if (o.deltaYoY === 0 && d !== 0) o.deltaYoY = Math.round(d * 100) / 100;
  }
  (D.meses || []).concat([D.mesAtual]).forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    ['aqua', 'bio', 'pai', 'total'].forEach(function (k) { deltaExato(m[k]); });
  });

  function mesAtivo() { return (typeof mesSelecionado === 'object' && mesSelecionado) || (D.meses && D.meses[D.mesAtualIdx]) || D.mesAtual; }
  function totaisMes(m, comBio) {
    var a = m.aqua || {}, b = m.bio || {}, p = m.pai || {};
    var f = function (k) { return num(a[k]) + num(p[k]) + (comBio ? num(b[k]) : 0); };
    var r26 = f('real26') || f('real');
    return { r26: r26, r25: f('real25'), obz: f('obz'), proj: f('proj'), par26: f('par26'), par25: f('par25') };
  }

  // ---------- aba Mês ----------
  function cardsAcum(m) {
    var ac = (m && m.acum) || D.acum;
    if (!ac) return;
    var comBio = bioGlobal();
    [['aqua', 'aqua'], ['bio', 'bio'], ['pai', 'pai']].forEach(function (k) {
      var v = ac[k[0]]; if (!v) return;
      setVar('ac_' + k[1] + 'd', dPct(num(v.r26), num(v.r25)));
    });
    var t = somaAcum(ac, comBio);
    if ($('ac_tot26')) $('ac_tot26').textContent = n0(t.r26);
    if ($('ac_tot25')) $('ac_tot25').textContent = 'vs ' + n0(t.r25) + ' em 2025';
    setVar('ac_totd', dPct(t.r26, t.r25));
  }
  function posMes(m) {
    if (!m || typeof m !== 'object') return;
    var comBio = bioMes(m.label);
    var t = totaisMes(m, comBio);
    // T4 + T3: referência 2025 e diferença em bilhetes
    if ($('h_ref25')) $('h_ref25').textContent = n0(t.r25);
    var dif = t.r26 - t.r25;
    if ($('h_refdiff')) $('h_refdiff').textContent = t.r25 > 0 ? (dif >= 0 ? '+' : '-') + n0(Math.abs(dif)) + ' bilhetes' : '';
    // T7: variações pelo valor exato
    setVar('h_yoy', dPct(t.r26, t.r25), ' vs 2025');
    setVar('tot_yoy', dPct(t.r26, t.r25), ' vs 2025');
    [['aqua', m.aqua], ['bio', m.bio], ['pai', m.pai]].forEach(function (k) {
      var o = k[1] || {};
      if ($(k[0] + '_yoy')) setVar(k[0] + '_yoy', dPct(num(o.real26 || o.real), num(o.real25)));
      if ($(k[0] + '_projpct') && num(o.obz) > 0) setAting(k[0] + '_projpct', num(o.proj) / o.obz * 100);
    });
    // T6: atingimento da projeção
    var pT = t.obz > 0 ? t.proj / t.obz * 100 : null;
    setAting('h_projpct', pT);
    setAting('tot_projpct', pT);
    setAting('tb_tot_projd', pT);
    [['aqua', m.aqua], ['pai', m.pai], ['bio', m.bio]].forEach(function (k) {
      var o = k[1] || {};
      if (k[0] === 'bio' && !comBio) return;
      setAting('tb_' + k[0] + '_projd', num(o.obz) > 0 ? num(o.proj) / o.obz * 100 : null);
    });
    cardsAcum(m);
  }
  var renderMesOrig = renderMes;
  renderMes = function (m) {
    var r = renderMesOrig.apply(this, arguments);
    try { posMes(m); } catch (e) { aviso('renderMes', e); }
    return r;
  };
  window.renderMes = renderMes;

  // ---------- mobile ----------
  function cardsAcumMob(m) {
    var el = $('mobAcumContent');
    var ac = (m && m.acum) || D.acum;
    if (!el || !ac || !ac.aqua) return;
    var comBio = bioGlobal();
    var t = somaAcum(ac, comBio);
    var itens = [
      { lbl: pkImg('aqua', 16) + ' AquaRio', v: ac.aqua, cor: 'var(--aqua)' },
      { lbl: pkImg('bio', 16) + ' BioParque', v: ac.bio, cor: 'var(--bio)', bio: true },
      { lbl: pkImg('pai', 16) + ' Paineiras', v: ac.pai, cor: 'var(--pai)' },
      { lbl: 'TOTAL GRUPO', v: t, cor: 'var(--navy)' }
    ].filter(function (x) { return x.v && (!x.bio || comBio); });
    el.innerHTML = '<div class="mob-section-title">ACUMULADO 2026</div>' + itens.map(function (x) {
      var v26 = num(x.v.r26), v25 = num(x.v.r25), f = varPct(dPct(v26, v25));
      var maxV = Math.max(v26, v25), w = maxV > 0 ? Math.round(v26 / maxV * 100) : 0;
      return '<div class="mob-acum-card"><div class="mob-acum-header"><div class="mob-acum-label" style="color:' + x.cor + '">' + x.lbl + '</div>'
        + '<div class="mob-acum-delta ' + (f.up === false ? 'dn' : 'up') + '">' + f.txt + '</div></div>'
        + '<div class="mob-acum-vals"><div class="mob-acum-v26">' + n0(v26) + '</div><div class="mob-acum-v25">vs ' + n0(v25) + ' em 2025</div></div>'
        + '<div class="mob-acum-bar"><div class="mob-acum-fill" data-w="' + w + '" style="width:0%;background:' + x.cor + '"></div></div></div>';
    }).join('');
    try { animateBars(); } catch (e) {}
  }
  // cópia do mês com o total refeito sem o Bio (o hero e os totais mobile liam o total da
  // planilha, que soma o Bio em jan a jul mesmo com o botão ligado)
  function mesSemBio(m) {
    var t = totaisMes(m, false), c = {};
    Object.keys(m).forEach(function (k) { c[k] = m[k]; });
    var tot = {};
    Object.keys(m.total || {}).forEach(function (k) { tot[k] = m.total[k]; });
    tot.real26 = t.r26; tot.real = t.r26; tot.real25 = t.r25; tot.obz = t.obz; tot.proj = t.proj;
    tot.par26 = t.par26; tot.par25 = t.par25;
    tot.pctMeta = t.obz > 0 ? Math.round(t.r26 / t.obz * 100) : 0;
    tot.pctProj = t.obz > 0 ? Math.round(t.proj / t.obz * 100) : 0;
    var d = dPct(t.r26, t.r25);
    tot.deltaYoY = d === null ? 0 : (Math.abs(d) < 1 ? Math.round(d * 10) / 10 : Math.round(d));
    c.total = tot;
    return c;
  }
  var bmcOrig = buildMobContent;
  buildMobContent = function (pageId, mesData) {
    var m = mesData || D.mesAtual, r;
    if (pageId === 'mar' && m && typeof m === 'object' && m.total && !bioMes(m.label)) {
      r = bmcOrig.call(this, pageId, mesSemBio(m));
    } else {
      r = bmcOrig.apply(this, arguments);
    }
    try { if (pageId === 'acum') cardsAcumMob(m); } catch (e) { aviso('mobile acum', e); }
    return r;
  };
  window.buildMobContent = buildMobContent;

  // Textos de leitura do Acumulado eram fixos desde março ("+60% no acumulado (35.034 vs 21.839)").
  // Agora saem dos mesmos números dos cards, para o mês selecionado.
  function insightsAcum(mesData) {
    var ac = (mesData && mesData.acum) || D.acum;
    var box = document.querySelectorAll('#pg-acum .irow .ins');
    if (!ac || box.length < 3) return;
    var nM = (D.meses && mesData) ? D.meses.indexOf(mesData) + 1 : 0;
    if (nM < 1) nM = (D.hist26.aqua || []).filter(function (v) { return v !== null; }).length;
    var mSel = (D.meses || [])[nM - 1] || {}, ultMes = MESES[nM - 1].toLowerCase();
    var aberto = !mSel.isFechado && mSel.diaAtual > 0;
    var periodo = (nM === 1 && !aberto) ? 'jan' : 'jan a ' + (aberto ? (mSel.diaAtual < 10 ? '0' : '') + mSel.diaAtual + '/' : '') + ultMes;
    var itens = [['aqua', 'AquaRio', box[0]], ['bio', 'BioParque', box[1]], ['pai', 'Paineiras', box[2]]];
    itens.forEach(function (it) {
      var v = ac[it[0]], el = it[2];
      if (!v || !el) return;
      var d = dPct(num(v.r26), num(v.r25)), f = varPct(d);
      var serie = (D.hist26[it[0]] || []).slice(0, nM), melhor = -1;
      serie.forEach(function (x, i) { if (x !== null && (melhor < 0 || x > serie[melhor])) melhor = i; });
      el.className = 'ins ' + (d === null ? 'warn' : d >= 5 ? 'good' : d >= -5 ? 'warn' : 'alert');
      var ic = el.querySelector('.ins-icon');
      if (ic) ic.textContent = d === null ? 'ℹ️' : d >= 5 ? '📈' : d >= -5 ? '🟡' : '🔴';
      var tx = el.querySelector('.ins-text');
      if (tx) tx.innerHTML = '<strong>' + it[1] + ' no acumulado (' + periodo + '):</strong> ' + f.txt + ' vs 2025 ('
        + n0(v.r26) + ' vs ' + n0(v.r25) + ').' + (melhor >= 0 && serie[melhor] > 0 ? ' Maior mês de 2026: ' + MESES[melhor] + ' (' + n0(serie[melhor]) + ').' : '');
    });
  }

  // ---------- aba Acumulado ----------
  var initAcumOrig = initAcum;
  initAcum = function (mesData) {
    var r = initAcumOrig.apply(this, arguments);
    try {
      cardsAcum(mesData);
      insightsAcum(mesData);
      // Trade vs Parque: mesmas contas do original, só o sinal/arredondamento (T7)
      var a = (mesData && mesData.acum) || D.acum;
      var nM = (D.meses && mesData) ? D.meses.indexOf(mesData) + 1 : 0;
      if (nM < 1) nM = (D.hist26 && D.hist26.aqua) ? D.hist26.aqua.filter(function (v) { return v !== null; }).length : 1;
      var parque = function (k) {
        var p26 = 0, p25 = 0;
        (D.meses || []).slice(0, nM).forEach(function (m) { p26 += num((m[k] || {}).par26); });
        for (var i = 0; i < nM; i++) p25 += num(D.histPar25 && D.histPar25[k] ? D.histPar25[k][i] : 0);
        return [p26, p25];
      };
      var ordem = ['aqua', 'pai'].concat(_bioAcumOn ? ['bio'] : []);
      var cards = document.querySelectorAll('#acumTV .acum-tv-card');
      ordem.forEach(function (k, i) {
        var c = cards[i]; if (!c || !a || !a[k]) return;
        var ds = c.querySelectorAll('.acum-tv-delta'), p = parque(k);
        if (ds[0]) setVar(ds[0], dPct(num(a[k].r26), num(a[k].r25)), ' vs 2025');
        if (ds[1]) setVar(ds[1], dPct(p[0], p[1]), ' vs 2025');
      });
    } catch (e) { aviso('initAcum', e); }
    return r;
  };
  window.initAcum = initAcum;

  // ---------- aba Histórico ----------
  var hist25Orig = null;
  function cardsHist25(comBio) {
    var row = $('rowHist25');
    if (!row) return;
    var cards = row.querySelectorAll('.acum-card');
    var tot = cards[cards.length - 1];
    if (!tot) return;
    if (hist25Orig === null) hist25Orig = tot.innerHTML;
    if (comBio) { tot.innerHTML = hist25Orig; return; }
    var meta = function (card) {
      var t = (card && card.querySelector('.acum-v25') || {}).textContent || '';
      var mm = t.match(/Meta:\s*([\d.]+)/);
      return mm ? parseInt(mm[1].replace(/\./g, ''), 10) : 0;
    };
    var soma = function (arr) { return (arr || []).reduce(function (s, v) { return s + num(v); }, 0); };
    var r25 = soma(D.hist25.aqua) + soma(D.hist25.pai);
    var r24 = soma(D.hist24.aqua) + soma(D.hist24.pai);
    var mt = meta(cards[0]) + meta(cards[2]);
    // mesmo formato dos cards vizinhos (1 casa decimal)
    var um = function (v) { return Math.abs(v).toFixed(1).replace('.', ','); };
    var vm = dPct(r25, mt), v24 = dPct(r25, r24);
    tot.innerHTML = '<div class="acum-label">TOTAL 2025 (sem BioParque)</div><div class="acum-v26">' + n0(r25) + '</div>'
      + '<div class="acum-v25">Meta: ' + n0(mt) + (vm === null ? '' : ' · ' + (vm >= 0 ? '▲ ' : '▼ ') + um(vm) + '%') + '</div>'
      + (v24 === null ? '' : '<div class="acum-delta ' + (v24 >= 0 ? 'up' : 'dn') + '">' + (v24 >= 0 ? '▲' : '▼') + ' vs 2024: ' + (v24 >= 0 ? '+' : '-') + um(v24) + '%</div>');
  }
  function cardsHistKpi(comBio) {
    var ult = (D.meses || []).slice(-1)[0] || {};
    var ac = ult.acum || D.acum || {};
    var aberto = ult && !ult.isFechado && ult.diaAtual > 0;
    var idxUlt = typeof ult.mesIdx === 'number' ? ult.mesIdx : null;
    var dd = function (v) { return (v < 10 ? '0' : '') + v; };
    var corte = idxUlt === null ? '' : (aberto ? 'jan a ' + dd(ult.diaAtual) + '/' + MESES[idxUlt].toLowerCase() : 'jan a ' + MESES[idxUlt].toLowerCase());
    var soma = function (arr, n) { return (arr || []).slice(0, n).reduce(function (s, v) { return s + num(v); }, 0); };
    var cont = function (arr) { return (arr || []).filter(function (v) { return v !== null && v !== undefined; }).length; };
    var parques = [['aqua', 'AquaRio', 'rgba(0,95,142,1)'], ['pai', 'Paineiras', 'rgba(45,106,43,1)']].concat(comBio ? [['bio', 'BioParque', 'rgba(194,90,0,1)']] : []);
    parques.forEach(function (pk) {
      var k = pk[0], el = $('hkpi_' + k);
      if (!el) return;
      var t24 = D.hist24[k], t25 = D.hist25[k], t26 = D.hist26[k];
      var p24 = (D.histPar24 || {})[k], p25 = (D.histPar25 || {})[k], p26 = (D.histPar26 || {})[k];
      var nM = cont(t26), nM24 = cont(t24);
      var tS24 = soma(t24, nM24), tS25 = soma(t25, 12), tS26 = soma(t26, nM);
      var pS24 = soma(p24, nM24), pS25 = soma(p25, 12), pS26 = soma(p26, nM);
      // mesmo período de 2025: Trade igual à aba Acumulado; Parque com o mesmo corte de dias
      // (D.histPar25 do mês em andamento já vem cortado no mesmo dia de 2026)
      var tMP = ac[k] && typeof ac[k].r25 === 'number' ? ac[k].r25 : soma(t25, nM);
      var pMP = soma(p25, nM);
      var p25Inc = cont(p25) < 12 || (aberto && idxUlt !== null && idxUlt < 12);
      var vt = varPct(dPct(tS26, tMP)), vp = varPct(dPct(pS26, pMP));
      var cls = function (f) { return f.up === false ? 'dn' : 'up'; };
      var h = '<div class="hist-kpi-lbl" style="color:' + pk[2] + '">' + pkImg(k, 16) + ' ' + pk[1] + '</div><div class="hist-kpi-row">';
      if (nM24 > 0) h += '<div class="hist-kpi-yr"><span class="hist-kpi-tag">2024</span><div class="hist-kpi-t">Trade: <strong>' + n0(tS24) + '</strong></div><div class="hist-kpi-p">Parque: <strong>' + n0(pS24) + '</strong></div></div>';
      h += '<div class="hist-kpi-yr"><span class="hist-kpi-tag">2025</span><div class="hist-kpi-t">Trade: <strong>' + n0(tS25) + '</strong></div>'
        + '<div class="hist-kpi-p"' + (p25Inc ? ' title="Visitação do parque em 2025 só até ' + corte + ' (sem dado dos meses seguintes no Dash)"' : '') + '>Parque' + (p25Inc ? '*' : '') + ': <strong>' + n0(pS25) + '</strong></div></div>';
      h += '<div class="hist-kpi-yr on" style="border-color:' + pk[2] + '"><span class="hist-kpi-tag" style="color:' + pk[2] + '">2026' + (corte ? ' (' + corte + ')' : '') + '</span>'
        + '<div class="hist-kpi-t">Trade: <strong>' + n0(tS26) + '</strong><span class="hist-kpi-d ' + cls(vt) + '">' + vt.txt + '</span></div>'
        + '<div class="hist-kpi-p">Parque: <strong>' + n0(pS26) + '</strong><span class="hist-kpi-d ' + cls(vp) + '">' + vp.txt + '</span></div>'
        + '<div class="hist-kpi-p" style="font-size:10px;color:var(--muted);margin-top:4px">vs mesmo período de 2025: Trade ' + n0(tMP) + ' · Parque ' + n0(pMP) + '</div></div>';
      h += '</div>';
      if (p25Inc) h += '<div style="font-size:10px;color:var(--muted);margin-top:6px">* Parque 2025: ' + corte + ' (os meses seguintes de 2025 ainda não estão no Dash).</div>';
      el.innerHTML = h;
    });
  }
  var initHistOrig = initHist;
  initHist = function () {
    var r = initHistOrig.apply(this, arguments);
    try { var b = bioGlobal(); cardsHist25(b); cardsHistKpi(b); } catch (e) { aviso('initHist', e); }
    return r;
  };
  window.initHist = initHist;

  // ---------- aba Intel. de Mercado (T1 e T2): reescrita de initImm ----------
  initImm = function (mesData) {
    var imm = D.imm || {};
    var vazio = { y25: [], y26: [] };
    // 0 de visitação no monumento/concorrente = mês ainda sem dado
    var limpa = function (arr) { var o = []; for (var i = 0; i < 12; i++) { var v = (arr || [])[i]; o.push((v === null || v === undefined || v === 0) ? null : v); } return o; };
    var hp25 = (D.histPar25 || {}).pai, hp26 = (D.histPar26 || {}).pai;
    var ult = (D.meses || []).slice(-1)[0] || {};
    var idxAberto = (!ult.isFechado && ult.diaAtual > 0 && typeof ult.mesIdx === 'number') ? ult.mesIdx : -1;
    var entidades = [
      { nome: 'Paineiras (visitação total)', cor: 'var(--pai)', y25: limpa(hp25), y26: limpa(hp26), parcial: idxAberto },
      { nome: 'Trem do Corcovado', cor: 'var(--aqua)', y25: limpa((imm.trem || vazio).y25), y26: limpa((imm.trem || vazio).y26) },
      { nome: 'Bondinho Pão de Açúcar', cor: 'var(--bio)', y25: limpa((imm.bondinho || vazio).y25), y26: limpa((imm.bondinho || vazio).y26) },
      { nome: 'Cristo Redentor (monumento)', cor: 'var(--muted)', y25: limpa((imm.cristo || vazio).y25), y26: limpa((imm.cristo || vazio).y26) }
    ];
    // 2025 da Paineiras no mês em andamento vem cortado no mesmo dia (mesmo período): marca com *
    var fmtV = function (v, star) { return v === null ? '-' : n0(v) + (star ? '*' : ''); };
    var fmtD = function (a, b) {
      if (a === null || b === null || !a) return '<span>-</span>';
      var d = (b - a) / a * 100, s = Math.abs(d).toFixed(1).replace('.', ',');
      return '<span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + s + '%</span>';
    };
    var head = '<th class="se-th-label">Entidade · Ano</th>' + MESES.map(function (m, i) { return '<th>' + m + (i === idxAberto ? '*' : '') + '</th>'; }).join('');
    var body = entidades.map(function (e) {
      var star = function (i) { return e.parcial === i; };
      return '<tr class="se-row-park"><td class="se-td-label" style="color:' + e.cor + '">' + e.nome + ' · 2025</td>' + MESES.map(function (m, i) { return '<td>' + fmtV(e.y25[i], star(i)) + '</td>'; }).join('') + '</tr>'
        + '<tr><td class="se-td-label">2026</td>' + MESES.map(function (m, i) { return '<td>' + fmtV(e.y26[i], star(i)) + '</td>'; }).join('') + '</tr>'
        + '<tr class="se-row-delta"><td class="se-td-label">Δ% vs 2025</td>' + MESES.map(function (m, i) { return '<td>' + fmtD(e.y25[i], e.y26[i]) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var nota = idxAberto >= 0 ? '<div style="font-size:10px;color:var(--muted);margin-top:6px">* ' + MESES[idxAberto] + ': mês em andamento. Paineiras compara 2026 e 2025 até o mesmo dia (' + (ult.diaAtual < 10 ? '0' : '') + ult.diaAtual + '/' + MESES[idxAberto].toLowerCase() + '). Paineiras = visitação total do parque (todos os canais), não só Trade.</div>' : '';
    var wrap = $('immReguaWrap');
    if (wrap) wrap.innerHTML = '<table class="se-regua"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' + nota;

    // Captação: último mês FECHADO (até o mês selecionado) com Paineiras, Trem e Cristo
    var pai = entidades[0], trem = entidades[1], cristo = entidades[3];
    var mSel = mesData || D.mesAtual || {};
    var selObj = (D.meses || []).filter(function (mm) { return mm.label === mSel.label; })[0];
    var idxSel = selObj ? selObj.mesIdx : 11;
    var fechado = {};
    (D.meses || []).forEach(function (mm) { fechado[mm.mesIdx] = !!mm.isFechado; });
    var idx = -1;
    for (var i = Math.min(11, idxSel); i >= 0; i--) {
      if (!fechado[i]) continue;
      if (pai.y26[i] !== null && trem.y26[i] !== null && cristo.y26[i] !== null) { idx = i; break; }
    }
    var cardsEl = $('immCaptacaoCards'), subEl = $('immCaptacaoSub');
    if (!cardsEl) return;
    if (idx < 0) {
      cardsEl.innerHTML = '<div class="acum-card"><div class="acum-label">Sem dado suficiente</div><div class="acum-v25">Nenhum mês fechado com Paineiras, Trem do Corcovado e Cristo Redentor preenchidos ao mesmo tempo ainda (o mês em andamento nunca entra aqui).</div></div>';
      return;
    }
    if (subEl) subEl.textContent = '% que cada acesso representa do total de visitantes do monumento em ' + MESES[idx] + '/2026 (último mês fechado com dado). Paineiras = visitação total do parque.';
    var pc = function (a, b) { return (a !== null && b) ? a / b * 100 : null; };
    function card(nome, cor, p26, p25) {
      var dl = '';
      if (p25 !== null) {
        var d = p26 - p25;
        dl = '<div class="acum-delta ' + (d >= 0 ? 'up' : 'dn') + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(d).toFixed(1).replace('.', ',') + ' p.p. vs 2025</div>';
      }
      return '<div class="acum-card"><div class="acum-label" style="color:' + cor + '">' + nome + '</div>'
        + '<div class="acum-v26">' + p26.toFixed(1).replace('.', ',') + '%</div>'
        + '<div class="acum-v25">' + (p25 !== null ? 'vs ' + p25.toFixed(1).replace('.', ',') + '% em 2025' : 'sem base 2025') + '</div>' + dl + '</div>';
    }
    cardsEl.innerHTML = card('Paineiras / Cristo Redentor', 'var(--pai)', pc(pai.y26[idx], cristo.y26[idx]), pc(pai.y25[idx], cristo.y25[idx]))
      + card('Trem do Corcovado / Cristo Redentor', 'var(--aqua)', pc(trem.y26[idx], cristo.y26[idx]), pc(trem.y25[idx], cristo.y25[idx]));
  };
  window.initImm = initImm;

  // ---------- reaplica no que já está na tela ----------
  function reaplicar() {
    try {
      fixArvore(document.body);
      var m = mesAtivo();
      if (m && typeof m === 'object') {
        renderMes(m);
        if (typeof curPage !== 'undefined' && curPage && curPage !== 'mar') initCharts(curPage, m);
      }
    } catch (e) { aviso('reaplicar', e); }
  }
  if (document.readyState === 'complete') reaplicar();
  else window.addEventListener('load', function () { setTimeout(reaplicar, 300); });
})();

/* 14/10/2026 (Paulo aprovou seguir com o celular): correções de bug no layout de celular, só na
   faixa de celular do Trade (max-width:860px, a mesma em que aparecem .mob-header/.mob-nav2).
   Desktop (861px+) não muda.
   1) Barra de abas (.mob-nav2) tem "position:relative" com top:48px (sobra do sticky original) e
      ficava deslocada 48px por cima do primeiro card. Fica no fluxo normal (top:0), sem cobrir nada.
      Obs.: o sticky original não funciona porque html e body têm overflow-x:hidden; deixar a barra
      fixa na tela é decisão de layout (prévia da navegação inferior), não entra aqui.
   2) Alvos de toque: abas, seletor de mês e abas internas do Top com no mínimo 40-44px.
   3) Texto com menos de 12px sobe pra 12px.
   4) Top Clientes: # e Agência fixos (sticky) e a tabela abre rolada até a coluna de bilhetes do
      período selecionado. Intel: régua abre no mês atual. */
(function () {
  if (window.__tradePatchMobile) return;
  window.__tradePatchMobile = true;
  var MQ = window.matchMedia('(max-width:860px)');
  var MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  var hoje = new Date();
  var CHAVE_HOJE = hoje.getFullYear() * 12 + hoje.getMonth();

  var css = document.createElement('style');
  css.id = 'tradePatchMobileCss';
  css.textContent = [
    '@media (max-width:860px){',
    '  .mob-nav2{ top:0 !important; height:auto !important; min-height:var(--mob-nav2-h); padding:4px 10px !important; }',
    '  .mob-nav2-btn{ min-height:40px; padding:6px 12px !important; font-size:12px !important; }',
    '  .mob-nav2-sel{ min-height:40px; }',
    '  .cli-tab{ min-height:44px; font-size:12px !important; }',
    '  .cli-seg-btn{ min-height:40px; }',
    '  .cli-select{ min-height:44px; }',
    '  .mob-header .bio-global-toggle, .mob-header .theme-toggle-btn{ position:relative; }',
    '  .mob-header .bio-global-toggle::after, .mob-header .theme-toggle-btn::after{ content:""; position:absolute; inset:-11px -5px; }',
    '  .cli-tbl th, .cli-tbl td{ font-size:12px; }',
    '  .cli-tbl th:first-child, .cli-tbl td:first-child{ padding-left:6px; padding-right:4px; }',
    '  .cli-tbl td:nth-child(2){ white-space:normal; min-width:96px; max-width:118px; line-height:1.25; }',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  function rgba(s) {
    var m = String(s || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function fundoOpaco(el) {
    var camadas = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = rgba(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
    }
    var base = { r: 255, g: 255, b: 255 };
    for (var i = camadas.length - 1; i >= 0; i--) {
      var k = camadas[i];
      base = { r: k.r * k.a + base.r * (1 - k.a), g: k.g * k.a + base.g * (1 - k.a), b: k.b * k.a + base.b * (1 - k.a) };
    }
    return 'rgb(' + Math.round(base.r) + ',' + Math.round(base.g) + ',' + Math.round(base.b) + ')';
  }
  function areaRolavel(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return p;
    }
    return null;
  }
  function chaveMes(txt) {
    var m = String(txt || '').trim().toUpperCase().match(/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-ZÇ]*\*?\s*(?:\/\s*(\d{2,4}))?/);
    if (!m) return null;
    var a = m[2] ? parseInt(m[2], 10) : hoje.getFullYear();
    if (a < 100) a += 2000;
    return a * 12 + MESES.indexOf(m[1]);
  }
  function fixar(cel, left) {
    if (cel.dataset.tpmStk !== undefined) return;
    cel.dataset.tpmStk = cel.style.cssText;
    var fundo = fundoOpaco(cel);
    cel.style.position = 'sticky';
    cel.style.left = left + 'px';
    cel.style.zIndex = cel.tagName === 'TH' ? '4' : '3';
    cel.style.backgroundColor = fundo;
    cel.style.boxShadow = 'inset -1px 0 0 rgba(0,0,0,.12)';
  }
  function rolarAte(area, alvo, largFixa) {
    if (!alvo || area.dataset.tpmRolou === '1' || area.scrollLeft > 4) return;
    var ra = area.getBoundingClientRect();
    var x = alvo.getBoundingClientRect().left - ra.left + area.scrollLeft;
    var s = x - largFixa - 2;
    // se o mês ainda cabe sem rolar, não mexe
    if (alvo.getBoundingClientRect().right <= ra.right) return;
    if (s > 8) { area.scrollLeft = s; area.dataset.tpmRolou = '1'; }
  }

  // Top Clientes: # + Agência fixos, rola até a coluna de bilhetes do período ("AGO/2026 → OUT/2026")
  function topClientes() {
    var tb = document.querySelector('#cli-rank-tbl table.cli-tbl');
    if (!tb || !tb.offsetParent || tb.dataset.tpmFeito) return;
    var area = areaRolavel(tb);
    if (!area || tb.scrollWidth <= area.clientWidth + 4) return;
    tb.dataset.tpmFeito = '1';
    var pad = -(parseFloat(getComputedStyle(area).paddingLeft) || 0);
    var cab = tb.tHead ? tb.tHead.rows[tb.tHead.rows.length - 1] : tb.rows[0];
    var w0 = cab.cells[0].offsetWidth;
    var w1 = cab.cells[1].offsetWidth;
    Array.prototype.forEach.call(tb.rows, function (r) {
      if (r.cells.length < 3) return;
      if (r.cells[0].offsetLeft <= 3) fixar(r.cells[0], pad);
      if (Math.abs(r.cells[1].offsetLeft - w0) <= 3) fixar(r.cells[1], pad + w0);
    });
    var alvo = null;
    Array.prototype.some.call(cab.cells, function (c) { if (/\d{4}\s*→/.test(c.textContent) && !/^2025/.test(c.textContent.trim())) { alvo = c; return true; } return false; });
    rolarAte(area, alvo, w0 + w1);
  }
  // Intel (.se-regua): já tem 1ª coluna fixa, só abre no mês atual
  function reguas() {
    document.querySelectorAll('table.se-regua').forEach(function (tb) {
      if (!tb.offsetParent) return;
      var area = areaRolavel(tb);
      if (!area || area.dataset.tpmRolou === '1' || tb.scrollWidth <= area.clientWidth + 4) return;
      var cab = tb.tHead ? tb.tHead.rows[tb.tHead.rows.length - 1] : tb.rows[0];
      var alvo = null, melhor = -1;
      Array.prototype.forEach.call(cab.cells, function (c) { var k = chaveMes(c.textContent); if (k !== null && k <= CHAVE_HOJE && k > melhor) { melhor = k; alvo = c; } });
      if (!alvo) return;
      var largFixa = cab.cells[0].getBoundingClientRect().width;
      var ra = area.getBoundingClientRect();
      var rc = alvo.getBoundingClientRect();
      // mês atual encostado na direita, com os anteriores à esquerda
      var s = rc.right - ra.left + area.scrollLeft - area.clientWidth + 6;
      s = Math.min(s, rc.left - ra.left + area.scrollLeft - largFixa - 2);
      if (s > 8) { area.scrollLeft = s; area.dataset.tpmRolou = '1'; }
    });
  }
  function fonteMinima() {
    var raizes = document.querySelectorAll('.mob-header, .mob-nav2, .page.on, .foot');
    if (!raizes.length) raizes = [document.body];
    Array.prototype.forEach.call(raizes, function (raiz) {
      raiz.querySelectorAll('*').forEach(function (el) {
        if (el.dataset && el.dataset.tpmFz !== undefined) return;
        if (el.closest('svg') || /^(CANVAS|SCRIPT|STYLE)$/.test(el.tagName)) return;
        var texto = false;
        for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { texto = true; break; } }
        if (!texto && !/^(INPUT|SELECT|BUTTON)$/.test(el.tagName)) return;
        if (!el.offsetParent) return;
        if (parseFloat(getComputedStyle(el).fontSize) < 11.95) {
          el.dataset.tpmFz = el.style.getPropertyValue('font-size') + '|' + el.style.getPropertyPriority('font-size');
          el.style.setProperty('font-size', '12px', 'important');
        }
      });
    });
  }
  var timer = null;
  function passar() {
    timer = null;
    if (!MQ.matches) return;
    try { fonteMinima(); topClientes(); reguas(); } catch (e) { if (window.console) console.warn('[trade_patch mobile]', e); }
  }
  function agendar(ms) { if (!MQ.matches || timer) return; timer = setTimeout(passar, ms || 250); }
  function desfazer() {
    document.querySelectorAll('[data-tpm-stk]').forEach(function (c) { c.style.cssText = c.dataset.tpmStk; delete c.dataset.tpmStk; });
    document.querySelectorAll('[data-tpm-fz]').forEach(function (el) {
      var p = el.dataset.tpmFz.split('|');
      el.style.removeProperty('font-size');
      if (p[0]) el.style.setProperty('font-size', p[0], p[1] || '');
      delete el.dataset.tpmFz;
    });
    document.querySelectorAll('[data-tpm-feito]').forEach(function (t) { delete t.dataset.tpmFeito; });
    document.querySelectorAll('[data-tpm-rolou]').forEach(function (a) { delete a.dataset.tpmRolou; });
  }
  new MutationObserver(function () { agendar(300); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', function () { agendar(300); }, true);
  window.addEventListener('resize', function () { if (!MQ.matches) { desfazer(); return; } agendar(400); });
  window.tradeMobAplicar = passar;
  agendar(600);
})();
