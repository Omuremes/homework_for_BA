"""
Прогноз продаж (SALE, до возвратов) по SKU суммарно по складам, ноябрь 2026 – октябрь 2027.

Запуск из корня проекта после run_sql.py (берёт очищенные таблицы из output/analytics.duckdb):
    python forecast/forecast.py

Методы:
  1. Базовый (seasonal naive): прогноз месяца = факт того же месяца годом ранее.
  2. Seasonal naive × годовой рост SKU: факт того же месяца годом ранее, умноженный на
     коэффициент роста SKU = продажи за последние 6 месяцев истории / те же 6 месяцев годом ранее
     (ограничен диапазоном 0,5–2,0, при нулевом знаменателе = 1).

Проверка: история по 2026-07 включительно, сравнение с фактом 2026-08…2026-10, WAPE по всем SKU × месяцам.
"""
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"

GROWTH_WINDOW = 6
GROWTH_CLIP = (0.5, 2.0)

con = duckdb.connect(str(OUT / "analytics.duckdb"), read_only=True)
products = con.execute("SELECT sku_id, product_name, category FROM products").df()
sales = con.execute("""
    SELECT sku_id, DATE_TRUNC('month', sale_date)::DATE AS month, SUM(quantity) AS units
    FROM sales WHERE operation = 'SALE' GROUP BY ALL
""").df()
pair_daily = con.execute("""
    SELECT d.sku_id, d.warehouse_id, i.snapshot_date, i.on_hand_units,
           COALESCE(s.units, 0) AS sale_units
    FROM inventory_daily i
    JOIN dim_pairs d USING (sku_id, warehouse_id)
    LEFT JOIN (SELECT sku_id, warehouse_id, sale_date, SUM(quantity) AS units
               FROM sales WHERE operation = 'SALE' GROUP BY ALL) s
           ON s.sku_id = i.sku_id AND s.warehouse_id = i.warehouse_id AND s.sale_date = i.snapshot_date
""").df()
con.close()

# Матрица SKU × месяц, месяцы без продаж = 0
sales["month"] = pd.to_datetime(sales["month"]).dt.to_period("M")
hist_months = pd.period_range("2024-11", "2026-10", freq="M")
Y = (sales.pivot_table(index="sku_id", columns="month", values="units", aggfunc="sum")
          .reindex(index=products.sku_id.sort_values(), columns=hist_months).fillna(0))


def seasonal_naive(hist: pd.DataFrame, months) -> pd.DataFrame:
    return pd.DataFrame({m: hist[m - 12] for m in months})


def growth_factor(hist: pd.DataFrame, last: pd.Period, window: int = GROWTH_WINDOW) -> pd.Series:
    recent = pd.period_range(last - window + 1, last, freq="M")
    num, den = hist[recent].sum(axis=1), hist[recent - 12].sum(axis=1)
    g = (num / den.replace(0, np.nan)).fillna(1.0)
    return g.clip(*GROWTH_CLIP)


def seasonal_growth(hist: pd.DataFrame, last: pd.Period, months, window: int = GROWTH_WINDOW) -> pd.DataFrame:
    return seasonal_naive(hist, months).mul(growth_factor(hist, last, window), axis=0)


def wape(forecast: pd.DataFrame, actual: pd.DataFrame) -> float:
    return float((forecast - actual).abs().to_numpy().sum() / actual.to_numpy().sum() * 100)


# ---------------- Проверка на август–октябрь 2026 ----------------
train_end = pd.Period("2026-07", "M")
val_months = pd.period_range("2026-08", "2026-10", freq="M")
train = Y.loc[:, :train_end]
actual = Y[val_months]

fc_base = seasonal_naive(train, val_months)
fc_growth = seasonal_growth(train, train_end, val_months)

wape_tbl = pd.DataFrame([
    {"method": "1. Базовый: факт того же месяца год назад", "wape_pct": wape(fc_base, actual)},
    {"method": f"2. Тот же месяц год назад × рост SKU за {GROWTH_WINDOW} мес.", "wape_pct": wape(fc_growth, actual)},
])

# Чувствительность выбора окна роста — для пояснения выбора
sens = pd.DataFrame([{"growth_window_months": k,
                      "wape_pct": wape(seasonal_growth(train, train_end, val_months, k), actual)} for k in (3, 6, 9)])

backtest = (pd.concat({"actual_units": actual.stack(), "baseline_units": fc_base.stack(),
                       "method2_units": fc_growth.stack()}, axis=1)
              .rename_axis(["sku_id", "month"]).reset_index())
backtest["month"] = backtest["month"].dt.to_timestamp().dt.date
backtest["baseline_abs_err"] = (backtest.baseline_units - backtest.actual_units).abs()
backtest["method2_abs_err"] = (backtest.method2_units - backtest.actual_units).abs()

# ---------------- Влияние дефицита на факт ----------------
# Упущенные продажи пары в день OOS ≈ средние продажи в дни с остатком за предыдущие 180 дней.
pair_daily["snapshot_date"] = pd.to_datetime(pair_daily["snapshot_date"])
pair_daily = pair_daily.sort_values(["sku_id", "warehouse_id", "snapshot_date"])
pair_daily["in_stock"] = (pair_daily.on_hand_units > 0).astype(int)
# день считаем «в наличии», если остаток на конец предыдущего дня > 0
pair_daily["avail"] = pair_daily.groupby(["sku_id", "warehouse_id"]).in_stock.shift(1).fillna(1)
g = pair_daily.groupby(["sku_id", "warehouse_id"])
roll = lambda col: g[col].transform(lambda s: s.shift(1).rolling(180, min_periods=30).sum())
pair_daily["rate_instock"] = (roll("sale_units") / roll("avail").replace(0, np.nan)).fillna(0)
pair_daily["lost_units"] = np.where(pair_daily.avail == 0, pair_daily.rate_instock, 0.0)
pair_daily["month"] = pair_daily.snapshot_date.dt.to_period("M")

lost_val = pair_daily[pair_daily.month.isin(val_months)]
lost_by_month = lost_val.groupby("month").lost_units.sum()
lost_by_pair = (lost_val.groupby(["sku_id", "warehouse_id"])
                .agg(oos_days=("avail", lambda s: int((s == 0).sum())), lost_units=("lost_units", "sum"))
                .query("lost_units > 0").sort_values("lost_units", ascending=False).reset_index())
lost_by_pair["lost_units"] = lost_by_pair.lost_units.round(0)

# ---------------- Итоговый прогноз: история по 2026-10 ----------------
hist_end = pd.Period("2026-10", "M")
fc_months = pd.period_range("2026-11", "2027-10", freq="M")
final = seasonal_growth(Y, hist_end, fc_months)
g_final = growth_factor(Y, hist_end)

forecast = (final.stack().rename("forecast_units").rename_axis(["sku_id", "forecast_month"]).reset_index())
forecast["forecast_month"] = forecast.forecast_month.dt.to_timestamp().dt.date
forecast["forecast_units"] = forecast.forecast_units.round(0).astype(int)
forecast = forecast[["forecast_month", "sku_id", "forecast_units"]].sort_values(["forecast_month", "sku_id"])
forecast.to_csv(OUT / "forecast.csv", index=False)

# Факт + проверочный прогноз + итоговый прогноз на одной шкале (для Looker Studio)
act_long = Y.stack().rename("actual_units").rename_axis(["sku_id", "month"]).reset_index()
bt_long = fc_growth.stack().rename("backtest_forecast_units").rename_axis(["sku_id", "month"]).reset_index()
fc_long = final.stack().rename("forecast_units").rename_axis(["sku_id", "month"]).reset_index()
timeline = act_long.merge(bt_long, how="outer").merge(fc_long, how="outer").merge(products, on="sku_id")
timeline["month"] = timeline.month.dt.to_timestamp().dt.date
for c in ["actual_units", "backtest_forecast_units", "forecast_units"]:
    timeline[c] = timeline[c].round(0)
timeline = timeline[["month", "sku_id", "product_name", "category",
                     "actual_units", "backtest_forecast_units", "forecast_units"]].sort_values(["month", "sku_id"])
timeline.to_csv(OUT / "forecast_timeline.csv", index=False)

backtest.round(2).to_csv(OUT / "forecast_backtest.csv", index=False)
wape_tbl.round(2).to_csv(OUT / "forecast_wape.csv", index=False)
g_final.rename("growth_factor").round(4).reset_index().to_csv(OUT / "forecast_growth_factors.csv", index=False)
lost_by_pair.to_csv(OUT / "lost_sales_aug_oct_2026.csv", index=False)

# ---------------- Сводка в консоль ----------------
print(wape_tbl.round(2).to_string(index=False))
print("\nЧувствительность к окну роста:\n", sens.round(2).to_string(index=False))
print("\nФакт по месяцам проверки:", actual.sum().astype(int).to_dict())
print("Оценка упущенных из-за OOS продаж:", lost_by_month.round(0).to_dict())
print("Топ пар по упущенным продажам (авг–окт 2026):\n", lost_by_pair.head(10).to_string(index=False))
print("\nИтоговый прогноз, всего ед.:", int(forecast.forecast_units.sum()),
      "| факт ноя-2025…окт-2026:", int(Y[pd.period_range('2025-11', '2026-10', freq='M')].to_numpy().sum()))
print("Коэффициент роста (медиана по SKU):", round(float(g_final.median()), 3))
