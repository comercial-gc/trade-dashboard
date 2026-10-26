# -*- coding: utf-8 -*-
"""Garante que o index.html do Trade Dashboard carregue o trade_patch.js (13/10/2026) e o
trade_v2.js (26/10/2026, abas OBZ / Indicadores Parques / Origem / Oportunidades e subaba Carteira).

O index.html é regerado pelo Apps Script (Trade Dashboard.gs) todo dia às 18h e a cada
atualização manual; se os carregadores não estiverem no HTML gerado, as correções da aba
Top Clientes e as abas novas somem. Este script (rodado pelo workflow injetar-patch.yml a cada
push no index.html) coloca antes do </body> o carregador que estiver faltando."""
import sys

SCRIPTS = ["trade_patch.js", "trade_v2.js"]


def loader(nome):
    return ('<script>(function(){var s=document.createElement("script");'
            f's.src="https://comercial-gc.github.io/trade-dashboard/{nome}?v="+Date.now();'
            'document.body.appendChild(s);})();</script>')


p = "index.html"
s = open(p, encoding="utf-8").read()
faltando = [n for n in SCRIPTS if n not in s]
if not faltando:
    print("carregadores já presentes")
    sys.exit(0)
i = s.rfind("</body>")
if i < 0:
    print("ERRO: index.html sem </body>")
    sys.exit(1)
s = s[:i] + "".join(loader(n) + "\n" for n in faltando) + s[i:]
open(p, "w", encoding="utf-8").write(s)
print("carregador inserido: " + ", ".join(faltando))
