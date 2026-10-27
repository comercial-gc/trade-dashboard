"""Pedidos (LB) do Paineiras que o CARD classifica como Trade -> trade_pai_card.json (raiz do repositório).

27/10/2026, pedido do Paulo: o Portal do Agente ("Cristo Redentor | Portal do agente", bilhete "Paineiras
Avulso - Trade", Grupo do Bilhete Trade) chega no Flux do Drive como CANAL_VENDA ECOMMERCE, sem agência e
idêntico à venda do site. Em ago e set o Trade oficial (planilha da Bia/Nikolas, feita pelo CARD) contava
esses bilhetes; a rotina automática, que só lê o Flux, deixava fora ~9,2 mil em out/26. O trade_diario.py
passa a contar como Trade todo LB desta lista.

A lista vem das exportações do CARD Limber do Paineiras (a tarefa diária fundo-rj-diario exporta os
últimos 3 dias de utilização com o modelo "IGETECH - SISTEMAS"; também aceita a exportação completa).
Trade = Grupo do Bilhete Trade ou Portal Service/Condutores, fora do POS e fora de pedido cancelado.

Uso: python scripts/trade_pai_card.py arquivo1.xlsx [arquivo2.xlsx ...]
"""
import datetime
import json
import os
import re
import sys
import unicodedata

import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "trade_pai_card.json")
PORTAL_TRADE_RE = re.compile(r"PORTAL SERVICE|CONDUTOR|CAR SERVICE")
# Local de Venda do CARD -> agência como vem no Flux (o Flux não traz agência nesses pedidos);
# venda do Comercial do Paineiras fica sem agência, como já acontece no Top Clientes
LOCAL_AGENCIA = {"GET YOUR GUIDE": "GETYOURGUIDE DEUTSCHLAND GMBH"}


def n(x):
    s = unicodedata.normalize("NFD", str(x or "")).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())


def ler(caminho):
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    linhas = ws.iter_rows(values_only=True)
    h = [n(c) for c in next(linhas)]
    ix = {c: i for i, c in enumerate(h)}
    for obrig in ("LOCALIZADOR", "LOCAL DE VENDA", "GRUPO DO BILHETE", "BILHETE"):
        if obrig not in ix:
            raise SystemExit(f"{caminho}: sem a coluna {obrig}; layout diferente do esperado")
    g = lambda r, c: r[ix[c]] if c in ix and ix[c] < len(r) else None
    lbs, total, paineiras = {}, 0, 0
    for r in linhas:
        lb = n(g(r, "LOCALIZADOR"))
        if not lb:
            continue
        total += 1
        destino = n(g(r, "ESTABELEC. DESTINO") or g(r, "RECEITA"))
        if destino and "PAINEIRAS" not in destino:
            continue
        paineiras += 1
        if "CANCELADA" in n(g(r, "STATUS")):
            continue
        pos = n(g(r, "ORIGEM VENDA")) == "POS" if "ORIGEM VENDA" in ix else bool(n(g(r, "TICK - NOME")))
        local = n(g(r, "LOCAL DE VENDA"))
        portal = PORTAL_TRADE_RE.search(" ".join(n(g(r, c)) for c in ("LOCAL DE VENDA", "NOME ECOMMERCE DE ORIGEM", "BILHETE", "NOME INTERNO")))
        if pos or not (n(g(r, "GRUPO DO BILHETE")) == "TRADE" or portal):
            continue
        lbs[lb] = LOCAL_AGENCIA.get(local, "")
    print(f"{os.path.basename(caminho)}: {total} linhas, {paineiras} do Paineiras, {len(lbs)} pedidos Trade")
    return lbs


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    base = json.load(open(SAIDA, encoding="utf-8")) if os.path.exists(SAIDA) else {"lbs": {}}
    antes = len(base["lbs"])
    for arq in sys.argv[1:]:
        base["lbs"].update(ler(arq))
    base["atualizado_em"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    base["lbs"] = dict(sorted(base["lbs"].items()))
    json.dump(base, open(SAIDA, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"trade_pai_card.json: {len(base['lbs'])} pedidos ({len(base['lbs']) - antes:+d})")


if __name__ == "__main__":
    main()
