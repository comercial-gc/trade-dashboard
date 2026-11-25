# -*- coding: utf-8 -*-
"""Gera trade_contratos.json (rodar de novo quando a GEFIT mandar clientes faturados novos: edite as listas F e A abaixo): tipo de contrato dos clientes do Trade, a partir do e-mail da Thayane Araujo (GEFIT, 24/11/2026)
encaminhado pela Paula Bottino em 25/11/2026. Faturados = a lista do e-mail; Adiantamento Fixo = GRAMADO PARKS e W40;
os demais ficam "Sem Categoria" (calculado na tela). Cada cliente traz todos nomes que o Dash usa para ele (razão social,
grafias do Top Clientes, do CARD e do bruto, e os nomes que as regras de unificação juntam), porque o Dash não tem CNPJ."""
import json, os, sys

F = [
    ("09.323.625/0001-69", "Bealocal Tours Operadora Ltda", ["BE A LOCAL TOURS", "BEALOCAL TOURS OPERADORA LTDA", "BE A LOCAL"]),
    ("01.365.194/0001-91", "BEST WAY TRIPS AGENCIA DE VIAGENS E TURISMO LTDA", ["BEST WAY TRIPS"]),
    ("07.741.441/0001-93", "BILHETERIA.COM PRODUCOES E PROMOCOES LTDA ME", ["BILHETERIA.COM PRODUÇÕES E PROMOÇÕES", "BILHETERIA COM"]),
    ("20.345.191/0001-30", "BRAZIL CONECTION AGENCIA DE VIAGENS LTDA - EPP", ["BRAZIL CONNECTION TURISMO RECEPTIVO LTDA", "BRAZIL CONNECTION", "BRAZIL CONECTION"]),
    ("07.713.155/0001-14", "Brazil Expedition Passeios Turísticos Me Ltda", ["BRAZIL EXPEDITION PASSEIOS TURISTICOS LTDA"]),
    ("13.146.834/0001-51", "CLUB WEB SERVICOS DIGITAIS LTDA - ME", ["CLUB WEB SERVIÇOS DIGITAIS LTDA"]),
    ("27.361.663/0001-98", "DIO BERKANA VIAGENS E TURISMO LTDA", []),
    ("11.428.529/0001-27", "FERIAS RIO VIAGENS E TURISMO LTDA", ["FERIAS TURISMO"]),
    ("02.447.633/0001-78", "HYD BRAZILIAN TOURS VIAGENS LTDA", ["IN BUZIOS", "HYD BRAZILIAN TOURS / IN BUZIOS"]),
    ("01.957.456/0001-07", "INTERTOURING RECEPTIVO AG DE VIAGENS E TURISMO LTDA", ["INTERTOURING-AGENCIA DE VIAGEM E TURISMO LTDA", "INTERTOURING AG. DE VIAG. E TUR. LTDA."]),
    ("07.426.439/0001-20", "JS AGENCIAS DE VIAGENS E TURISMO LTDA", ["PASSEIO RIO", "PASSEIO RIO TURISMO"]),
    ("06.166.683/0001-38", "LATIN RIO TRAVEL - AGENCIA DE TURISMO LTDA", ["LATIN RIO TRAVEL", "LATIN RIO"]),
    ("40.434.458/0001-73", "PROMOTIONAL TRAVEL VIAGENS E TURISMO LTDA", []),
    ("28.276.737/0001-50", "RIO RADICAL ECOTURISMO LTDA.", ["RIO RADICAL TURISMO DE AVENTURA LTDA"]),
    ("32.455.796/0001-63", "SOBRE TERRA & CIA LTDA - ME", ["JEEP TUOR / SOBRE TERRA", "JEEP TUOR", "SOBRE TERRA E CIA LTDA"]),
    ("31.675.132/0001-47", "THE IFRIEND INTERMEDIACAO DE NEGOCIOS LTDA - EPP", []),
    ("51.977.055/0001-97", "TRAVEL & EXPERIENCES RJ LTDA ME", ["TRAVEL E EXPERIENCES RJ LTDA"]),
    ("00.358.207/0001-32", "Via Capi Viagens e Turismo LTDA", ["VIA CAPI", "VIA-CAPI"]),
    ("05.873.416/0001-38", "C2 RIO VIAGENS E TURISMO LTDA - ME", ["C2 RIO VIAGENS E TURISMO S.A.", "C2RIO TOURS & TRAVEL"]),
    ("51.919.821/0001-67", "PROGRAMA DE PONTOS 6WINGS LTDA", []),
    ("25.276.911/0001-77", "MARINA MASCARENHAS KNAUER PENEDO VIAGENS TURISMO E EVENTOS LTDA ME", ["MARINA MASCARENHAS KNAUER PENEDO VIAGENS, TURISMO"]),
    ("37.766.450/0001-08", "BRIAN LIMA DA SILVA CORRESPONDENTE FINANCEIRO LTDA ME", ["Go Now", "GO NOW TOURS", "BRIAN LIMA DA SILVA"]),
    ("10.335.415/0001-70", "INGRESSO COM DESCONTO LTDA ME", ["ICD - INGRESSO COM DESCONTO", "ICD"]),
    ("54.801.401/0001-70", "ONERIO PASS INGRESSOS E ACESSOS LTDA", ["ONERIO PASS INGRESSOS E ACESSOS", "API - ONE RIO"]),
    ("11.805.397/0021-59", "BEACH PARK HOTEIS E TURISMO S/A", []),
    ("09.489.355/0001-60", "BRAZIL4YOU OPERADORA RECEPTIVA LTDA", ["Brazil4You", "BRASIL SHOW TURISMO LTDA", "BRASIL SHOW", "BRAZIL SHOW TURISMO",
                                                                 "GRAY LINE", "GRAY LINE BRAZIL", "BRASIL VIAGEM OPERADORA DE TURISMO LTDA"]),
    ("05.949.330/0001-41", "CARIOCA TROPICAL", ["CARIOCA TROPICAL TURISMO LTDA"]),
]
A = [
    ("GRAMADO PARKS", ["GRAMADO PROMOÇÃO DE VENDAS", "GRAMADO PROMOÇÃO DE VENDAS LTDA", "GRAMADO PROMOCAO DE VENDAS S.A.", "GRAMADO PROMOCAO DE VENDAS", "GRAMADO PARKS"]),
    ("W40", ["W 40 EMPREENDIMENTOS IMOBILIARIOS LTDA", "W 40 EMPREENDIMENTOS IMOBILIÁRIOS", "W40"]),
]
clientes = [{"contrato": "Faturados", "cnpj": c, "razao": r, "nomes": n} for c, r, n in F]
clientes += [{"contrato": "Adiantamento Fixo", "razao": r, "nomes": n} for r, n in A]
out = {
    "_descricao": "Tipo de contrato dos clientes do Trade. Faturados = lista da GEFIT; Adiantamento Fixo = GRAMADO PARKS e W40; os demais "
                  "são Sem Categoria (calculado na tela). Nomes = todas as grafias que o Dash usa para o cliente.",
    "fonte": "E-mail de Thayane Araujo (GEFIT) de 24/11/2026, encaminhado por Paula Bottino em 25/11/2026 (assunto: Categoria de clientes)",
    "geradoEm": "2026-11-25",
    "contratos": ["Faturados", "Adiantamento Fixo", "Sem Categoria"],
    "clientes": clientes,
}
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "trade_contratos.json")
with open(dest, "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(len(F), "faturados,", len(A), "adiantamento fixo ->", dest)
