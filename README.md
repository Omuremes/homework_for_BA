# Тестовое задание Junior Data Analyst: продажи и запасы электротехники

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
Если установлен DuckDB CLI, SQL можно выполнить напрямую: `mkdir output && duckdb < sql/solution.sql`.


## 5. Выводы
См. `slides/Junior_DA_results.pdf`:
1. Перебросить 963 ед. (4,3 млн KGS) между складами (`output/transfer_plan.csv`).
2. Срочно закупить 1 056 ед. (0,65 млн KGS) по OOS-парам и парам с покрытием меньше 7 дней (`output/replenishment.csv`).
3. Заморозить закупки по 8 OVERSTOCK-парам, на которые приходится 4,5 млн KGS излишка (34% стоимости запаса).
