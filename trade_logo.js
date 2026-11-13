/* 13/11/2026 (Paulo): logo do Trade no cabeçalho do Dash (desktop e mobile).
   Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py), então sobrevive ao rebuild do
   index.html pelo Apps Script e não mexe no script principal.

   A logo tem 3 versões, uma por tipo de fundo (o texto "TRADE" embaixo NÃO faz parte da logo; os arquivos
   trazem só o emblema, com fundo transparente):
     logo-trade-claro.png   fundo claro/branco (ícones do app: icon-192/512, apple-touch-icon, favicon)
     logo-trade-preto.png   fundo preto e escuros como o azul-marinho: cabeçalho do Dash (desktop e mobile)
     logo-trade-cinza.png   fundo cinza escuro (reserva, para fundos cinza)
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
})();
