# -*- coding: utf-8 -*-
"""Gera trade_unificadas.json: as agências que a tabela CANONICAL (trade_regras_agencias.py) forma juntando 2 ou mais
nomes de origem, com a lista dos nomes. O balão do Dash (trade_agtip.js) usa o arquivo para mostrar, em cada agência
unificada na origem, quais nomes a compõem (essas junções acontecem antes do dado chegar ao Dash, então o volume de cada
nome não existe mais; o balão mostra os nomes, sem divisão de volume).

Rodar de novo sempre que o CANONICAL mudar:  python scripts/gerar_unificadas.py
Grafias que só diferem em maiúscula, acento, pontuação, "&" x "E" ou sufixo societário contam como um nome só."""
import json, os, re, sys, unicodedata, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import trade_regras_agencias as regras  # noqa: E402

SUF = re.compile(r"\b(LTDA|LIMITADA|ME|EPP|EIRELI|EIRELLI|SA|S A|SOCIEDADE ANONIMA)\b")


def chave(n):
    s = unicodedata.normalize("NFD", str(n or "").replace("�", ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper().replace("&", " E ")
    s = re.sub(r"\d{8,}", " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = SUF.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def principal(variantes):
    # entre as grafias do mesmo nome, a que está em maiúsculas e é mais completa
    return sorted(variantes, key=lambda v: (v != v.upper(), -len(v), v))[0].strip().rstrip(".")


def main():
    grupos = {}
    for bruto, canonico in regras.CANONICAL.items():
        grupos.setdefault(canonico, []).append(bruto)
    saida = []
    for canonico in sorted(grupos):
        por_chave = {}
        for b in grupos[canonico]:
            por_chave.setdefault(chave(b), []).append(b)
        nomes = sorted(principal(v) for v in por_chave.values())
        # grafia com acento quebrado no bruto (U+FFFD) é a mesma de outra grafia correta: sai da lista
        if any("�" not in n for n in nomes):
            nomes = [n for n in nomes if "�" not in n]
        nomes = list({chave(n): n for n in nomes}.values())
        if len(nomes) < 2:
            continue
        saida.append({"canonico": canonico, "nomes": sorted(nomes)})
    destino = os.path.join(os.path.dirname(AQUI), "trade_unificadas.json")
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"geradoEm": datetime.date.today().isoformat(), "grupos": saida}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(saida)} agências com 2+ nomes de origem gravadas em {destino}")


if __name__ == "__main__":
    main()
