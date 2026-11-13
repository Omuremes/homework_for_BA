"""
Действия для закупок на основе output/inventory_october.csv и forecast.csv.
Запуск из корня проекта после run_sql.py и forecast/forecast.py:
    python analysis/actions.py

1. transfer_plan.csv    — излишек OVERSTOCK-пары перебрасывается на склады, где тот же SKU ниже цели
                          (в первую очередь туда, где покрытие меньше).
2. replenishment.csv    — сколько докупить до целевого запаса после переброски (OK и OOS пары).
"""
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "output"
inv = pd.read_csv(OUT / "inventory_october.csv")

inv["gap_units"] = (inv.target_stock_units - inv.on_hand_units_eod).where(inv.status.isin(["OK", "OOS"])).clip(lower=0)

transfers = []
for sku, g in inv.groupby("sku_id"):
    excess = {r.warehouse_name: r.excess_units for r in g.itertuples() if r.excess_units > 0}
    for d in g[g.gap_units > 0].sort_values("cover_days").itertuples():
        need = d.gap_units
        for src in sorted(excess, key=excess.get, reverse=True):
            qty = min(need, excess[src])
            if qty <= 0:
                continue
            transfers.append({"sku_id": sku, "product_name": d.product_name, "category": d.category,
                              "from_warehouse": src, "to_warehouse": d.warehouse_name,
                              "units": int(qty), "value_kgs": qty * d.unit_cost_kgs,
                              "to_cover_days_before": d.cover_days, "to_oos_days_oct": d.oos_days_oct})
            excess[src] -= qty
            need -= qty

transfer_plan = pd.DataFrame(transfers).sort_values("value_kgs", ascending=False)
transfer_plan.to_csv(OUT / "transfer_plan.csv", index=False)

received = transfer_plan.groupby(["sku_id", "to_warehouse"]).units.sum()
rep = inv[inv.gap_units > 0].copy()
rep["transfer_in_units"] = [received.get((r.sku_id, r.warehouse_name), 0) for r in rep.itertuples()]
rep["buy_units"] = rep.gap_units - rep.transfer_in_units
rep["buy_value_kgs"] = rep.buy_units * rep.unit_cost_kgs
rep = rep[["sku_id", "product_name", "category", "warehouse_name", "status", "on_hand_units_eod",
           "daily_sales_rate", "cover_days", "target_cover_days", "target_stock_units", "oos_days_oct",
           "gap_units", "transfer_in_units", "buy_units", "buy_value_kgs"]].sort_values(["cover_days", "buy_value_kgs"], ascending=[True, False])
rep.to_csv(OUT / "replenishment.csv", index=False)

print("Переброски:", len(transfer_plan), "строк,", int(transfer_plan.units.sum()), "ед.,",
      round(transfer_plan.value_kgs.sum() / 1e6, 2), "млн KGS")
print(transfer_plan.to_string(index=False))
print("\nДокупка до цели после переброски:", int(rep.buy_units.sum()), "ед.,",
      round(rep.buy_value_kgs.sum() / 1e6, 2), "млн KGS; пар:", int((rep.buy_units > 0).sum()))
print("Пары OK/OOS с покрытием < 7 дней:", int((rep.cover_days < 7).sum()))
print(rep.head(15).to_string(index=False))
