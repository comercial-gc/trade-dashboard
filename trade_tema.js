/* 18/11/2026 (Paulo): cores de identidade do Dash do Trade iguais às dos Dashes de Performance e de Conteúdo.
   Carregado pelo mesmo esquema do trade_patch.js (scripts/injetar_patch.py), então sobrevive ao rebuild do index.html
   pelo Apps Script e não mexe no script principal.

   Paleta comum dos dois Dashes de referência
     verde-floresta  #0f3d2e (títulos do Performance) e #1d5749 (marca do Conteúdo), gradiente do cabeçalho do Conteúdo
                     #163f35 > #1d5749 > #256a4b
     verde de ação   #1f7a4d (botão ativo, positivo) e #5aa055 (apoio)
     acento quente   laranja #e8830f (faixa do cabeçalho do Conteúdo) e dourado #d4a017 (barra do título do Performance)
     neutros         tinta #16211c, linha #e4e8e5, painel #f7f9f7, apagado #5b6b63

   O que muda: cabeçalho (desktop e celular), faixa de navegação, aba ativa, indicador deslizante, cabeçalhos de tabela,
   selos, títulos de seção e o botão de Excel. O que NÃO muda: a cor de cada parque (AquaRio azul, BioParque laranja,
   Paineiras verde, 3P) nos gráficos, cartões e filtros de parque, e o tema escuro (superfícies já são as mesmas do Performance). */
(function () {
  if (window.__tradeTema) return;
  window.__tradeTema = true;

  var css = document.createElement('style');
  css.id = 'tv-tema';
  css.textContent = [
    ':root{--navy:#0f3d2e;--slate:#1d5749;--text:#16211c;--border:#e4e8e5;--muted:#5b6b63;',
    '  --tv-verde:#1f7a4d;--tv-marca:#1d5749;--tv-marca2:#5aa055;--tv-laranja:#e8830f;--tv-ouro:#d4a017;--tv-pale:#e5f3ec;',
    '  --tv-hero:linear-gradient(100deg,#163f35 0%,#1d5749 55%,#256a4b 100%)}',
    // o trade_v2.js força --muted azulado (#4F6B7D) no claro; volta ao cinza-esverdeado, ainda com contraste >= 5:1
    'html:root:not([data-theme="dark"]){--muted:#4d5f56;--up:#1f7a4d}',
    // cabeçalho (desktop e celular): faixa verde-floresta com linha laranja, como o cabeçalho do Dash de Conteúdo
    '.topbar,.mob-header{background:var(--tv-hero);border-bottom:3px solid var(--tv-laranja);box-shadow:0 2px 14px rgba(15,61,46,.38)}',
    '.mob-nav2{background:var(--tv-marca);border-bottom:1px solid rgba(255,255,255,.14)}',
    '.brand-dot,.mob-dot{background:var(--tv-laranja)}',
    '.brand-small,.mob-date{color:rgba(255,255,255,.62)}',
    // navegação: item ativo verde de ação, hover com o laranja da marca
    '.np:hover{border-color:var(--tv-laranja);color:#fff}',
    '.np.on,.mob-nav2-btn.on{background:var(--tv-verde);border-color:var(--tv-marca2);color:#fff}',
    '.nav-slider,.mob-nav2-slider{background:linear-gradient(90deg,var(--tv-laranja),var(--tv-ouro))}',
    // menu das seções (Resultado, Clientes, Mercado, Parques) e subabas (Top Clientes e Três Pescadores).
    // Prefixo html: o trade_v2.js injeta o CSS dele depois deste arquivo e usa --aqua nesses itens.
    'html .tv2-menu button:hover{background:var(--tv-pale)}html .tv2-menu button.on{color:var(--tv-marca);background:var(--tv-pale)}',
    'html .cli-tab.on,html .tv2-subtab.on{color:var(--tv-marca);border-bottom-color:var(--tv-laranja)}',
    'html .tv2-subtab:focus-visible,html .tv2-menu button:focus-visible,html .cli-tab:focus-visible{outline:2px solid var(--tv-verde);outline-offset:-2px}',
    'html .tv2-ev-mais{color:var(--tv-marca)}',
    // barra inferior, folha "Mais" e lista de Top Clientes do celular (o trade_patch.js usa azul-marinho/azul-água neles)
    '#tpmNav button{color:var(--muted)}',
    'html #tpmNav button.on{color:var(--tv-marca)}html #tpmNav button.on .tpm-ic{background:var(--tv-pale)}',
    '.tpm-mais-lista button.on{border-color:var(--tv-verde);color:var(--tv-marca);background:var(--tv-pale)}',
    '.tpm-mais-btn{color:var(--tv-marca)}',
    '.tpm-grab{background:var(--border)}',
    '.tpm-li.aberto{background:#f4f9f6}',
    'html .tpm-cap,html .tpm-rk,html .tpm-nm small,html .tpm-nd,html .tpm-det,html #tpmNav button{color:var(--muted)}',
    '.tpm-grab,.tpm-lista,.tpm-cap,.tpm-li,.tpm-mais-btn,.tpm-mais-tit button,.tpm-mais-lista button,#tpmNav{border-color:var(--border)}',
    'html[data-theme="dark"] #tpmNav button.on,html[data-theme="dark"] .tpm-mais-btn,html[data-theme="dark"] .tpm-mais-lista button.on{color:#7fc77a}',
    'html[data-theme="dark"] #tpmNav button.on .tpm-ic,html[data-theme="dark"] .tpm-mais-lista button.on{background:#163226}',
    'html[data-theme="dark"] .tpm-li.aberto{background:#163226}',
    // blocos de destaque do celular
    '.mob-hero,.hero{background:linear-gradient(135deg,#0f3d2e 0%,#1d5749 100%)}',
    '.total-bar{background:linear-gradient(135deg,#0f3d2e,#1d5749)}',
    '.mes-select option{background:#0f3d2e}',
    // linha Total da aba Mês (pêssego do BioParque) e barras do Top Clientes (azul-marinho fixo no JS) em verde da marca
    'html:root:not([data-theme="dark"]) .pktbl-total{background:var(--tv-pale)}',
    '.cli-bar-fill[style*="13,27,42"],.cli-bar-fill[style*="13, 27, 42"]{background:rgba(15,61,46,.85)!important}',
    // títulos de seção em verde-floresta, como o título do Dash de Performance (no escuro seguem a cor do texto)
    '.sec-t,.cli-title,.mob-section-title{color:#0f3d2e}',
    'html[data-theme="dark"] .sec-t,html[data-theme="dark"] .cli-title,html[data-theme="dark"] .mob-section-title{color:var(--text)}',
    'html[data-theme="dark"] .cli-tab.on,html[data-theme="dark"] .tv2-subtab.on,html[data-theme="dark"] .tv2-menu button.on,html[data-theme="dark"] .tv2-ev-mais{color:#7fc77a}',
    'html[data-theme="dark"] .tv2-menu button.on,html[data-theme="dark"] .tv2-menu button:hover{background:#163226}'
  ].join('\n');
  document.head.appendChild(css);

  // cor da barra do navegador no celular
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#163f35');
})();
