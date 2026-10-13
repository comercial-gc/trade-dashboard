# -*- coding: utf-8 -*-
"""Garante que o index.html do Trade Dashboard carregue o trade_patch.js (13/10/2026).

O index.html é regerado pelo Apps Script (Trade Dashboard.gs) todo dia às 18h e a cada
atualização manual; se o carregador do patch não estiver no HTML gerado, as correções da aba
Top Clientes somem. Este script (rodado pelo workflow injetar-patch.yml a cada push no
index.html) coloca o carregador antes do </body> quando ele não está lá."""
import sys

MARCA = "trade_patch.js"
LOADER = ('<script>(function(){var s=document.createElement("script");'
          's.src="https://comercial-gc.github.io/trade-dashboard/trade_patch.js?v="+Date.now();'
          'document.body.appendChild(s);})();</script>')

p = "index.html"
s = open(p, encoding="utf-8").read()
if MARCA in s:
    print("carregador já presente")
    sys.exit(0)
i = s.rfind("</body>")
if i < 0:
    print("ERRO: index.html sem </body>")
    sys.exit(1)
s = s[:i] + LOADER + "\n" + s[i:]
open(p, "w", encoding="utf-8").write(s)
print("carregador inserido")
