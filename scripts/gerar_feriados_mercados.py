"""Gera feriados_mercados.json (Trade Dashboard, aba Origem): feriados nacionais dos países que
mais mandam visitantes para AquaRio e Paineiras, 2025 a 2027, pela biblioteca `holidays`."""
import json, datetime as dt, holidays
PAISES = {  # nome como vem na coluna PAIS do bruto -> código ISO
    "Brasil": "BR", "Argentina": "AR", "Chile": "CL", "Colômbia": "CO", "Peru": "PE", "Uruguai": "UY",
    "Paraguai": "PY", "Equador": "EC", "Bolívia": "BO", "México": "MX", "Estados Unidos": "US", "Canadá": "CA",
    "Alemanha": "DE", "França": "FR", "Reino Unido": "GB", "Espanha": "ES", "Itália": "IT", "Portugal": "PT",
    "Holanda": "NL", "Suíça": "CH", "Bélgica": "BE", "Africa Do Sul": "ZA", "Austrália": "AU", "Israel": "IL",
    "Venezuela": "VE", "Japão": "JP", "China": "CN", "Coreia Do Sul": "KR", "Índia": "IN", "Áustria": "AT",
    "Suécia": "SE", "Noruega": "NO", "Dinamarca": "DK", "Irlanda": "IE", "Polônia": "PL",
}
out = {"geradoEm": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"),
       "fonte": f"biblioteca python-holidays {holidays.__version__}: só feriados nacionais (sem regionais)",
       "paises": {}}
for nome, iso in PAISES.items():
    lst = []
    for ano in (2025, 2026, 2027):
        h = None
        for lang in (("pt_BR",) if iso == "BR" else ("en_US",)) + (None,):
            try:
                h = holidays.country_holidays(iso, years=ano, language=lang) if lang else holidays.country_holidays(iso, years=ano)
                break
            except Exception:
                continue
        for d, n in sorted(h.items()):
            lst.append([d.isoformat(), n])
    out["paises"][nome] = {"iso": iso, "feriados": lst}
json.dump(out, open("feriados_mercados.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print({k: len(v["feriados"]) for k, v in out["paises"].items()})
