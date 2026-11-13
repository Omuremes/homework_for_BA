-- =====================================================================
-- Тестовое задание Junior Data Analyst — продажи и запасы электротехники
-- Диалект: DuckDB (>= 1.1)
--
-- Порядок запуска (из корня проекта Junior_Data_Analyst_Test):
--   вариант 1:  python run_sql.py                 (создаёт папку output/ и выполняет этот файл)
--   вариант 2:  mkdir output && duckdb < sql/solution.sql
-- Файл выполняется целиком сверху вниз, разделы зависят от предыдущих:
--   0. Загрузка CSV в сырые таблицы (все поля — текст, чтобы проверки видели исходные значения)
--   1. Проверки качества данных  -> output/dq_checks.csv
--   2. Очищенные таблицы (дедупликация, приведение типов)
--   3. Выгрузка sales_monthly     -> output/sales_monthly.csv
--   4. Выгрузка inventory_october -> output/inventory_october.csv
--   5. Топ-3 OVERSTOCK по складам  -> output/top3_overstock.csv
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Загрузка
-- ---------------------------------------------------------------------
-- BOM в справочниках DuckDB снимает сам; all_varchar — чтобы мусор не терялся при авто-приведении типов.
CREATE OR REPLACE TABLE raw_products        AS SELECT * FROM read_csv('data/products.csv',        header = true, all_varchar = true);
CREATE OR REPLACE TABLE raw_warehouses      AS SELECT * FROM read_csv('data/warehouses.csv',      header = true, all_varchar = true);
CREATE OR REPLACE TABLE raw_sales           AS SELECT * FROM read_csv('data/sales.csv',           header = true, all_varchar = true);
CREATE OR REPLACE TABLE raw_inventory_daily AS SELECT * FROM read_csv('data/inventory_daily.csv', header = true, all_varchar = true);

-- Параметры периода
CREATE OR REPLACE MACRO p_hist_start()  AS DATE '2024-11-01';
CREATE OR REPLACE MACRO p_hist_end()    AS DATE '2026-10-31';
CREATE OR REPLACE MACRO p_eval_date()   AS DATE '2026-10-31';
CREATE OR REPLACE MACRO p_oct_start()   AS DATE '2026-10-01';
CREATE OR REPLACE MACRO p_rate_start()  AS DATE '2026-08-03';   -- 90 дней: 03.08–31.10.2026


-- ---------------------------------------------------------------------
-- 1. Проверки качества данных
--    Каждая строка: таблица, проверка, число затронутых строк, как учтено.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE dq_checks AS
WITH
calendar AS (
    SELECT CAST(d AS DATE) AS dt
    FROM generate_series(p_hist_start(), p_hist_end(), INTERVAL 1 DAY) t(d)
),
pairs AS (
    SELECT p.sku_id, w.warehouse_id FROM raw_products p CROSS JOIN raw_warehouses w
),
expected_snapshots AS (
    SELECT c.dt, p.sku_id, p.warehouse_id FROM calendar c CROSS JOIN pairs p
),
inv_dedup AS (
    SELECT DISTINCT TRY_CAST(snapshot_date AS DATE) AS dt, sku_id, warehouse_id FROM raw_inventory_daily
),
missing_snapshots AS (
    SELECT e.* FROM expected_snapshots e
    ANTI JOIN inv_dedup i ON i.dt = e.dt AND i.sku_id = e.sku_id AND i.warehouse_id = e.warehouse_id
)
-- Справочники
SELECT 'products' AS table_name, 'Дубли sku_id' AS check_name,
       (SELECT COUNT(*) - COUNT(DISTINCT sku_id) FROM raw_products) AS affected_rows,
       'Нет нарушений' AS treatment
UNION ALL
SELECT 'products', 'Пустые/нечисловые/неположительные unit_cost_kgs или target_cover_days',
       (SELECT COUNT(*) FROM raw_products
         WHERE TRY_CAST(unit_cost_kgs AS DOUBLE) IS NULL OR TRY_CAST(unit_cost_kgs AS DOUBLE) <= 0
            OR TRY_CAST(target_cover_days AS INTEGER) IS NULL OR TRY_CAST(target_cover_days AS INTEGER) <= 0),
       'Нет нарушений'
UNION ALL
SELECT 'warehouses', 'Дубли warehouse_id',
       (SELECT COUNT(*) - COUNT(DISTINCT warehouse_id) FROM raw_warehouses),
       'Нет нарушений'

-- Продажи
UNION ALL
SELECT 'sales', 'Дубли line_id (лишние строки сверх первой)',
       (SELECT COUNT(*) - COUNT(DISTINCT line_id) FROM raw_sales),
       'Все дубли — полные копии строк (8 line_id по 2 раза). Оставлена одна строка на line_id'
UNION ALL
SELECT 'sales', 'Дубли line_id с различающимися полями',
       (SELECT COUNT(*) FROM (
            SELECT line_id FROM raw_sales GROUP BY line_id
            HAVING COUNT(DISTINCT (sale_date, warehouse_id, sku_id, operation, quantity, unit_price_kgs)) > 1)),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'sku_id отсутствует в products',
       (SELECT COUNT(*) FROM raw_sales s ANTI JOIN raw_products p USING (sku_id)),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'warehouse_id отсутствует в warehouses',
       (SELECT COUNT(*) FROM raw_sales s ANTI JOIN raw_warehouses w USING (warehouse_id)),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'operation не SALE/RETURN',
       (SELECT COUNT(*) FROM raw_sales WHERE operation IS NULL OR operation NOT IN ('SALE', 'RETURN')),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'quantity пустое, дробное или <= 0',
       (SELECT COUNT(*) FROM raw_sales
         WHERE TRY_CAST(quantity AS INTEGER) IS NULL OR TRY_CAST(quantity AS INTEGER) <= 0
            OR TRY_CAST(quantity AS DOUBLE) <> TRY_CAST(quantity AS INTEGER)),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'unit_price_kgs пустая или <= 0',
       (SELECT COUNT(*) FROM raw_sales
         WHERE TRY_CAST(unit_price_kgs AS DOUBLE) IS NULL OR TRY_CAST(unit_price_kgs AS DOUBLE) <= 0),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'Цена продажи ниже себестоимости',
       (SELECT COUNT(*) FROM raw_sales s JOIN raw_products p USING (sku_id)
         WHERE TRY_CAST(s.unit_price_kgs AS DOUBLE) < TRY_CAST(p.unit_cost_kgs AS DOUBLE)),
       'Нет нарушений'
UNION ALL
SELECT 'sales', 'sale_date не дата или вне 01.11.2024–31.10.2026',
       (SELECT COUNT(*) FROM raw_sales
         WHERE TRY_CAST(sale_date AS DATE) IS NULL
            OR TRY_CAST(sale_date AS DATE) NOT BETWEEN p_hist_start() AND p_hist_end()),
       'Нет нарушений'

-- Ежедневные остатки
UNION ALL
SELECT 'inventory_daily', 'Дубли ключа (snapshot_date, warehouse_id, sku_id), лишние строки',
       (SELECT COUNT(*) - COUNT(DISTINCT (snapshot_date, warehouse_id, sku_id)) FROM raw_inventory_daily),
       'Оба дубля — полные копии (10-12 W03 E005, 31-10 W01 E007). Оставлен один снимок'
UNION ALL
SELECT 'inventory_daily', 'Дубли ключа с разным on_hand_units',
       (SELECT COUNT(*) FROM (
            SELECT 1 FROM raw_inventory_daily GROUP BY snapshot_date, warehouse_id, sku_id
            HAVING COUNT(DISTINCT on_hand_units) > 1)),
       'Нет нарушений'
UNION ALL
SELECT 'inventory_daily', 'sku_id или warehouse_id отсутствует в справочниках',
       (SELECT COUNT(*) FROM raw_inventory_daily i
         WHERE sku_id NOT IN (SELECT sku_id FROM raw_products)
            OR warehouse_id NOT IN (SELECT warehouse_id FROM raw_warehouses)),
       'Нет нарушений'
UNION ALL
SELECT 'inventory_daily', 'on_hand_units пустой, дробный или < 0',
       (SELECT COUNT(*) FROM raw_inventory_daily
         WHERE TRY_CAST(on_hand_units AS INTEGER) IS NULL OR TRY_CAST(on_hand_units AS INTEGER) < 0
            OR TRY_CAST(on_hand_units AS DOUBLE) <> TRY_CAST(on_hand_units AS INTEGER)),
       'Нет нарушений'
UNION ALL
SELECT 'inventory_daily', 'snapshot_date не дата или вне периода',
       (SELECT COUNT(*) FROM raw_inventory_daily
         WHERE TRY_CAST(snapshot_date AS DATE) IS NULL
            OR TRY_CAST(snapshot_date AS DATE) NOT BETWEEN p_hist_start() AND p_hist_end()),
       'Нет нарушений'
UNION ALL
SELECT 'inventory_daily',
       'Пропущенные дневные снимки (ожидается 36 SKU × 3 склада × 730 дней = 78 840): '
         || (SELECT string_agg(strftime(dt, '%d.%m.%Y') || ' ' || warehouse_id || ' ' || sku_id, '; ' ORDER BY dt, warehouse_id)
             FROM missing_snapshots),
       (SELECT COUNT(*) FROM missing_snapshots),
       'Не заполняем. 17.10 W02 E024: в октябре 30 дней снимков, средний остаток по доступным дням. '
         || '31.10 W01 E015 и W03 E033: остаток/стоимость/покрытие пустые, статус NO_DATA'
UNION ALL
SELECT 'inventory_daily', 'Пары товар–склад вообще без снимков',
       (SELECT COUNT(*) FROM pairs p ANTI JOIN raw_inventory_daily i USING (sku_id, warehouse_id)),
       'Нет нарушений';

COPY dq_checks TO 'output/dq_checks.csv' (HEADER, DELIMITER ',');


-- ---------------------------------------------------------------------
-- 2. Очищенные таблицы
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE products AS
SELECT sku_id, product_name, category,
       CAST(unit_cost_kgs AS DOUBLE)      AS unit_cost_kgs,
       CAST(target_cover_days AS INTEGER) AS target_cover_days
FROM raw_products;

CREATE OR REPLACE TABLE warehouses AS
SELECT warehouse_id, warehouse_name FROM raw_warehouses;

-- Полные дубли line_id схлопываем до одной строки
CREATE OR REPLACE TABLE sales AS
SELECT line_id,
       CAST(sale_date AS DATE)          AS sale_date,
       warehouse_id, sku_id, operation,
       CAST(quantity AS INTEGER)        AS quantity,
       CAST(unit_price_kgs AS DOUBLE)   AS unit_price_kgs
FROM raw_sales
QUALIFY ROW_NUMBER() OVER (PARTITION BY line_id ORDER BY sale_date) = 1;

-- Полные дубли снимков схлопываем до одного
CREATE OR REPLACE TABLE inventory_daily AS
SELECT CAST(snapshot_date AS DATE)    AS snapshot_date,
       warehouse_id, sku_id,
       CAST(on_hand_units AS INTEGER) AS on_hand_units
FROM raw_inventory_daily
QUALIFY ROW_NUMBER() OVER (PARTITION BY snapshot_date, warehouse_id, sku_id ORDER BY on_hand_units) = 1;

-- Все пары товар × склад со справочными атрибутами
CREATE OR REPLACE TABLE dim_pairs AS
SELECT p.sku_id, p.product_name, p.category, p.unit_cost_kgs, p.target_cover_days,
       w.warehouse_id, w.warehouse_name
FROM products p CROSS JOIN warehouses w;


-- ---------------------------------------------------------------------
-- 3. sales_monthly: месяц × товар × склад, включая месяцы без операций
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE sales_monthly AS
WITH months AS (
    SELECT CAST(m AS DATE) AS month_start
    FROM generate_series(p_hist_start(), DATE_TRUNC('month', p_hist_end()), INTERVAL 1 MONTH) t(m)
),
agg AS (
    SELECT DATE_TRUNC('month', sale_date)::DATE AS month_start, sku_id, warehouse_id,
           SUM(quantity) FILTER (WHERE operation = 'SALE')   AS sold_units,
           SUM(quantity) FILTER (WHERE operation = 'RETURN') AS returned_units,
           SUM(CASE operation WHEN 'SALE' THEN 1 ELSE -1 END * quantity * unit_price_kgs) AS net_revenue_kgs
    FROM sales
    GROUP BY ALL
)
SELECT m.month_start,
       d.sku_id, d.product_name,
       d.warehouse_id, d.warehouse_name,
       d.category,
       COALESCE(a.sold_units, 0)                                       AS sold_units,
       COALESCE(a.returned_units, 0)                                   AS returned_units,
       COALESCE(a.sold_units, 0) - COALESCE(a.returned_units, 0)       AS net_units,
       COALESCE(a.net_revenue_kgs, 0)                                  AS net_revenue_kgs,
       (COALESCE(a.sold_units, 0) - COALESCE(a.returned_units, 0)) * d.unit_cost_kgs AS net_cogs_kgs,
       COALESCE(a.net_revenue_kgs, 0)
         - (COALESCE(a.sold_units, 0) - COALESCE(a.returned_units, 0)) * d.unit_cost_kgs AS gross_profit_kgs
FROM months m
CROSS JOIN dim_pairs d
LEFT JOIN agg a ON a.month_start = m.month_start AND a.sku_id = d.sku_id AND a.warehouse_id = d.warehouse_id
ORDER BY m.month_start, d.sku_id, d.warehouse_id;

COPY sales_monthly TO 'output/sales_monthly.csv' (HEADER, DELIMITER ',');


-- ---------------------------------------------------------------------
-- 4. inventory_october: товар × склад, состояние на 31.10.2026
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE inventory_october AS
WITH
eod AS (            -- снимок на дату оценки
    SELECT sku_id, warehouse_id, on_hand_units
    FROM inventory_daily WHERE snapshot_date = p_eval_date()
),
oct_inv AS (        -- октябрьские снимки: полнота, дни OOS, средний остаток
    SELECT sku_id, warehouse_id,
           COUNT(*)                                   AS snapshot_days_oct,
           COUNT(*) FILTER (WHERE on_hand_units = 0)  AS oos_days_oct,
           AVG(on_hand_units)                         AS avg_on_hand_units_oct
    FROM inventory_daily
    WHERE snapshot_date BETWEEN p_oct_start() AND p_eval_date()
    GROUP BY ALL
),
oct_sales AS (      -- чистые продажи октября
    SELECT sku_id, warehouse_id,
           SUM(CASE operation WHEN 'SALE' THEN 1 ELSE -1 END * quantity) AS net_units_oct
    FROM sales
    WHERE sale_date BETWEEN p_oct_start() AND p_eval_date()
    GROUP BY ALL
),
rate AS (           -- продажи SALE за 90 дней
    SELECT sku_id, warehouse_id, SUM(quantity) AS sale_units_90d
    FROM sales
    WHERE operation = 'SALE' AND sale_date BETWEEN p_rate_start() AND p_eval_date()
    GROUP BY ALL
),
base AS (
    SELECT d.*,
           e.on_hand_units                                       AS on_hand_units_eod,
           e.on_hand_units * d.unit_cost_kgs                     AS on_hand_value_kgs,
           COALESCE(oi.oos_days_oct, 0)                          AS oos_days_oct,
           COALESCE(oi.snapshot_days_oct, 0)                     AS snapshot_days_oct,
           COALESCE(os.net_units_oct, 0) * d.unit_cost_kgs       AS net_cogs_oct_kgs,
           oi.avg_on_hand_units_oct * d.unit_cost_kgs            AS avg_stock_value_oct_kgs,
           COALESCE(r.sale_units_90d, 0)                         AS sale_units_90d,
           COALESCE(r.sale_units_90d, 0) / 90.0                  AS daily_sales_rate,
           -- ceil(продажи_90д × норматив / 90): числитель целый, поэтому нет ошибки вида 20.0000001 -> 21
           CAST(CEIL(COALESCE(r.sale_units_90d, 0) * d.target_cover_days / 90.0) AS INTEGER) AS target_stock_units
    FROM dim_pairs d
    LEFT JOIN eod       e  USING (sku_id, warehouse_id)
    LEFT JOIN oct_inv   oi USING (sku_id, warehouse_id)
    LEFT JOIN oct_sales os USING (sku_id, warehouse_id)
    LEFT JOIN rate      r  USING (sku_id, warehouse_id)
),
status AS (
    SELECT *,
           CASE
               WHEN on_hand_units_eod IS NULL           THEN 'NO_DATA'
               WHEN on_hand_units_eod = 0               THEN 'OOS'
               WHEN sale_units_90d = 0                  THEN 'NO_SALES'
               WHEN on_hand_units_eod > target_stock_units THEN 'OVERSTOCK'
               ELSE 'OK'
           END AS status
    FROM base
)
SELECT sku_id, product_name,
       warehouse_id, warehouse_name,
       category,
       on_hand_units_eod,
       on_hand_value_kgs,
       oos_days_oct,
       snapshot_days_oct,
       net_cogs_oct_kgs,
       ROUND(avg_stock_value_oct_kgs, 2)                                   AS avg_stock_value_oct_kgs,
       ROUND(net_cogs_oct_kgs / NULLIF(avg_stock_value_oct_kgs, 0), 4)    AS turnover_oct,
       sale_units_90d,
       ROUND(daily_sales_rate, 4)                                          AS daily_sales_rate,
       ROUND(on_hand_units_eod / NULLIF(daily_sales_rate, 0), 1)           AS cover_days,
       target_cover_days,
       target_stock_units,
       status,
       CASE WHEN status = 'OVERSTOCK'     THEN on_hand_units_eod - target_stock_units
            WHEN status IN ('OOS', 'OK')  THEN 0 END                        AS excess_units,
       CASE WHEN status = 'OVERSTOCK'     THEN (on_hand_units_eod - target_stock_units) * unit_cost_kgs
            WHEN status IN ('OOS', 'OK')  THEN 0 END                        AS excess_value_kgs,
       unit_cost_kgs
FROM status
ORDER BY sku_id, warehouse_id;

COPY inventory_october TO 'output/inventory_october.csv' (HEADER, DELIMITER ',');


-- ---------------------------------------------------------------------
-- 5. До трёх SKU со статусом OVERSTOCK на каждом складе по стоимости излишка
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE top3_overstock AS
SELECT *
FROM (
    SELECT warehouse_id, warehouse_name, sku_id, product_name, category,
           on_hand_units_eod, target_stock_units, excess_units, excess_value_kgs, cover_days,
           ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY excess_value_kgs DESC, sku_id) AS rank_in_warehouse
    FROM inventory_october
    WHERE status = 'OVERSTOCK'
)
WHERE rank_in_warehouse <= 3
ORDER BY warehouse_id, rank_in_warehouse;

COPY top3_overstock TO 'output/top3_overstock.csv' (HEADER, DELIMITER ',');
