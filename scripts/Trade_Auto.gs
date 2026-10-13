// ═══════════════════════════════════════════════════════════════════
// Trade_Auto.gs  (13/10/2026)
// Preenche sozinho as abas "Diário <Mês><aa>" e "Top Clientes-<Mês>" e republica
// o Dashboard do Trade (Drive + GitHub).
// Os números vêm do trade_diario.json do repositório comercial-gc/trade-dashboard,
// calculado pelo workflow update-trade a partir da pasta do Flux do Paulo
// (09:45 a 15:00). Este script roda de hora em hora com a conta de quem ativou o
// gatilho; só age quando o JSON muda.
//
// Grava SOMENTE:
//   - Diário: colunas C, E, I, J, K (AquaRio) e M, O, S (Paineiras) dos dias do JSON,
//     só se o cabeçalho da linha 2 e a data da coluna B baterem, e só as células que mudaram;
//   - Top Clientes: linhas de agência + TOTAL GERAL e o subtítulo da linha 2;
//   - aba oculta "Automação Trade (log)" com o histórico do que foi feito.
// Fórmulas, 2025, metas e as demais colunas não são tocadas.
//
// Para ligar: rodar ativarGatilhoTradeAuto() uma vez (pede autorização).
// Para rodar na hora: tradeAutoAgora().
// ═══════════════════════════════════════════════════════════════════

var TRADE_AUTO_JSON = 'https://api.github.com/repos/comercial-gc/trade-dashboard/contents/trade_diario.json';
var TRADE_AUTO_LOG = 'Automação Trade (log)';
var TRADE_AUTO_COLS = { C: 3, E: 5, I: 9, J: 10, K: 11, M: 13, O: 15, S: 19 };

function tradeAutoAtualizar(forcar) {
  var props = PropertiesService.getScriptProperties();
  var dados = _tradeAutoBaixarJson();
  if (!dados || !dados.ate) return;
  forcar = forcar === true;
  if (!forcar && props.getProperty('TRADE_AUTO_GERADO') === dados.gerado_em) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1mUWZypuE6G-T35i7eDwRlU0d9dzqdUCxTgtm5ZmV4XY');
  var mudDiario = _tradeAutoDiario(ss, dados);
  var mudTop = _tradeAutoTop(ss, dados);
  var resumo = dados.aba_diario + ': ' + mudDiario.length + ' células' +
    (mudDiario.length ? ' (' + mudDiario.join(', ').slice(0, 2000) + ')' : '') +
    '; ' + dados.aba_top + ': ' + (mudTop ? 'reescrito com ' + dados.top.linhas.length + ' agências' : 'igual') +
    '; dados até ' + ('0' + dados.ate).slice(-2) + '/' + dados.mes.slice(5) +
    (dados.avisos && dados.avisos.length ? '; avisos: ' + dados.avisos.join(' | ') : '');

  var publicado = '';
  if (mudDiario.length || mudTop || forcar) {
    SpreadsheetApp.flush();
    var d = lerDados();
    var hist = lerHistorico();
    var imm;
    try { imm = lerIntelMercadoPaineiras(); } catch (e) { imm = null; }
    var eventosRio;
    try { eventosRio = lerEventosRio(); } catch (e) { eventosRio = []; }
    var precisaoProjecao;
    try { precisaoProjecao = registrarHistoricoProjecao(d, hist); } catch (e) { precisaoProjecao = null; }
    var html = montarHTML(d, {ok:false,tempAtual:'--',icon:'',prev:[],diasChuva:[]}, hist, imm, eventosRio, precisaoProjecao);
    salvarNoDrive(html);
    if (!atualizarGitHub(html)) {
      _tradeAutoLog(ss, resumo + '; ERRO: Dashboard não subiu para o GitHub (GITHUB_TOKEN)');
      throw new Error('Trade_Auto: planilha preenchida, mas o Dashboard não subiu para o GitHub. Tento de novo na próxima hora.');
    }
    publicado = '; Dashboard publicado';
  }
  _tradeAutoLog(ss, resumo + publicado);
  props.setProperty('TRADE_AUTO_GERADO', dados.gerado_em);
}

// o gatilho passa um objeto de evento como argumento; por isso ele chama esta função
function tradeAutoGatilho() { tradeAutoAtualizar(false); }

function tradeAutoAgora() { tradeAutoAtualizar(true); }

function _tradeAutoBaixarJson() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var h = { 'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'Apps-Script' };
  if (token) h['Authorization'] = 'token ' + token;
  var r = UrlFetchApp.fetch(TRADE_AUTO_JSON + '?t=' + Date.now(), { headers: h, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Trade_Auto: não consegui ler trade_diario.json (' + r.getResponseCode() + ')');
  return JSON.parse(r.getContentText());
}

function _tradeAutoDiario(ss, dados) {
  var sh = ss.getSheetByName(dados.aba_diario);
  if (!sh) throw new Error('Trade_Auto: aba "' + dados.aba_diario + '" não existe. Nada foi gravado.');
  var vals = sh.getRange(1, 1, 35, 20).getValues();
  var cab = vals[1];
  Object.keys(dados.cabecalhos).forEach(function (letra) {
    var atual = String(cab[TRADE_AUTO_COLS[letra] - 1] || '').trim().toLowerCase();
    if (atual.indexOf(dados.cabecalhos[letra]) !== 0)
      throw new Error('Trade_Auto: cabeçalho da coluna ' + letra + ' em "' + dados.aba_diario + '" é "' + atual + '", esperado "' + dados.cabecalhos[letra] + '". Nada foi gravado.');
  });
  var ano = Number(dados.mes.slice(0, 4)), mes = Number(dados.mes.slice(5, 7));
  // confere todas as datas antes de gravar qualquer coisa
  dados.diario.forEach(function (l) {
    var b = vals[l.dia + 1][1];
    if (!(b instanceof Date) || b.getFullYear() !== ano || b.getMonth() + 1 !== mes || b.getDate() !== l.dia)
      throw new Error('Trade_Auto: linha ' + (l.dia + 2) + ' de "' + dados.aba_diario + '" não é o dia ' + l.dia + '. Nada foi gravado.');
  });
  var mud = [];
  dados.diario.forEach(function (l) {
    if ((dados.protegidos || []).indexOf(l.dia) >= 0) return;
    Object.keys(TRADE_AUTO_COLS).forEach(function (letra) {
      var novo = l[letra];
      if (novo === null || novo === undefined) return;
      var velho = vals[l.dia + 1][TRADE_AUTO_COLS[letra] - 1];
      if (typeof velho === 'number' && Math.abs(velho - novo) < 0.005) return;
      sh.getRange(l.dia + 2, TRADE_AUTO_COLS[letra]).setValue(novo);
      mud.push(letra + (l.dia + 2));
    });
  });
  return mud;
}

function _tradeAutoTop(ss, dados) {
  var sh = ss.getSheetByName(dados.aba_top);
  if (!sh) throw new Error('Trade_Auto: aba "' + dados.aba_top + '" não existe. Top Clientes não gravado.');
  var ult = Math.max(sh.getLastRow(), 4);
  var vals = sh.getRange(1, 1, ult, 4).getValues();
  var cab = vals[2].map(function (v) { return String(v).trim(); }).join('|');
  if (cab !== 'Agência|AquaRio|Paineiras Corcovado|TOTAL')
    throw new Error('Trade_Auto: cabeçalho da linha 3 de "' + dados.aba_top + '" mudou (' + cab + '). Top Clientes não gravado.');
  var totalAntigo = ult;
  for (var i = 3; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toUpperCase() === 'TOTAL GERAL') { totalAntigo = i + 1; break; }
  }
  var atuais = [];
  for (var j = 3; j < totalAntigo - 1; j++) {
    if (String(vals[j][0]).trim()) atuais.push([String(vals[j][0]).trim(), Math.round(Number(vals[j][1]) || 0), Math.round(Number(vals[j][2]) || 0)]);
  }
  var novos = dados.top.linhas;
  if (JSON.stringify(atuais) === JSON.stringify(novos) && String(vals[1][0]).trim() === dados.top.subtitulo) return false;

  var ini = 4, fim = ini + novos.length - 1, totalNovo = fim + 1;
  // formato: linha de total vai para a nova posição; linhas de agência copiam a linha 5
  sh.getRange(totalAntigo, 1, 1, 4).copyTo(sh.getRange(totalNovo, 1, 1, 4), { formatOnly: true });
  if (totalNovo - 1 >= 6) sh.getRange(5, 1, 1, 4).copyTo(sh.getRange(6, 1, totalNovo - 6, 4), { formatOnly: true });
  if (totalAntigo > totalNovo) sh.getRange(totalNovo + 1, 1, totalAntigo - totalNovo, 4).clear();
  var linhas = novos.map(function (r, k) { return [r[0], r[1], r[2], '=SUM(B' + (ini + k) + ':C' + (ini + k) + ')']; });
  linhas.push(['TOTAL GERAL', '=SUM(B' + ini + ':B' + fim + ')', '=SUM(C' + ini + ':C' + fim + ')', '=SUM(D' + ini + ':D' + fim + ')']);
  sh.getRange(ini, 1, linhas.length, 4).setValues(linhas);
  sh.getRange(2, 1).setValue(dados.top.subtitulo);
  return true;
}

function _tradeAutoLog(ss, texto) {
  var log = ss.getSheetByName(TRADE_AUTO_LOG);
  if (!log) {
    log = ss.insertSheet(TRADE_AUTO_LOG);
    log.appendRow(['data/hora', 'o que foi feito']);
    log.hideSheet();
  }
  log.appendRow([Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'), texto]);
}

function ativarGatilhoTradeAuto() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'tradeAutoGatilho'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tradeAutoGatilho').timeBased().everyHours(1).create();
}
