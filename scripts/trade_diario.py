"""Números diários da planilha TRADE (aba "Diário <Mês><aa>" e "Top Clientes-<Mês>").

13/10/2026, pedido do Paulo: o Trade passa a ser preenchido sozinho a partir da pasta do Drive
onde ele sobe todo dia os relatórios do Flux (e, até 02/10/2026, do CARD), com as regras dele:

  AquaRio   Trade = CANAL_VENDA TRADE, sem os LOCAL_VENDA "POS*" exceto "POS TRADE". Conta LINHAS.
            APPAI / Escolas = NOME_BILHETE contém APPAI / ESCOLA. Receita = soma do VALOR inteiro
            (a planilha antiga perdia os valores com centavos, que viravam texto no Excel pt-BR).
            Arquivo do CARD (até 02/10): Origem Venda <> POS e Grupo do Bilhete = Trade; receita = PRECO.
  Paineiras Trade = NOME_CATEGORIA com GUIA/AGENCIA/OPERADORA/TRADE ou CANAL_VENDA TRADE, sem
            BINAMIK. Soma QTDE_TOTAL. Receita = soma do VALOR.
  Parque    Visitação do dia da planilha "Visitação Parques 2026" (linha "Realizado 2026").
  Top Clientes  Ranking do mês por agência (regras da skill ranking-trade-agencias, em
            trade_regras_agencias.py), AquaRio e Paineiras por NOME_AGENCIA.

Cada dia sai do arquivo mais recente da pasta que contém aquele dia (o nome do arquivo não importa).

A conta de serviço NÃO tem acesso à planilha do Trade (o compartilhamento é bloqueado). Por isso
este script só gera trade_diario.json na raiz do repositório; quem grava na planilha é o
Apps Script dela (Trade_Auto.gs), rodando com a conta do Paulo, que confere data e cabeçalho de
cada linha, grava só o que mudou e republica o Dashboard.

Uso: python scripts/trade_diario.py [--mes 2026-10] [--out trade_diario.json]
"""
import argparse
import calendar
import collections
import csv
import datetime
import io
import json
import os
import re
import socket
import sys
import time
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import trade_regras_agencias as regras  # noqa: E402

socket.setdefaulttimeout(300)
AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA_FLUX = "1-VhOHmeTFaaNfgVHdPDDcE55zwXmpEVA"  # pasta pessoal do Paulo (não é mais a fonte, ver abaixo)
# 14/10/2026 (Paulo): a fonte é a pasta "2026" do Drive, com os brutos mensais de todos os parques
# (AQUA_<MÊS>_2026, PAI_<MÊS>_2026), que se atualizam sozinhos todo dia de manhã (~8h45). São as
# mesmas pastas que alimentam o Dash de Performance (config.json top5_origem_folders).
PASTAS_BRUTO = {"A": "1A5qKFeQ_cqEACsqiZ_XAw7CR34-6RQr2", "P": "1n7e_VX-iOpnhZkiA9jd8OR1CNPK3WqBn"}
MES_ARQ = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
VISITACAO_ID = "1Ut5PCIe0oMUwfeRGLaM16HoTelGw0qfd"
GRAFIAS_JSON = os.path.join(AQUI, "trade_grafias.json")
# dias que o Paulo preencheu pelo CARD e não devem ser reescritos
PROTEGIDOS = {(2026, 10): [1, 2]}
# 26/10/2026 (Paulo): Portal Service e Condutores (desde ago/26) são TRADE. No CARD vêm com Grupo do Bilhete
# "E-Commerce" e Local de Venda "Cristo Redentor | Portal Service / Condutores" ("Car Service" no nome antigo);
# no Flux já vêm como CANAL_VENDA TRADE / PORTAL DE AGENTES. Vale para qualquer arquivo que traga essas colunas.
PORTAL_TRADE_RE = re.compile(r"PORTAL SERVICE|CONDUTOR|CAR SERVICE")
# agências que nunca entram no Top Clientes (além das da skill)
EXCLUIR_EXTRA = {"TESTE"}
# grafias já decididas (Paulo, 13/10/2026; Great Tour é a grafia de todos os meses de 2026)
GRAFIA = {"HEADOUT": "HEADOUT EXPERIENCES", "GREAT TOURS OPERATOR": "GREAT TOUR"}

MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro",
         "Outubro", "Novembro", "Dezembro"]
ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
# coluna da aba Diário -> (parque, campo, começo esperado do cabeçalho na linha 2)
COLUNAS = {
    "C": ("A", "trade", "trade 26"), "E": ("A", "parque", "parque 26"), "I": ("A", "appai", "appai"),
    "J": ("A", "esc", "escolas"), "K": ("A", "rec", "receita 26"),
    "M": ("P", "trade", "trade 26"), "O": ("P", "parque", "parque 26"), "S": ("P", "rec", "receita 26"),
}


def n(x):
    s = unicodedata.normalize("NFKD", str(x if x is not None else "")).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())


def num(x):
    if x is None or x == "":
        return 0.0
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip()
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def para_data(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    if isinstance(v, (int, float)) and 20000 < v < 80000:
        return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
    s = str(v or "").strip()[:10]
    for f in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, f).date()
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------- Drive

def drive_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    escopo = ["https://www.googleapis.com/auth/drive.readonly"]
    caminho = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if caminho:
        cred = service_account.Credentials.from_service_account_file(caminho, scopes=escopo)
    else:
        cred = service_account.Credentials.from_service_account_info(json.loads(os.environ["GCP_SERVICE_ACCOUNT_JSON"]), scopes=escopo)
    return build("drive", "v3", credentials=cred, cache_discovery=False)


def _exec(req, tentativas=5):
    for i in range(tentativas):
        try:
            return req.execute()
        except (OSError, socket.timeout):
            if i == tentativas - 1:
                raise
            time.sleep(2 ** i)


def _baixar(drive, f):
    from googleapiclient.http import MediaIoBaseDownload
    for tentativa in range(3):
        try:
            if f["mimeType"] == "application/vnd.google-apps.spreadsheet":
                req = drive.files().export_media(fileId=f["id"], mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                tipo = "xlsx"
            else:
                req = drive.files().get_media(fileId=f["id"], supportsAllDrives=True)
                tipo = "xlsx" if (f["name"].lower().endswith(".xlsx") or "spreadsheetml" in f["mimeType"]) else "csv"
            buf = io.BytesIO()
            dl = MediaIoBaseDownload(buf, req, chunksize=10 * 1024 * 1024)
            feito = False
            while not feito:
                _, feito = dl.next_chunk(num_retries=5)
            return tipo, buf.getvalue()
        except OSError:
            if tentativa == 2:
                raise
            time.sleep(5)


def _tabela(tipo, raw):
    # 16/10/2026: o PAI_OUT_2026.xlsx passou a vir como CSV com nome .xlsx (mimeType text/csv) e
    # quebrava o openpyxl. O formato é decidido pelo conteúdo: xlsx é um zip e começa com "PK".
    tipo = "xlsx" if raw[:2] == b"PK" else "csv"
    if tipo == "xlsx":
        import openpyxl
        ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        h = [n(x) for x in next(it)]
        return h, [list(r) for r in it]
    try:
        t = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        t = raw.decode("latin-1")
    sep = ";" if t[:3000].count(";") > t[:3000].count(",") else ","
    rd = csv.reader(io.StringIO(t), delimiter=sep)
    h = [n(x) for x in next(rd)]
    return h, list(rd)


def _listar(drive, pai):
    out, tok = [], None
    while True:
        r = _exec(drive.files().list(q=f"'{pai}' in parents and trashed=false", pageToken=tok, pageSize=200,
                                     fields="nextPageToken,files(id,name,mimeType,modifiedTime,size)",
                                     supportsAllDrives=True, includeItemsFromAllDrives=True))
        out += r["files"]
        tok = r.get("nextPageToken")
        if not tok:
            return out


# ---------------------------------------------------------------- pasta do Flux

def ler_brutos_mes(drive, ano, mes):
    """Brutos mensais da pasta 2026 do Drive: para cada parque, o arquivo <PREFIXO>_<MÊS>_<ANO> de maior
    tamanho (mesma regra do Dash de Performance; ignora planilha "TRATADA").
    -> ({("A"|"P", dia): {...agregados..., "ag": Counter, "arq", "mod"}}, avisos)"""
    import re as _re
    avisos, por_dia = [], {}
    alvo = {MES_ARQ[mes - 1]} | ({"MAIO"} if mes == 5 else set()) | ({"MARCO"} if mes == 3 else set())
    for parque, pasta in PASTAS_BRUTO.items():
        cands = []
        for f in _listar(drive, pasta):
            if f["mimeType"].endswith("folder") or "TRATAD" in n(f["name"]):
                continue
            toks = [t for t in _re.split(r"[_\-. ]+", n(f["name"])) if t]
            if str(ano) in toks and alvo & set(toks[1:]):
                cands.append(f)
        if not cands:
            avisos.append(f"bruto de {MESES[mes - 1]}/{ano} do {'AquaRio' if parque == 'A' else 'Paineiras'} não encontrado na pasta 2026")
            continue
        f = max(cands, key=lambda x: int(x.get("size") or 0))
        tipo, raw = _baixar(drive, f)
        h, rows = _tabela(tipo, raw)
        for d, x in processar(parque, h, rows, ano, mes, f["name"], avisos).items():
            por_dia[(parque, d)] = dict(x, arq=f["name"], mod=f["modifiedTime"])
    return por_dia, avisos


def ler_pasta_mes(drive, ano, mes):
    """-> ({("A"|"P", dia): {...agregados..., "ag": Counter, "arq", "mod"}}, avisos)"""
    avisos = []
    pastas = [f for f in _listar(drive, PASTA_FLUX) if f["mimeType"].endswith("folder") and n(f["name"]) == n(MESES[mes - 1])]
    if not pastas:
        return {}, [f"pasta '{MESES[mes - 1]}' não encontrada na pasta do Flux"]
    por_dia = {}
    for sub in _listar(drive, pastas[0]["id"]):
        if not sub["mimeType"].endswith("folder"):
            continue
        parque = "A" if "AQUA" in n(sub["name"]) else "P" if "PAINEIRAS" in n(sub["name"]) else None
        if not parque:
            continue
        for f in _listar(drive, sub["id"]):
            if f["mimeType"].endswith("folder"):
                continue
            tipo, raw = _baixar(drive, f)
            h, rows = _tabela(tipo, raw)
            for d, x in processar(parque, h, rows, ano, mes, f["name"], avisos).items():
                atual = por_dia.get((parque, d))
                if atual is None or f["modifiedTime"] > atual["mod"]:
                    por_dia[(parque, d)] = dict(x, arq=f["name"], mod=f["modifiedTime"])
    return por_dia, avisos


def processar(parque, h, rows, ano, mes, nome_arq, avisos):
    ix = {c: i for i, c in enumerate(h)}

    def g(r, c):
        i = ix.get(c)
        return r[i] if i is not None and i < len(r) else None

    card = "ORIGEM VENDA" in ix
    if not card and "CANAL_VENDA" not in ix:
        avisos.append(f"{nome_arq}: layout desconhecido, ignorado")
        return {}
    if card and parque != "A":
        avisos.append(f"{nome_arq}: arquivo do CARD na pasta do Paineiras, ignorado")
        return {}
    col_data = "DATA/HORA - UTILIZACAO" if card else ("DATA_UTILIZACAO" if "DATA_UTILIZACAO" in ix else "DATA_UTILIZADA")
    memo, dias = {}, {}
    for r in rows:
        raw = g(r, col_data)
        if raw not in memo:
            memo[raw] = para_data(raw)
        dt = memo[raw]
        if not dt or dt.year != ano or dt.month != mes:
            continue
        x = dias.setdefault(dt.day, {"trade": 0.0, "appai": 0.0, "esc": 0.0, "rec": 0.0, "ag": collections.Counter()})
        q = 1
        portal = PORTAL_TRADE_RE.search(" ".join(n(g(r, c)) for c in ("LOCAL DE VENDA", "BILHETE", "GRUPO DO BILHETE", "NOME INTERNO")))
        if card:
            if n(g(r, "ORIGEM VENDA")) == "POS" or (n(g(r, "GRUPO DO BILHETE")) != "TRADE" and not portal):
                continue
            b = n(g(r, "BILHETE"))
            x["trade"] += 1
            x["rec"] += num(g(r, "PRECO"))
            lv = str(g(r, "LOCAL DE VENDA") or "").strip()
            ag = "APPAI" if ("APPAI" in b or lv == regras.APPAI_LOCAL_VENDA) else ("" if lv in regras.INTERNOS else lv)
        elif parque == "A":
            local = n(g(r, "LOCAL_VENDA"))
            if not portal and (n(g(r, "CANAL_VENDA")) != "TRADE" or (local.startswith("POS") and local != "POS TRADE")):
                continue
            b = n(g(r, "NOME_BILHETE"))
            x["trade"] += 1
            x["rec"] += num(g(r, "VALOR"))
            ag = str(g(r, "NOME_AGENCIA") or "").strip()
            if "APPAI" in b or n(ag).startswith("ASSOCIACAO BENEF PROF PUBL"):
                ag = "APPAI"
        else:
            cat = n(g(r, "NOME_CATEGORIA"))
            ag = str(g(r, "NOME_AGENCIA") or "").strip()
            if "BINAMIK" in n(ag):
                continue
            if not (portal or n(g(r, "CANAL_VENDA")) == "TRADE" or any(k in cat for k in ("GUIA", "AGENCIA", "OPERADORA", "TRADE"))):
                continue
            q = num(g(r, "QTDE_TOTAL"))
            x["trade"] += q
            x["rec"] += num(g(r, "VALOR"))
            b = ""
        if parque == "A":
            if "APPAI" in b:
                x["appai"] += 1
            if "ESCOLA" in b:
                x["esc"] += 1
        if ag and ag != "APPAI" and (regras.deve_excluir(ag) or n(ag) in EXCLUIR_EXTRA):
            ag = ""
        if ag:
            x["ag"][ag if ag == "APPAI" else regras.normalizar(ag)] += q
    return dias


# ---------------------------------------------------------------- visitação do parque

def ler_visitacao(drive, ano, mes):
    """Linha 'Realizado 2026' dos blocos AquaRio e Paineiras na aba do mês (mesma leitura do
    parse_month_daily do Performance Dashboard)."""
    import openpyxl
    tipo, raw = _baixar(drive, {"id": VISITACAO_ID, "name": "visitacao.xlsx",
                                "mimeType": _exec(drive.files().get(fileId=VISITACAO_ID, fields="mimeType", supportsAllDrives=True))["mimeType"]})
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    aba = n(MESES[mes - 1])
    ws = next(wb[s] for s in wb.sheetnames if n(s) == aba)
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    ndias = calendar.monthrange(ano, mes)[1]
    out = {}
    for i, row in enumerate(rows):
        if not row or row[0] != "Realizado 2026":
            continue
        j = i - 1
        while j >= 0 and (not rows[j] or not rows[j][0] or rows[j][0] == "Ações"):
            j -= 1
        titulo = n(rows[j][0]) if j >= 0 else ""
        p = "A" if "AQUARIO" in titulo else "P" if "PAINEIRAS" in titulo else None
        if not p or any(k[0] == p for k in out):
            continue
        for d, v in enumerate(row[1:1 + ndias], start=1):
            if isinstance(v, (int, float)) and v > 0:
                out[(p, d)] = float(v)
    return out


# ---------------------------------------------------------------- grafia das agências

_PALPITE = (("�O ", "ÃO "), ("�ES ", "ÕES "), ("�A ", "ÇA "), ("�", ""))


def _chave(nome):
    s = "".join(c if c == "�" else unicodedata.normalize("NFKD", c).encode("ascii", "ignore").decode() for c in nome)
    return "".join(c for c in s.upper() if c.isalnum() or c == "�")


def resolvedor_grafia(conhecidos):
    """O Flux grava acento como caractere quebrado (U+FFFD). Casa o nome com a grafia que já
    está nas abas Top Clientes (sem acento e pontuação, o caractere quebrado vale qualquer
    letra). Só troca quando há exatamente 1 candidato; sem candidato, palpite pela terminação."""
    por_chave = {}
    for nome in conhecidos:
        if nome and "�" not in nome:
            por_chave.setdefault(_chave(nome), set()).add(nome)

    def resolver(nome):
        nome = GRAFIA.get(nome, nome)
        k = _chave(nome)
        if k in por_chave and len(por_chave[k]) == 1:
            return next(iter(por_chave[k]))
        if "�" in k:
            rx = re.compile("^" + re.escape(k).replace("�", "[A-Z]") + "$")
            cand = {nm for kk, nms in por_chave.items() if rx.match(kk) for nm in nms}
            if len(cand) == 1:
                return cand.pop()
            s = nome + " "
            for a, b in _PALPITE:
                s = s.replace(a, b)
            return s.strip()
        return nome
    return resolver


def montar_ranking(dados, ate, resolver=lambda x: x):
    tot = collections.defaultdict(lambda: [0.0, 0.0])
    for (p, dia), x in dados.items():
        if dia > ate:
            continue
        for ag, v in x["ag"].items():
            tot[resolver(ag)][0 if p == "A" else 1] += v
    return sorted(([k, round(a), round(b)] for k, (a, b) in tot.items() if round(a) + round(b) > 0),
                  key=lambda r: (-(r[1] + r[2]), r[0]))


# ---------------------------------------------------------------- principal

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mes", help="AAAA-MM (padrão: mês de ontem)")
    ap.add_argument("--out", default=os.path.join(AQUI, "..", "trade_diario.json"))
    a = ap.parse_args()
    hoje = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date()
    ontem = hoje - datetime.timedelta(days=1)
    ano, mes = (int(a.mes[:4]), int(a.mes[5:7])) if a.mes else (ontem.year, ontem.month)
    ult = calendar.monthrange(ano, mes)[1]
    limite = min(ult, ontem.day) if (ontem.year, ontem.month) == (ano, mes) else ult

    drive = drive_service()
    dados, avisos = ler_brutos_mes(drive, ano, mes)
    vis = ler_visitacao(drive, ano, mes)
    ate = 0
    for d in range(1, limite + 1):  # último dia com os dois parques, sem buraco desde o dia 1
        if ("A", d) in dados and ("P", d) in dados:
            ate = d
        else:
            break
    faltando = list(range(ate + 1, limite + 1))
    sem_parque = [d for d in range(1, ate + 1) if ("A", d) not in vis or ("P", d) not in vis]

    conhecidos = set(json.load(open(GRAFIAS_JSON, encoding="utf-8"))) if os.path.exists(GRAFIAS_JSON) else set()
    ranking = montar_ranking(dados, ate, resolvedor_grafia(conhecidos))
    protegidos = PROTEGIDOS.get((ano, mes), [])
    diario = []
    for d in range(1, ate + 1):
        if d in protegidos:
            continue
        linha = {"dia": d}
        for letra, (p, campo, _) in COLUNAS.items():
            linha[letra] = vis.get((p, d)) if campo == "parque" else round(dados[(p, d)][campo], 2)
        diario.append(linha)

    saida = {
        "versao": 1,
        "gerado_em": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mes": f"{ano}-{mes:02d}", "ate": ate, "limite": limite,
        "dias_faltando": faltando, "dias_sem_visitacao": sem_parque, "protegidos": protegidos,
        "aba_diario": f"Diário {ABREV[mes - 1]}{str(ano)[2:]}",
        "aba_top": f"Top Clientes-{ABREV[mes - 1]}",
        "cabecalhos": {k: v[2] for k, v in COLUNAS.items()},
        "diario": diario,
        "top": {"subtitulo": f"AquaRio · Paineiras Corcovado | {ABREV[mes - 1]}/{ano} (01 a {ate:02d}/{mes:02d})" if ate else "",
                "linhas": ranking},
        "arquivos": {f"{p}{d:02d}": x["arq"] for (p, d), x in sorted(dados.items())},
        "avisos": avisos,
    }
    # só regrava se o conteúdo mudou (gerado_em fica igual), para o Apps Script não republicar à toa
    antigo = json.load(open(a.out, encoding="utf-8")) if os.path.exists(a.out) else {}
    if {k: v for k, v in antigo.items() if k != "gerado_em"} == {k: v for k, v in saida.items() if k != "gerado_em"}:
        print("Sem mudanças em relação ao trade_diario.json atual")
    else:
        json.dump(saida, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        json.dump(sorted(conhecidos | {r[0] for r in ranking}), open(GRAFIAS_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{saida['aba_diario']}: dados até {ate:02d}/{mes:02d}" + (f"; faltam {faltando}" if faltando else "")
          + (f"; sem visitação do parque em {sem_parque}" if sem_parque else ""))
    print(f"{saida['aba_top']}: {len(ranking)} agências, AquaRio {sum(r[1] for r in ranking):,}, Paineiras {sum(r[2] for r in ranking):,}")
    for w in avisos:
        print("AVISO:", w)


if __name__ == "__main__":
    main()
