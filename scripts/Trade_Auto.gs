// ═══════════════════════════════════════════════════════════════════
// Trade_Auto.gs  (13/10/2026)
// Preenche sozinho as abas "Diário <Mês><aa>" e "Top Clientes-<Mês>" e republica
// o Dashboard do Trade (Drive + GitHub).
// Os números vêm do trade_diario.json do repositório comercial-gc/trade-dashboard,
// calculado pelo workflow update-trade a partir dos brutos da pasta 2026 do Drive
// (que se atualizam sozinhos por volta das 8h45). Este script roda de hora em hora com a conta de quem ativou o
// gatilho; só age quando o JSON muda.
//
// Grava SOMENTE:
//   - Diário: colunas C, E, I, J, K (AquaRio) e M, O, S (Paineiras) dos dias do JSON,
//     só se o cabeçalho da linha 2 e a data da coluna B baterem, e só as células que mudaram;
//   - Top Clientes: linhas de agência + TOTAL GERAL e o subtítulo da linha 2;
//   - aba oculta "Automação Trade (log)" com o histórico do que foi feito.
// Fórmulas, 2025, metas e as demais colunas não são tocadas.
//
// Para ligar: rodar ativarGatilhoTradeAuto() uma vez (pede autorização). Cria a rodada das 09:05
// (tradeAutoManha) e a de hora em hora (reserva).
// Para rodar na hora: tradeAutoAgora().
// Visitação do parque pela Controladoria: automática no gatilho; para forçar, tradeAutoParqueOficial().
// Publicar o que foi preenchido à mão (Diário e Top Clientes), sem a automação sobrescrever:
// tradePublicarManual() (pode ser atribuída a um botão/desenho na planilha).
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
  // 16/10/2026: se o Paulo publicou à mão dias que o Drive ainda não tem, o Top Clientes manual
  // (que já inclui esses dias) não é sobrescrito pelo cálculo mais curto. Quando o Drive alcançar,
  // a trava sai sozinha e a automação volta a escrever o Top Clientes.
  var manAte = Number(props.getProperty('TRADE_MANUAL_ATE') || 0), manMes = props.getProperty('TRADE_MANUAL_MES');
  var travaTop = manMes === dados.mes && manAte > Number(dados.ate);
  if (!travaTop && manAte) { props.deleteProperty('TRADE_MANUAL_ATE'); props.deleteProperty('TRADE_MANUAL_MES'); }
  var mudTop = travaTop ? false : _tradeAutoTop(ss, dados);
  var resumo = dados.aba_diario + ': ' + mudDiario.length + ' células' +
    (mudDiario.length ? ' (' + mudDiario.join(', ').slice(0, 2000) + ')' : '') +
    '; ' + dados.aba_top + ': ' + (travaTop ? 'preservado (lançado à mão até ' + ('0' + manAte).slice(-2) + ')' : (mudTop ? 'reescrito com ' + dados.top.linhas.length + ' agências' : 'igual')) +
    '; dados até ' + ('0' + dados.ate).slice(-2) + '/' + dados.mes.slice(5) +
    (dados.avisos && dados.avisos.length ? '; avisos: ' + dados.avisos.join(' | ') : '');

  var parciais = _tradeAutoFecharParciais(ss);
  if (parciais.length) resumo += '; fórmulas de "Parcial" de meses fechados trocadas pela soma do mês: ' + parciais.join(', ');
  var publicado = '';
  if (mudDiario.length || mudTop || parciais.length || forcar) {
    _tradeAutoPublicar(ss, resumo);
    publicado = '; Dashboard publicado';
  }
  _tradeAutoLog(ss, resumo + publicado);
  props.setProperty('TRADE_AUTO_GERADO', dados.gerado_em);
}

// o gatilho passa um objeto de evento como argumento; por isso ele chama esta função
function tradeAutoGatilho() {
  _tradeAutoDispararCalculo();
  tradeAutoAtualizar(false);
  try { _tradeAutoParque(false); } catch (e) { _tradeAutoLogPedido('visitação do parque pela Controladoria não aplicada: ' + e.message); }
}

// 14/10/2026: as rodadas agendadas do GitHub (workflow update-trade) não estavam disparando. Como
// reserva, o gatilho de hora em hora também pede o cálculo ao GitHub entre 9h e 17h; o resultado
// (trade_diario.json) é lido na rodada seguinte. Falha aqui nunca impede o resto.
function _tradeAutoDispararCalculo() {
  try {
    var h = Number(Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'H'));
    if (h < 9 || h > 17) return;
    var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) { _tradeAutoLogPedido('pedido de cálculo ao GitHub não enviado: propriedade GITHUB_TOKEN vazia'); return; }
    var r = UrlFetchApp.fetch('https://api.github.com/repos/comercial-gc/trade-dashboard/actions/workflows/update-trade.yml/dispatches', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'Apps-Script' },
      payload: JSON.stringify({ ref: 'main', inputs: { mes: '' } })
    });
    var cod = r.getResponseCode();
    _tradeAutoLogPedido(cod === 204 ? 'cálculo pedido ao GitHub (ok)'
      : 'pedido de cálculo ao GitHub RECUSADO (HTTP ' + cod + '): ' + r.getContentText().slice(0, 300));
  } catch (e) { _tradeAutoLogPedido('não consegui pedir o cálculo ao GitHub: ' + e.message); }
}

function _tradeAutoLogPedido(texto) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1mUWZypuE6G-T35i7eDwRlU0d9dzqdUCxTgtm5ZmV4XY');
    _tradeAutoLog(ss, texto);
  } catch (e) { Logger.log(texto); }
}

// roda uma vez à mão para testar o pedido ao GitHub sem esperar o gatilho (resultado na aba de log)
function tradeAutoTestarPedido() { _tradeAutoDispararCalculo(); }

function tradeAutoAgora() { tradeAutoAtualizar(true); }

// 16/10/2026 (Paulo): publica o Dashboard com o que está na planilha agora (inclusive dias e Top
// Clientes lançados à mão quando o Drive atrasa) e trava o Top Clientes até o Drive alcançar esse dia.
function tradePublicarManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1mUWZypuE6G-T35i7eDwRlU0d9dzqdUCxTgtm5ZmV4XY');
  var props = PropertiesService.getScriptProperties();
  var dados = _tradeAutoBaixarJson();
  var ultimo = 0, mes = dados ? dados.mes : null;
  if (dados && dados.aba_diario) {
    var sh = ss.getSheetByName(dados.aba_diario);
    var vals = sh ? sh.getRange(3, 2, 31, 2).getValues() : [];   // colunas B (data) e C (Trade AquaRio)
    vals.forEach(function (v) { if (v[0] instanceof Date && typeof v[1] === 'number' && v[1] > 0) ultimo = Math.max(ultimo, v[0].getDate()); });
  }
  if (ultimo && mes && ultimo > Number(dados.ate)) {
    props.setProperty('TRADE_MANUAL_ATE', String(ultimo));
    props.setProperty('TRADE_MANUAL_MES', mes);
  }
  var resumo = 'publicação manual: planilha até ' + ('0' + ultimo).slice(-2) + (mes ? '/' + mes.slice(5) : '') +
    (ultimo > Number(dados && dados.ate) ? ' (Drive até ' + ('0' + dados.ate).slice(-2) + '; Top Clientes travado até o Drive alcançar)' : '');
  _tradeAutoPublicar(ss, resumo);
  _tradeAutoLog(ss, resumo + '; Dashboard publicado');
  try { SpreadsheetApp.getActive().toast('Dashboard do Trade publicado com a planilha até ' + ('0' + ultimo).slice(-2), 'Trade', 5); } catch (e) {}
}

function _tradeAutoPublicar(ss, resumo) {
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
}

// 13/10/2026: a linha "Parcial:" de 2025 (trade 25, parque 25) usa SUM(INDEX(X:X,3):INDEX(X:X,2+DAY(TODAY()-1)))
// para comparar o mesmo período no mês em andamento. Quando o mês fecha, a fórmula continua
// andando com HOJE() e o mês fechado passa a comparar só alguns dias de 2025 (set/26 mostrava
// 27.580 no AquaRio em vez de 75.198). Nos meses já fechados, troca pela soma do mês inteiro.
function _tradeAutoFecharParciais(ss) {
  var MES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var hoje = new Date(), feitos = [];
  var rx = /INDEX\(([A-Z]+):\1,(\d+)\):INDEX\(\1:\1,(\d+)\+DAY\(TODAY\(\)-1\)\)/g;
  for (var ano = 2026; ano <= hoje.getFullYear(); ano++) {
    for (var m = 0; m < 12; m++) {
      if (ano === hoje.getFullYear() && m >= hoje.getMonth()) break; // mês atual continua com HOJE()
      var sh = ss.getSheetByName('Diário ' + MES_CURTO[m] + String(ano).slice(2));
      if (!sh) continue;
      var nDias = new Date(ano, m + 1, 0).getDate();
      var n = Math.min(sh.getLastRow(), 45), w = Math.min(sh.getLastColumn(), 40);
      var forms = sh.getRange(1, 1, n, w).getFormulas();
      var vals = sh.getRange(1, 1, n, 2).getValues();
      for (var r = 0; r < n; r++) {
        if (String(vals[r][0]).trim() !== 'Parcial:' && String(vals[r][1]).trim() !== 'Parcial:') continue;
        for (var c = 0; c < w; c++) {
          var f = forms[r][c];
          if (!f || f.indexOf('TODAY()') < 0) continue;
          var novo = f.replace(rx, function (_, col, ini, base) { return col + ini + ':' + col + (Number(base) + nDias); });
          if (novo !== f && novo.indexOf('TODAY()') < 0) {
            sh.getRange(r + 1, c + 1).setFormula(novo);
            feitos.push(sh.getName() + '!' + sh.getRange(r + 1, c + 1).getA1Notation());
          }
        }
      }
    }
  }
  return feitos;
}

// Visitação do parque (parque 26 e parque 25) igual à do Dash de Performance com a Controladoria ligada.
// 13/10/2026: versão manual para jan a set/26. 26/10/2026 (Paulo: "visitação do parque tem que bater com os
// números da Controladoria, fechados e parcial"): o trade_parque_oficial.json é gerado todo dia pela rotina
// das 08:00 (meses fechados: diário da Controladoria e, no dia sem fechamento, a planilha Visitação Parques
// 2026; mês corrente: só os dias que a Controladoria já mandou, o resto segue o cálculo diário) e esta função
// roda sozinha no gatilho de hora em hora quando o arquivo muda. Acha as colunas de cada aba "Diário" pelo
// cabeçalho ("parque 26" / "parque 25" sob o título AQUARIO / PAINEIRAS) e confere a data de cada linha.
// Para forçar na hora: tradeAutoParqueOficial().
function tradeAutoParqueOficial() { _tradeAutoParque(true); }

function _tradeAutoParque(forcar) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var h = { 'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'Apps-Script' };
  if (token) h['Authorization'] = 'token ' + token;
  var r = UrlFetchApp.fetch('https://api.github.com/repos/comercial-gc/trade-dashboard/contents/trade_parque_oficial.json?t=' + Date.now(), { headers: h, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Trade_Auto: não consegui ler trade_parque_oficial.json (' + r.getResponseCode() + ')');
  var dados = JSON.parse(r.getContentText());
  var props = PropertiesService.getScriptProperties();
  if (!forcar && props.getProperty('TRADE_PARQUE_GERADO') === dados.gerado_em) return;
  if (dados.versao !== 2 || !dados.meses) throw new Error('Trade_Auto: trade_parque_oficial.json em formato antigo');
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1mUWZypuE6G-T35i7eDwRlU0d9dzqdUCxTgtm5ZmV4XY');
  var ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var TIT = { AQUARIO: 'AquaRio', PAINEIRAS: 'Paineiras' };
  var resumo = [], total = 0;
  Object.keys(dados.meses).forEach(function (mesTxt) {
    var mes = Number(mesTxt), aba = 'Diário ' + ABREV[mes - 1] + '26', sh = ss.getSheetByName(aba);
    if (!sh) { resumo.push(aba + ': aba não existe'); return; }
    var vals = sh.getRange(1, 1, Math.min(sh.getLastRow(), 45), Math.min(sh.getLastColumn(), 40)).getValues();
    var hr = -1;
    for (var i = 0; i < 6 && hr < 0; i++) if (vals[i].some(function (v) { return String(v || '').trim().toLowerCase().indexOf('parque 26') === 0; })) hr = i;
    if (hr < 1) { resumo.push(aba + ': cabeçalho "parque 26" não encontrado'); return; }
    var dc = -1;
    for (var j = 0; j < 5 && dc < 0; j++) for (var k = hr + 1; k < hr + 5; k++) if (vals[k] && vals[k][j] instanceof Date) { dc = j; break; }
    if (dc < 0) { resumo.push(aba + ': coluna de data não encontrada'); return; }
    var blocos = [];
    vals[hr - 1].forEach(function (v, j2) { var t = String(v || '').trim().toUpperCase(); if (TIT[t] || t === 'BIOPARQUE') blocos.push([j2, TIT[t] || null]); });
    var mud = 0;
    blocos.forEach(function (b, bi) {
      var park = b[1];
      if (!park || !dados.meses[mesTxt][park]) return;
      var j1 = bi + 1 < blocos.length ? blocos[bi + 1][0] : b[0] + 12, c26 = -1, c25 = -1;
      for (var c = b[0]; c < Math.min(j1, vals[hr].length); c++) {
        var t = String(vals[hr][c] || '').trim().toLowerCase();
        if (c26 < 0 && t.indexOf('parque 26') === 0) c26 = c;
        if (c25 < 0 && t.indexOf('parque 25') === 0) c25 = c;
      }
      if (c26 < 0 || c25 < 0) { resumo.push(aba + ' ' + park + ': colunas parque 26/25 não encontradas'); return; }
      var dias = dados.meses[mesTxt][park];
      for (var r2 = hr + 1; r2 < vals.length; r2++) {
        var dt = vals[r2][dc];
        if (!(dt instanceof Date) || dt.getMonth() + 1 !== mes) continue;
        var x = dias[String(dt.getDate())];
        if (!x) continue;
        [[x[0], c26], [x[1], c25]].forEach(function (par) {
          var novo = par[0];
          if (novo === null || novo === undefined) return;
          var velho = vals[r2][par[1]];
          if (typeof velho === 'number' && Math.abs(velho - novo) < 0.5) return;
          sh.getRange(r2 + 1, par[1] + 1).setValue(novo);
          mud++;
        });
      }
    });
    total += mud;
    resumo.push(aba + ': ' + mud + ' células');
  });
  var parciais = _tradeAutoFecharParciais(ss);
  var texto = 'Visitação do parque pela Controladoria (' + dados.gerado_em + '): ' + resumo.join('; ') + (parciais.length ? '; fórmulas de "Parcial" fechadas: ' + parciais.join(', ') : '');
  if (total || parciais.length) { _tradeAutoPublicar(ss, texto); texto += '; Dashboard publicado'; }
  _tradeAutoLog(ss, texto);
  props.setProperty('TRADE_PARQUE_GERADO', dados.gerado_em);
}


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

// 19/10/2026 (Paulo): rodada fixa às 09:05. Pede o cálculo ao GitHub, espera ele terminar
// (até ~4 min) e já grava e publica. O gatilho de hora em hora continua como reserva para
// quando o Drive atrasa.
function tradeAutoManha() {
  var antes = (_tradeAutoBaixarJson() || {}).gerado_em;
  _tradeAutoDispararCalculo();
  for (var i = 0; i < 8; i++) {
    Utilities.sleep(30000);
    var j = _tradeAutoBaixarJson();
    if (j && j.gerado_em && j.gerado_em !== antes) break;
  }
  tradeAutoAtualizar(false);
  try { _tradeAutoParque(false); } catch (e) { _tradeAutoLogPedido('visitação do parque pela Controladoria não aplicada: ' + e.message); }
}

function ativarGatilhoTradeAuto() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { var f = t.getHandlerFunction(); return f === 'tradeAutoGatilho' || f === 'tradeAutoManha'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tradeAutoManha').timeBased().atHour(9).nearMinute(5).everyDays(1).inTimezone('America/Sao_Paulo').create();
  ScriptApp.newTrigger('tradeAutoGatilho').timeBased().everyHours(1).create();
}
