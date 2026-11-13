/* 13/11/2026 (Paulo): logo do Trade no cabeçalho do Dash (desktop e mobile).
   Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py), então sobrevive ao rebuild do
   index.html pelo Apps Script e não mexe no script principal.

   A logo tem 3 versões, uma por tipo de fundo (o texto "TRADE" embaixo NÃO faz parte da logo; os arquivos
   trazem só o emblema, com fundo transparente):
     logo-trade-claro.png   fundo claro/branco (ícones do app sem fundo: icon-192/512, favicon-64; apple-touch-icon com fundo branco)
     logo-trade-preto.png   fundo preto e escuros como o azul-marinho: cabeçalho do Dash (desktop e mobile)
     logo-trade-cinza.png   fundo cinza escuro (favicon-64-escuro, para aba escura do navegador)
   Os cabeçalhos do Dash são sempre azul-marinho (var(--navy)) nos temas claro e escuro, por isso usam a versão preto.
   Substitui o pontinho (.brand-dot / .mob-dot) que ficava no lugar da logo. */
(function () {
  if (window.__tradeLogo) return;
  window.__tradeLogo = true;

  var BASE = 'https://comercial-gc.github.io/trade-dashboard/';
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) BASE = '';
  var SRC = BASE + 'logo-trade-preto.png?v=20261113';

  var css = document.createElement('style');
  css.textContent = '.tv-logo{display:block;width:auto;flex-shrink:0;object-fit:contain}' +
    '.brand .tv-logo{height:42px;margin-right:2px}' +
    '.mob-title .tv-logo{height:34px}' +
    '.brand-dot.tv-oculto,.mob-dot.tv-oculto{display:none!important}';
  document.head.appendChild(css);

  function montar() {
    [['.brand', '.brand-dot'], ['.mob-title', '.mob-dot']].forEach(function (par) {
      var caixa = document.querySelector(par[0]), ponto = document.querySelector(par[0] + ' ' + par[1]);
      if (!caixa || !ponto || caixa.querySelector('.tv-logo')) return;
      var img = document.createElement('img');
      img.className = 'tv-logo'; img.src = SRC; img.alt = 'Trade'; img.decoding = 'async';
      // se o arquivo não carregar, o pontinho original volta (cabeçalho nunca fica sem marca)
      img.onerror = function () { img.remove(); ponto.classList.remove('tv-oculto'); };
      ponto.classList.add('tv-oculto');
      caixa.insertBefore(img, ponto);
    });
  }
  montar();
  window.addEventListener('load', montar);

  // Favicon sem fundo que acompanha o tema do navegador: emblema para aba clara e para aba escura.
  // O apple-touch-icon continua com fundo branco (o iOS exige ícone opaco).
  // Um único link que o JS troca conforme o tema (mais confiável que "media" no link, que nem todo navegador respeita).
  function favicons() {
    var v = '?v=20261113b';
    Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]')).forEach(function (l) { l.parentNode.removeChild(l); });
    var l = document.createElement('link');
    l.rel = 'icon'; l.type = 'image/png'; l.sizes = '64x64';
    document.head.appendChild(l);
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function aplicar() { l.href = BASE + (mq && mq.matches ? 'favicon-64-escuro.png' : 'favicon-64.png') + v; }
    aplicar();
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', aplicar); else if (mq.addListener) mq.addListener(aplicar); }
  }
  favicons();
})();
