"""Выполняет sql/solution.sql в DuckDB. Запуск из корня проекта: python run_sql.py"""
import os
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)  # пути в SQL относительные к корню проекта
(ROOT / "output").mkdir(exist_ok=True)

con = duckdb.connect(str(ROOT / "output" / "analytics.duckdb"))
sql = (ROOT / "sql" / "solution.sql").read_text(encoding="utf-8")
con.execute(sql)

for t in ["dq_checks", "sales_monthly", "inventory_october", "top3_overstock"]:
    print(f"{t}: {con.execute(f'SELECT COUNT(*) FROM {t}').fetchall()[0][0]} rows")
