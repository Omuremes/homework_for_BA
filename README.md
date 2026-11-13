## Структура

| Путь | Что внутри |
|---|---|
| `data/` | Исходные CSV, не изменялись |
| `sql/solution.sql` | **Диалект DuckDB.** Загрузка, проверки качества, очистка, выгрузки, топ-3 OVERSTOCK |
| `run_sql.py` | Запускает `solution.sql` и создаёт `output/` |
| `forecast/forecast.py` | Проверка двух методов (WAPE), итоговый прогноз, оценка упущенных продаж |
| `analysis/actions.py` | План перемещений между складами и список докупки |
| `looker/` | `looker_data.xlsx` для Google Sheets и `LOOKER_STUDIO_GUIDE.md` с пошаговой сборкой отчёта |
| `slides/` | Презентация (PPTX и PDF) и её генератор |
| `output/` | Все результаты |

## Порядок запуска (из корня проекта)

```bash
pip install duckdb pandas openpyxl
python run_sql.py               # 1-2. проверки + sales_monthly.csv, inventory_october.csv, top3_overstock.csv
python forecast/forecast.py     # 3. forecast.csv + проверка методов
python analysis/actions.py      # действия для закупок
python looker/build_sheets.py   # 4. книга для Google Sheets
```
