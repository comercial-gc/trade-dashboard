/* 26/10/2026 (e-mail "Demandas Dash Trade", Paula Bottino): abas novas do Trade Dashboard.
   Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py), então sobrevive ao
   rebuild do index.html pelo Apps Script e não mexe no script principal.

   Abas novas
     OBZ                 Trade e Escolar (AquaRio) realizado x meta OBZ, mês a mês, comparativos com o
                         mesmo período de 2025 e com o mês anterior, e quanto falta para a meta do mês.
     Indicadores Parques B2B x B2C x total por mês, dia útil x fim de semana x feriado, eventos e
                         antecedência de compra.
     Origem              share e antecedência por país do visitante e feriados dos mercados principais.
     Oportunidades       agências que já compraram e estão há mais de 6 meses sem comprar.
   Top Clientes ganha a subaba "Carteira": segmentação do Mapa de Canal 2026 (mesmos 4 grupos) com
   cidade e flags de Portal do Agente / Portal do Guia quando o cadastro existir.

   Fontes
     D (embutido no index.html pelo Apps Script): Trade oficial (linha "Parcial:" da planilha TRADE),
       meta OBZ, Escolar e meta Escolar, visitação do parque (Controladoria) e Top Clientes por mês.
     trade_indicadores.json (combos_extract.py do Dash de Performance, brutos de bilheteria): B2B x B2C
       por dia, antecedência, país, última venda de cada agência e feriados do Rio.
     feriados_mercados.json: feriados nacionais por país (python-holidays), 2025 a 2027.
     trade_agencias_cadastro.json (opcional): cidade, UF e portais de cada agência. Sem ele as colunas
       mostram "sem cadastro" em vez de inventar valor. */
(function () {
  if (window.__tradeV2) return;
  window.__tradeV2 = true;
  if (typeof D === 'undefined' || !D.meses) return;

  var BASE = 'https://comercial-gc.github.io/trade-dashboard/';
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) BASE = '';
  var PK = { a: 'aqua', p: 'pai' };
  var NOME = { a: 'AquaRio', p: 'Paineiras', t: 'AquaRio + Paineiras' };
  var NOME_TIND = { a: 'AquaRio', p: 'Paineiras' };
  var COR = { a: '#005F8E', p: '#2D6A2B', t: '#0D1B2A' };
  var COR_L = { a: '#00B4D8', p: '#56C354', t: '#6B8A9E' };
  var MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var IDX = Number(D.mesAtualIdx);
  var MA = D.meses[IDX] || {};
  var charts = {};
  var DADOS = { ind: null, fer: null, cad: null, carregado: false, erro: {} };

  // ---------------------------------------------------------------- utilidades
  function nf(v) { return v == null || isNaN(v) ? '-' : Math.round(v).toLocaleString('pt-BR'); }
  function pf(v, casas) { return v == null || !isFinite(v) ? '-' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: casas == null ? 1 : casas }) + '%'; }
  function ehZero(t) { return /^0([,.]0+)?(%| p\.p\.)?$/.test(t); }
  function sinal(v, fmt) { if (v == null || !isFinite(v)) return '-'; var t = fmt(Math.abs(v)); return ehZero(t) ? t : (v > 0 ? '+' : v < 0 ? '−' : '') + t; }
  function varPct(a, b) { return b ? a / b - 1 : null; }
  function cls(v) { return v == null ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : ''; }
  function pill(v, fmt) {
    var t = sinal(v, fmt || function (x) { return pf(x); });
    return '<span class="cli-pill ' + (v == null || ehZero(t) ? 'zero' : v > 0 ? 'up' : 'dn') + '">' + t + '</span>';
  }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chave(n) {
    return String(n || '').replace(/�/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/\d{8,}/g, ' ').replace(/[^A-Z0-9& ]/g, ' ')
      .replace(/\b(LTDA|LIMITADA|ME|EPP|EIRELI|EIRELLI|SA|S A|SOCIEDADE ANONIMA)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // mesmo agrupamento de agências do Top Clientes (trade_patch.js expõe cliNormAlias), com fallback
  function alias(n) { try { return typeof window.cliNormAlias === 'function' ? window.cliNormAlias(n) : n; } catch (e) { return n; } }
  function ym(ano, m0) { return ano + '-' + String(m0 + 1).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataBR(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '-'; }
  function mesLbl(k) { return MES[Number(k.slice(5, 7)) - 1] + '/' + k.slice(2, 4); }
  function kill(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function grade() { var dk = document.documentElement.getAttribute('data-theme') === 'dark'; return { grid: dk ? '#2b333b' : '#E6EEF3', txt: dk ? '#93A2AC' : '#6B8A9E' }; }
  function tinta() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '#E7ECEF' : '#0D1B2A'; } // linha de meta / total
  function eixos(extra) {
    var g = grade();
    var o = { x: { grid: { display: false }, ticks: { color: g.txt, font: { size: 10 } } },
      y: { grid: { color: g.grid }, ticks: { color: g.txt, font: { size: 10 }, callback: function (v) { return nf(v); } }, beginAtZero: true } };
    return Object.assign(o, extra || {});
  }
  function grafico(id, cfg) {
    kill(id);
    var c = el(id);
    if (!c || typeof Chart === 'undefined') return null;
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 10.5 }, color: grade().txt } } } }, cfg.options || {});
    charts[id] = new Chart(c, cfg);
    return charts[id];
  }
  function seg(id, opcoes, valor, aoMudar) {
    var h = '<div class="cli-seg" id="' + id + '">';
    opcoes.forEach(function (o) {
      h += '<button class="cli-seg-btn' + (o[0] === valor ? ' on-n' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>';
    });
    h += '</div>';
    setTimeout(function () {
      var w = el(id);
      if (!w) return;
      w.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          w.querySelectorAll('button').forEach(function (x) { x.classList.remove('on-n'); });
          b.classList.add('on-n');
          aoMudar(b.getAttribute('data-v'));
        };
      });
    }, 0);
    return h;
  }
  function rotulo(t) { return '<span style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">' + t + '</span>'; }
  function controle(t, html) { return '<div style="display:flex;flex-direction:column;gap:3px">' + rotulo(t) + html + '</div>'; }
  function kpi(lbl, val, sub, delta, cor) {
    return '<div class="cli-kpi-card"><div class="cli-kpi-label">' + lbl + '</div><div class="cli-kpi-val" style="color:' + (cor || 'var(--text)') + '">' + val + '</div>' +
      (sub ? '<div class="cli-kpi-sub">' + sub + '</div>' : '') + (delta ? '<div class="cli-kpi-delta">' + delta + '</div>' : '') + '</div>';
  }
  function aviso(t) { return '<div class="nota">' + t + '</div>'; }
  function carregando(id, oque) {
    var e = DADOS.erro[oque];
    el(id).innerHTML = e ? aviso('⚠️ Não foi possível carregar <strong>' + oque + '</strong> (' + esc(e) + '). Os números desta aba dependem dele.')
      : '<div class="cc" style="text-align:center;color:var(--muted);font-size:12px">Carregando dados…</div>';
  }

  // datas de referência
  var DIA_ATUAL = Number(MA.diaAtual) || 0;
  var DATA_REF = MA.isFechado ? null : new Date(2026, IDX, DIA_ATUAL);
  var REF_TXT = MA.isFechado ? 'mês fechado' : 'parcial até ' + String(DIA_ATUAL).padStart(2, '0') + '/' + String(IDX + 1).padStart(2, '0');

  // ---------------------------------------------------------------- carga dos JSONs
  function getJSON(nome, obrig) {
    return fetch(BASE + nome + '?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) { if (obrig) DADOS.erro[nome] = e.message; return null; });
  }
  var promessa = Promise.all([getJSON('trade_indicadores.json', true), getJSON('feriados_mercados.json', true),
    getJSON('trade_agencias_cadastro.json', false), getJSON('trade_extra.json', false)]).then(function (r) {
    DADOS.ind = r[0]; DADOS.fer = r[1]; DADOS.cad = r[2]; DADOS.extra = r[3]; DADOS.carregado = true;
    if (window.__tv2Pagina && RENDER[window.__tv2Pagina]) RENDER[window.__tv2Pagina]();
  });

  // ================================================================ OBZ
  // Trade oficial e meta do mês i (0 = jan/26) para o parque k ('a', 'p' ou 't' = AquaRio + Paineiras)
  function obzMes(i, k) {
    var m = D.meses[i];
    if (!m) return null;
    var ks = k === 't' ? ['a', 'p'] : [k];
    var o = { i: i, real: 0, meta: 0, r25: 0, fechado: !!m.isFechado, dia: Number(m.diaAtual) || 0, diasMes: m.diasMes };
    ks.forEach(function (x) {
      var d = m[PK[x]] || {};
      o.real += d.real26 || 0; o.meta += d.obz || 0; o.r25 += d.real25 || 0;
    });
    return o;
  }
  function tradeMesCheio(ano, i, k) { // mês fechado inteiro (para o mês anterior)
    var ks = k === 't' ? ['a', 'p'] : [k], s = 0;
    ks.forEach(function (x) {
      if (ano === 2026) s += (D.hist26[PK[x]] || [])[i] || 0;
      else s += i < IDX && D.meses[i] ? (D.meses[i][PK[x]].real25 || 0) : ((D.hist25[PK[x]] || [])[i] || 0);
    });
    return s;
  }
  function escMes(i) {
    var m = D.meses[i], e = m && m.escolarAppai && m.escolarAppai.aqua;
    if (!e) return null;
    return { i: i, real: e.esc26 || 0, meta: e.escMeta || 0, r25: e.esc25 || 0, fechado: !!m.isFechado, dia: Number(m.diaAtual) || 0, diasMes: m.diasMes };
  }
  // comparação com o mês anterior: mês fechado = total x total; mês em andamento = média diária
  // (o parcial nunca é comparado com o mês anterior inteiro)
  function vsMesAnterior(o, anterior) {
    if (anterior == null) return { abs: null, pct: null, txt: '' };
    if (o.fechado) return { abs: o.real - anterior.real, pct: varPct(o.real, anterior.real), txt: 'total do mês' };
    var dAnt = anterior.diasMes || 30;
    var md = o.real / Math.max(o.dia, 1), mdAnt = anterior.real / dAnt;
    return { abs: md - mdAnt, pct: varPct(md, mdAnt), txt: 'média diária (' + o.dia + ' dias x ' + dAnt + ' dias)', diario: true };
  }
  function anteriorTrade(i, k) {
    if (i > 0) { var p = obzMes(i - 1, k); p.diasMes = D.meses[i - 1].diasMes; return p; }
    return { real: tradeMesCheio(2025, 11, k), diasMes: 31 };
  }
  function anteriorEsc(i) {
    if (i > 0) return escMes(i - 1);
    var s = (D.appaiEscolarHist.serie || []).filter(function (x) { return x.label === 'Dez/25'; })[0];
    return s ? { real: s.aqua.escolas || 0, diasMes: 31 } : null;
  }
  function saldoCard(lbl, o, cor, unid) {
    if (!o) return '';
    var falta = o.meta - o.real, ating = o.meta ? o.real / o.meta : null;
    var restam = o.fechado ? 0 : Math.max((o.diasMes || 30) - o.dia, 0);
    var ritmoAtual = o.dia ? o.real / o.dia : null;
    var linhas;
    if (!o.meta) {
      linhas = '<div class="cli-kpi-sub">Sem meta OBZ cadastrada para o mês.</div>';
    } else if (falta <= 0) {
      linhas = '<div class="cli-kpi-delta" style="color:var(--up)">✔ Meta atingida · ' + nf(-falta) + ' ' + unid + ' acima</div>';
    } else {
      linhas = '<div class="cli-kpi-delta" style="color:var(--dn)">Faltam ' + nf(falta) + ' ' + unid + '</div>' +
        (restam ? '<div class="cli-kpi-sub">Ritmo necessário: ' + nf(falta / restam) + '/dia nos ' + restam + ' dias restantes · ritmo atual ' + nf(ritmoAtual) + '/dia</div>' : '');
    }
    return '<div class="cli-kpi-card" style="border-top:3px solid ' + cor + '"><div class="cli-kpi-label">' + lbl + '</div>' +
      '<div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">' +
      '<div><div class="cli-kpi-val">' + nf(o.real) + '</div><div class="cli-kpi-sub">realizado (' + (o.fechado ? 'mês fechado' : 'até dia ' + o.dia) + ')</div></div>' +
      '<div><div class="cli-kpi-val" style="color:var(--muted)">' + nf(o.meta) + '</div><div class="cli-kpi-sub">meta do mês</div></div>' +
      '<div><div class="cli-kpi-val" style="color:' + (ating == null ? 'var(--muted)' : ating >= 1 ? 'var(--up)' : 'var(--dn)') + '">' + (ating == null ? '-' : pf(ating)) + '</div><div class="cli-kpi-sub">atingimento</div></div></div>' +
      linhas + '</div>';
  }
  var obzEstado = { k: 't' };
  // 3 faixas (UX, 26/10): >= 100% da meta verde, 95 a 99,9% âmbar, abaixo de 95% vermelho. No mês em andamento
  // a meta é proporcional aos dias já passados.
  function corAting(o) {
    if (!o || !o.meta) return '#B8C4CC';
    var r = o.real / (o.fechado ? o.meta : o.meta * o.dia / o.diasMes);
    return r >= 1 ? '#1B8A4C' : r >= 0.95 ? '#E8A820' : '#C0392B';
  }
  function renderOBZ() {
    var pg = el('tv2-obz-corpo');
    var k = obzEstado.k;
    var html = '';
    // ---- quanto falta (mês atual)
    html += '<div class="sec" style="margin-top:6px"><div><div class="sec-t">QUANTO FALTA PARA A META · ' + (MA.nome || '') + '</div>' +
      '<div class="sec-s">Saldo = meta mensal − realizado acumulado (' + REF_TXT + '). Meta já batida aparece como "acima", nunca como saldo negativo.</div></div><span class="badge">' + REF_TXT + '</span></div>';
    html += '<div class="cli-kpis-ag" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' +
      saldoCard('Trade · AquaRio', obzMes(IDX, 'a'), COR.a, 'bilhetes') +
      saldoCard('Trade · Paineiras', obzMes(IDX, 'p'), COR.p, 'bilhetes') +
      saldoCard('Visitação Escolar · AquaRio', escMes(IDX), '#E8A820', 'escolares') + '</div>';
    // ---- gráfico Trade x OBZ
    var ms = [];
    for (var i = 0; i <= IDX; i++) ms.push(obzMes(i, k));
    html += '<div class="cc" style="margin-bottom:14px"><div class="cc-h"><div class="cc-t">Visitação Trade x OBZ · ' + NOME[k] + ' · 2026</div>' +
      '<div class="cc-s">Barras = realizado (verde: meta batida; âmbar: 95 a 99,9%; vermelho: abaixo de 95%; no mês em andamento a comparação é com a meta proporcional aos dias já passados) · linha = meta OBZ · tracejado = 2025 no mesmo período · ' + mesLbl(ym(2026, IDX)) + ' ' + REF_TXT + '</div></div>' +
      '<div style="height:260px"><canvas id="tv2-c-obz"></canvas></div></div>';
    html += tabelaOBZ(ms, function (o) { return anteriorTrade(o.i, k); }, 'Trade');
    // ---- Escolar
    var es = [];
    for (var j = 0; j <= IDX; j++) es.push(escMes(j));
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">VISITAÇÃO ESCOLAR X OBZ · AQUARIO</div>' +
      '<div class="sec-s">Escolar = bilhetes ESCOLA da planilha TRADE (separado do Trade geral) · meta = linha "Meta trade 26" da coluna Escolas</div></div></div>';
    html += '<div class="cc" style="margin-bottom:14px"><div class="cc-h"><div class="cc-t">Escolar realizado x meta · AquaRio · 2026</div><div class="cc-s">Meses sem meta cadastrada ficam sem atingimento</div></div>' +
      '<div style="height:240px"><canvas id="tv2-c-esc"></canvas></div></div>';
    html += tabelaOBZ(es, function (o) { return anteriorEsc(o.i); }, 'Escolar');
    html += aviso('ℹ️ <strong>Como ler:</strong> realizado e meta vêm da planilha TRADE (linha "Parcial:", a mesma do fechamento com o time). ' +
      'O mês em andamento é comparado com 2025 até o mesmo dia e com o mês anterior pela <strong>média diária</strong>, para não comparar parcial com mês inteiro. ' +
      'BioParque fica fora: saiu do grupo em ago/26.');
    pg.innerHTML = html;
    var cores = ms.map(function (o) { return corAting(o); });
    grafico('tv2-c-obz', { type: 'bar', data: { labels: ms.map(function (o) { return MES[o.i]; }), datasets: [
      { type: 'line', label: 'Meta OBZ', data: ms.map(function (o) { return o.meta || null; }), borderColor: tinta(), backgroundColor: tinta(), borderWidth: 2, pointRadius: 3, order: 0 },
      { type: 'line', label: '2025 (mesmo período)', data: ms.map(function (o) { return o.r25 || null; }), borderColor: '#9AA9B4', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, order: 1 },
      { label: 'Realizado 2026', data: ms.map(function (o) { return o.real; }), backgroundColor: cores, borderRadius: 4, order: 2 }] },
      options: { scales: eixos(), plugins: { tooltip: { callbacks: { afterBody: function (it) { var o = ms[it[0].dataIndex]; return o.meta ? 'Atingimento: ' + pf(o.real / o.meta) + (o.fechado ? '' : ' (' + REF_TXT + ')') : 'Sem meta'; } } } } } });
    var coresE = es.map(function (o) { return corAting(o); });
    grafico('tv2-c-esc', { type: 'bar', data: { labels: es.map(function (o) { return MES[o.i]; }), datasets: [
      { type: 'line', label: 'Meta', data: es.map(function (o) { return o.meta || null; }), borderColor: tinta(), borderWidth: 2, pointRadius: 3, order: 0 },
      { type: 'line', label: '2025 (mesmo período)', data: es.map(function (o) { return o.r25 || null; }), borderColor: '#9AA9B4', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, order: 1 },
      { label: 'Escolar 2026', data: es.map(function (o) { return o.real; }), backgroundColor: coresE, borderRadius: 4, order: 2 }] },
      options: { scales: eixos() } });
  }
  function tabelaOBZ(lista, anterior, nome) {
    var h = '<div class="cc" style="margin-bottom:14px;overflow-x:auto"><table class="cli-tbl"><thead><tr><th>Mês</th><th style="text-align:right">Meta OBZ</th><th style="text-align:right">Realizado</th>' +
      '<th style="text-align:right">Atingimento</th><th style="text-align:right">Saldo</th><th style="text-align:right">2025 mesmo período</th><th style="text-align:right">vs 2025</th>' +
      '<th style="text-align:right">vs mês anterior</th></tr></thead><tbody>';
    for (var x = lista.length - 1; x >= 0; x--) {
      var o = lista[x];
      if (!o) continue;
      var ant = vsMesAnterior(o, anterior(o));
      var saldo = o.meta ? o.meta - o.real : null;
      h += '<tr><td><strong>' + MES[o.i] + '/26</strong>' + (o.fechado ? '' : ' <span class="cli-pill novo">' + REF_TXT + '</span>') + '</td>' +
        '<td style="text-align:right">' + (o.meta ? nf(o.meta) : '<span style="color:var(--muted)">sem meta</span>') + '</td>' +
        '<td style="text-align:right"><strong>' + nf(o.real) + '</strong></td>' +
        '<td style="text-align:right">' + (o.meta ? '<span class="cli-pill ' + (o.real >= o.meta ? 'up' : 'dn') + '">' + pf(o.real / o.meta) + '</span>' : '-') + '</td>' +
        '<td style="text-align:right">' + (saldo == null ? '-' : saldo <= 0 ? '<span style="color:var(--up);font-weight:700">batida (+' + nf(-saldo) + ')</span>' : '<span style="color:var(--dn);font-weight:700">faltam ' + nf(saldo) + '</span>') + '</td>' +
        '<td style="text-align:right">' + nf(o.r25) + '</td>' +
        '<td style="text-align:right">' + sinal(o.real - o.r25, nf) + ' ' + pill(varPct(o.real, o.r25)) + '</td>' +
        '<td style="text-align:right" title="' + esc(ant.txt) + '">' + (ant.diario ? sinal(ant.abs, nf) + '/dia ' : sinal(ant.abs, nf) + ' ') + pill(ant.pct) + '</td></tr>';
    }
    return h + '</tbody></table></div>';
  }

  // ================================================================ dados dos brutos (trade_indicadores.json)
  function periodoMeses(cod) { // lista de 'AAAA-MM' do período escolhido, até o último mês com dado
    var ult = ym(2026, IDX), out = [];
    var ini = cod === '12m' ? (function () { var d = new Date(2026, IDX - 11, 1); return ym(d.getFullYear(), d.getMonth()); })()
      : cod === '2026' ? '2026-01' : cod === '2025' ? '2025-01' : '2025-01';
    var fim = cod === '2025' ? '2025-12' : ult;
    for (var a = 2025; a <= 2026; a++) for (var m = 0; m < 12; m++) { var kk = ym(a, m); if (kk >= ini && kk <= fim) out.push(kk); }
    return out;
  }
  var PERIODOS = [['12m', 'Últimos 12 meses'], ['2026', '2026'], ['2025', '2025'], ['tudo', 'Jan/25 em diante']];
  function parquesSel(k) { return k === 't' ? ['a', 'p'] : [k]; }
  function blocos(k, meses) { // [{parque, mes, bloco}]
    var out = [], P = (DADOS.ind && DADOS.ind.parques) || {};
    parquesSel(k).forEach(function (x) {
      meses.forEach(function (m) { var b = (P[NOME_TIND[x]] || {})[m]; if (b) out.push({ p: x, m: m, b: b }); });
    });
    return out;
  }
  function mesesFaltando(k, meses) {
    var P = (DADOS.ind && DADOS.ind.parques) || {}, f = [];
    parquesSel(k).forEach(function (x) { meses.forEach(function (m) { if (!(P[NOME_TIND[x]] || {})[m]) f.push(NOME[x] + ' ' + mesLbl(m)); }); });
    return f;
  }
  // Calibração (validação de 26/10/2026): o total do bruto bate com a visitação oficial, mas o B2B pela regra
  // do bruto só bate com o Trade oficial desde out/26 (antes a planilha TRADE era preenchida pelo CARD e pela
  // planilha de agências; ex.: AquaRio jan/25 bruto 24.252 x oficial 11.224). Por isso a distribuição por dia
  // vem do bruto e o total de cada mês é levado ao oficial (Trade = planilha TRADE, total = Controladoria).
  function fatorOficial(x) {
    var a = Number(x.m.slice(0, 4)), i = Number(x.m.slice(5, 7)) - 1, tot = 0, b2b = 0;
    Object.keys(x.b.dias).forEach(function (ds) { tot += x.b.dias[ds][0]; b2b += x.b.dias[ds][1]; });
    var of = a === 2026 ? (D.hist26[PK[x.p]] || [])[i] : tradeMesCheio(2025, i, x.p);
    var par = a === 2026 ? (D.histPar26[PK[x.p]] || [])[i] : parque2025(x.p, i);
    return { b2b: b2b && typeof of === 'number' && of > 0 ? of / b2b : 1, tot: tot && typeof par === 'number' && par > 0 ? par / tot : 1 };
  }
  function tipoDia(ds) {
    var fer = (DADOS.ind && DADOS.ind.feriadosRio) || {};
    if (fer[ds]) return 'fer';
    var w = new Date(ds + 'T12:00:00').getDay();
    return w === 0 || w === 6 ? 'fds' : 'du';
  }

  // ================================================================ INDICADORES PARQUES
  var indEstado = { k: 't', per: '12m' };
  // Visitação de 2025 do mês inteiro: a do Histórico do Dash de Performance (trade_indicadores.json, parque2025).
  // O HTML só tem jan-set/25 inteiros: out/25 lá é o mesmo período do mês corrente (1 a 25/10) e nov/dez vêm vazios.
  function parque2025(x, i) {
    var v = ((DADOS.ind && DADOS.ind.parque2025) || {})[NOME_TIND[x]];
    var k = ym(2025, i);
    if (v && typeof v[k] === 'number') return v[k];
    return i < IDX ? ((D.histPar25 || {})[PK[x]] || [])[i] : null;
  }
  function serieMensal(k) { // B2B oficial, total do parque (Controladoria), B2C = total − B2B
    var out = [];
    [2025, 2026].forEach(function (ano) {
      for (var i = 0; i < 12; i++) {
        if (ano === 2026 && i > IDX) break;
        var b2b = 0, tot = 0, ok = true;
        parquesSel(k).forEach(function (x) {
          var t = ano === 2026 ? (D.hist26[PK[x]] || [])[i] : tradeMesCheio(2025, i, x);
          var p = ano === 2026 ? (D.histPar26[PK[x]] || [])[i] : parque2025(x, i);
          if (typeof t !== 'number' || typeof p !== 'number' || !p) ok = false;
          b2b += t || 0; tot += p || 0;
        });
        if (ok) out.push({ k: ym(ano, i), b2b: b2b, tot: tot, b2c: tot - b2b, parcial: ano === 2026 && i === IDX && !MA.isFechado });
      }
    });
    return out;
  }
  function renderInd() {
    var pg = el('tv2-ind-corpo');
    var k = indEstado.k, meses = periodoMeses(indEstado.per);
    var html = '';
    // 4.1
    var s = serieMensal(k).filter(function (x) { return meses.indexOf(x.k) >= 0; });
    html += '<div class="sec" style="margin-top:6px"><div><div class="sec-t">EVOLUÇÃO MENSAL · B2B, B2C E TOTAL</div>' +
      '<div class="sec-s">B2B = Trade oficial (planilha TRADE) · Total = visitação do parque (Controladoria) · B2C = Total − B2B, sem somar categorias que se sobrepõem</div></div>' +
      '<span class="badge">' + NOME[k] + '</span></div>';
    html += '<div class="cc" style="margin-bottom:14px"><div class="cc-h"><div class="cc-t">Visitação mensal · ' + NOME[k] + '</div><div class="cc-s">' +
      (s.some(function (x) { return x.parcial; }) ? mesLbl(ym(2026, IDX)) + ' ' + REF_TXT + ' (ponto vazado)' : '') + '</div></div><div style="height:270px"><canvas id="tv2-c-b2b"></canvas></div>';
    if (s.length) {
      var ult = s[s.length - 1];
      html += '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--muted)">Share B2B no período: <strong style="color:var(--text)">' +
        pf(s.reduce(function (a, x) { return a + x.b2b; }, 0) / s.reduce(function (a, x) { return a + x.tot; }, 0)) + '</strong> · último mês (' + mesLbl(ult.k) + '): <strong style="color:var(--text)">' + pf(ult.b2b / ult.tot) + '</strong></div>';
    }
    html += '</div>';
    // 4.2 a 4.4 dependem dos brutos
    html += '<div id="tv2-ind-brutos"></div>';
    pg.innerHTML = html;
    grafico('tv2-c-b2b', { type: 'line', data: { labels: s.map(function (x) { return mesLbl(x.k); }), datasets: [
      { label: 'Total', data: s.map(function (x) { return x.tot; }), borderColor: tinta(), backgroundColor: tinta(), borderWidth: 2.5, tension: .25, pointRadius: s.map(function (x) { return x.parcial ? 5 : 2.5; }), pointBackgroundColor: s.map(function (x) { return x.parcial ? 'transparent' : tinta(); }) },
      { label: 'B2C', data: s.map(function (x) { return x.b2c; }), borderColor: '#E8A820', backgroundColor: '#E8A820', borderWidth: 2, tension: .25, pointRadius: 2.5 },
      { label: 'B2B (Trade)', data: s.map(function (x) { return x.b2b; }), borderColor: COR[k === 't' ? 'a' : k], backgroundColor: COR[k === 't' ? 'a' : k], borderWidth: 2, tension: .25, pointRadius: 2.5 }] },
      options: { scales: eixos(), plugins: { tooltip: { callbacks: { afterBody: function (it) { var x = s[it[0].dataIndex]; return 'Share B2B: ' + pf(x.b2b / x.tot) + (x.parcial ? ' · ' + REF_TXT : ''); } } } } } });
    if (!DADOS.carregado || !DADOS.ind) { carregando('tv2-ind-brutos', 'trade_indicadores.json'); return; }
    renderIndBrutos(k, meses);
  }
  function renderIndBrutos(k, meses) {
    var bl = blocos(k, meses), falt = mesesFaltando(k, meses);
    var html = '';
    if (falt.length) html += aviso('⚠️ Sem bruto de bilheteria para: ' + esc(falt.join(', ')) + '. Esses meses ficam fora das análises abaixo (não viram zero).');
    // ---- 4.2 tipo de dia
    var G = { du: { n: 0, tot: 0, b2b: 0 }, fds: { n: 0, tot: 0, b2b: 0 }, fer: { n: 0, tot: 0, b2b: 0 } };
    var porMes = {};
    var diasVistos = {};
    bl.forEach(function (x) {
      var f = fatorOficial(x);
      Object.keys(x.b.dias).forEach(function (ds) {
        var v = x.b.dias[ds], t = tipoDia(ds);
        if (!v[0]) return; // parque fechado / sem venda
        if (!diasVistos[ds]) { diasVistos[ds] = true; G[t].n++; (porMes[x.m] = porMes[x.m] || { du: { n: 0, tot: 0 }, fds: { n: 0, tot: 0 }, fer: { n: 0, tot: 0 } })[t].n++; }
        var tot = v[0] * f.tot, b2b = Math.min(v[1] * f.b2b, tot);
        G[t].tot += tot; G[t].b2b += b2b;
        porMes[x.m][t].tot += tot;
      });
    });
    var totG = G.du.tot + G.fds.tot + G.fer.tot;
    var NOM = { du: 'Dia útil', fds: 'Fim de semana', fer: 'Feriado' };
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">DIA ÚTIL X FIM DE SEMANA X FERIADO</div>' +
      '<div class="sec-s">Comparação pela <strong>média diária</strong> (cada grupo tem um número de dias diferente). Feriado = feriado nacional, estadual (RJ) ou municipal (Rio), mesmo caindo no fim de semana. Distribuição por dia dos brutos de bilheteria, com o total de cada mês ajustado ao oficial (Trade da planilha TRADE e visitação da Controladoria).</div></div></div>';
    html += '<div class="cc" style="margin-bottom:14px;overflow-x:auto"><table class="cli-tbl"><thead><tr><th>Tipo de dia</th><th style="text-align:right">Dias</th><th style="text-align:right">Média diária total</th>' +
      '<th style="text-align:right">Média B2B</th><th style="text-align:right">Média B2C</th><th style="text-align:right">Share B2B</th><th style="text-align:right">Volume total</th><th style="text-align:right">% do volume</th><th style="text-align:right">Índice vs dia útil</th></tr></thead><tbody>';
    var mdDu = G.du.n ? G.du.tot / G.du.n : null;
    ['du', 'fds', 'fer'].forEach(function (t) {
      var g = G[t];
      var md = g.n ? g.tot / g.n : null;
      html += '<tr><td><strong>' + NOM[t] + '</strong></td><td style="text-align:right">' + g.n + '</td><td style="text-align:right"><strong>' + nf(md) + '</strong></td>' +
        '<td style="text-align:right">' + nf(g.n ? g.b2b / g.n : null) + '</td><td style="text-align:right">' + nf(g.n ? (g.tot - g.b2b) / g.n : null) + '</td>' +
        '<td style="text-align:right">' + pf(g.tot ? g.b2b / g.tot : null) + '</td><td style="text-align:right">' + nf(g.tot) + '</td><td style="text-align:right">' + pf(totG ? g.tot / totG : null) + '</td>' +
        '<td style="text-align:right">' + (md && mdDu ? (md / mdDu).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x' : '-') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="cc" style="margin-bottom:14px"><div class="cc-h"><div class="cc-t">Média diária por mês e tipo de dia</div><div class="cc-s">Mostra os meses em que a diferença entre fim de semana e dia útil aumenta</div></div><div style="height:240px"><canvas id="tv2-c-dia"></canvas></div></div>';
    // ---- 4.3 eventos
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">EVENTOS E FATORES DE IMPACTO</div>' +
      '<div class="sec-s">Registros da aba Eventos (planilha TRADE). Visitação do dia (bruto) x média dos mesmos dias da semana do mês sem evento: é o que foi observado, não prova que o evento causou a variação.</div></div></div>';
    html += '<div class="cc" style="margin-bottom:14px;overflow-x:auto" id="tv2-eventos"></div>';
    // ---- 4.4 antecedência
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">ANTECEDÊNCIA DE COMPRA · B2B X B2C</div>' +
      '<div class="sec-s">Dias entre a data da venda e a data de utilização. Venda depois do uso ou data inválida = "sem data" (fora das médias). 60 dias ou mais contam como 60 na média. B2B aqui é pela regra do bruto (mesma do Trade oficial desde out/26); antes disso ela classifica mais bilhetes como B2B do que a planilha.</div></div></div>';
    html += '<div id="tv2-antec"></div>';
    el('tv2-ind-brutos').innerHTML = html;
    var ms = meses.filter(function (m) { return porMes[m]; });
    grafico('tv2-c-dia', { type: 'bar', data: { labels: ms.map(mesLbl), datasets: ['du', 'fds', 'fer'].map(function (t, n) {
      return { label: NOM[t], data: ms.map(function (m) { var g = porMes[m][t]; return g.n ? Math.round(g.tot / g.n) : null; }), backgroundColor: ['#9AA9B4', COR[k === 't' ? 'a' : k], '#E8A820'][n], borderRadius: 3 };
    }) }, options: { scales: eixos() } });
    renderEventos(k, meses, bl);
    renderAntec(bl, meses);
  }
  function renderEventos(k, meses, bl) {
    var mapaPq = { a: /AQUA/i, p: /PAINEIRAS/i };
    var dias = {}; // parque -> ds -> total
    bl.forEach(function (x) { var d = dias[x.p] = dias[x.p] || {}; Object.keys(x.b.dias).forEach(function (ds) { d[ds] = x.b.dias[ds][0]; }); });
    var evs = (D.eventosRio || []).filter(function (e) { return e.data && meses.indexOf(e.data.slice(0, 7)) >= 0; });
    var linhas = [];
    var comEvento = {};
    evs.forEach(function (e) { parquesSel(k).forEach(function (x) { if (mapaPq[x].test(e.parque || '')) (comEvento[x] = comEvento[x] || {})[e.data] = true; }); });
    evs.forEach(function (e) {
      parquesSel(k).forEach(function (x) {
        if (!mapaPq[x].test(e.parque || '')) return;
        var d = dias[x] || {}, v = d[e.data];
        var w = new Date(e.data + 'T12:00:00').getDay(), ref = [], mesE = e.data.slice(0, 7);
        Object.keys(d).forEach(function (ds) {
          if (ds.slice(0, 7) === mesE && ds !== e.data && !(comEvento[x] || {})[ds] && new Date(ds + 'T12:00:00').getDay() === w && d[ds] > 0) ref.push(d[ds]);
        });
        var mref = ref.length ? ref.reduce(function (a, b) { return a + b; }, 0) / ref.length : null;
        linhas.push({ e: e, p: x, v: v, ref: mref, n: ref.length });
      });
    });
    linhas.sort(function (a, b) { return a.e.data !== b.e.data ? (a.e.data < b.e.data ? 1 : -1) : (a.p < b.p ? -1 : a.p > b.p ? 1 : 0); });
    var cats = {};
    linhas.forEach(function (l) { cats[l.e.categoria || '-'] = (cats[l.e.categoria || '-'] || 0) + 1; });
    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">' + rotulo('Categoria') + '<select class="cli-select" id="tv2-ev-cat"><option value="">Todas (' + linhas.length + ')</option>' +
      Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + ' (' + cats[c] + ')</option>'; }).join('') + '</select></div><div id="tv2-ev-tab"></div>';
    el('tv2-eventos').innerHTML = linhas.length ? h : '<div style="font-size:12px;color:var(--muted)">Nenhum evento cadastrado na aba Eventos para o período e parque escolhidos.</div>';
    function tab() {
      var c = (el('tv2-ev-cat') || {}).value || '';
      var ls = linhas.filter(function (l) { return !c || (l.e.categoria || '-') === c; });
      var t = '<table class="cli-tbl"><thead><tr><th>Data</th><th>Parque</th><th>Categoria</th><th>Evento (cadastrado)</th><th style="text-align:right">Visitação do dia</th><th style="text-align:right">Referência</th><th style="text-align:right">Observado</th></tr></thead><tbody>';
      var visto = {};
      ls.slice(0, 150).forEach(function (l) {
        var dlt = l.v != null && l.ref ? l.v / l.ref - 1 : null;
        var g = l.e.data + '|' + l.p;
        if (visto[g]) { // mesmo dia e parque: o número do dia aparece uma vez só
          t += '<tr><td style="white-space:nowrap;color:var(--muted)">' + dataBR(l.e.data) + '</td><td style="color:var(--muted)">' + NOME[l.p] + '</td><td style="font-size:10.5px;color:var(--muted)">' + esc(l.e.categoria) + '</td>' +
            '<td style="font-size:11px;max-width:420px">' + esc(l.e.evento) + '</td><td colspan="3" style="text-align:center;font-size:10.5px;color:var(--muted)">mesmo dia da linha acima</td></tr>';
          return;
        }
        visto[g] = true;
        t += '<tr><td style="white-space:nowrap">' + dataBR(l.e.data) + '</td><td>' + NOME[l.p] + '</td><td style="font-size:10.5px;color:var(--muted)">' + esc(l.e.categoria) + '</td>' +
          '<td style="font-size:11px;max-width:420px">' + esc(l.e.evento) + '</td><td style="text-align:right">' + (l.v == null ? '<span style="color:var(--muted)">sem dado</span>' : nf(l.v)) + '</td>' +
          '<td style="text-align:right" title="média de ' + l.n + ' dias iguais do mês sem evento">' + nf(l.ref) + '</td><td style="text-align:right">' + pill(dlt) + '</td></tr>';
      });
      t += '</tbody></table>' + (ls.length > 150 ? '<div class="cc-s" style="margin-top:6px">Mostrando os 150 mais recentes de ' + ls.length + '.</div>' : '');
      el('tv2-ev-tab').innerHTML = t;
    }
    if (linhas.length) { tab(); el('tv2-ev-cat').onchange = tab; }
  }
  // Quebra de base (conferida em 26/10/2026): no Paineiras, até jul/26 a DATA_VENDA do bruto não é a data real
  // da compra (B2C com 95% "no mesmo dia" e, de ago/25 a jul/26, B2B com 0 dia); a partir de ago/26 o padrão
  // muda de uma vez para 3-4 dias. Antecedência do Paineiras só conta de ago/26 em diante. AquaRio: série toda.
  var ANTEC_DESDE = { a: '2025-01', p: '2026-08' };
  function antecOk(x) { return x.m >= ANTEC_DESDE[x.p]; }
  function avisoAntec(bl) {
    var fora = bl.filter(function (x) { return !antecOk(x); });
    return fora.length ? aviso('⚠️ Paineiras antes de ago/26 fica fora da antecedência: até jul/26 a data de venda do bruto não é a data real da compra ' +
      '(quase tudo aparece como compra no mesmo dia) e em ago/26 o padrão muda de uma vez. ' + fora.length + ' mês(es) do filtro excluído(s) só desta análise.') : '';
  }
  var FAIXAS_ANT = [[0, 0, 'Mesmo dia'], [1, 2, '1–2 dias'], [3, 7, '3–7 dias'], [8, 14, '8–14 dias'], [15, 30, '15–30 dias'], [31, 59, '31–59 dias'], [60, 60, '60+ dias']];
  function resumoHist(h) {
    var n = 0, s = 0;
    h.forEach(function (q, d) { n += q; s += q * d; });
    var med = null, ac = 0;
    for (var d = 0; d < h.length; d++) { ac += h[d]; if (ac >= n / 2) { med = d; break; } }
    return { n: n, media: n ? s / n : null, mediana: med, faixas: FAIXAS_ANT.map(function (f) { var q = 0; for (var d = f[0]; d <= f[1]; d++) q += h[d] || 0; return n ? q / n : null; }) };
  }
  function somaHist(bl, seg) {
    var max = (DADOS.ind.antMax || 60) + 1, h = new Array(max).fill(0), sem = 0;
    bl.forEach(function (x) {
      var a = x.b.ant;
      if (seg !== 'b2c') a.b2b.forEach(function (q, d) { h[d] += q; });
      if (seg !== 'b2b') a.b2c.forEach(function (q, d) { h[d] += q; });
      sem += seg === 'b2b' ? a.sem[0] : seg === 'b2c' ? a.sem[1] : a.sem[0] + a.sem[1];
    });
    var r = resumoHist(h); r.sem = sem; return r;
  }
  function renderAntec(bl0, meses) {
    var bl = bl0.filter(antecOk);
    var R = { b2b: somaHist(bl, 'b2b'), b2c: somaHist(bl, 'b2c'), tot: somaHist(bl, 'tot') };
    var NOM = { b2b: 'B2B (Trade)', b2c: 'B2C', tot: 'Total' };
    var h = avisoAntec(bl0) + '<div class="cli-kpis-ag" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">';
    ['b2b', 'b2c', 'tot'].forEach(function (s) {
      var r = R[s];
      h += kpi(NOM[s], r.media == null ? '-' : r.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dias', 'mediana ' + (r.mediana == null ? '-' : r.mediana + ' dias') + ' · compra no mesmo dia ' + pf(r.faixas[0]),
        '<span style="color:var(--muted);font-weight:500">' + nf(r.n) + ' bilhetes com data · ' + nf(r.sem) + ' sem data</span>');
    });
    h += '</div><div class="row2"><div class="cc"><div class="cc-h"><div class="cc-t">Distribuição por faixa de antecedência</div><div class="cc-s">% dos bilhetes com data válida em cada faixa</div></div><div style="height:240px"><canvas id="tv2-c-antf"></canvas></div></div>' +
      '<div class="cc"><div class="cc-h"><div class="cc-t">Antecedência média por mês</div><div class="cc-s">Média em dias (60+ conta como 60)</div></div><div style="height:240px"><canvas id="tv2-c-antm"></canvas></div></div></div>';
    el('tv2-antec').innerHTML = h;
    grafico('tv2-c-antf', { type: 'bar', data: { labels: FAIXAS_ANT.map(function (f) { return f[2]; }), datasets: ['b2b', 'b2c', 'tot'].map(function (s, n) {
      return { label: NOM[s], data: R[s].faixas.map(function (v) { return v == null ? null : +(v * 100).toFixed(1); }), backgroundColor: ['#005F8E', '#E8A820', '#9AA9B4'][n], borderRadius: 3 };
    }) }, options: { scales: eixos({ y: { grid: { color: grade().grid }, ticks: { color: grade().txt, callback: function (v) { return v + '%'; } }, beginAtZero: true } }) } });
    var ms = meses.filter(function (m) { return bl.some(function (x) { return x.m === m; }); });
    grafico('tv2-c-antm', { type: 'line', data: { labels: ms.map(mesLbl), datasets: ['b2b', 'b2c'].map(function (s, n) {
      return { label: NOM[s], data: ms.map(function (m) { var r = somaHist(bl.filter(function (x) { return x.m === m; }), s); return r.media == null ? null : +r.media.toFixed(1); }),
        borderColor: ['#005F8E', '#E8A820'][n], backgroundColor: ['#005F8E', '#E8A820'][n], tension: .25, borderWidth: 2, pointRadius: 2.5 };
    }) }, options: { scales: eixos({ y: { grid: { color: grade().grid }, ticks: { color: grade().txt }, beginAtZero: true } }) } });
  }

  // ================================================================ ORIGEM
  var oriEstado = { k: 't', per: '12m', seg: 'tot', semBR: '0' };
  // A coluna PAIS do bruto vem com várias grafias do mesmo país ("Colombia", "Colômbia", "Col�Mbia",
  // "Holanda (Países Baixos)", "Polônia, República Da"). Junta pela grafia sem acento; o caractere perdido
  // (�) casa com qualquer letra de um nome já conhecido. Exibe a grafia acentuada de maior volume.
  var PAIS_CANON = null;
  // Afeganistão, Albânia e África do Sul são os 3 primeiros itens da lista de países do sistema de venda e aparecem com
  // volume sem paralelo (ex.: Paineiras jul/26, 293 "Afeganistão", 234 deles B2B): é o país que fica
  // marcado quando ninguém escolhe. Vão para uma linha própria, visível, em vez de contar como mercado.
  var SUSPEITO = '(provável erro de preenchimento)';
  // 26/10/2026 (Paulo): Afeganistão, Albânia e África do Sul ficam fora de qualquer top países oficial
  var SUSPEITOS_K = { 'AFEGANISTAO': 1, 'ALBANIA': 1, 'AFRICA DO SUL': 1 };
  var SUSPEITOS = { has: function (n) { return !!SUSPEITOS_K[semAcento(n).toUpperCase()]; } };
  function semAcento(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function paisBase(n) { return String(n).replace(/\s*\(.*?\)\s*/g, ' ').replace(/,\s*rep.*$/i, '').replace(/\s+/g, ' ').trim(); }
  function montarCanon() {
    var vol = {}, porChave = {}, quebrados = [];
    Object.values((DADOS.ind && DADOS.ind.parques) || {}).forEach(function (pm) {
      Object.values(pm).forEach(function (b) { Object.keys(b.pais).forEach(function (n) { vol[n] = (vol[n] || 0) + b.pais[n][0]; }); });
    });
    Object.keys(vol).forEach(function (n) {
      var base = paisBase(n);
      if (base.indexOf('�') >= 0) { quebrados.push(n); return; }
      var k = semAcento(base).toUpperCase();
      var c = porChave[k] = porChave[k] || { nome: base, v: -1, acento: false };
      var temAcento = base !== semAcento(base);
      if ((temAcento && !c.acento) || (temAcento === c.acento && vol[n] > c.v)) { c.nome = base; c.v = vol[n]; c.acento = temAcento; }
    });
    var mapa = {};
    Object.keys(vol).forEach(function (n) {
      var base = paisBase(n);
      if (base.indexOf('�') < 0) { mapa[n] = porChave[semAcento(base).toUpperCase()].nome; return; }
      var re = new RegExp('^' + semAcento(base).toUpperCase().replace(/[.*+^$()[\]{}|\\]/g, '\\$&').replace(/�/g, '.') + '$');
      var achou = Object.keys(porChave).filter(function (k) { return re.test(k); });
      mapa[n] = achou.length === 1 ? porChave[achou[0]].nome : base.replace(/�/g, '?');
    });
    return mapa;
  }
  function paisCanon(n) { if (!PAIS_CANON) PAIS_CANON = montarCanon(); return PAIS_CANON[n] || n; }
  function somaPaises(bl) {
    var P = {};
    bl.forEach(function (x) {
      Object.keys(x.b.pais).forEach(function (n0) {
        var n = n0 === '(não informado)' ? n0 : paisCanon(n0);
        if (SUSPEITOS.has(n)) n = SUSPEITO;
        var v = x.b.pais[n0], a = P[n] = P[n] || new Array(v.length).fill(0);
        v.forEach(function (q, i) { a[i] += q; });
      });
    });
    return P;
  }
  function volSeg(v, seg) { return seg === 'b2b' ? v[1] : seg === 'b2c' ? v[0] - v[1] : v[0]; }
  function mesAnoAnterior(m) { return (Number(m.slice(0, 4)) - 1) + m.slice(4); }
  function renderOri() {
    var pg = el('tv2-ori-corpo');
    if (!DADOS.carregado || !DADOS.ind) { carregando('tv2-ori-corpo', 'trade_indicadores.json'); return; }
    var k = oriEstado.k, seg = oriEstado.seg, meses = periodoMeses(oriEstado.per);
    var bl = blocos(k, meses), P = somaPaises(bl);
    var mesesAnt = meses.map(mesAnoAnterior), blAnt = blocos(k, mesesAnt), PA = somaPaises(blAnt);
    var compAnt = blAnt.length === bl.length && bl.length > 0;
    var semBR = oriEstado.semBR === '1';
    var nomes = Object.keys(P).filter(function (n) { return !(semBR && n === 'Brasil'); });
    var base = nomes.reduce(function (a, n) { return a + volSeg(P[n], seg); }, 0);
    var baseAnt = Object.keys(PA).filter(function (n) { return !(semBR && n === 'Brasil'); }).reduce(function (a, n) { return a + volSeg(PA[n], seg); }, 0);
    var ord = nomes.filter(function (n) { return n !== '(não informado)' && n !== SUSPEITO; }).sort(function (a, b) { return volSeg(P[b], seg) - volSeg(P[a], seg); });
    var top = ord.slice(0, 15), resto = ord.slice(15);
    var falt = mesesFaltando(k, meses);
    var html = falt.length ? aviso('⚠️ Sem bruto para: ' + esc(falt.join(', ')) + '. Esses meses ficam fora.') : '';
    html += '<div class="sec" style="margin-top:6px"><div><div class="sec-t">SHARE DE VISITAÇÃO POR PAÍS</div><div class="sec-s">País do visitante (coluna PAIS do bruto). Base do share = total do filtro' +
      (semBR ? ' sem o Brasil' : '') + ', incluindo "não informado", que aparece separado e nunca é descartado.</div></div><span class="badge">' + NOME[k] + '</span></div>';
    html += '<div class="row2"><div class="cc" style="overflow-x:auto"><table class="cli-tbl"><thead><tr><th>#</th><th>País</th><th style="text-align:right">Visitantes</th><th style="text-align:right">Share</th>' +
      (compAnt ? '<th style="text-align:right">Share ano anterior</th><th style="text-align:right">Δ p.p.</th>' : '') + '</tr></thead><tbody>';
    function linha(rk, n, v, vAnt) {
      var sh = base ? v / base : null, shA = baseAnt && vAnt != null ? vAnt / baseAnt : null;
      return '<tr><td class="cli-rk">' + rk + '</td><td><strong>' + esc(n) + '</strong></td><td style="text-align:right">' + nf(v) + '</td><td style="text-align:right"><strong>' + pf(sh) + '</strong></td>' +
        (compAnt ? '<td style="text-align:right">' + pf(shA) + '</td><td style="text-align:right">' + (sh != null && shA != null ? pill(sh - shA, function (x) { return (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.'; }) : '-') + '</td>' : '') + '</tr>';
    }
    top.forEach(function (n, i) { html += linha(i + 1, n, volSeg(P[n], seg), PA[n] ? volSeg(PA[n], seg) : 0); });
    if (resto.length) html += linha('', 'Demais registros (' + resto.length + ' nomes de país)', resto.reduce(function (a, n) { return a + volSeg(P[n], seg); }, 0), resto.reduce(function (a, n) { return a + (PA[n] ? volSeg(PA[n], seg) : 0); }, 0));
    if (P['(não informado)']) html += linha('', '(não informado)', volSeg(P['(não informado)'], seg), PA['(não informado)'] ? volSeg(PA['(não informado)'], seg) : 0);
    if (P[SUSPEITO]) html += linha('', SUSPEITO + ' ⓘ', volSeg(P[SUSPEITO], seg), PA[SUSPEITO] ? volSeg(PA[SUSPEITO], seg) : 0);
    html += '<tr><td></td><td><strong>Total</strong></td><td style="text-align:right"><strong>' + nf(base) + '</strong></td><td style="text-align:right">100%</td>' + (compAnt ? '<td></td><td></td>' : '') + '</tr></tbody></table>' +
      (compAnt ? '' : '<div class="cc-s" style="margin-top:6px">Sem comparação com o ano anterior: falta bruto de algum mês equivalente.</div>') +
      '<div class="cc-s" style="margin-top:6px">ⓘ Afeganistão, Albânia e África do Sul são os primeiros itens da lista de países do sistema de venda e aparecem com volume sem paralelo, quase todo de agência: ficam fora do ranking, como erro de preenchimento. Grafias diferentes do mesmo país (com e sem acento, acento quebrado) foram unificadas.</div></div>' +
      '<div class="cc"><div class="cc-h"><div class="cc-t">Evolução do share · 6 maiores mercados estrangeiros</div><div class="cc-s">% do total do mês (base com Brasil e não informado)</div></div><div style="height:300px"><canvas id="tv2-c-pais"></canvas></div></div></div>';
    // ---- antecedência por país
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">ANTECEDÊNCIA DE COMPRA POR PAÍS</div><div class="sec-s">Países com pelo menos 300 bilhetes com data válida no período · todos os canais · maiores mercados primeiro</div></div></div>' + avisoAntec(bl);
    var PAnt = somaPaises(bl.filter(antecOk));
    var ant = Object.keys(PAnt).filter(function (n) { return n !== '(não informado)' && n !== SUSPEITO && PAnt[n][3] >= 300; }).map(function (n) {
      var v = PAnt[n]; return { n: n, q: v[3], media: v[2] / v[3], f: v.slice(4).map(function (x) { return x / v[3]; }) };
    }).sort(function (a, b) { return b.q - a.q; });
    var FX = ['Mesmo dia', '1–2', '3–7', '8–14', '15–30', '31+'];
    html += '<div class="cc" style="margin-bottom:14px;overflow-x:auto"><table class="cli-tbl"><thead><tr><th>País</th><th style="text-align:right">Bilhetes c/ data</th><th style="text-align:right">Média (dias)</th>' +
      FX.map(function (f) { return '<th style="text-align:right">' + f + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ant.map(function (a) {
        return '<tr><td><strong>' + esc(a.n) + '</strong></td><td style="text-align:right">' + nf(a.q) + '</td><td style="text-align:right"><strong>' + a.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '</strong></td>' +
          a.f.map(function (x) { return '<td style="text-align:right">' + pf(x, 0) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table><div class="cc-s" style="margin-top:6px">Média com a cauda inteira (sem teto de 60 dias). Faixas em % dos bilhetes com data válida do país.</div></div>';
    // ---- feriados
    html += '<div class="sec" style="margin-top:18px"><div><div class="sec-t">FERIADOS DOS MERCADOS PRINCIPAIS</div><div class="sec-s">Próximos 120 dias. Entram só os países com 0,5% ou mais da visitação nos últimos 12 meses (mais o Brasil). ' +
      'O mês do feriado no ano anterior mostra se esse mercado já pesou mais naquele mês (índice 1,0 = média mensal do país).</div></div></div><div class="cc" style="overflow-x:auto" id="tv2-feriados"></div>';
    pg.innerHTML = html;
    // gráfico de evolução
    var top6 = ord.filter(function (n) { return n !== 'Brasil'; }).slice(0, 6);
    var msG = meses.filter(function (m) { return bl.some(function (x) { return x.m === m; }); });
    var paleta = ['#005F8E', '#2D6A2B', '#E8A820', '#C0392B', '#7B4FA0', '#0097A7'];
    grafico('tv2-c-pais', { type: 'line', data: { labels: msG.map(mesLbl), datasets: top6.map(function (n, i) {
      return { label: n, data: msG.map(function (m) {
        var Pm = somaPaises(bl.filter(function (x) { return x.m === m; })), t = 0;
        Object.keys(Pm).forEach(function (z) { t += volSeg(Pm[z], seg); });
        return Pm[n] && t ? +(volSeg(Pm[n], seg) / t * 100).toFixed(2) : 0;
      }), borderColor: paleta[i], backgroundColor: paleta[i], tension: .25, borderWidth: 2, pointRadius: 2 };
    }) }, options: { scales: eixos({ y: { grid: { color: grade().grid }, ticks: { color: grade().txt, callback: function (v) { return v + '%'; } }, beginAtZero: true } }) } });
    renderFeriados(k);
  }
  function renderFeriados(k) {
    var box = el('tv2-feriados');
    if (!DADOS.fer) { box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Arquivo de feriados não carregado.</div>'; return; }
    var meses12 = periodoMeses('12m'), bl = blocos(k, meses12), P = somaPaises(bl), tot = 0;
    Object.keys(P).forEach(function (n) { tot += P[n][0]; });
    var rel = Object.keys(DADOS.fer.paises).filter(function (n) { return n === 'Brasil' || (P[n] && tot && P[n][0] / tot >= 0.005); });
    var hoje = DATA_REF || new Date(2026, IDX + 1, 0), lim = new Date(hoje.getTime() + 120 * 864e5);
    var linhas = [];
    rel.forEach(function (n) {
      var share = P[n] && tot ? P[n][0] / tot : null;
      var porMes = {};
      bl.forEach(function (x) { var v = somaPaises([x])[n]; if (v) porMes[x.m] = (porMes[x.m] || 0) + v[0]; });
      var mediaMes = Object.keys(porMes).length ? Object.values(porMes).reduce(function (a, b) { return a + b; }, 0) / Object.keys(porMes).length : null;
      DADOS.fer.paises[n].feriados.forEach(function (f) {
        var d = new Date(f[0] + 'T12:00:00');
        if (d < hoje || d > lim) return;
        var w = d.getDay();
        var ponte = w === 1 || w === 5 ? 'emenda com o fim de semana' : w === 2 || w === 4 ? 'possível ponte' : w === 0 || w === 6 ? 'cai no fim de semana' : '';
        var mAnt = (d.getFullYear() - 1) + '-' + String(d.getMonth() + 1).padStart(2, '0');
        var vAnt = porMes[mAnt];
        linhas.push({ d: f[0], n: n, nome: f[1], ponte: ponte, share: share, idx: vAnt != null && mediaMes ? vAnt / mediaMes : null, mAnt: mAnt });
      });
    });
    linhas.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (b.share || 0) - (a.share || 0); });
    var DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    box.innerHTML = linhas.length ? '<table class="cli-tbl"><thead><tr><th>Data</th><th>País</th><th>Feriado</th><th>Calendário</th><th style="text-align:right">Share do mercado (12m)</th><th style="text-align:right">Mesmo mês no ano anterior</th></tr></thead><tbody>' +
      linhas.map(function (l) {
        return '<tr><td style="white-space:nowrap">' + dataBR(l.d) + ' <span style="color:var(--muted);font-size:10px">' + DS[new Date(l.d + 'T12:00:00').getDay()] + '</span></td><td><strong>' + esc(l.n) + '</strong></td><td>' + esc(l.nome) + '</td>' +
          '<td style="font-size:10.5px;color:var(--muted)">' + l.ponte + '</td><td style="text-align:right">' + pf(l.share) + '</td>' +
          '<td style="text-align:right" title="visitantes do país em ' + mesLbl(l.mAnt) + ' ÷ média mensal do país">' + (l.idx == null ? '<span style="color:var(--muted)">sem dado</span>' : l.idx.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x') + '</td></tr>';
      }).join('') + '</tbody></table><div class="cc-s" style="margin-top:6px">Fonte: ' + esc(DADOS.fer.fonte) + '. Feriados regionais e férias escolares não entram.</div>'
      : '<div style="font-size:12px;color:var(--muted)">Nenhum feriado nos próximos 120 dias para os mercados relevantes.</div>';
  }

  // ================================================================ OPORTUNIDADES
  var opEstado = { min: '10', ord: 'hist', busca: '' };
  var INTERNOS = /AQUA RIO AQUARIO|AQUARIO MARINHO|PAINEIRAS|BINAMIK|BIOPARQUE|^TESTE/;
  function ultimaPlanilha() { // chave do nome -> último mês (AAAA-MM) com venda no Top Clientes da planilha TRADE
    var u = {};
    (D.meses2025 || []).forEach(function (m, i) { (m.clientes || []).forEach(function (c) { if (c.t > 0) { var kk = chave(alias(c.n)); var mm = ym(2025, i); if (!u[kk] || u[kk] < mm) u[kk] = mm; } }); });
    (D.meses || []).forEach(function (m, i) { (m.clientes || []).forEach(function (c) { if (c.t > 0) { var kk = chave(alias(c.n)); var mm = ym(2026, i); if (!u[kk] || u[kk] < mm) u[kk] = mm; } }); });
    return u;
  }
  function cadastro(cod, nome) {
    var c = DADOS.cad && DADOS.cad.agencias;
    if (!c) return null;
    return c[cod] || c[chave(nome)] || null;
  }
  function dataRefBrutos() {
    var max = '';
    Object.values((DADOS.ind && DADOS.ind.parques) || {}).forEach(function (pm) { Object.values(pm).forEach(function (b) { Object.keys(b.dias).forEach(function (ds) { if (ds > max) max = ds; }); }); });
    return max;
  }
  function renderOp() {
    var pg = el('tv2-op-corpo');
    if (!DADOS.carregado || !DADOS.ind) { carregando('tv2-op-corpo', 'trade_indicadores.json'); return; }
    var ref = dataRefBrutos();
    var refD = new Date(ref + 'T12:00:00'), corte = new Date(refD); corte.setMonth(corte.getMonth() - 6);
    var corteS = iso(corte);
    var A = {};
    Object.keys(DADOS.ind.agencias || {}).forEach(function (pq) {
      var x = pq === 'AquaRio' ? 'a' : 'p';
      Object.keys(DADOS.ind.agencias[pq]).forEach(function (cod0) {
        var g = DADOS.ind.agencias[pq][cod0];
        var cod = /^\d{1,3}(\.\d{3})+$/.test(cod0) ? cod0.replace(/\./g, '') : cod0; // alguns arquivos gravam "6.031.763"
        if (INTERNOS.test(chave(g.n))) return;
        var a = A[cod] = A[cod] || { cod: cod, n: g.n, q: 0, pv: g.pv, uv: g.uv, pq: {}, m: {} };
        a.q += g.q; a.pv = a.pv < g.pv ? a.pv : g.pv; a.uv = a.uv > g.uv ? a.uv : g.uv;
        a.pq[x] = (a.pq[x] || 0) + g.q;
        Object.keys(g.m).forEach(function (mm) { a.m[mm] = (a.m[mm] || 0) + g.m[mm]; });
        if (g.q > (a.qn || 0)) { a.qn = g.q; a.n = g.n; }
      });
    });
    // Alguns brutos (ex.: Paineiras até mar/26) vêm sem CODIGO_AGENCIA e a agência fica pelo nome; a mesma
    // agência aparece depois com código (ex.: "HYD BRAZILIAN TOURS / IN BUZIOS" parecia parada desde 31/03,
    // mas vende todo mês com código). Junta pelo nome normalizado (mesmo agrupamento do Top Clientes).
    var B = {};
    Object.values(A).forEach(function (a) {
      var kk = chave(alias(a.n)) || a.cod;
      var b = B[kk];
      if (!b) { B[kk] = a; a.cods = /^\d+$/.test(a.cod) ? [a.cod] : []; return; }
      if (/^\d+$/.test(a.cod) && b.cods.indexOf(a.cod) < 0) b.cods.push(a.cod);
      b.q += a.q; b.pv = b.pv < a.pv ? b.pv : a.pv; b.uv = b.uv > a.uv ? b.uv : a.uv;
      Object.keys(a.pq).forEach(function (x) { b.pq[x] = (b.pq[x] || 0) + a.pq[x]; });
      Object.keys(a.m).forEach(function (mm) { b.m[mm] = (b.m[mm] || 0) + a.m[mm]; });
      if ((a.qn || 0) > (b.qn || 0)) { b.qn = a.qn; b.n = a.n; }
    });
    Object.values(B).forEach(function (b) { b.cod = b.cods.join(', ') || b.cod; b.n = alias(b.n); });
    var up = ultimaPlanilha();
    var lista = [], vendeuPlanilha = 0;
    Object.values(B).forEach(function (a) {
      if (a.uv >= corteS) return;
      var mp = up[chave(alias(a.n))] || up[chave(a.n)];
      if (mp && mp > a.uv.slice(0, 7) && mp >= corteS.slice(0, 7)) { vendeuPlanilha++; return; } // a planilha TRADE registra venda mais recente
      var ms = Object.keys(a.m).sort();
      var ativos = ms.filter(function (m) { return a.m[m] > 0; });
      a.mesesSem = Math.floor((refD - new Date(a.uv + 'T12:00:00')) / (864e5 * 30.44));
      a.diasSem = Math.round((refD - new Date(a.uv + 'T12:00:00')) / 864e5);
      a.mediaAtiva = ativos.length ? a.q / ativos.length : 0;
      a.mesesAtivos = ativos.length;
      a.cad = cadastro(a.cod, a.n);
      lista.push(a);
    });
    var minQ = Number(opEstado.min);
    var busca = chave(opEstado.busca);
    var ls = lista.filter(function (a) { return a.q >= minQ && (!busca || chave(a.n).indexOf(busca) >= 0 || a.cod.indexOf(opEstado.busca) >= 0); });
    var ord = { dias: function (a, b) { return b.diasSem - a.diasSem; }, hist: function (a, b) { return b.q - a.q; }, media: function (a, b) { return b.mediaAtiva - a.mediaAtiva; },
      local: function (a, b) { var x = a.cad ? (a.cad.uf || '') + (a.cad.cidade || '') : '~', y = b.cad ? (b.cad.uf || '') + (b.cad.cidade || '') : '~'; return x < y ? -1 : x > y ? 1 : b.q - a.q; } }[opEstado.ord];
    ls.sort(ord);
    var html = '<div class="sec" style="margin-top:6px"><div><div class="sec-t">AGÊNCIAS SEM COMPRAR HÁ MAIS DE 6 MESES</div>' +
      '<div class="sec-s">Última venda efetiva = maior DATA_VENDA de bilhete Trade da agência nos brutos (AquaRio + Paineiras, jan/25 em diante), ' +
      'cruzada com o Top Clientes da planilha TRADE. Referência: ' + dataBR(ref) + ' · corte: venda antes de ' + dataBR(corteS) + '.</div></div><span class="badge">' + ls.length + ' agências</span></div>';
    html += '<div class="cli-kpis-ag">' + kpi('Agências inativas (6m+)', nf(ls.length), 'com ' + minQ + '+ bilhetes no histórico') +
      kpi('Bilhetes no histórico', nf(ls.reduce(function (a, x) { return a + x.q; }, 0)), 'volume que essas agências já compraram') +
      kpi('Ritmo típico somado', nf(ls.reduce(function (a, x) { return a + x.mediaAtiva; }, 0)) + '/mês', 'soma da média mensal de cada agência nos meses em que comprou (referência, não previsão)') +
      kpi('Reativadas pela planilha', nf(vendeuPlanilha), 'sem venda no bruto, mas com venda recente no Top Clientes: ficam fora') + '</div>';
    html += aviso('⚠️ <strong>Limites:</strong> (1) só aparecem agências que já venderam desde jan/25. Agência cadastrada que nunca vendeu não está em nenhuma base que o Dash lê. ' +
      '(2) No Paineiras, antes de ago/26 a venda de agência na bilheteria vinha sem o nome da agência no bruto; por isso a lista é cruzada com o Top Clientes da planilha. ' +
      '(3) Cidade/UF e data de cadastro dependem do cadastro oficial de agências' + (DADOS.cad ? '' : ', que ainda não foi carregado (coluna fica "sem cadastro")') + '.');
    html += '<div class="cc" style="overflow-x:auto"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">' +
      controle('Buscar', '<input id="tv2-op-busca" class="cli-select" style="background-image:none;padding-right:11px;min-width:200px" placeholder="nome ou código" value="' + esc(opEstado.busca) + '">') +
      controle('Mínimo no histórico', '<select class="cli-select" id="tv2-op-min">' + ['1', '10', '50', '100', '500'].map(function (v) { return '<option value="' + v + '"' + (v === opEstado.min ? ' selected' : '') + '>' + v + '+ bilhetes</option>'; }).join('') + '</select>') +
      controle('Ordenar por', '<select class="cli-select" id="tv2-op-ord">' + [['dias', 'Tempo sem vender'], ['hist', 'Histórico de vendas'], ['media', 'Média mensal quando ativa']].concat(DADOS.cad ? [['local', 'Localização']] : []).map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === opEstado.ord ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') +
      '<button class="cli-seg-btn" style="background:var(--navy);color:#fff;border-color:var(--navy)" id="tv2-op-xls">⬇️ Excel</button></div>';
    var cadOp = !!DADOS.cad;
    html += '<table class="cli-tbl"><thead><tr><th>Agência</th><th>Código</th>' + (cadOp ? '<th>Cidade / UF</th>' : '') + '<th>Última venda</th><th style="text-align:right">Sem vender</th><th style="text-align:right">Bilhetes (hist.)</th>' +
      '<th style="text-align:right">Média/mês ativa</th><th>Parques</th><th>Meses com venda</th></tr></thead><tbody>';
    ls.slice(0, 300).forEach(function (a) {
      html += '<tr><td><strong>' + esc(a.n) + '</strong></td><td style="font-size:10.5px;color:var(--muted)">' + esc(/^\d/.test(a.cod) ? a.cod : '-') + '</td>' +
        (cadOp ? '<td>' + (a.cad ? esc((a.cad.cidade || '-') + ' / ' + (a.cad.uf || '-')) : '<span style="color:var(--muted);font-size:10.5px">sem cadastro</span>') + '</td>' : '') +
        '<td style="white-space:nowrap">' + dataBR(a.uv) + '</td><td style="text-align:right"><strong>' + a.mesesSem + ' meses</strong></td><td style="text-align:right">' + nf(a.q) + '</td>' +
        '<td style="text-align:right">' + nf(a.mediaAtiva) + '</td><td>' + Object.keys(a.pq).map(function (x) { return '<span class="cli-pill" style="background:' + (x === 'a' ? 'var(--aqua-pale);color:var(--aqua)' : 'var(--pai-pale);color:var(--pai)') + '">' + NOME[x] + '</span>'; }).join(' ') + '</td>' +
        '<td style="font-size:10.5px;color:var(--muted)">' + a.mesesAtivos + ' (' + mesLbl(Object.keys(a.m).sort()[0]) + ' a ' + mesLbl(a.uv.slice(0, 7)) + ')</td></tr>';
    });
    html += '</tbody></table>' + (ls.length > 300 ? '<div class="cc-s" style="margin-top:6px">Mostrando 300 de ' + ls.length + '. O Excel traz todas.</div>' : '') + '</div>';
    pg.innerHTML = html;
    var t;
    el('tv2-op-busca').oninput = function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { opEstado.busca = v; renderOp(); var b = el('tv2-op-busca'); b.focus(); b.setSelectionRange(v.length, v.length); }, 300); };
    el('tv2-op-min').onchange = function () { opEstado.min = this.value; renderOp(); };
    el('tv2-op-ord').onchange = function () { opEstado.ord = this.value; renderOp(); };
    el('tv2-op-xls').onclick = function () {
      if (typeof XLSX === 'undefined') return;
      var rows = [['Agência', 'Código', 'Cidade', 'UF', 'Última venda', 'Dias sem vender', 'Meses sem vender', 'Bilhetes no histórico', 'Média mensal quando ativa', 'AquaRio', 'Paineiras', 'Meses com venda', 'Primeira venda']];
      ls.forEach(function (a) {
        rows.push([a.n, /^\d/.test(a.cod) ? a.cod : '', a.cad ? a.cad.cidade || '' : 'sem cadastro', a.cad ? a.cad.uf || '' : '', dataBR(a.uv), a.diasSem, a.mesesSem, Math.round(a.q),
          Math.round(a.mediaAtiva), Math.round(a.pq.a || 0), Math.round(a.pq.p || 0), a.mesesAtivos, dataBR(a.pv)]);
      });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Inativas 6m+');
      XLSX.writeFile(wb, 'agencias_inativas_' + ref + '.xlsx');
    };
  }

  // ================================================================ CLIENTES > CARTEIRA (Mapa de Canal)
  var carEstado = { grupo: '', busca: '', loc: '0' };
  var GRUPOS = [['Defender e acelerar', 'Volume alto + crescimento', 'var(--up)', '#e3f5eb'], ['Recuperar volume', 'Volume alto + queda ou estável', 'var(--dn)', '#fff0ee'],
    ['Desenvolver potencial', 'Volume menor + crescimento', 'var(--aqua)', '#e8f2fb'], ['Reavaliar esforço', 'Volume menor + queda ou estável', '#B45309', '#fff4d9']];
  function carteira() {
    // Mesmo período nos dois anos: jan até o último mês fechado de 2026 (mapa da Paula: jan–set)
    var ultF = MA.isFechado ? IDX : IDX - 1, A = {};
    function soma(lista, campo) {
      (lista || []).forEach(function (c) {
        var nome = alias(c.n), kk = chave(nome); if (!kk || INTERNOS.test(kk)) return;
        var a = A[kk] = A[kk] || { n: nome, v25: 0, v26: 0 };
        a[campo] += (c.a || 0) + (c.p || 0);
      });
    }
    for (var i = 0; i <= ultF; i++) { soma((D.meses[i] || {}).clientes, 'v26'); soma((D.meses2025[i] || {}).clientes, 'v25'); }
    var arr = Object.values(A).filter(function (a) { return a.v25 + a.v26 > 0; });
    var vols = arr.map(function (a) { return a.v26; }).sort(function (a, b) { return a - b; });
    // mesma regra do Mapa de Canal 2026 anexado pela Paula (conferida: as 536 agências caem no mesmo grupo):
    // volume alto = 2026 >= mediana; crescimento = variação % positiva, o que exige base em 2025
    // (agência nova, sem 2025, não conta como crescimento)
    var meio = Math.floor(vols.length / 2);
    var mediana = !vols.length ? 0 : vols.length % 2 ? vols[meio] : (vols[meio - 1] + vols[meio]) / 2;
    arr.forEach(function (a) {
      a.diff = a.v26 - a.v25; a.pct = a.v25 ? a.v26 / a.v25 - 1 : null;
      var alto = a.v26 >= mediana, cresce = a.pct != null && a.pct > 0;
      a.g = alto ? (cresce ? GRUPOS[0][0] : GRUPOS[1][0]) : (cresce ? GRUPOS[2][0] : GRUPOS[3][0]);
      a.cad = cadastro(null, a.n);
    });
    return { arr: arr, mediana: mediana, ate: ultF };
  }
  function renderCarteira() {
    var box = el('cli-panel-carteira');
    if (!box) return;
    var c = carteira(), arr = c.arr;
    var t25 = arr.reduce(function (s, a) { return s + a.v25; }, 0), t26 = arr.reduce(function (s, a) { return s + a.v26; }, 0);
    var per = 'Jan–' + MES[c.ate] + ' 2026 x Jan–' + MES[c.ate] + ' 2025';
    var html = '<div class="cli-period-info tot">Mapa de Canal · ' + per + ' · AquaRio + Paineiras · Trade por agência (Top Clientes da planilha TRADE). Volume alto/baixo pela mediana de 2026 (' + nf(c.mediana) + ' bilhetes).</div>';
    var of26 = 0; for (var i = 0; i <= c.ate; i++) of26 += ((D.hist26.aqua || [])[i] || 0) + ((D.hist26.pai || [])[i] || 0);
    html += '<div class="cli-kpis-ag">' + kpi('Volume 2026 (agências identificadas)', nf(t26), per.split(' x ')[0] + ' · ' + pf(of26 ? t26 / of26 : null) + ' do Trade oficial (' + nf(of26) + ')') +
      kpi('Volume 2025', nf(t25), 'mesmo período') +
      kpi('Variação', pf(varPct(t26, t25)), sinal(t26 - t25, nf) + ' bilhetes') + kpi('Compradores', nf(arr.length), 'com venda em algum dos 2 anos') + '</div>';
    html += '<div class="row4" style="margin-bottom:14px">' + GRUPOS.map(function (g) {
      var ls = arr.filter(function (a) { return a.g === g[0]; }).sort(function (a, b) { return b.v26 - a.v26; });
      return '<div class="cc" style="background:' + g[3] + ';border-color:transparent;cursor:pointer" data-g="' + esc(g[0]) + '"><div class="cc-t" style="color:' + g[2] + '">' + g[0] + '</div><div class="cc-s">' + g[1] + '</div>' +
        '<div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:#0D1B2A;margin-top:6px">' + ls.length + ' agências</div><div class="cc-s" style="color:#3b4a55">' + nf(ls.reduce(function (s, a) { return s + a.v26; }, 0)) + ' bilhetes em 2026</div></div>';
    }).join('') + '</div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">' +
      controle('Buscar', '<input id="tv2-car-busca" class="cli-select" style="background-image:none;padding-right:11px;min-width:200px" placeholder="nome da agência" value="' + esc(carEstado.busca) + '">') +
      controle('Grupo', '<select class="cli-select" id="tv2-car-grupo"><option value="">Todos</option>' + GRUPOS.map(function (g) { return '<option' + (g[0] === carEstado.grupo ? ' selected' : '') + '>' + g[0] + '</option>'; }).join('') + '</select>') +
      (DADOS.cad ? controle('Visão', '<select class="cli-select" id="tv2-car-loc"><option value="0"' + (carEstado.loc === '0' ? ' selected' : '') + '>Por agência</option><option value="1"' + (carEstado.loc === '1' ? ' selected' : '') + '>Por cidade</option></select>') : '') + '</div>';
    if (!DADOS.cad) carEstado.loc = '0';
    var ls = arr.filter(function (a) { return (!carEstado.grupo || a.g === carEstado.grupo) && (!carEstado.busca || chave(a.n).indexOf(chave(carEstado.busca)) >= 0); });
    if (carEstado.loc === '1') {
      var L = {};
      ls.forEach(function (a) { var kk = a.cad ? (a.cad.cidade || '-') + ' / ' + (a.cad.uf || '-') : 'sem cadastro'; var l = L[kk] = L[kk] || { n: kk, v25: 0, v26: 0, ag: 0 }; l.v25 += a.v25; l.v26 += a.v26; l.ag++; });
      var ll = Object.values(L).sort(function (a, b) { return (a.v26 - a.v25) - (b.v26 - b.v25); });
      html += '<div class="cc" style="overflow-x:auto"><table class="cli-tbl"><thead><tr><th>Cidade / UF</th><th style="text-align:right">Agências</th><th style="text-align:right">2025</th><th style="text-align:right">2026</th><th style="text-align:right">Δ volume</th><th style="text-align:right">Δ %</th></tr></thead><tbody>' +
        ll.map(function (l) { return '<tr><td><strong>' + esc(l.n) + '</strong></td><td style="text-align:right">' + l.ag + '</td><td style="text-align:right">' + nf(l.v25) + '</td><td style="text-align:right"><strong>' + nf(l.v26) + '</strong></td><td style="text-align:right" class="' + cls(l.v26 - l.v25) + '">' + sinal(l.v26 - l.v25, nf) + '</td><td style="text-align:right">' + pill(varPct(l.v26, l.v25)) + '</td></tr>'; }).join('') +
        '</tbody></table><div class="cc-s" style="margin-top:6px">Ordenado pela maior queda absoluta. Mesmo período nos dois anos, o que já tira o efeito de sazonalidade do mês.</div></div>';
    } else {
      ls.sort(function (a, b) { return b.v26 - a.v26; });
      var flag = function (v) { return v == null ? '<span style="color:var(--muted);font-size:10.5px">sem cadastro</span>' : v === true || v === 'sim' ? '✔' : v === false || v === 'não' ? '-' : esc(v); };
      var cad = !!DADOS.cad;
      html += '<div class="cc" style="overflow-x:auto"><table class="cli-tbl"><thead><tr><th>Agência</th>' + (cad ? '<th>Cidade / UF</th><th>Portal do Agente</th><th>Portal do Guia</th>' : '') + '<th style="text-align:right">2025</th><th style="text-align:right">2026</th><th style="text-align:right">Δ volume</th><th style="text-align:right">Δ %</th><th>Prioridade sugerida</th></tr></thead><tbody>' +
        ls.slice(0, 300).map(function (a) {
          var g = GRUPOS.filter(function (x) { return x[0] === a.g; })[0];
          return '<tr><td><strong>' + esc(a.n) + '</strong></td>' + (cad ? '<td>' + (a.cad ? esc((a.cad.cidade || '-') + ' / ' + (a.cad.uf || '-')) : '<span style="color:var(--muted);font-size:10.5px">sem cadastro</span>') + '</td>' +
            '<td>' + flag(a.cad ? a.cad.portalAgente : null) + '</td><td>' + flag(a.cad ? a.cad.portalGuia : null) + '</td>' : '') +
            '<td style="text-align:right">' + nf(a.v25) + '</td><td style="text-align:right"><strong>' + nf(a.v26) + '</strong></td><td style="text-align:right" class="' + cls(a.diff) + '">' + sinal(a.diff, nf) + '</td>' +
            '<td style="text-align:right">' + (a.pct == null ? '<span class="cli-pill novo">novo</span>' : pill(a.pct)) + '</td><td><span class="cli-pill" style="background:' + g[3] + ';color:' + g[2] + '">' + a.g + '</span></td></tr>';
        }).join('') + '</tbody></table>' + (ls.length > 300 ? '<div class="cc-s" style="margin-top:6px">Mostrando 300 de ' + ls.length + '.</div>' : '') + '</div>';
    }
    if (!DADOS.cad) html += aviso('ℹ️ <strong>Cidade, Portal do Agente e Portal do Guia</strong> entram aqui quando o cadastro oficial de agências for carregado ' +
      '(código, cidade, UF e as flags dos dois portais, separando acesso, habilitação e uso). Nenhuma base do Dash traz esses campos: a UF/PAIS do bruto é do visitante, não da agência.');
    html += aviso('ℹ️ <strong>Sobre o Mapa de Canal anexado:</strong> o arquivo classifica <em>compradores</em> em 4 grupos de ação (volume x crescimento), não traz uma taxonomia de canais. ' +
      'A segmentação acima usa exatamente a mesma regra (mediana de volume de 2026 e variação % vs 2025, mesmo período) sobre os números oficiais do Top Clientes; os canais continuam os da planilha TRADE. ' +
      'Pela regra do mapa, agência nova (sem compra em 2025) não conta como crescimento e cai em "Recuperar volume" ou "Reavaliar esforço"; ela aparece com a etiqueta "novo" na coluna Δ %.');
    box.innerHTML = html;
    box.querySelectorAll('[data-g]').forEach(function (d) { d.onclick = function () { carEstado.grupo = carEstado.grupo === d.getAttribute('data-g') ? '' : d.getAttribute('data-g'); renderCarteira(); }; });
    var t;
    el('tv2-car-busca').oninput = function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { carEstado.busca = v; renderCarteira(); var b = el('tv2-car-busca'); b.focus(); b.setSelectionRange(v.length, v.length); }, 300); };
    el('tv2-car-grupo').onchange = function () { carEstado.grupo = this.value; renderCarteira(); };
    if (el('tv2-car-loc')) el('tv2-car-loc').onchange = function () { carEstado.loc = this.value; renderCarteira(); };
  }

  // ================================================================ Cancelamento (28/10/2026)
  // Pedido da gerente comercial (via Paulo): % de cancelamento mensal (os 2 parques, filtrável), % por agência mês a mês,
  // relação com o clima e cancelado em R$. Fonte: trade_cancelamento.json (CARD Robo\canc_agrega.py), CARD por período
  // de visita, só Trade. Cancelado = Cancelada (Estorno) + Cancelado gerou crédito; pedido de cancelamento à parte;
  // não pago fora; no-show = aprovado sem entrada com visita até ontem.
  var cancEstado = { k: 't', mes: '', met: 'canc', min: '100' };
  DADOS.canc = null;
  var promessaCanc = getJSON('trade_cancelamento.json', true).then(function (j) {
    DADOS.canc = j;
    if (window.__tv2Pagina === 'canc') renderCanc();
  });
  function cancSoma(lst) {
    var o = { ag: 0, canc: 0, ped: 0, util: 0, ns: 0, fut: 0, rs_ag: 0, rs_canc: 0, rs_ns: 0 };
    lst.forEach(function (x) { if (x) Object.keys(o).forEach(function (c) { o[c] += x[c] || 0; }); });
    return o;
  }
  function cancParques(k) { return k === 't' ? ['AquaRio', 'Paineiras'] : [k === 'a' ? 'AquaRio' : 'Paineiras']; }
  // meses com base completa para todos os parques do filtro (o Paineiras só tem o Trade no CARD desde ago/26)
  function cancMeses() {
    var C = DADOS.canc, ps = cancParques(cancEstado.k), ini = ps.map(function (p) { return (C.inicio || {})[p] || ''; }).sort().pop() || '';
    var s = {};
    ps.forEach(function (p) { Object.keys((C.meses || {})[p] || {}).forEach(function (m) { if (m >= ini) s[m] = 1; }); });
    return Object.keys(s).sort();
  }
  function cancMes(k, m) { return cancSoma(cancParques(k).map(function (p) { return ((DADOS.canc.meses || {})[p] || {})[m]; })); }
  // % de no-show sobre o que já devia ter acontecido (agendado menos visita futura)
  function txNs(o) { var b = o.ag - o.fut; return b > 0 ? o.ns / b : null; }
  function txCanc(o) { return o.ag ? o.canc / o.ag : null; }
  function rs(v) { return v == null ? '-' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }

  function renderCanc() {
    var pg = el('tv2-canc-corpo');
    if (!DADOS.canc) { carregando('tv2-canc-corpo', 'trade_cancelamento.json'); return; }
    var C = DADOS.canc, ms = cancMeses(), k = cancEstado.k;
    if (!ms.length) { pg.innerHTML = aviso('Sem dados de cancelamento ainda.'); return; }
    if (!cancEstado.mes || ms.indexOf(cancEstado.mes) < 0) cancEstado.mes = ms[ms.length - 1];
    var sel = el('tv2-canc-mes');
    if (sel) sel.innerHTML = ms.slice().reverse().map(function (m) { return '<option value="' + m + '"' + (m === cancEstado.mes ? ' selected' : '') + '>' + mesLbl(m) + '</option>'; }).join('');
    var mSel = cancEstado.mes, ate = C.ate, parcial = mSel === ate.slice(0, 7);
    var M = cancMes(k, mSel), ANO = cancSoma(ms.map(function (m) { return cancMes(k, m); }));
    var corK = COR[k];
    var h = '<div class="cli-kpis-ag" style="margin-bottom:14px">' +
      kpi('Bilhetes agendados', nf(M.ag), mesLbl(mSel) + (parcial ? ' (parcial até ' + dataBR(ate).slice(0, 5) + ')' : ''), null, corK) +
      kpi('Cancelados', pf(txCanc(M)), nf(M.canc) + ' bilhetes · ' + rs(M.rs_canc) + (M.ped ? '<br>+ ' + nf(M.ped) + ' com pedido de cancelamento em andamento' : '')) +
      kpi('No-show', pf(txNs(M)), nf(M.ns) + ' bilhetes · ' + rs(M.rs_ns)) +
      kpi('Acumulado ' + mesLbl(ms[0]) + ' a ' + mesLbl(ms[ms.length - 1]), pf(txCanc(ANO)) + ' · ' + pf(txNs(ANO)), 'cancelado · no-show · ' + rs(ANO.rs_canc + ANO.rs_ns) + ' perdidos') +
      '</div>';
    h += '<div class="row2"><div class="cc"><div class="cc-h"><div class="cc-t">% de cancelamento e no-show por mês</div><div class="cc-s">' + NOME[k] + ' · sobre os bilhetes Trade agendados para o mês</div></div><div style="height:260px"><canvas id="tv2-c-canc"></canvas></div></div>' +
      '<div class="cc"><div class="cc-h"><div class="cc-t">Valor perdido por mês (R$)</div><div class="cc-s">Preço dos bilhetes cancelados e dos no-shows</div></div><div style="height:260px"><canvas id="tv2-c-canc-rs"></canvas></div></div></div>';
    h += '<div class="cc" style="margin:14px 0;overflow-x:auto" id="tv2-canc-ag"></div>';
    h += '<div class="cc" style="margin-bottom:14px;overflow-x:auto" id="tv2-canc-clima"></div>';
    h += aviso('ℹ️ <strong>Como ler:</strong> agendado = bilhetes Trade com visita marcada no mês (CARD, período de visita; vendas em maquininha e não pagos ficam fora). ' +
      '<strong>Cancelado</strong> = estorno ou crédito gerado. <strong>No-show</strong> = bilhete aprovado, com visita até ' + dataBR(ate).slice(0, 5) + ', sem entrada registrada; o % de no-show é sobre os bilhetes cuja visita já passou. ' +
      '<strong>Pedido de cancelamento</strong> = ainda aprovado, mas com cancelamento solicitado. <strong>Paineiras só a partir de ago/26</strong>: antes disso a venda Trade do parque não passava pelo CARD, e o AquaRio tem histórico desde jan/26 (na visão dos dois parques, a partir de ago/26). Agência = local de venda no CARD (pedidos do comercial sem agência ficam agrupados). Atualizado todo dia; os meses recentes ainda podem mudar com cancelamentos feitos depois.');
    pg.innerHTML = h;
    var lbl = ms.map(mesLbl);
    grafico('tv2-c-canc', { type: 'line', data: { labels: lbl, datasets: [
      { label: '% cancelado', data: ms.map(function (m) { var v = txCanc(cancMes(k, m)); return v == null ? null : +(v * 100).toFixed(2); }), borderColor: '#C0392B', backgroundColor: '#C0392B', tension: .25, pointRadius: 3 },
      { label: '% no-show', data: ms.map(function (m) { var v = txNs(cancMes(k, m)); return v == null ? null : +(v * 100).toFixed(2); }), borderColor: '#E67E22', backgroundColor: '#E67E22', tension: .25, pointRadius: 3 }] },
      options: { scales: eixos({ y: { beginAtZero: true, grid: { color: grade().grid }, ticks: { color: grade().txt, font: { size: 10 }, callback: function (v) { return v + '%'; } } } }),
        plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.raw == null ? '-' : c.raw.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'); } } } } } });
    grafico('tv2-c-canc-rs', { type: 'bar', data: { labels: lbl, datasets: [
      { label: 'Cancelado', data: ms.map(function (m) { return Math.round(cancMes(k, m).rs_canc); }), backgroundColor: '#C0392B', stack: 's' },
      { label: 'No-show', data: ms.map(function (m) { return Math.round(cancMes(k, m).rs_ns); }), backgroundColor: '#E67E22', stack: 's' }] },
      options: { scales: eixos({ x: { stacked: true, grid: { display: false }, ticks: { color: grade().txt, font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, grid: { color: grade().grid }, ticks: { color: grade().txt, font: { size: 10 }, callback: function (v) { return 'R$ ' + nf(v); } } } }),
        plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + rs(c.raw); } } } } } });
    renderCancAg(ms);
    renderCancClima();
  }

  // % por agência: mês a mês (histórico) + total do período
  function renderCancAg(ms) {
    var C = DADOS.canc, k = cancEstado.k, met = cancEstado.met, min = Number(cancEstado.min);
    var ag = {};
    cancParques(k).forEach(function (p) {
      Object.keys((C.agencias || {})[p] || {}).forEach(function (a) {
        var o = C.agencias[p][a];
        ag[a] = ag[a] || {};
        Object.keys(o).forEach(function (m) { ag[a][m] = cancSoma([ag[a][m], o[m]]); });
      });
    });
    var linhas = Object.keys(ag).map(function (a) {
      var t = cancSoma(ms.map(function (m) { return ag[a][m]; }));
      return { a: a, t: t, m: ag[a] };
    }).filter(function (l) { return l.t.ag >= min; });
    var tx = met === 'canc' ? txCanc : txNs;
    linhas.sort(function (x, y) { return (met === 'canc' ? y.t.canc - x.t.canc : y.t.ns - x.t.ns) || y.t.ag - x.t.ag; });
    var cor = function (v) { if (v == null) return ''; var a = Math.min(1, v / 0.15); return 'background:rgba(192,57,43,' + (0.08 + a * 0.55).toFixed(2) + ')'; };
    var h = '<div class="cc-h" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-end"><div><div class="cc-t">% por agência, mês a mês</div><div class="cc-s">' + NOME[k] + ' · ' + linhas.length + ' agências com ' + nf(min) + '+ bilhetes agendados no período · ordenado por bilhetes ' + (met === 'canc' ? 'cancelados' : 'no-show') + '</div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' + controle('Indicador', seg('tv2-canc-met', [['canc', '% cancelado'], ['ns', '% no-show']], met, function (v) { cancEstado.met = v; renderCancAg(ms); })) +
      controle('Mínimo', '<select class="cli-select" id="tv2-canc-min">' + ['10', '100', '500', '1000'].map(function (v) { return '<option value="' + v + '"' + (v === cancEstado.min ? ' selected' : '') + '>' + v + '+ bilhetes</option>'; }).join('') + '</select>') +
      '<button class="cli-seg-btn" style="background:var(--navy);color:#fff;border-color:var(--navy);align-self:flex-end" id="tv2-canc-xls">⬇️ Excel</button></div></div>';
    h += '<table class="cli-table" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Agência</th>' + ms.map(function (m) { return '<th>' + mesLbl(m) + '</th>'; }).join('') +
      '<th>Agendados</th><th>' + (met === 'canc' ? 'Cancelados' : 'No-show') + '</th><th>%</th><th>R$ perdido</th></tr></thead><tbody>';
    linhas.forEach(function (l) {
      var v = tx(l.t);
      h += '<tr><td style="text-align:left;white-space:nowrap">' + esc(l.a) + '</td>' + ms.map(function (m) { var o = l.m[m]; var x = o ? tx(o) : null; return '<td style="text-align:right;' + cor(x) + '" title="' + (o ? nf(o.ag) + ' agendados' : '') + '">' + (o && o.ag ? pf(x) : '-') + '</td>'; }).join('') +
        '<td style="text-align:right">' + nf(l.t.ag) + '</td><td style="text-align:right">' + nf(met === 'canc' ? l.t.canc : l.t.ns) + '</td><td style="text-align:right;font-weight:700;' + cor(v) + '">' + pf(v) + '</td><td style="text-align:right">' + rs(met === 'canc' ? l.t.rs_canc : l.t.rs_ns) + '</td></tr>';
    });
    h += '</tbody></table>';
    var box = el('tv2-canc-ag');
    box.innerHTML = h;
    el('tv2-canc-min').onchange = function () { cancEstado.min = this.value; renderCancAg(ms); };
    el('tv2-canc-xls').onclick = function () {
      if (typeof XLSX === 'undefined') return;
      var aoa = [['Agência'].concat(ms.map(mesLbl).map(function (x) { return x + ' agendados'; }), ms.map(mesLbl).map(function (x) { return x + ' cancelados'; }), ms.map(mesLbl).map(function (x) { return x + ' no-show'; }), ['Agendados', 'Cancelados', 'No-show', 'R$ cancelado', 'R$ no-show'])];
      linhas.forEach(function (l) {
        aoa.push([l.a].concat(ms.map(function (m) { return (l.m[m] || {}).ag || 0; }), ms.map(function (m) { return (l.m[m] || {}).canc || 0; }), ms.map(function (m) { return (l.m[m] || {}).ns || 0; }),
          [l.t.ag, l.t.canc, l.t.ns, Math.round(l.t.rs_canc), Math.round(l.t.rs_ns)]));
      });
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Cancelamento');
      XLSX.writeFile(wb, 'cancelamento_trade_' + k + '.xlsx');
    };
  }

  // clima: dias por faixa de chuva no Rio, com % de cancelamento e no-show dos bilhetes daquele dia
  function renderCancClima() {
    var C = DADOS.canc, k = cancEstado.k, ch = C.chuva || {}, ate = C.ate;
    var F = [['sem', 'Sem chuva (até 1 mm)', function (x) { return x < 1; }], ['leve', 'Chuva (1 a 10 mm)', function (x) { return x >= 1 && x < 10; }], ['forte', 'Chuva forte (10 mm ou mais)', function (x) { return x >= 10; }]];
    var g = {}, DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], porDia = {};
    F.forEach(function (f) { g[f[0]] = { dias: {}, ag: 0, canc: 0, ns: 0, util: 0 }; });
    cancParques(k).forEach(function (p) {
      Object.keys((C.dias || {})[p] || {}).forEach(function (d) {
        if (d > ate || d.slice(0, 7) < (cancMeses()[0] || '')) return;
        var v = C.dias[p][d], mm = ch[d];
        var w = DS[new Date(d + 'T12:00:00').getDay()];
        porDia[w] = porDia[w] || { ag: 0, canc: 0, ns: 0 };
        porDia[w].ag += v[0]; porDia[w].canc += v[1]; porDia[w].ns += v[2];
        if (mm == null) return;
        var f = F.filter(function (f) { return f[2](mm); })[0];
        var o = g[f[0]]; o.dias[d] = 1; o.ag += v[0]; o.canc += v[1]; o.ns += v[2]; o.util += v[3];
      });
    });
    var h = '<div class="cc-h"><div class="cc-t">Clima e dia da semana</div><div class="cc-s">' + NOME[k] + ' · chuva do dia da visita no Rio (Open-Meteo) · % sobre os bilhetes Trade agendados para aqueles dias</div></div>' +
      '<div class="row2"><table class="cli-table" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Chuva no dia da visita</th><th>Dias</th><th>Agendados</th><th>% cancelado</th><th>% no-show</th></tr></thead><tbody>' +
      F.map(function (f) { var o = g[f[0]]; return '<tr><td style="text-align:left">' + f[1] + '</td><td style="text-align:right">' + nf(Object.keys(o.dias).length) + '</td><td style="text-align:right">' + nf(o.ag) + '</td><td style="text-align:right">' + pf(o.ag ? o.canc / o.ag : null) + '</td><td style="text-align:right">' + pf(o.ag ? o.ns / o.ag : null) + '</td></tr>'; }).join('') +
      '</tbody></table><table class="cli-table" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Dia da semana</th><th>Agendados</th><th>% cancelado</th><th>% no-show</th></tr></thead><tbody>' +
      ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function (w) { var o = porDia[w] || { ag: 0, canc: 0, ns: 0 }; return '<tr><td style="text-align:left">' + w + '</td><td style="text-align:right">' + nf(o.ag) + '</td><td style="text-align:right">' + pf(o.ag ? o.canc / o.ag : null) + '</td><td style="text-align:right">' + pf(o.ag ? o.ns / o.ag : null) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="cc-s" style="margin-top:6px">Mostra o que foi observado, não prova causa: o cancelamento costuma ser decidido antes do dia, e a chuva pesa mais no no-show (o grupo não aparece).</div>';
    el('tv2-canc-clima').innerHTML = h;
  }

  // ================================================================ páginas e navegação
  var PAGINAS = [
    ['obz', '🎯 OBZ', '🎯 OBZ', 'OBZ · TRADE E ESCOLAR', 'Realizado x meta OBZ, comparativos e quanto falta para a meta do mês'],
    ['ind', '🏞️ Indicadores Parques', '🏞️ Indic.', 'INDICADORES PARQUES', 'B2B x B2C, tipo de dia, eventos e antecedência de compra'],
    ['ori', '🌎 Origem', '🌎 Origem', 'ORIGEM DOS VISITANTES', 'Share e antecedência por país e feriados dos mercados principais'],
    ['op', '💡 Oportunidades', '💡 Oport.', 'OPORTUNIDADES', 'Agências que já compraram e estão paradas há mais de 6 meses'],
    ['canc', '🚫 Cancelamento', '🚫 Cancel.', 'CANCELAMENTO E NO-SHOW · TRADE', '% de bilhetes Trade cancelados e não utilizados, por mês, agência e clima']
  ];
  window.__tv2CancMes = function (v) { cancEstado.mes = v; renderCanc(); };
  var RENDER = { obz: renderOBZ, ind: renderInd, ori: renderOri, op: renderOp, canc: renderCanc };
  function filtros(id) {
    if (id === 'obz') return controle('Parque do gráfico', seg('tv2-obz-k', [['t', 'AquaRio + Paineiras'], ['a', 'AquaRio'], ['p', 'Paineiras']], obzEstado.k, function (v) { obzEstado.k = v; renderOBZ(); }));
    if (id === 'ind') return controle('Parque', seg('tv2-ind-k', [['t', 'Os dois'], ['a', 'AquaRio'], ['p', 'Paineiras']], indEstado.k, function (v) { indEstado.k = v; renderInd(); })) +
      controle('Período', seg('tv2-ind-per', PERIODOS, indEstado.per, function (v) { indEstado.per = v; renderInd(); }));
    if (id === 'canc') return controle('Parque', seg('tv2-canc-k', [['t', 'Os dois'], ['a', 'AquaRio'], ['p', 'Paineiras']], cancEstado.k, function (v) { cancEstado.k = v; renderCanc(); })) +
      controle('Mês dos indicadores', '<select class="cli-select" id="tv2-canc-mes" onchange="window.__tv2CancMes(this.value)"></select>');
    if (id === 'ori') return controle('Parque', seg('tv2-ori-k', [['t', 'Os dois'], ['a', 'AquaRio'], ['p', 'Paineiras']], oriEstado.k, function (v) { oriEstado.k = v; renderOri(); })) +
      controle('Período', seg('tv2-ori-per', PERIODOS, oriEstado.per, function (v) { oriEstado.per = v; renderOri(); })) +
      controle('Canal', seg('tv2-ori-seg', [['tot', 'Total'], ['b2b', 'B2B'], ['b2c', 'B2C']], oriEstado.seg, function (v) { oriEstado.seg = v; renderOri(); })) +
      controle('Brasil', seg('tv2-ori-br', [['0', 'Com'], ['1', 'Sem']], oriEstado.semBR, function (v) { oriEstado.semBR = v; renderOri(); }));
    return '';
  }
  function montarPaginas() {
    var ultima = el('pg-imm');
    if (!ultima) return false;
    // no celular o index.html esconde todo filho de .page que não seja .mob-content (regra com 2 ids);
    // o bloco das abas novas precisa de especificidade maior para aparecer
    var css = document.createElement('style');
    css.textContent = '@media (max-width:860px){' + PAGINAS.map(function (p) { return 'body #pg-' + p[0] + ':not(#tv2-x):not(#tv2-y) > .tv2-wrap'; }).join(',') +
      '{display:block!important}.tv2-wrap .cli-hdr{flex-direction:column;align-items:stretch}.tv2-wrap .cli-controls{gap:10px}.tv2-wrap .cli-seg{flex-wrap:wrap}.tv2-wrap .row2{grid-template-columns:1fr}}';
    document.head.appendChild(css);
    PAGINAS.forEach(function (p) {
      if (el('pg-' + p[0])) return;
      var d = document.createElement('div');
      d.id = 'pg-' + p[0];
      d.className = 'page';
      d.innerHTML = '<div class="tv2-wrap"><div class="cli-hdr" style="margin-top:16px"><div><div class="cli-title">' + p[3] + '</div><div class="sec-s">' + p[4] + ' · dados até ' + (MA.dataFmt || '') + '</div></div>' +
        '<div class="cli-controls">' + filtros(p[0]) + '</div></div><div id="tv2-' + p[0] + '-corpo"></div></div>';
      ultima.parentNode.insertBefore(d, ultima.nextSibling);
      ultima = d;
    });
    // botões (desktop e mobile), depois do Intel. Mercado
    var bImm = document.querySelector('.topbar .np[onclick*="\'imm\'"]');
    var mImm = document.querySelector('.mob-nav2-btn[data-page="imm"]');
    var antD = bImm, antM = mImm;
    PAGINAS.forEach(function (p) {
      if (bImm && !document.querySelector('.topbar .np[onclick*="\'' + p[0] + '\'"]')) {
        var b = document.createElement('button');
        b.className = 'np'; b.setAttribute('onclick', "nav(this,'" + p[0] + "')"); b.textContent = p[1];
        antD.parentNode.insertBefore(b, antD.nextSibling); antD = b;
      }
      if (mImm && !document.querySelector('.mob-nav2-btn[data-page="' + p[0] + '"]')) {
        var m = document.createElement('button');
        m.className = 'mob-nav2-btn'; m.setAttribute('onclick', "mobNav2(this,'" + p[0] + "')"); m.setAttribute('data-page', p[0]); m.textContent = p[2];
        antM.parentNode.insertBefore(m, antM.nextSibling); antM = m;
      }
    });
    // subaba Carteira no Top Clientes
    var barra = document.querySelector('#pg-cli .cli-tab-bar');
    var painelIns = el('cli-panel-insights');
    if (barra && painelIns && !el('cli-panel-carteira')) {
      var bt = document.createElement('button');
      bt.className = 'cli-tab'; bt.textContent = '🗺️ Carteira'; bt.setAttribute('onclick', "cliSetTab('carteira',this)");
      barra.appendChild(bt);
      var pn = document.createElement('div');
      pn.id = 'cli-panel-carteira'; pn.style.display = 'none';
      painelIns.parentNode.insertBefore(pn, painelIns.nextSibling);
    }
    return true;
  }
  if (!montarPaginas()) return;
  // celular: entram no menu "Mais" da barra inferior (trade_patch.js lê window.__tpmMaisExtra ao abrir)
  window.__tpmMaisExtra = PAGINAS.map(function (p) { return { id: p[0], rot: p[1].replace(/^\S+\s/, '') }; });
  // navegação: as abas novas não passam pelo initCharts do script principal
  // as abas novas não usam o mês do topo (têm filtro de período próprio): o seletor some enquanto elas estão abertas
  function seletorMes(mostrar) {
    ['mesSeletor', 'mobMesSel'].forEach(function (id) { var e = el(id); if (e) e.style.visibility = mostrar ? '' : 'hidden'; });
  }
  var initOrig = window.initCharts;
  window.initCharts = function (id, md) {
    seletorMes(!RENDER[id]);
    if (RENDER[id]) { window.__tv2Pagina = id; return RENDER[id](); }
    window.__tv2Pagina = null;
    return initOrig(id, md);
  };
  var mobOrig = window.buildMobContent;
  if (typeof mobOrig === 'function') window.buildMobContent = function (id, md) { if (RENDER[id]) return; return mobOrig(id, md); };
  // a Carteira tem período e base próprios: esconde a faixa de período e os filtros de parque/período do Ranking
  function controlesCli(mostrar) {
    ['cli-period-info'].forEach(function (id) { var e = el(id); if (e) e.style.visibility = mostrar ? '' : 'hidden'; });
    var c = document.querySelector('#pg-cli .cli-controls');
    if (c) Array.prototype.forEach.call(c.children, function (ch) { if (!/Exportar/.test(ch.textContent)) ch.style.display = mostrar ? '' : 'none'; });
  }
  var setTabOrig = window.cliSetTab;
  if (typeof setTabOrig === 'function') {
    window.cliSetTab = function (tab, btn) {
      var pn = el('cli-panel-carteira');
      if (tab === 'carteira') {
        document.querySelectorAll('.cli-tab').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        ['ranking', 'agencia', 'share', 'insights'].forEach(function (x) { var p = el('cli-panel-' + x); if (p) p.style.display = 'none'; });
        pn.style.display = '';
        controlesCli(false);
        renderCarteira();
        return;
      }
      if (pn) pn.style.display = 'none';
      controlesCli(true);
      return setTabOrig(tab, btn);
    };
  }
  // ================================================================ base única do Trade (26/10/2026)
  // O painel APPAI/Escolar usava como "Trade" a soma dos dias sem a linha Extras (ex.: jan/26 18.475), enquanto
  // todas as outras abas usam o Trade oficial da linha "Parcial:" (18.673). Os % de APPAI e Escolar sobre o
  // Trade passam a usar o oficial, o mesmo número da aba do mês, do Acumulado e do Histórico.
  (function () {
    var pct = function (n, d) { return d > 0 ? Math.round(n / d * 1000) / 10 : 0; };
    var mudou = false;
    function alinhar(o, trade) {
      if (!o || typeof trade !== 'number' || o.trade === trade) return;
      o.trade = trade;
      if ('esc26' in o) { o.escShareTrade = pct(o.esc26, trade); o.appShareTrade = pct(o.app26, trade); }
      if ('escolas' in o) { o.escShareTrade = pct(o.escolas, trade); o.appShareTrade = pct(o.appai, trade); }
      mudou = true;
    }
    (D.meses || []).forEach(function (m, i) { if (m.escolarAppai) alinhar(m.escolarAppai.aqua, (D.hist26.aqua || [])[i]); });
    ((D.appaiEscolarHist || {}).serie || []).forEach(function (x) {
      var mm = /^(\w{3})\/26$/.exec(x.label || '');
      if (!mm) return;
      var i = MES.indexOf(mm[1]);
      if (i >= 0) alinhar(x.aqua, (D.hist26.aqua || [])[i]);
    });
    if (mudou) setTimeout(function () {
      try { if (typeof window.renderMes === 'function' && (!window.curPage || window.curPage === 'mar')) window.renderMes(window.mesSelecionado && window.mesSelecionado.aqua ? window.mesSelecionado : D.meses[IDX]); } catch (e) { }
    }, 400);
  })();

  // ================================================================ abas antigas: números que precisam bater (26/10/2026)
  (function () {
    var mudou = false;
    // (a) Escolar de jan/26: a linha "Parcial:" da planilha marca 0, mas os dias somam 85 (Paulo: vale 85).
    // Regra geral: quando a soma dos dias (escolarAppai) diverge do resumo do mês, vale a soma dos dias.
    (D.meses || []).forEach(function (m, i) {
      var e = m.escolarAppai && m.escolarAppai.aqua;
      if (!e || typeof e.esc26 !== 'number') return;
      var atual = (D.hist26.escolas_aqua || [])[i];
      if (typeof atual === 'number' && atual !== e.esc26) {
        var dif = e.esc26 - atual;
        D.hist26.escolas_aqua[i] = e.esc26;
        if (m.aqua) m.aqua.escolas = e.esc26;
        for (var j = i; j < D.meses.length; j++) { var a = D.meses[j].acum && D.meses[j].acum.aqua; if (a && typeof a.escolas === 'number') a.escolas += dif; }
        if (i === IDX && D.mesAtual && D.mesAtual.aqua) D.mesAtual.aqua.escolas = e.esc26;
        mudou = true;
      }
    });
    // (b) APPAI no Top 10 do mês: mesmo número da coluna APPAI da planilha (o ranking contava 2 bilhetes a mais)
    (D.meses || []).forEach(function (m, i) {
      var tp = m.topClientesPainel && m.topClientesPainel.aqua, ap = (D.hist26.appai_aqua || [])[i];
      if (!tp || typeof ap !== 'number' || !ap) return;
      tp.forEach(function (c) { if (c.n === 'APPAI' && c.v26 !== ap) { c.v26 = ap; if (c.v25) c.delta = Math.round((ap / c.v25 - 1) * 1000) / 10; mudou = true; } });
    });
    if (mudou) setTimeout(function () {
      try { if (typeof window.renderMes === 'function' && (!window.curPage || window.curPage === 'mar')) window.renderMes(window.mesSelecionado && window.mesSelecionado.aqua ? window.mesSelecionado : D.meses[IDX]); } catch (e) { }
    }, 450);

    var fmtN = function (v) { return v == null ? '-' : Math.round(v).toLocaleString('pt-BR'); };
    var fmtR = function (v) { return v == null ? '-' : 'R$ ' + (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil'; };
    var fmtP = function (v) { return v == null ? '-' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; };
    function delta(a, b, pp) {
      if (a == null || b == null || (!pp && !b)) return '';
      var d = pp ? (a - b) * 100 : (a / b - 1) * 100;
      var t = Math.abs(d).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + (pp ? 'pp' : '%');
      return ' <span class="ae-cdelta ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲' : '▼') + t + '</span>';
    }
    // (c) Acumulado > Escolar: o mês em andamento comparava com o mesmo mês de 2025 INTEIRO (out: 2.815 x 2.649).
    // Agora o lado 2025 do mês corrente e do acumulado é o mesmo período (1 a 25/10/25), com receita do trade_extra.json.
    function escolarHist() {
      var tb = el('escolarHistTable');
      var tx = DADOS.extra;
      if (!tb || tb.dataset.tv2 === '1' || MA.isFechado || !tx || !tx.aquario) return;
      var e = MA.escolarAppai && MA.escolarAppai.aqua;
      if (!e) return;
      var dias = tx.aquario.dias || {}, pref = '2025-' + String(IDX + 1).padStart(2, '0') + '-';
      var p25 = { escV: 0, tradeV: 0, parqueV: 0 }, full25 = { escV: 0, tradeV: 0, parqueV: 0 }, ac25 = { escV: 0, tradeV: 0, parqueV: 0 };
      Object.keys(dias).forEach(function (ds) {
        if (ds.slice(0, 4) !== '2025') return;
        var v = dias[ds], mm = Number(ds.slice(5, 7)) - 1, dd = Number(ds.slice(8, 10));
        var ok = mm < IDX || (mm === IDX && dd <= DIA_ATUAL);
        if (ds.indexOf(pref) === 0) { full25.escV += v[1]; full25.tradeV += v[5]; full25.parqueV += v[7]; if (dd <= DIA_ATUAL) { p25.escV += v[1]; p25.tradeV += v[5]; p25.parqueV += v[7]; } }
        if (ok) { ac25.escV += v[1]; ac25.tradeV += v[5]; ac25.parqueV += v[7]; }
      });
      var esc25 = e.esc25, tr25 = MA.aqua.real25, pq25 = MA.aqua.par25;
      var escAc25 = 0, trAc25 = 0, pqAc25 = 0;
      for (var i = 0; i <= IDX; i++) {
        var ei = D.meses[i].escolarAppai && D.meses[i].escolarAppai.aqua;
        escAc25 += ei ? (ei.esc25 || 0) : 0; trAc25 += D.meses[i].aqua.real25 || 0; pqAc25 += D.meses[i].aqua.par25 || 0;
      }
      var col = IDX + 1, colAc = tb.querySelectorAll('thead th').length - 1;
      var linhas = tb.querySelectorAll('tbody tr');
      function poe(r, c, v26txt, v25, v26, pp, fmt) {
        var td = linhas[r] && linhas[r].children[c]; if (!td) return;
        var c25 = td.querySelector('.ae-c25'); if (!c25) return;
        c25.innerHTML = fmt(v25) + delta(v26, v25, pp);
        c25.title = '2025 no mesmo período (até ' + String(DIA_ATUAL).padStart(2, '0') + '/' + String(IDX + 1).padStart(2, '0') + ')';
      }
      function num(td) { var t = td && td.querySelector('.ae-c26'); return t ? t.textContent : ''; }
      function pn(t) { return Number(String(t).replace(/[^\d,]/g, '').replace(',', '.')) || 0; }
      // valores de 2026 que já estão na tabela (mesma base do resto da aba)
      var esc26 = e.esc26, escAc26 = pn(num(linhas[0].children[colAc]));
      var rec26 = pn(num(linhas[3].children[col])) * 1000, recAc26 = pn(num(linhas[3].children[colAc])) * 1000;
      var shT26 = pn(num(linhas[1].children[col])) / 100, shP26 = pn(num(linhas[2].children[col])) / 100;
      var shTAc26 = pn(num(linhas[1].children[colAc])) / 100, shPAc26 = pn(num(linhas[2].children[colAc])) / 100;
      var rT26 = pn(num(linhas[4].children[col])) / 100, rP26 = pn(num(linhas[5].children[col])) / 100;
      var rTAc26 = pn(num(linhas[4].children[colAc])) / 100, rPAc26 = pn(num(linhas[5].children[colAc])) / 100;
      // mês corrente
      poe(0, col, '', esc25, esc26, false, fmtN);
      poe(1, col, '', tr25 ? esc25 / tr25 : null, shT26, true, fmtP);
      poe(2, col, '', pq25 ? esc25 / pq25 : null, shP26, true, fmtP);
      poe(3, col, '', p25.escV, rec26, false, fmtR);
      poe(4, col, '', p25.tradeV ? p25.escV / p25.tradeV : null, rT26, true, fmtP);
      poe(5, col, '', p25.parqueV ? p25.escV / p25.parqueV : null, rP26, true, fmtP);
      // acumulado (jan até o mesmo dia)
      poe(0, colAc, '', escAc25, escAc26, false, fmtN);
      poe(1, colAc, '', trAc25 ? escAc25 / trAc25 : null, shTAc26, true, fmtP);
      poe(2, colAc, '', pqAc25 ? escAc25 / pqAc25 : null, shPAc26, true, fmtP);
      poe(3, colAc, '', ac25.escV, recAc26, false, fmtR);
      poe(4, colAc, '', ac25.tradeV ? ac25.escV / ac25.tradeV : null, rTAc26, true, fmtP);
      poe(5, colAc, '', ac25.parqueV ? ac25.escV / ac25.parqueV : null, rPAc26, true, fmtP);
      tb.dataset.tv2 = '1';
      var th = tb.querySelectorAll('thead th')[col];
      if (th && th.textContent.indexOf('*') < 0) th.textContent = th.textContent + '*';
      if (!el('tv2-esc-nota')) {
        var n = document.createElement('div');
        n.id = 'tv2-esc-nota'; n.className = 'cc-s'; n.style.margin = '6px 0 0';
        n.textContent = '* ' + MES[IDX] + '/26 parcial até ' + String(DIA_ATUAL).padStart(2, '0') + '/' + String(IDX + 1).padStart(2, '0') + ': o lado 2025 deste mês e do Acumulado é o mesmo período de 2025, não o mês inteiro.';
        tb.parentNode.insertBefore(n, tb.nextSibling);
      }
    }
    // (d) Histórico: o card de 2025 vinha do "Consolidado 2025" (AquaRio 123.879) e o bloco abaixo do Parcial
    // (125.158). O card passa a usar o mesmo total do bloco; o Parque 2025 do bloco passa a ser o ano inteiro.
    function historico() {
      var row = el('rowHist25');
      if (!row) return;
      parque25Hist();
      if (row.dataset.tv2 === '1') return;
      var soma = function (a) { return (a || []).reduce(function (s, v) { return s + (typeof v === 'number' ? v : 0); }, 0); };
      var t25 = { aqua: 0, pai: 0 };
      ['aqua', 'pai'].forEach(function (k) { for (var i = 0; i < 12; i++) t25[k] += i < IDX && D.meses[i] ? (D.meses[i][k].real25 || 0) : ((D.hist25[k] || [])[i] || 0); });
      var t24 = { aqua: soma(D.hist24.aqua), pai: soma(D.hist24.pai) };
      var cards = row.querySelectorAll('.acum-card');
      [['aqua', 0], ['pai', 2]].forEach(function (x) {
        var c = cards[x[1]]; if (!c) return;
        var v = c.querySelector('.acum-v26'), m = c.querySelector('.acum-v25'), d = c.querySelector('.acum-delta');
        var meta = m ? pn(m.textContent.split('·')[0]) : 0;
        if (v) v.textContent = fmtN(t25[x[0]]);
        if (m && meta) { var dm = t25[x[0]] / meta - 1; m.textContent = 'Meta: ' + fmtN(meta) + ' · ' + (dm >= 0 ? '▲ ' : '▼ ') + Math.abs(dm * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'; }
        if (d && t24[x[0]]) { var d4 = t25[x[0]] / t24[x[0]] - 1; d.className = 'acum-delta ' + (d4 >= 0 ? 'up' : 'dn'); d.textContent = (d4 >= 0 ? '▲' : '▼') + ' vs 2024: ' + (d4 >= 0 ? '+' : '-') + Math.abs(d4 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'; }
      });
      var tot = cards[3];
      if (tot) {
        var tv = tot.querySelector('.acum-v26'), tm = tot.querySelector('.acum-v25'), td = tot.querySelector('.acum-delta');
        var tt = t25.aqua + t25.pai, tmeta = tm ? pn(tm.textContent.split('·')[0]) : 0, t4 = t24.aqua + t24.pai;
        if (tv) tv.textContent = fmtN(tt);
        if (tm && tmeta) { var dm2 = tt / tmeta - 1; tm.textContent = 'Meta: ' + fmtN(tmeta) + ' · ' + (dm2 >= 0 ? '▲ ' : '▼ ') + Math.abs(dm2 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'; }
        if (td && t4) { var d5 = tt / t4 - 1; td.className = 'acum-delta ' + (d5 >= 0 ? 'up' : 'dn'); td.textContent = (d5 >= 0 ? '▲' : '▼') + ' vs 2024: ' + (d5 >= 0 ? '+' : '-') + Math.abs(d5 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'; }
      }
      row.dataset.tv2 = '1';
    }
    // Parque 2025 do bloco: ano inteiro (Histórico do Dash de Performance), assim que o JSON chegar
    function parque25Hist() {
      var p25 = DADOS.ind && DADOS.ind.parque2025;
      if (p25) [['hkpi_aqua', 'AquaRio'], ['hkpi_pai', 'Paineiras']].forEach(function (x) {
        var box = el(x[0]); if (!box) return;
        var tot25 = Object.keys(p25[x[1]] || {}).reduce(function (s, k) { return s + p25[x[1]][k]; }, 0);
        box.querySelectorAll('.hist-kpi-yr').forEach(function (y) {
          var tag = y.querySelector('.hist-kpi-tag');
          if (!tag || tag.textContent.trim() !== '2025') return;
          var p = Array.prototype.filter.call(y.querySelectorAll('.hist-kpi-p'), function (z) { return /Parque/.test(z.textContent); })[0];
          if (p && tot25 && p.textContent.indexOf('*') >= 0) { p.innerHTML = 'Parque: <strong>' + fmtN(tot25) + '</strong>'; p.removeAttribute('title'); }
        });
        Array.prototype.forEach.call(box.querySelectorAll('*'), function (z) { if (z.children.length === 0 && /^\* Parque 2025/.test(z.textContent.trim())) z.style.display = 'none'; });
      });
    }
    function pn(t) { return Number(String(t).replace(/[^\d,]/g, '').replace(',', '.')) || 0; }
    // (e) textos: "Â·" quebrado, "feriado(s)", subtítulos que ainda citam o BioParque
    function textos(raiz) {
      var w = document.createTreeWalker(raiz || document.body, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = w.nextNode())) {
        var t = n.nodeValue, o = t;
        if (t.indexOf('Â') >= 0) t = t.replace(/Â·/g, '·').replace(/Â /g, ' ');
        if (t.indexOf('(s)') >= 0) t = t.replace(/\b1 feriado\(s\)/g, '1 feriado').replace(/feriado\(s\)/g, 'feriados');
        if (t.indexOf(' -- ') >= 0) t = t.replace(/ -- /g, ' · ');
        if (/BioParque e AquaRio|AquaRio e BioParque/.test(t)) t = t.replace(/BioParque e AquaRio|AquaRio e BioParque/g, 'AquaRio');
        if (t !== o) n.nodeValue = t;
      }
    }
    var tm = null;
    function passar() {
      tm = null;
      try { escolarHist(); historico(); textos(document.querySelector('.page.on') || document.body); } catch (e) { if (window.console) console.warn('[trade_v2 abas antigas]', e); }
    }
    new MutationObserver(function () { if (!tm) tm = setTimeout(passar, 250); }).observe(document.body, { childList: true, subtree: true });
    window.__tv2Passar = passar;
    promessa.then(passar);
  })();

  // ================================================================ UX (26/10/2026, leitura do agente de UX)
  (function () {
    var css = document.createElement('style');
    css.textContent = [
      // contraste do texto secundário (3,6:1 -> ~5,5:1) e rótulos legíveis
      ':root:not([data-theme="dark"]){--muted:#4F6B7D}',
      '.cli-kpi-label,.acum-label,.tb-l,.hist-kpi-tag,.hs-l{font-size:10.5px!important}',
      '.cc-s,.sec-s,.cli-kpi-sub{font-size:11px}',
      // faixa escura da aba do mês: repetia Total, OBZ e Projeção do topo; fica só a Receita
      '#pg-mar .total-bar .tb-div{display:none}',
      // BioParque saiu do grupo em ago/26: some o botão de ocultar/mostrar
      '#bioGlobalToggleDesktop,#bioGlobalToggleMob{display:none!important}',
      // previsão do tempo: 7 dias em vez de 16
      '#pvWeatherBody .pv-weather-days > :nth-child(n+8){display:none}',
      // eventos do mês: 3 visíveis, o resto atrás do botão
      '.tv2-ev-fechado > :nth-child(n+4){display:none}',
      '.tv2-ev-mais{margin-top:6px;background:none;border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-family:inherit;font-size:11px;font-weight:600;color:var(--aqua);cursor:pointer}',
      // tema escuro: linha Total da tabela sem o fundo marrom
      'html[data-theme="dark"] .pktbl-total{background:#1d252c!important}'
    ].join('\n');
    document.head.appendChild(css);
    function faixa() {
      var bar = document.querySelector('#pg-mar .total-bar');
      if (!bar) return;
      ['tot_real', 'tot_obz', 'tot_proj'].forEach(function (id) { var v = el(id); var it = v && v.closest('.tb-i'); if (it) it.style.display = 'none'; });
    }
    function eventos() {
      document.querySelectorAll('#pg-mar .ctx-list').forEach(function (l) {
        if (l.children.length <= 4 || l.dataset.tv2) return;
        l.dataset.tv2 = '1';
        l.classList.add('tv2-ev-fechado');
        var b = document.createElement('button');
        b.className = 'tv2-ev-mais'; b.textContent = 'Ver todos os ' + l.children.length + ' eventos';
        b.onclick = function () { var f = l.classList.toggle('tv2-ev-fechado'); b.textContent = f ? 'Ver todos os ' + l.children.length + ' eventos' : 'Mostrar só os 3 primeiros'; };
        l.parentNode.insertBefore(b, l.nextSibling);
      });
    }
    // Top Clientes, "vs Últimos N meses": com o mês corrente parcial, a janela atual tinha menos dias que a
    // anterior (ago a 25/out x mai a jul). Agora as duas janelas usam só meses fechados (jul a set x abr a jun).
    var perOrig = window.cliGetPeriodo;
    if (typeof perOrig === 'function') {
      window.cliGetPeriodo = function () {
        var r = perOrig.apply(this, arguments);
        try {
          if (!r || !r.cur || !r.cur.length || r.yoy || ['1m', '3m', '6m', '12m'].indexOf(window.cliPeriodo) < 0) return r;
          var ult = r.cur[r.cur.length - 1];
          if (!ult || ult.label !== MA.label || MA.isFechado) return r;
          var meses = (D.meses2025 || []).concat(D.meses || []).filter(function (m) { return m.clientes && m.clientes.length; });
          var anc = meses.indexOf(ult) - 1, n = r.n;
          if (anc < 0) return r;
          var cur = meses.slice(Math.max(0, anc - n + 1), anc + 1);
          var prev = anc >= n ? meses.slice(Math.max(0, anc - n * 2 + 1), anc - n + 1) : [];
          var lbl = function (a) { return a.length === 1 ? a[0].label : a[0].label + ' → ' + a[a.length - 1].label; };
          r.cur = cur; r.prev = prev; r.curLabel = lbl(cur) + ' (meses fechados)'; r.prevLabel = prev.length ? lbl(prev) : '-';
          if (typeof cliGetEquiv2025 === 'function') { r.equiv2025 = cliGetEquiv2025(cur); if (typeof cliEquiv2025Label === 'function') r.equiv2025Label = cliEquiv2025Label(r.equiv2025); }
        } catch (e) { }
        return r;
      };
    }
    var t = null;
    new MutationObserver(function () { if (!t) t = setTimeout(function () { t = null; try { faixa(); eventos(); } catch (e) { } }, 250); }).observe(document.body, { childList: true, subtree: true });
    faixa(); eventos();
  })();

  // ================================================================ menu em 4 seções (26/10/2026, leitura de UX)
  // 10 abas soltas no topo viraram 4 seções com submenu. Os botões originais continuam no HTML (escondidos),
  // e cada item do submenu clica no botão original: nav(), initCharts e o resto do script não mudam.
  (function () {
    var SECOES = [
      ['res', 'Resultado', [['mar', '📅 Mês'], ['acum', '📊 Acumulado'], ['obz', '🎯 OBZ'], ['hist', '📈 Histórico']]],
      ['cli', 'Clientes', [['cli', '🏆 Top Clientes'], ['op', '💡 Oportunidades'], ['canc', '🚫 Cancelamento']]],
      ['mer', 'Mercado', [['share', '🔄 Share Trade'], ['imm', '🗻 Intel. Mercado'], ['ori', '🌎 Origem']]],
      ['par', 'Parques', [['ind', '🏞️ Indicadores Parques']]]
    ];
    var topo = document.querySelector('.topbar');
    var orig = function (id) { return document.querySelector('.topbar .np[onclick*="\'' + id + '\'"]:not(.tv2-sec)'); };
    if (!topo || !orig('mar')) return;
    var css = document.createElement('style');
    css.textContent = [
      '.topbar .np:not(.tv2-sec){display:none!important}',
      '.tv2-sec{display:inline-flex;align-items:center;gap:5px}',
      '.tv2-sec small{opacity:.75;font-weight:500}',
      '.tv2-menu{position:fixed;z-index:400;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.18);padding:6px;min-width:190px;display:none}',
      '.tv2-menu.aberto{display:block}',
      '.tv2-menu button{display:block;width:100%;text-align:left;background:none;border:none;border-radius:7px;padding:9px 12px;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer}',
      '.tv2-menu button:hover{background:var(--aqua-pale)}',
      '.tv2-menu button.on{color:var(--aqua);background:var(--aqua-pale)}'
    ].join('\n');
    document.head.appendChild(css);
    var menu = document.createElement('div');
    menu.className = 'tv2-menu';
    document.body.appendChild(menu);
    var ancora = orig('mar'), botoes = {};
    SECOES.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'np tv2-sec'; b.type = 'button'; b.setAttribute('data-sec', s[0]);
      ancora.parentNode.insertBefore(b, ancora);
      botoes[s[0]] = b;
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (s[2].length === 1) { fechar(); orig(s[2][0][0]).click(); return; }
        if (menu.classList.contains('aberto') && menu.dataset.sec === s[0]) { fechar(); return; }
        var cur = window.curPage;
        menu.innerHTML = s[2].map(function (it) {
          var rot = it[1] + (it[0] === 'mar' && el('navMesLabel') ? ' · ' + el('navMesLabel').textContent : '');
          return '<button type="button" data-ir="' + it[0] + '" class="' + (it[0] === cur ? 'on' : '') + '">' + rot + '</button>';
        }).join('');
        menu.querySelectorAll('[data-ir]').forEach(function (x) { x.onclick = function () { fechar(); orig(x.getAttribute('data-ir')).click(); }; });
        var r = b.getBoundingClientRect();
        menu.style.left = Math.min(r.left, window.innerWidth - 210) + 'px'; menu.style.top = (r.bottom + 6) + 'px';
        menu.dataset.sec = s[0];
        menu.classList.add('aberto');
      });
    });
    function fechar() { menu.classList.remove('aberto'); }
    document.addEventListener('click', function (e) { if (!e.target.closest('.tv2-menu')) fechar(); });
    window.addEventListener('scroll', fechar, { passive: true });
    function secaoDe(id) { return SECOES.filter(function (s) { return s[2].some(function (it) { return it[0] === id; }); })[0]; }
    function rotular(id) {
      var cur = id || window.curPage || 'mar';
      SECOES.forEach(function (s) {
        var b = botoes[s[0]], ativo = s[2].some(function (it) { return it[0] === cur; });
        var item = ativo ? s[2].filter(function (it) { return it[0] === cur; })[0] : null;
        b.innerHTML = s[1] + (ativo && s[2].length > 1 ? ' <small>· ' + item[1].replace(/^\S+\s/, '') + '</small>' : '') + (s[2].length > 1 ? ' ▾' : '');
        b.classList.toggle('on', ativo);
      });
    }
    // o indicador deslizante passa a marcar a seção (o botão original está escondido)
    var slideOrig = window._slideIndicator;
    if (typeof slideOrig === 'function') {
      window._slideIndicator = function (slider, btn) {
        if (slider && slider.id === 'navSlider') {
          var m = btn && !btn.classList.contains('tv2-sec') && /'(\w+)'/.exec(btn.getAttribute('onclick') || '');
          var id = m ? m[1] : (window.curPage || 'mar');
          rotular(id);
          var s = secaoDe(id);
          if (s) btn = botoes[s[0]];
        }
        return slideOrig(slider, btn);
      };
    }
    rotular();
    setTimeout(function () { window._slideIndicator(el('navSlider'), null); }, 200);
  })();

  // ================================================================ indicador do menu (26/10/2026)
  // O sublinhado do menu do topo ficava torto: ele é posicionado no clique, mas logo depois a página nova
  // muda de altura, a barra de rolagem vertical aparece/some e os botões (alinhados à direita da marca)
  // andam ~15px; as fontes carregando depois também mudam a largura dos botões. Agora a calha da barra
  // de rolagem fica sempre reservada e o indicador é recalculado sempre que o topo ou um botão muda.
  (function () {
    var st = document.createElement('style');
    st.textContent = 'html{scrollbar-gutter:stable}';
    document.head.appendChild(st);
    function ajustar() {
      if (typeof _slideIndicator !== 'function') return;
      _slideIndicator(el('navSlider'), document.querySelector('.topbar .np.on'));
      var mb = document.querySelector('.mob-nav2-btn.on');
      if (mb) _slideIndicator(el('mobNav2Slider'), mb);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(ajustar);
      var tb = document.querySelector('.topbar');
      if (tb) ro.observe(tb);
      document.querySelectorAll('.topbar .np').forEach(function (b) { ro.observe(b); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
    window.addEventListener('load', ajustar);
    document.addEventListener('click', function (e) { if (e.target.closest('.np, .mob-nav2-btn')) { setTimeout(ajustar, 120); setTimeout(ajustar, 450); } }, true);
    setTimeout(ajustar, 300);
  })();

  // ================================================================ "Faltam para a meta" na aba do mês (26/10/2026)
  // Os cards "A captar AquaRio / Paineiras" ficavam espremidos na barra de totais e mostravam "0" e "-990/dia"
  // quando a meta já tinha sido batida. Viram cards próprios: quanto falta e o ritmo por dia nos dias restantes,
  // ou "Meta batida" com quanto ficou acima.
  (function () {
    var css = document.createElement('style');
    css.textContent = '.tv2-faltam{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:14px 0}' +
      '.tv2-fc{background:var(--white);border:1px solid var(--border);border-left:4px solid var(--c);border-radius:12px;padding:14px 18px}' +
      '.tv2-fc-l{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--c)}' +
      '.tv2-fc-v{font-family:"Bebas Neue",sans-serif;font-size:32px;line-height:1.05;color:var(--text);margin-top:4px}' +
      '.tv2-fc-p{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:8px;font-size:11.5px;font-weight:700;background:var(--cp);color:var(--c)}' +
      '.tv2-fc-s{font-size:10.5px;color:var(--muted);margin-top:6px}' +
      '.tv2-fc.ok .tv2-fc-v{color:var(--up)}';
    document.head.appendChild(css);
    function mesSel() {
      var m = (typeof mesSelecionado === 'object' && mesSelecionado && mesSelecionado.aqua) ? mesSelecionado : null;
      return m || D.meses[IDX] || D.mesAtual;
    }
    function render() {
      var bar = document.querySelector('#pg-mar .total-bar');
      if (!bar) return;
      ['aqua_saldo', 'pai_saldo', 'bio_saldo'].forEach(function (id) {
        var v = el(id); if (!v) return;
        var it = v.closest('.tb-i'); if (it) it.style.display = 'none';
        var p = it && it.previousElementSibling; if (p && p.classList.contains('tb-div')) p.style.display = 'none';
      });
      var box = el('tv2-faltam');
      if (!box) { box = document.createElement('div'); box.id = 'tv2-faltam'; box.className = 'tv2-faltam'; bar.parentNode.insertBefore(box, bar.nextSibling); }
      var m = mesSel(), fechado = !!m.isFechado;
      var dias = fechado ? 0 : Number(m.diasRestantes != null ? m.diasRestantes : (D.mesAtual || {}).diasRestantes) || 0;
      var pq = [['AquaRio', m.aqua, '#005F8E', 'var(--aqua-pale)'], ['Paineiras', m.pai, '#2D6A2B', 'var(--pai-pale)']];
      if (window._bioAtivo && m.bio && m.bio.obz) pq.push(['BioParque', m.bio, '#C25A00', 'var(--bio-pale)']);
      box.innerHTML = pq.map(function (x) {
        var d = x[1] || {}, meta = d.obz || 0, real = d.real26 || 0, falta = meta - real;
        var head, val, pillTxt, sub, ok = falta <= 0;
        if (!meta) { head = x[0] + ' · sem meta'; val = '-'; pillTxt = 'meta OBZ não cadastrada'; sub = ''; }
        else if (ok) { head = x[0] + ' · meta atingida'; val = 'Meta batida'; pillTxt = '+' + nf(-falta) + ' acima da meta'; sub = nf(real) + ' de ' + nf(meta) + ' (' + pf(real / meta) + ')'; }
        else if (fechado) { head = x[0] + ' · faltaram para a meta'; val = nf(falta); pillTxt = 'mês fechado'; sub = nf(real) + ' de ' + nf(meta) + ' (' + pf(real / meta) + ')'; }
        else { head = x[0] + ' · faltam para a meta'; val = nf(falta); pillTxt = dias ? nf(falta / dias) + '/dia · ' + dias + ' dias restantes' : 'último dia'; sub = nf(real) + ' de ' + nf(meta) + ' (' + pf(real / meta) + ')'; }
        return '<div class="tv2-fc' + (ok && meta ? ' ok' : '') + '" style="--c:' + x[2] + ';--cp:' + x[3] + '"><div class="tv2-fc-l">' + head + '</div><div class="tv2-fc-v">' + val + '</div>' +
          '<div class="tv2-fc-p">' + pillTxt + '</div>' + (sub ? '<div class="tv2-fc-s">' + sub + '</div>' : '') + '</div>';
      }).join('');
    }
    // celular: o card do parque mostra "A captar" com valor negativo quando a meta foi batida
    function mobile() {
      var m = mesSel();
      document.querySelectorAll('.mob-pk-stat-l').forEach(function (l) {
        if (l.textContent.trim() !== 'A captar') return;
        var v = l.nextElementSibling, d = v && v.nextElementSibling;
        var card = l.closest('.mob-pk') || l.parentNode.parentNode.parentNode;
        var txt = card ? card.textContent : '';
        var pk = /AquaRio/i.test(txt) ? m.aqua : /Paineiras/i.test(txt) ? m.pai : /BioParque/i.test(txt) ? m.bio : null;
        if (!pk || !pk.obz) { l.textContent = 'Faltam p/ meta'; return; }
        var falta = pk.obz - (pk.real26 || 0);
        if (falta <= 0) {
          l.textContent = 'Meta batida';
          if (v) { v.textContent = '+' + nf(-falta); v.style.color = 'var(--up)'; }
          if (d) d.textContent = 'acima da meta';
        } else {
          l.textContent = 'Faltam p/ meta';
          if (v) v.textContent = nf(falta);
        }
      });
    }
    var t = null;
    function agendar() { if (t) return; t = setTimeout(function () { t = null; try { render(); mobile(); } catch (e) { if (window.console) console.warn('[trade_v2 faltam]', e); } }, 60); }
    var alvo = el('aqua_saldo');
    if (alvo) new MutationObserver(agendar).observe(alvo, { childList: true, characterData: true, subtree: true });
    var pgMar = el('pg-mar');
    if (pgMar) new MutationObserver(function () {
      var tem = Array.prototype.some.call(pgMar.querySelectorAll('.mob-pk-stat-l'), function (l) { return l.textContent.trim() === 'A captar'; });
      if (tem) mobile(); // só troca texto quando ainda existe "A captar": não dispara de novo
    }).observe(pgMar, { childList: true, subtree: true });
    agendar();
  })();

  // tema: redesenha a aba aberta (cores dos eixos)
  var temaOrig = window.toggleTheme;
  if (typeof temaOrig === 'function') window.toggleTheme = function () { var r = temaOrig.apply(this, arguments); if (window.__tv2Pagina) RENDER[window.__tv2Pagina](); return r; };
  window.__tv2 = { render: RENDER, dados: DADOS, promessa: promessa, carteira: carteira };
})();
