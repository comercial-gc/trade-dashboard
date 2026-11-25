/* 17/11/2026 (Paulo): balão de composição das agências, em todas as abas em que aparece nome de agência.
   Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py), então sobrevive ao rebuild do
   index.html pelo Apps Script e não mexe no script principal.

   Quando várias grafias formam uma agência só (ex.: RIO CARIOCA = RIO CARIOCA TOUR TURISMO LIMITADA + ETOURSBRAZIL DMC),
   passar o mouse no nome mostra, como num comentário, o total e cada nome que compõe o resultado com o valor e o share:
       RIO CARIOCA  1.975 bilhetes
       RIO CARIOCA TOUR TURISMO LIMITADA   836   42,3%
       ETOURSBRAZIL DMC OPERADORA DE TURISMO LTDA   1.139   57,7%
   No celular o balão abre ao tocar no nome.

   O que este arquivo faz
     1) API window.__tvAgTip (attr, json, compD) usada pelas abas do trade_v2.js (Carteira, Oportunidades, Cancelamento, 3P).
     2) Aba Mês (Top Clientes do mês) e a lista de clientes do celular: junta no próprio dado (D.meses[].topClientesPainel e
        D.clientes) as grafias que o cliNormAlias do trade_patch.js unifica, guarda a composição em cada linha e põe o balão.
     3) Top Clientes > Insights: balão calculado do período e dos parques do filtro.
   Os números do balão saem sempre do mesmo recorte que a tela mostra, então a soma das linhas bate com o total do nome. */
(function () {
  if (window.__tvAgTip) return;
  var API = window.__tvAgTip = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nf(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }
  function pf1(v) { return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  function alias(n) { try { return typeof window.cliNormAlias === 'function' ? window.cliNormAlias(n) : n; } catch (e) { return n; } }
  // mesma normalização do scripts/gerar_unificadas.py: sem acento, sem pontuação, "&" = "E", sem sufixo societário
  function chave(n) {
    return String(n || '').replace(/�/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/&/g, ' E ')
      .replace(/\d{8,}/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|LIMITADA|ME|EPP|EIRELI|EIRELLI|SA|S A|SOCIEDADE ANONIMA)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Agências que a regra de origem (CANONICAL do trade_regras_agencias.py) forma juntando 2+ nomes ANTES de o dado chegar ao
  // Dash: o volume de cada nome já não existe, então o balão lista os nomes (sem divisão de volume). Arquivo: trade_unificadas.json
  // (gerado por scripts/gerar_unificadas.py; rodar de novo quando o CANONICAL mudar). Opcional: sem ele o balão só perde essa lista.
  var REGRA = {};
  var BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : 'https://comercial-gc.github.io/trade-dashboard/';
  fetch(BASE + 'trade_unificadas.json?v=' + Date.now()).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j) return;
    (j.grupos || []).forEach(function (g) { [g.canonico].concat(g.nomes).forEach(function (n) { REGRA[chave(n)] = g; }); });
  }).catch(function () { });
  // nomes da regra que o balão ainda não mostra: se o título É o nome-rótulo da regra (ex.: "JEEP TUOR / SOBRE TERRA") entram todos;
  // senão saem os que já são o próprio nome ou parte de um nome mostrado (ex.: RIO CARIOCA TOUR dentro de RIO CARIOCA TOUR TURISMO)
  function extrasRegra(d) {
    var g = REGRA[chave(d.t)];
    if (!g) return [];
    var rotulo = chave(g.canonico) === chave(d.t), mostrados = d.c.map(function (x) { return chave(x[0]); });
    return g.nomes.filter(function (n) {
      var k = chave(n);
      if (mostrados.indexOf(k) >= 0) return false;
      if (rotulo) return true;
      var tk = k.split(' ');
      return !mostrados.some(function (m) { var mt = m.split(' '); return tk.every(function (t) { return mt.indexOf(t) >= 0; }); });
    });
  }

  // ---------------------------------------------------------------- API
  // json: texto do atributo data-agtip. comps = [{n, v}] (nome bruto e valor no recorte da tela); u = unidade do valor.
  API.json = function (titulo, sub, comps, unid) {
    var c = (comps || []).filter(function (x) { return x && x.v > 0; });
    if (!c.length) return '';
    c.sort(function (a, b) { return b.v - a.v; });
    return JSON.stringify({ t: titulo, s: sub || '', u: unid || 'bilhetes', c: c.map(function (x) { return [x.n, x.v]; }) });
  };
  API.attr = function (titulo, sub, comps, unid) {
    var j = API.json(titulo, sub, comps, unid);
    return j ? ' data-agtip="' + esc(j) + '"' : '';
  };
  // composição de um nome unificado no recorte (meses por rótulo, parques a/b/p) a partir das listas de clientes do D
  API.compD = function (canon, labels, parques) {
    var pk = parques && parques.length ? parques : ['a', 'p'], o = {};
    (D.meses2025 || []).concat(D.meses || []).forEach(function (m) {
      if (labels && labels.indexOf(m.label) < 0) return;
      (m.clientes || []).forEach(function (c) {
        if (alias(c.n) !== canon) return;
        var v = (pk.indexOf('a') >= 0 ? c.a || 0 : 0) + (pk.indexOf('b') >= 0 ? c.b || 0 : 0) + (pk.indexOf('p') >= 0 ? c.p || 0 : 0);
        if (v) o[c.n] = (o[c.n] || 0) + v;
      });
    });
    return Object.keys(o).map(function (n) { return { n: n, v: o[n] }; });
  };

  // todas as composições de uma vez: { nomeUnificado: { nomeBruto: valor } } no recorte (uma passada só, para tabelas grandes)
  API.compMap = function (labels, parques) {
    var pk = parques && parques.length ? parques : ['a', 'p'], mapa = {};
    (D.meses2025 || []).concat(D.meses || []).forEach(function (m) {
      if (labels && labels.indexOf(m.label) < 0) return;
      (m.clientes || []).forEach(function (c) {
        var v = (pk.indexOf('a') >= 0 ? c.a || 0 : 0) + (pk.indexOf('b') >= 0 ? c.b || 0 : 0) + (pk.indexOf('p') >= 0 ? c.p || 0 : 0);
        if (!v) return;
        var al = alias(c.n), o = mapa[al] = mapa[al] || {};
        o[c.n] = (o[c.n] || 0) + v;
      });
    });
    return mapa;
  };

  // ---------------------------------------------------------------- balão
  var css = document.createElement('style');
  css.textContent = '[data-agtip]{cursor:help}[data-agtip]:hover{text-decoration:underline dotted;text-decoration-color:var(--muted);text-underline-offset:3px}@media(hover:none){[data-agtip]{text-decoration:underline dotted;text-decoration-color:var(--muted);text-underline-offset:3px;-webkit-tap-highlight-color:transparent}}html[data-theme="dark"] .tv-agtip{background:#1f272e;border-color:#46515b;box-shadow:0 10px 28px rgba(0,0,0,.55)}' +
    '.tv-agtip{position:fixed;z-index:9999;max-width:min(420px,calc(100vw - 16px));min-width:min(220px,calc(100vw - 16px));overflow-wrap:anywhere;background:var(--white,#fff);color:var(--text,#0D1B2A);border:1px solid var(--border,#D5E8F0);border-radius:10px;' +
    'box-shadow:0 10px 28px rgba(0,0,0,.22);padding:10px 12px;font-family:inherit;font-size:12px;line-height:1.35;display:none;pointer-events:none}' +
    '.tv-agtip.on{display:block}.tv-agtip-t{display:flex;justify-content:space-between;gap:14px;font-weight:800;font-size:12.5px;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid var(--border,#D5E8F0)}' +
    '.tv-agtip-t span{font-weight:700;color:var(--muted,#6B8A9E);white-space:nowrap}.tv-agtip-s{font-size:10.5px;color:var(--muted,#6B8A9E);margin:-3px 0 6px}' +
    '.tv-agtip-l{display:grid;grid-template-columns:1fr auto auto;gap:3px 12px;align-items:baseline}.tv-agtip-l .n{word-break:break-word}.tv-agtip-l .v{text-align:right;font-weight:700}' +
    '.tv-agtip-l .p{text-align:right;color:var(--muted,#6B8A9E);min-width:42px}.tv-agtip-f{margin-top:6px;font-size:10.5px;color:var(--muted,#6B8A9E)}' +
    '.tv-agtip-r{margin-top:8px;padding-top:6px;border-top:1px dashed var(--border,#D5E8F0);font-size:11.5px}.tv-agtip-rt{font-size:10.5px;font-weight:700;color:var(--muted,#6B8A9E);margin-bottom:2px}';
  document.head.appendChild(css);
  var tip = document.createElement('div');
  tip.className = 'tv-agtip'; tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  var alvo = null, timer = null;

  function montar(d) {
    var tot = d.c.reduce(function (s, x) { return s + x[1]; }, 0), un = d.u || 'bilhetes';
    var h = '<div class="tv-agtip-t"><div>' + esc(d.t) + '</div><span>' + (un === 'R$' ? 'R$ ' + nf(tot) : nf(tot) + ' ' + esc(un)) + '</span></div>' + (d.s ? '<div class="tv-agtip-s">' + esc(d.s) + '</div>' : '') + '<div class="tv-agtip-l">';
    d.c.forEach(function (x) { h += '<div class="n">' + esc(x[0]) + '</div><div class="v">' + (un === 'R$' ? 'R$ ' + nf(x[1]) : nf(x[1])) + '</div><div class="p">' + (tot ? pf1(x[1] / tot) : '-') + '</div>'; });
    h += '</div>';
    var extras = extrasRegra(d);
    if (extras.length) h += '<div class="tv-agtip-r"><div class="tv-agtip-rt">Unificada na origem com:</div>' + extras.map(function (n) { return '<div>' + esc(n) + '</div>'; }).join('') + '</div>';
    // contrato do cliente (trade_contratos.json, resolvido no trade_v2.js); o Três Pescadores não tem essa informação
    var ctr = window.__tvContrato && !/Três Pescadores/.test(d.s || '') ? window.__tvContrato.de(d.t) : '';
    if (ctr) h += '<div class="tv-agtip-f">Contrato: <strong>' + esc(ctr) + '</strong></div>';
    var dsc = window.__tvDesconto && !/Três Pescadores/.test(d.s || '') ? window.__tvDesconto.de(d.t) : null;
    if (dsc) h += '<div class="tv-agtip-f">Desconto atual (AquaRio): <strong>' + esc(dsc.rot) + '</strong></div>';
    if (d.c.length > 1) h += '<div class="tv-agtip-f">' + d.c.length + ' nomes formam esta agência</div>';
    return h;
  }
  function mostrar(el) {
    var d;
    try { d = JSON.parse(el.getAttribute('data-agtip')); } catch (e) { return; }
    if (!d || !d.c || !d.c.length) return;
    alvo = el;
    tip.innerHTML = montar(d);
    tip.classList.add('on');
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var x = Math.min(Math.max(8, r.left), vw - tw - 8), y = r.bottom + 6;
    if (y + th > vh - 8) y = Math.max(8, r.top - th - 6);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function esconder() { clearTimeout(timer); alvo = null; tip.classList.remove('on'); }
  var toque = window.matchMedia && window.matchMedia('(hover: none)').matches;
  document.addEventListener('mouseover', function (e) {
    if (toque) return;
    var el = e.target.closest && e.target.closest('[data-agtip]');
    if (!el || el === alvo) return;
    clearTimeout(timer);
    timer = setTimeout(function () { mostrar(el); }, 120);
  });
  document.addEventListener('mouseout', function (e) {
    if (toque) return;
    var el = e.target.closest && e.target.closest('[data-agtip]');
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    esconder();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-agtip]');
    if (toque && el) { if (el === alvo) esconder(); else mostrar(el); return; }
    if (!e.target.closest || !e.target.closest('.tv-agtip')) esconder();
  });
  window.addEventListener('scroll', esconder, { passive: true, capture: true });
  window.addEventListener('resize', esconder);
  document.addEventListener('mousemove', function () { if (alvo && !alvo.isConnected) esconder(); }, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') esconder(); });

  // ---------------------------------------------------------------- dados do index.html (aba Mês, celular, Insights)
  function marcar(el, titulo, sub, comps) {
    if (!el) return;
    var j = API.json(titulo, sub, comps);
    if (!j) return;
    el.setAttribute('data-agtip', j);
    el.removeAttribute('title');
  }
  var PARK = { aqua: 'AquaRio', bio: 'BioParque', pai: 'Paineiras' };

  // junta, em cada lista, os nomes que o cliNormAlias unifica; guarda a composição em cada linha (d.comp)
  function juntarPainel(arr) {
    var grupos = {}, ordem = [];
    arr.forEach(function (d) {
      var al = alias(d.n);
      if (!grupos[al]) { grupos[al] = []; ordem.push(al); }
      grupos[al].push(d);
    });
    var out = ordem.map(function (al) {
      var g = grupos[al];
      if (g.length === 1) { var d = g[0]; d.comp = d.comp || [{ n: d.n, v: d.v26 }]; if (al !== d.n) d.n = al; return d; }
      var v26 = 0, v25 = 0, comp = [];
      g.forEach(function (d) { v26 += d.v26 || 0; v25 += d.v25 || 0; comp.push({ n: d.n, v: d.v26 || 0 }); });
      var base = g[0], m = {};
      Object.keys(base).forEach(function (k) { m[k] = base[k]; });
      m.n = al; m.v26 = v26; m.v25 = v25; m.delta = v25 > 0 ? Math.round((v26 / v25 - 1) * 1000) / 10 : null; m.comp = comp;
      return m;
    });
    out.sort(function (a, b) { return (b.v26 || 0) - (a.v26 || 0); });
    out.__agm = true;
    return out;
  }
  function prepararDados() {
    (D.meses || []).forEach(function (m) {
      var tp = m && m.topClientesPainel;
      if (!tp) return;
      ['aqua', 'bio', 'pai'].forEach(function (k) { if (tp[k] && tp[k].length && !tp[k].__agm) tp[k] = juntarPainel(tp[k]); });
    });
    if (D.clientes && D.clientes.length && !D.clientes.__agm) {
      var g = {}, ordem = [];
      D.clientes.forEach(function (c) {
        var al = alias(c.n);
        if (!g[al]) { g[al] = { itens: [] }; ordem.push(al); }
        g[al].itens.push(c);
      });
      var out = ordem.map(function (al) {
        var it = g[al].itens, base = it[0], m = {}, comp = [];
        Object.keys(base).forEach(function (k) { m[k] = base[k]; });
        if (it.length > 1) { ['a', 'b', 'p', 't'].forEach(function (k) { m[k] = it.reduce(function (s, c) { return s + (c[k] || 0); }, 0); }); }
        it.forEach(function (c) { comp.push({ n: c.n, v: c.t || 0 }); });
        m.n = al; m.comp = comp;
        return m;
      });
      out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
      out.__agm = true;
      D.clientes = out;
    }
  }

  function tipsPainel(m) {
    var tp = m && m.topClientesPainel;
    if (!tp) return;
    [['pai', 'tc_pai_rows'], ['aqua', 'tc_aqua_rows'], ['bio', 'tc_bio_rows']].forEach(function (p) {
      var box = document.getElementById(p[1]), arr = tp[p[0]];
      if (!box || !arr) return;
      var rows = box.querySelectorAll('.tc-row');
      for (var i = 0; i < rows.length && i < arr.length; i++) {
        var d = arr[i];
        marcar(rows[i].querySelector('.tc-nome'), d.n, (m.label || '') + ' · ' + PARK[p[0]], d.comp);
      }
    });
  }
  function tipsMobile(m) {
    var tp = m && m.topClientesPainel;
    document.querySelectorAll('.mob-cli-item').forEach(function (item, idx) {
      var nome = item.querySelector('.mob-cli-name');
      if (!nome) return;
      var lista = null, sub = '';
      if (item.closest('#mobCliContent')) { lista = D.clientes; idx = Array.prototype.indexOf.call(item.parentNode.querySelectorAll('.mob-cli-item'), item); sub = 'Acumulado'; }
      else if (tp) {
        var blocoEl = item.parentNode, tit = blocoEl.querySelector('.mob-chart-title'), t = tit ? tit.textContent : '';
        var k = /Aqua/i.test(t) ? 'aqua' : /Bio/i.test(t) ? 'bio' : /Paineiras/i.test(t) ? 'pai' : null;
        if (!k) return;
        lista = tp[k]; idx = Array.prototype.indexOf.call(blocoEl.querySelectorAll('.mob-cli-item'), item); sub = (m.label || '') + ' · ' + PARK[k];
      }
      var d = lista && lista[idx];
      if (d && d.comp) marcar(nome, d.n, sub, d.comp);
    });
  }
  function tipsInsights() {
    var root = document.getElementById('cli-insights-content');
    if (!root || typeof cliGetPeriodo !== 'function' || typeof cliGetDados !== 'function') return;
    var per = cliGetPeriodo(), dados = cliGetDados().dados, labels = (per.cur || []).map(function (m) { return m.label; });
    var pk = (typeof cliParque !== 'undefined' && cliParque && cliParque.length) ? cliParque : ['a', 'p'];
    root.querySelectorAll('div,span').forEach(function (el) {
      if (el.children.length) return;
      var t = (el.textContent || '').trim();
      if (!t || !dados[t]) return;
      marcar(el, t, per.curLabel || labels.join(', '), API.compD(t, labels, pk));
    });
  }

  function envolver(nome, depois) {
    var orig = window[nome];
    if (typeof orig !== 'function' || orig.__agtip) return;
    var f = function () { var r = orig.apply(this, arguments); try { depois.apply(this, arguments); } catch (e) { if (window.console) console.warn('trade_agtip', nome, e); } return r; };
    f.__agtip = true;
    window[nome] = f;
  }
  function iniciar() {
    prepararDados();
    envolver('renderTopClientes', function (m) { tipsPainel(m); });
    envolver('buildMobContent', function (id, m) { tipsMobile(m || window.mesSelecionado || (D.meses || [])[D.mesAtualIdx]); });
    envolver('cliRenderInsights', tipsInsights);
    // redesenha o que já estava na tela com os dados unificados
    try {
      var m = window.mesSelecionado || (D.meses || [])[D.mesAtualIdx];
      if (typeof renderTopClientes === 'function' && m) window.renderTopClientes(m);
      if (typeof buildMobContent === 'function' && window.curPage) window.buildMobContent(window.curPage, m);
      if (window.curPage === 'cli' && typeof cliRenderAtivo === 'function') cliRenderAtivo();
    } catch (e) { if (window.console) console.warn('trade_agtip', e); }
  }
  // espera o trade_patch.js (que define o cliNormAlias com as unificações) antes de juntar os dados
  var tent = 0;
  (function esperar() {
    if (typeof D !== 'undefined' && D.meses && (window.__tradePatchClientes || tent > 80)) return iniciar();
    tent++; setTimeout(esperar, 100);
  })();
})();
