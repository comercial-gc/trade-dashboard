/* 09/11/2026 (Paulo): faixa "Atualizado até" no topo de cada aba do Dash do Trade, igual à do Dash de
   Performance (frescor-bar). Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py),
   então sobrevive ao rebuild do index.html pelo Apps Script e não mexe no script principal.

   Regras (as mesmas do Performance)
     diária : em dia = os dados chegaram até ontem (o Dash é D-1)
     mensal : em dia = tem o mês anterior fechado
     check verde = em dia, vermelho = atrasada, cinza = sem data confiável
     com 2 parques e só um atrasado: "todos ok exceto X até dd/mm"
     balão (passar o mouse ou tocar) com a data por parque e o "Esperado"

   Fontes (só o que existe nos dados; nada é inventado)
     trade     D (planilha TRADE embutida no index.html, mesAtual.diaAtual) e trade_diario.json (último dia
               com linha por parque: C = Trade AquaRio, M = Trade Paineiras). Vale o menor dos dois.
     topcli    D.meses[mês].topClientesPainel.diaAtual (aba Top Clientes da planilha TRADE)
     intel     D.imm: último mês com dado dos 3 lados (planilha externa, mensal)
     brutos    trade_indicadores.json: último dia por parque em parques[parque][mês].dias
     compras   trade_indicadores.json: maior uv/uu (última compra/uso) das agências por parque
     escolar   trade_extra.json: último dia de aquario.dias (Escolar e receita, só AquaRio)
     canc      trade_cancelamento.json: campo "ate" (CARD, por período de visita)
     t3p       trade_3p.json: campo "ate" (Três Pescadores, B2B e B2C)
   Sem data confiável (não entram na faixa): metas OBZ (anuais), eventosRio, feriados_mercados.json
   (calendário fixo), cadastro de agências (arquivo opcional). */
(function () {
  if (window.__tradeFrescor) return;
  window.__tradeFrescor = true;
  if (typeof D === 'undefined' || !D.meses) return;

  var BASE = 'https://comercial-gc.github.io/trade-dashboard/';
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) BASE = '';
  var MES_CAP = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var NL = String.fromCharCode(10);
  var PARQUES = ['AquaRio', 'Paineiras'];

  // ---------------------------------------------------------------- datas
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ontem() { var d = new Date(); d.setDate(d.getDate() - 1); return iso(d); }
  function dm(s) { return s.length === 7 ? MES_CAP[+s.slice(5, 7) - 1] + '/' + s.slice(2, 4) : s.slice(8, 10) + '/' + s.slice(5, 7); }
  function maxIso(a) { var u = null; a.forEach(function (x) { if (x && (!u || x > u)) u = x; }); return u; }

  // ---------------------------------------------------------------- carga dos JSONs (todos opcionais)
  var JS = { trade_diario: null, trade_indicadores: null, trade_extra: null, trade_cancelamento: null, trade_3p: null };
  var carregadoEm = 0, carregando = null;
  function getJSON(nome) {
    return fetch(BASE + nome + '.json?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () { return null; });
  }
  function carregar() {
    if (carregando) return carregando;
    carregando = Promise.all(Object.keys(JS).map(function (n) { return getJSON(n).then(function (j) { JS[n] = j; }); })).then(function () {
      carregadoEm = Date.now(); carregando = null;
    });
    return carregando;
  }

  // ---------------------------------------------------------------- fontes
  // geradoEm / gerado_em vêm em UTC (ex.: 2026-11-09T12:32Z): mostra no horário local
  function geradoLocal(s) {
    if (!s) return '';
    var d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(s) ? (s.length === 17 ? s.replace('Z', ':00Z') : s) : s.replace(' ', 'T'));
    if (isNaN(d)) return '';
    return dm(iso(d)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function mesAtualD() {
    var m = D.meses[D.mesAtualIdx] || {};
    var ano = Number(String((D.mesAtual || {}).label || '').split('/')[1]) || new Date().getFullYear();
    return { ano: ano, mes: Number(m.mesIdx), m: m };
  }
  // último dia do mês corrente da planilha (diaAtual 0 cai no último dia do mês anterior)
  function ateD() {
    var x = mesAtualD(), dia = Number(((D.mesAtual || {}).diaAtual != null ? D.mesAtual : x.m).diaAtual);
    if (isNaN(x.mes) || isNaN(dia)) return null;
    return iso(new Date(x.ano, x.mes, dia));
  }
  function tradeDiarioUltimo(col) {
    var j = JS.trade_diario, x = mesAtualD();
    if (!j || !Array.isArray(j.diario)) return null;
    if (j.mes !== x.ano + '-' + pad(x.mes + 1)) return null;
    var u = 0;
    j.diario.forEach(function (r) { if (r && r[col] != null && Number(r.dia) > u) u = Number(r.dia); });
    return u ? j.mes + '-' + pad(u) : null;
  }
  function ultimoDiaMesIndicadores(p) {
    var j = JS.trade_indicadores, ps = j && j.parques && j.parques[p];
    if (!ps) return null;
    var meses = Object.keys(ps).filter(function (k) { return ps[k] && ps[k].dias && Object.keys(ps[k].dias).length; }).sort();
    if (!meses.length) return null;
    return Object.keys(ps[meses[meses.length - 1]].dias).sort().pop();
  }
  function comprasUltima(p) {
    var j = JS.trade_indicadores, a = j && j.agencias && j.agencias[p];
    if (!a) return null;
    var u = null;
    Object.keys(a).forEach(function (k) { u = maxIso([u, a[k].uv, a[k].uu]); });
    return u;
  }
  function dos(parques, fn) {
    var det = {}; parques.forEach(function (p) { det[p] = fn(p) || null; });
    return { tipo: 'dia', det: det };
  }

  var FONTES = {
    trade: { label: 'Trade e visitação (planilha)', parques: PARQUES, get: function (parques) {
      var base = ateD(), col = { AquaRio: 'C', Paineiras: 'M' };
      var r = dos(parques || PARQUES, function (p) {
        var js = tradeDiarioUltimo(col[p]);
        return base && js ? (js < base ? js : base) : (base || js);
      });
      var g = (D.mesAtual || {}).dataFmt;
      r.nota = 'Planilha TRADE lida na geração do Dash' + (g ? ' (' + g + ')' : '') + '. Vale o menor entre o dia da planilha e o da leitura diária' +
        (JS.trade_diario ? ' (' + geradoLocal(JS.trade_diario.gerado_em) + ').' : ' (indisponível agora, vale só a planilha).');
      return r;
    } },
    topcli: { label: 'Top Clientes', get: function () {
      var x = mesAtualD(), t = x.m.topClientesPainel, dia = t && Number(t.diaAtual);
      return { tipo: 'dia', ate: dia ? iso(new Date(x.ano, x.mes, dia)) : null };
    } },
    intel: { label: 'Cristo, Trem e Bondinho', get: function () {
      var imm = D.imm || {}, ano = mesAtualD().ano, det = {};
      // meses futuros vêm 0 ou null na planilha: só conta valor maior que zero
      [['trem', 'Trem do Corcovado'], ['bondinho', 'Bondinho'], ['cristo', 'Cristo Redentor']].forEach(function (k) {
        var y = (imm[k[0]] || {}).y26 || [], ult = -1;
        y.forEach(function (v, i) { if (v) ult = i; });
        det[k[1]] = ult >= 0 ? ano + '-' + pad(ult + 1) : null;
      });
      return { tipo: 'mes', det: det, nota: 'Planilha externa, atualizada manualmente. Mensal: em dia = tem o mês anterior. A captação do Cristo usa o último mês com dado nos 3 lados.' };
    } },
    brutos: { label: 'Bilheteria (brutos)', parques: PARQUES, get: function () {
      var r = dos(PARQUES, ultimoDiaMesIndicadores);
      r.nota = 'Bilhetes dos brutos lidos em ' + (JS.trade_indicadores ? geradoLocal(JS.trade_indicadores.geradoEm) : 'sem leitura') + '.';
      return r;
    } },
    compras: { label: 'Bilheteria (brutos)', parques: PARQUES, get: function () {
      var r = dos(PARQUES, comprasUltima);
      r.nota = 'Última compra ou utilização das agências. Brutos lidos em ' + (JS.trade_indicadores ? geradoLocal(JS.trade_indicadores.geradoEm) : 'sem leitura') + '.';
      return r;
    } },
    escolar: { label: 'Escolar e receita (AquaRio)', get: function () {
      var j = JS.trade_extra, d = j && j.aquario && j.aquario.dias;
      return { tipo: 'dia', ate: d ? Object.keys(d).sort().pop() : null, nota: 'Lido em ' + (j ? geradoLocal(j.geradoEm) + '.' : '(indisponível agora).') };
    } },
    canc: { label: 'Cancelamento (CARD)', get: function () {
      var j = JS.trade_cancelamento;
      return { tipo: 'dia', ate: j && j.ate ? String(j.ate).slice(0, 10) : null, nota: 'Por período de visita. Lido em ' + (j && j.gerado_em ? String(j.gerado_em).slice(8, 10) + '/' + String(j.gerado_em).slice(5, 7) + ' ' + String(j.gerado_em).slice(11, 16) : 'sem leitura') + '.' };
    } }
  };
  // Três Pescadores (13/11/2026): trade_3p.json, campo "ate" = último dia do mês corrente já incluído
  FONTES.t3p = { label: 'Três Pescadores (B2B e B2C)', get: function () {
    var j = JS.trade_3p;
    return { tipo: 'dia', ate: j && j.ate ? String(j.ate).slice(0, 10) : null, nota: 'Total pela planilha de visitação e canal pelo bruto/tratado. Lido em ' + (j && j.geradoEm ? dm(String(j.geradoEm).slice(0, 10)) : 'sem leitura') + '.' };
  } };
  // cada aba: fontes que ela realmente usa
  var ABAS = {
    mar: ['trade'], acum: ['trade'], hist: ['trade'], share: ['trade'],
    cli: ['topcli'], imm: ['intel', 'tradePai'],
    obz: ['trade', 'escolar'], ind: ['brutos'], ori: ['brutos'], op: ['compras'], canc: ['canc'], tres: ['t3p']
  };
  FONTES.tradePai = { label: 'Paineiras (Trade e visitação)', get: function () { return FONTES.trade.get(['Paineiras']); } };

  // ---------------------------------------------------------------- avaliação (mesma do Performance)
  function avaliar(r) {
    if (r.det && Object.keys(r.det).length) {
      var datas = Object.keys(r.det).map(function (k) { return r.det[k]; });
      r.ate = datas.some(function (d) { return !d; }) ? null : datas.reduce(function (a, b) { return b < a ? b : a; });
    }
    if (!r.ate) return 'sem';
    return r.ate >= limite(r) ? 'ok' : 'atraso';
  }
  function limite(r) {
    if (r.tipo === 'dia') return ontem();
    var h = new Date(); return iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)).slice(0, 7);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function itemHtml(f, r) {
    var st = avaliar(r), rot = 'até';
    var quando = !r.ate ? 'sem data' : rot + ' ' + dm(r.ate);
    var dets = r.det ? Object.keys(r.det) : [];
    if (dets.length > 1) {
      var datas = dets.map(function (k) { return r.det[k]; }).filter(Boolean);
      var max = maxIso(datas);
      var atras = dets.filter(function (k) { return !r.det[k] || r.det[k] < max; });
      if (max && atras.length && atras.length < dets.length) {
        var lista = atras.map(function (k) { return r.det[k] ? k + ' até ' + dm(r.det[k]) : k + ' sem dado'; }).join(', ');
        quando = (max >= limite(r) ? ': todos ok exceto ' : ': demais ' + rot + ' ' + dm(max) + ', exceto ') + lista;
      }
    }
    var det = dets.length > 1 ? dets.map(function (k) {
      var d = r.det[k]; return k + ': ' + (d ? dm(d) : 'sem dado') + (d && d < limite(r) ? ' (atrasado)' : '');
    }).join(NL) : '';
    var esperado = r.tipo === 'dia' ? 'Esperado: até ' + dm(ontem()) + ' (D-1).' : 'Esperado: mês anterior fechado.';
    var tip = [esperado, det, r.nota || f.nota || ''].filter(Boolean).join(NL);
    var icone = st === 'ok' ? '✓' : st === 'atraso' ? '!' : '?';
    return '<span class="frescor-item frescor-' + st + '" tabindex="0" data-fr-tip="' + esc(tip) + '"><span class="frescor-ic">' + icone + '</span><span>' +
      (quando.charAt(0) === ':' ? '<b>' + f.label + ':</b> ' + quando.slice(2) : '<b>' + f.label + '</b> ' + quando) + '</span></span>';
  }

  // ---------------------------------------------------------------- tela
  var css = document.createElement('style');
  css.id = 'tradeFrescorCss';
  var ids = Object.keys(ABAS);
  css.textContent = [
    '.frescor-bar{ display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; padding:0 0 12px; font-size:12px; color:var(--muted); }',
    '.frescor-tit{ font-weight:600; margin-right:2px; }',
    '.frescor-item{ position:relative; display:inline-flex; align-items:center; gap:5px; padding:3px 9px 3px 4px; border-radius:999px; border:1px solid var(--border); background:var(--white); color:var(--text); white-space:nowrap; cursor:help; outline:none; }',
    '.frescor-item b{ font-weight:600; }',
    '.frescor-ic{ display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; font-size:10px; font-weight:700; color:#fff; background:var(--muted); }',
    '.frescor-ok .frescor-ic{ background:var(--up); }',
    '.frescor-atraso{ border-color:var(--dn); background:var(--dn-bg); }',
    '.frescor-atraso .frescor-ic{ background:var(--dn); }',
    '.frescor-item::after{ content:attr(data-fr-tip); display:none; position:absolute; top:calc(100% + 6px); left:0; z-index:250; width:max-content; max-width:min(300px,calc(100vw - 32px)); white-space:pre-line;',
    '  background:var(--navy); color:#fff; font-size:11px; font-weight:500; line-height:1.4; padding:7px 10px; border-radius:7px; box-shadow:0 6px 16px rgba(0,0,0,.28); pointer-events:none; }',
    '.frescor-item.fr-dir::after{ left:auto; right:0; }',
    '.frescor-item:hover::after, .frescor-item:focus::after{ display:block; }',
    '[data-theme="dark"] .frescor-item::after{ background:#2b333b; }',
    '@media (max-width:860px){ .frescor-item{ white-space:normal; max-width:100%; border-radius:14px; } }',
    '@media (max-width:860px){ ' + ids.map(function (i) { return 'body #pg-' + i + ':not(#fr-x):not(#fr-y) > .frescor-bar'; }).join(',') + '{ display:flex!important; } }',
    '@media print{ .frescor-bar{ display:none!important; } }'
  ].join('\n');
  document.head.appendChild(css);

  function pintar(id) {
    var pg = document.getElementById('pg-' + id), lista = ABAS[id];
    if (!pg || !lista) return;
    var bar = pg.querySelector(':scope > .frescor-bar');
    if (!bar) { bar = document.createElement('div'); bar.className = 'frescor-bar'; pg.insertBefore(bar, pg.firstChild); }
    var h = lista.map(function (k) {
      var f = FONTES[k], r;
      try { r = f.get() || {}; } catch (e) { r = {}; }
      return itemHtml(f, r);
    }).join('');
    var novo = '<span class="frescor-tit">Atualizado até</span>' + h;
    if (bar.innerHTML !== novo) bar.innerHTML = novo;
  }
  function pintarTodas() { Object.keys(ABAS).forEach(pintar); }

  // o balão abre para a esquerda quando não cabe à direita
  document.addEventListener('mouseover', function (e) {
    var it = e.target.closest && e.target.closest('.frescor-item');
    if (it) it.classList.toggle('fr-dir', it.getBoundingClientRect().left + 300 > window.innerWidth);
  });
  document.addEventListener('focusin', function (e) {
    var it = e.target.closest && e.target.closest('.frescor-item');
    if (it) it.classList.toggle('fr-dir', it.getBoundingClientRect().left + 300 > window.innerWidth);
  });

  // pinta na troca de aba (nav, mobNav2 e a barra inferior do celular só mudam a classe .on) e quando
  // as abas novas do trade_v2.js entram no DOM; recarrega os JSONs se a página ficou aberta por mais de 10 min
  var ultimaPagina = null, agendado = false;
  function verificar() {
    agendado = false;
    var on = document.querySelector('.page.on'), id = on && on.id.replace(/^pg-/, '');
    var faltando = Object.keys(ABAS).some(function (i) { var pg = document.getElementById('pg-' + i); return pg && !pg.querySelector(':scope > .frescor-bar'); });
    if (faltando) pintarTodas();
    if (id && id !== ultimaPagina) { ultimaPagina = id; pintar(id); }
    if (Date.now() - carregadoEm > 600000 && !carregando) carregar().then(pintarTodas);
  }
  new MutationObserver(function () { if (!agendado) { agendado = true; setTimeout(verificar, 30); } })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });

  pintarTodas(); // já com os dados do D
  carregar().then(pintarTodas);
})();
