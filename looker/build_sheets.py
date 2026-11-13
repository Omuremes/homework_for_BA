"""Собирает looker/looker_data.xlsx: по вкладке на источник Looker Studio. Запуск: python looker/build_sheets.py

Каждой колонке задаётся явный формат, чтобы Google Таблицы и Looker Studio определили тип без ручной правки:
даты — «Дата» без времени, коды и названия — «Текст», количества и KGS — целые числа, доли и дни — дробные.
"""
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
XLSX = ROOT / "looker" / "looker_data.xlsx"

DATE_COLS = {"month_start", "month"}

timeline = pd.read_csv(OUT / "forecast_timeline.csv", parse_dates=["month"])

# Длинный формат для графика «Прогноз»: одна строка = месяц × SKU × ряд, без пустых ячеек.
# В Looker: измерение month, параметр разбивки series, показатель units.
forecast_chart = (
    timeline.melt(id_vars=["month", "sku_id", "product_name", "category"],
                  value_vars=["actual_units", "forecast_units"], var_name="series", value_name="units")
    .dropna(subset=["units"])
    .assign(series=lambda d: d.series.map({"actual_units": "Факт", "forecast_units": "Прогноз"}),
            units=lambda d: d.units.astype(int))
    .sort_values(["month", "sku_id"])
)

sheets = {
    "forecast_chart": forecast_chart,
    "sales_monthly": pd.read_csv(OUT / "sales_monthly.csv", parse_dates=["month_start"]),
    "inventory_october": pd.read_csv(OUT / "inventory_october.csv"),
    "forecast_timeline": timeline,
    "top3_overstock": pd.read_csv(OUT / "top3_overstock.csv"),
    "transfer_plan": pd.read_csv(OUT / "transfer_plan.csv"),
    "replenishment": pd.read_csv(OUT / "replenishment.csv"),
    "dq_checks": pd.read_csv(OUT / "dq_checks.csv"),
}

# Формат числовых колонок; всё нечисловое — текст, даты — дата
FORMATS = {
    "turnover_oct": "0.00",
    "daily_sales_rate": "0.0000",
    "cover_days": "0.0",
    "to_cover_days_before": "0.0",
    "avg_stock_value_oct_kgs": "#,##0.00",
}
INT_FORMAT = "#,##0"

with pd.ExcelWriter(XLSX, engine="openpyxl") as xw:
    for name, df in sheets.items():
        df.to_excel(xw, sheet_name=name, index=False)

wb = load_workbook(XLSX)
for name, df in sheets.items():
    ws = wb[name]
    for j, col in enumerate(df.columns, start=1):
        if col in DATE_COLS:
            fmt = "yyyy-mm-dd"
        elif pd.api.types.is_numeric_dtype(df[col]):
            fmt = FORMATS.get(col, INT_FORMAT)
        else:
            fmt = "@"  # текст: коды E001/W01 не превратятся в числа или даты
        for (cell,) in ws.iter_rows(min_row=2, min_col=j, max_col=j):
            cell.number_format = fmt
        ws.cell(row=1, column=j).font = Font(bold=True)
        width = max(len(str(col)), int(df[col].astype(str).str.len().quantile(0.9)) if len(df) else 0)
        ws.column_dimensions[get_column_letter(j)].width = min(max(width + 2, 10), 60)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
wb.save(XLSX)

print("looker/looker_data.xlsx:", {k: len(v) for k, v in sheets.items()})
