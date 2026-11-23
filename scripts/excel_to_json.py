#!/usr/bin/env python3
"""Lee el Excel semanal (WOR) y genera data/data.json para el dashboard.
Uso:  python scripts/excel_to_json.py "WOR 231026-291026.xlsx" data/data.json
Si data.json ya existe, la semana nueva se AGREGA al historial (o reemplaza si ya estaba)."""
import sys, json, os, datetime as dt
import openpyxl

UPTHRUST = ["B18", "B19", "B4"]          # editar cada semana si cambia (dato manual del reporte)
SHUTDOWN = ["B12", "B2"]                 # pozos apagados por falla ESP (dato manual)

def iso(d): return d.strftime("%Y-%m-%d")
def r(x, n=2): return None if x is None else round(float(x), n)

def main(xlsx, out):
    wb = openpyxl.load_workbook(xlsx, data_only=True)

    # ---- Producción diaria de la semana
    ws = wb["Production and Pumping"]
    days = []
    for row in ws.iter_rows(min_row=5, max_row=11, values_only=True):
        if isinstance(row[0], dt.datetime):
            days.append(dict(date=iso(row[0]), oil=r(row[1]), water=r(row[2]), fluid=r(row[3]),
                             gas=r(row[4]), wc=r(row[5]), deliv=r(row[6]), bsw=r(row[7], 5)))
    n = len(days)
    avg = lambda k: r(sum(d[k] for d in days) / n)
    # ---- Serie mensual 2026 (todos los bloques "Monthly Report")
    daily2026 = []
    for row in ws.iter_rows(min_row=19, max_row=300, values_only=True):
        if isinstance(row[0], dt.datetime) and row[1] is not None:
            daily2026.append([iso(row[0]), r(row[1]), r(row[2]), r(row[3]), r(row[4]), r(row[5])])
    # ---- Forecast mensual
    ws = wb["FORECAST"]
    forecast = []
    for row in ws.iter_rows(min_row=4, max_row=90, values_only=True):
        if isinstance(row[0], dt.datetime):
            forecast.append(dict(m=row[0].strftime("%Y-%m"), actual=r(row[1]), plan=r(row[2]),
                                 fulfil=r(row[3], 4), original=r(row[4])))
    # ---- Run life
    ws = wb["RLD"]
    rld = []
    for row in ws.iter_rows(min_row=4, max_row=22, values_only=True):
        if row[1]:
            w = str(row[1]).strip()
            rld.append(dict(well=w, pump=str(row[2]).strip(), start=iso(row[3]), end=iso(row[4]),
                            days=int((row[4] - row[3]).days + 1), target=row[6],
                            status=("shutdown" if w in SHUTDOWN else "upthrust" if w in UPTHRUST else "ok")))
    # ---- Pérdidas de la semana (fechas dentro de la semana)
    d0, d1 = days[0]["date"], days[-1]["date"]
    losses = []
    for row in wb["Produccion Losses"].iter_rows(values_only=True):
        for i, c in enumerate(row[:3]):
            if isinstance(c, dt.datetime) and d0 <= iso(c) <= d1:
                well = row[i + 1]
                if well and (row[i + 2] or row[i + 3]):
                    losses.append(dict(date=iso(c), well=str(well).strip(), rec=r(row[i + 2]),
                                       nonrec=r(row[i + 3]), note=str(row[i + 4] or "")))
                break
    # ---- Agua inyectada
    ws = wb["BSW"]
    inj = []
    for row in ws.iter_rows(min_row=5, max_row=11, values_only=True):
        if isinstance(row[1], dt.datetime):
            inj.append(dict(date=iso(row[1]), a10=r(row[2], 0), p10=r(row[3], 0), sst10=r(row[4], 0), oil10=r(row[5], 0),
                            a11=r(row[6], 0), p11=r(row[7], 0), sst11=r(row[8], 0), oil11=r(row[9], 0)))
    # ---- Gas
    gas = []
    for row in wb["GAS"].iter_rows(min_row=4, max_row=10, values_only=True):
        if isinstance(row[1], dt.datetime):
            gas.append(dict(date=iso(row[1]), fuel=r(row[4]), produced=r(row[5]), flared=r(row[6])))

    rs = wb["RLD"]
    rldStats = dict(upthrust=r(rs["E25"].value, 4), downthrust=r(rs["E26"].value, 4), inrange=r(rs["E27"].value, 4))
    bs = wb["BSW"]
    k = len(inj)
    mean = lambda key: r(sum(x[key] for x in inj) / k, 0)
    injSummary = dict(
        a10=dict(water=mean("a10"), psi=mean("p10"), sst=mean("sst10"), oil=mean("oil10")),
        a11=dict(water=mean("a11"), psi=mean("p11"), sst=mean("sst11"), oil=mean("oil11")),
        salinity=r(bs["H17"].value, 0))
    fuel = sum(g["fuel"] for g in gas); prod = sum(g["produced"] for g in gas); flared = sum(g["flared"] for g in gas)
    gasSummary = dict(fuel=r(fuel), produced=r(prod), flared=r(flared), fuelPerDay=r(fuel / len(gas)),
                      fuelPct=r(fuel / prod * 100), flaredPct=r(flared / prod * 100), microturbine=0)

    week = dict(id=f"{d0}_{d1}", start=d0, end=d1, days=days,
                avg=dict(oil=avg("oil"), water=avg("water"), fluid=avg("fluid"), gas=avg("gas"),
                         wc=avg("wc"), deliv=avg("deliv"), bsw=r(sum(d["bsw"] for d in days) / n * 100, 3)),
                rld=rld, rldStats=rldStats, losses=losses, injection=inj, injSummary=injSummary,
                gas=gas, gasSummary=gasSummary, source="excel")
    hist = {"weeks": []}
    if os.path.exists(out):
        hist = json.load(open(out, encoding="utf-8"))
    here = os.path.dirname(os.path.abspath(out))
    manual = []
    mdir = os.path.join(here, "manual")                      # semanas cargadas a mano (p.ej. desde PDF)
    if os.path.isdir(mdir):
        for fn in sorted(os.listdir(mdir)):
            if fn.endswith(".json"):
                manual.append(json.load(open(os.path.join(mdir, fn), encoding="utf-8")))
    manual = [m for m in manual if m["id"] != week["id"]]    # el Excel real reemplaza a una semana manual
    hist["weeks"] = [w for w in hist["weeks"] if w["id"] != week["id"] and w["id"] not in {m["id"] for m in manual}] + [week] + manual
    hist["weeks"].sort(key=lambda w: w["start"])
    npath = os.path.join(here, "notes.json")                  # novedades de la semana (texto del WOR)
    notes = json.load(open(npath, encoding="utf-8")) if os.path.exists(npath) else {}
    for w in hist["weeks"]:
        v = notes.get(w["id"], {})
        if isinstance(v, list): v = {"notes": v}
        w["notes"] = v.get("notes", w.get("notes", []))
        w["comments"] = v.get("comments", w.get("comments", {}))
        w["areas"] = v.get("areas", w.get("areas", {}))
    hist["forecast"] = forecast
    hist["daily2026"] = daily2026
    hist["generated"] = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    json.dump(hist, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(here, "data.js"), "w", encoding="utf-8") as f:
        f.write("window.DASH_DATA = " + json.dumps(hist, ensure_ascii=False) + ";\n")
    print("OK ->", out, "| semanas:", [w["id"] for w in hist["weeks"]])

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
