// 13/10/2026 (pedido do Paulo): o número de Trade validado com a Bia/Nikolas (comissionamento) é o
// oficial, e o Dash de Performance passa a usar esse mesmo número no canal "Trade". Este script lê o
// bloco de dados (var D = {...}) que o Apps Script grava no index.html e publica trade_mensal.json
// com o Trade, o parque, APPAI e Escolas de cada mês. Roda no workflow injetar-patch a cada novo
// index.html.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const i = html.indexOf('var D = {');
if (i < 0) { console.error('bloco "var D" não encontrado no index.html'); process.exit(1); }
const code = html.slice(i, html.indexOf('</script>', i));
const ctx = { window: {}, document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
              localStorage: { getItem: () => null }, navigator: {} };
vm.createContext(ctx);
try { vm.runInContext(code, ctx); } catch (e) { /* o resto do script usa o DOM; o D já foi definido */ }
const D = ctx.D;
if (!D || !D.hist26) { console.error('D.hist26 não encontrado'); process.exit(1); }

const PARQUES = { aqua: 'AquaRio', pai: 'Paineiras', bio: 'BioParque' };
const meses = {};
const pad = n => String(n).padStart(2, '0');
const mesAtual = Number(D.mesAtualIdx);
for (let m = 0; m < 12; m++) {
  const k = `2026-${pad(m + 1)}`;
  for (const [tk, nome] of Object.entries(PARQUES)) {
    const trade = (D.hist26[tk] || [])[m];
    if (typeof trade !== 'number' || (trade === 0 && tk === 'bio')) continue;
    const parque = ((D.histPar26 || {})[tk] || [])[m];
    (meses[k] = meses[k] || {})[nome] = {
      trade,
      parque: typeof parque === 'number' ? parque : null,
      appai: ((D.hist26['appai_' + tk]) || [])[m] ?? null,
      escolas: ((D.hist26['escolas_' + tk]) || [])[m] ?? null,
      parcial: m === mesAtual,
    };
  }
}
// 2025: trade do mês inteiro (D.hist25), que o Paulo não quer mexer agora
for (let m = 0; m < 12; m++) {
  const k = `2025-${pad(m + 1)}`;
  for (const [tk, nome] of Object.entries(PARQUES)) {
    const trade = ((D.hist25 || {})[tk] || [])[m];
    if (typeof trade !== 'number') continue;
    (meses[k] = meses[k] || {})[nome] = { trade, parque: null, appai: null, escolas: null, parcial: false };
  }
}
const ordenado = Object.fromEntries(Object.entries(meses).sort());
const saida = { versao: 1, fonte: 'Dash do Trade (planilha TRADE, validada com Bia/Nikolas)',
                dataRef: (D.mesAtual || {}).dataFmt || null, meses: ordenado };
fs.writeFileSync('trade_mensal.json', JSON.stringify(saida, null, 1));
console.log('trade_mensal.json:', Object.keys(ordenado).length, 'meses');
