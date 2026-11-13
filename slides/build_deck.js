const pptxgen = require("pptxgenjs");
const { applyTheme } = require("C:/Users/omega/.claude/skills/synced/ae2e80ab-ae43-4758-b8eb-860830ea7593_f4950601-c6de-4e13-aab7-449ae6f2aa2c/pptx/scripts/apply_theme.js");

const OUT = "C:/Users/omega/OneDrive/Desktop/Junior_Data_Analyst_Test/slides/Junior_DA_results.pptx";

const THEME = {
  name: "Electro Amber",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B2329", lt1: "FFFFFF", dk2: "33424C", lt2: "EEF1F3",
    accent1: "E9A300", accent2: "2B7A78", accent3: "C8553D", accent4: "8A9BA8",
    accent5: "5B8E7D", accent6: "3A6EA5", hlink: "3A6EA5", folHlink: "6D5A8C",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Продажи и запасы электротехники — выводы для закупок";
pres.author = "Junior Data Analyst";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const W = 13.333, M = 0.6;

pres.defineSlideMaster({
  title: "DARK",
  background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.55, w: W - 2 * M, h: 1.5,
        fontSize: 36, bold: true, color: C.background1, valign: "top", align: "left", fontFace: THEME.headFontFace, margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.4, w: W - 2 * M, h: 0.9,
        fontSize: 26, bold: true, color: C.text1, valign: "top", align: "left", fontFace: THEME.headFontFace, margin: 0 }, text: "" } },
    { text: { text: "Продажи и запасы электротехники · данные 01.11.2024–31.10.2026",
        options: { x: M, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.5, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent4, align: "right" },
});

const T = (slide, text, opts) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: THEME.bodyFontFace, ...opts });

// Карточка с цифрой
function stat(slide, { x, y, w, h, value, label, dark, accent, name }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08,
    fill: { color: dark ? C.text2 : C.background2 }, line: { type: "none" }, objectName: name + " card" });
  T(slide, value, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.75, fontSize: 32, bold: true,
    color: accent || (dark ? C.accent1 : C.text1), fontFace: THEME.headFontFace, objectName: name + " value" });
  T(slide, label, { x: x + 0.25, y: y + 0.95, w: w - 0.5, h: h - 1.1, fontSize: 14, valign: "top",
    color: dark ? C.background1 : C.text2, objectName: name + " label" });
}

// ---------------------------------------------------------------- 1. Главное
pres.addSection({ title: "Главное" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Главное" });
  s.addText("Продажи растут, но запас лежит не на тех складах", { placeholder: "title" });
  T(s, "Оценка запасов на 31.10.2026 · история продаж 11.2024–10.2026 · прогноз 11.2026–10.2027",
    { x: M, y: 1.75, w: 11, h: 0.4, fontSize: 16, color: C.accent4 });

  const cw = (W - 2 * M - 3 * 0.3) / 4, cy = 2.6, ch = 2.1;
  const kpis = [
    ["188,0 млн", "чистая выручка за 11.2025–10.2026, KGS (+12,0% г/г)"],
    ["54,5 млн", "валовая прибыль, KGS (+18,8% г/г), маржа 29,0% против 27,3%"],
    ["4,5 млн", "излишек запаса, KGS: 34% стоимости известного остатка в 8 парах"],
    ["122,5 тыс.", "ед. — прогноз продаж на 11.2026–10.2027 (+8,5% г/г)"],
  ];
  kpis.forEach(([v, l], i) => stat(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: ch, value: v, label: l, dark: true, name: "kpi" + i }));

  T(s, "Три действия для закупок", { x: M, y: 5.1, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.background1 });
  T(s, [
    { text: "Перебросить 963 ед. (4,3 млн KGS) с перезатаренных складов на склады, где тот же SKU заканчивается", options: { bullet: { type: "number" }, breakLine: true } },
    { text: "Срочно закупить 1 056 ед. (0,65 млн KGS) по 5 парам без остатка и парам с покрытием < 7 дней", options: { bullet: { type: "number" }, breakLine: true } },
    { text: "Заморозить закупки по 8 парам OVERSTOCK, пока остаток не снизится до норматива", options: { bullet: { type: "number" } } },
  ], { x: M, y: 5.55, w: W - 2 * M, h: 1.4, fontSize: 16, color: C.background1, paraSpaceAfter: 4 });

  s.addNotes("Главный вывод: спрос растёт около 9% в год, маржа улучшилась, но запас распределён неравномерно. " +
    "На одних складах лежат 2–4 месяца продаж, на других тот же SKU заканчивается за 4–6 дней. " +
    "Поэтому первое действие — перемещение, а не новая закупка.");
}

// ---------------------------------------------------------------- 2. Продажи и прогноз
pres.addSection({ title: "Продажи и прогноз" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Продажи и прогноз" });
  s.addText("Спрос растёт на 8–10% в год, пик — август–октябрь", { placeholder: "title" });

  const mon = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const labels = [];
  for (let i = 0; i < 36; i++) {
    const m = (10 + i) % 12, y = 24 + Math.floor((10 + i) / 12);
    labels.push(mon[m] + " " + y);
  }
  const actual = [7890, 7860, 7309, 6636, 7804, 8559, 8986, 8689, 9376, 9716, 9851, 10085,
                  8675, 8919, 8198, 7581, 8769, 9250, 9843, 9781, 10394, 10526, 10697, 10241];
  const fc = [9408, 9680, 8883, 8209, 9504, 10032, 10679, 10620, 11277, 11436, 11630, 11159];
  s.addChart(pres.charts.BAR, [
    { name: "Факт, ед.", labels, values: [...actual, ...Array(12).fill(0)] },
    { name: "Прогноз, ед.", labels, values: [...Array(24).fill(0), ...fc] },
  ], {
    x: M, y: 1.4, w: 8.3, h: 5.4, barDir: "col", barGrouping: "stacked", overlap: 100, barGapWidthPct: 40,
    chartColors: [HEX.dk2, HEX.accent1],
    showLegend: true, legendPos: "t", legendFontSize: 12, legendFontFace: "+mn-lt", legendColor: HEX.dk2,
    catAxisLabelColor: HEX.dk2, valAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 10, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", catAxisLabelRotate: -90,
    valAxisLabelFormatCode: "# ##0", valGridLine: { color: "DDE2E6", size: 0.75 }, catGridLine: { style: "none" },
    showTitle: true, title: "Продажи SALE по месяцам, ед., все SKU и склады", titleFontSize: 14, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
    objectName: "Monthly sales and forecast chart",
  });

  const rx = 9.3, rw = W - M - rx;
  stat(s, { x: rx, y: 1.4, w: rw, h: 1.75, value: "WAPE 8,1%", label: "у выбранного метода против 10,1% у базового (проверка на авг–окт 2026)", accent: C.accent2, name: "wape" });
  T(s, [
    { text: "Метод: ", options: { bold: true } },
    { text: "факт того же месяца год назад × рост SKU за последние 6 месяцев к тем же месяцам прошлого года.", options: { breakLine: true } },
    { text: "Дефицит: ", options: { bold: true } },
    { text: "в дни без остатка продажи не происходили. Упущено около 690 ед. за авг–окт, из них 464 в октябре; больше всего у E013 в Бишкеке (~289 шт). Факт ниже реального спроса, поэтому прогноз скорее консервативен." },
  ], { x: rx, y: 3.45, w: rw, h: 3.3, fontSize: 14, color: C.text1, valign: "top", paraSpaceAfter: 8 });

  s.addNotes("Сезонность: провал в январе–феврале, пик в августе–октябре. Рост около 9% год к году. " +
    "Базовый метод не учитывает рост и даёт 10,1% WAPE; с коэффициентом роста SKU ошибка 8,1% (окно 3 мес — 8,5%, 9 мес — 8,1%). " +
    "Октябрь 2026 ниже сентября из-за всплеска OOS: 172 пар-дня без остатка против 16 год назад.");
}

// ---------------------------------------------------------------- 3. Излишки
pres.addSection({ title: "Запасы" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Запасы" });
  s.addText("Треть стоимости запаса — излишек в 8 парах", { placeholder: "title" });

  const pairs = [
    ["E002 Кабель ВВГнг 3×2,5 · Бишкек", 1582950], ["E003 Кабель ВВГнг 3×4 · Ош", 933660],
    ["E005 Провод ПВ-3 1×6 · Бишкек", 743400], ["E001 Кабель ВВГнг 3×1,5 · Джалал-Абад", 468000],
    ["E018 Реле напряжения · Ош", 273000], ["E032 Щит на 24 модуля · Бишкек", 242060],
    ["E016 УЗО 2P 40 А · Джалал-Абад", 190500], ["E025 Гофротруба 16 мм · Ош", 65520],
  ].reverse();
  s.addChart(pres.charts.BAR, [{ name: "Излишек, тыс. KGS", labels: pairs.map(p => p[0]), values: pairs.map(p => Math.round(p[1] / 1000)) }], {
    x: M, y: 1.4, w: 7.9, h: 5.4, barDir: "bar", barGapWidthPct: 45, chartColors: [HEX.accent1],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "# ##0", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true,
    valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "Стоимость излишка сверх цели, тыс. KGS (по себестоимости)", titleFontSize: 14, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
    objectName: "Excess value by pair chart",
  });

  const rx = 8.9, rw = W - M - rx;
  stat(s, { x: rx, y: 1.4, w: rw, h: 1.6, value: "13,1 млн", label: "KGS — стоимость известного остатка на 31.10", name: "stock" });
  stat(s, { x: rx, y: 3.2, w: rw, h: 1.6, value: "4,5 млн", label: "KGS излишек (34%), 2,6 млн из них в Бишкеке", accent: C.accent3, name: "excess" });
  T(s, "Покрытие у этих пар 74–189 дней при нормативе 35–50. Четыре из восьми — кабель и провод: 3,7 млн KGS, или 83% излишка.",
    { x: rx, y: 5.05, w: rw, h: 1.7, fontSize: 14, color: C.text1, valign: "top" });

  s.addNotes("Топ-3 по складам (оконная функция ROW_NUMBER по складу): Бишкек — E002, E005, E032; Ош — E003, E018, E025; " +
    "Джалал-Абад — E001, E016. Оборачиваемость этих пар в октябре 0,24–0,46 против 1,0+ у остальных.");
}

// ---------------------------------------------------------------- 4. Дефицит
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Запасы" });
  s.addText("5 пар уже пусты, ещё 10 опустеют за неделю", { placeholder: "title" });

  const hdr = ["SKU", "Товар", "Склад", "Остаток", "Ед./день", "Покрытие, дн", "Норматив, дн", "Статус"].map(t => ({
    text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 } } }));
  const rows = [
    ["E013", "Автомат 1P C16", "Бишкек", "0", "4,48", "0", "35", "OOS 31 дн"],
    ["E009", "Светильник LED 18 Вт", "Ош", "0", "1,60", "0", "40", "OOS 31 дн"],
    ["E035", "Контактор 3P 25 А", "Ош", "0", "1,17", "0", "50", "OOS 22 дн"],
    ["E021", "Розетка IP44", "Джалал-Абад", "0", "0,84", "0", "43", "OOS 31 дн"],
    ["E006", "Кабель КГ 3×2,5", "Джалал-Абад", "0", "0,28*", "0", "50", "OOS 31 дн"],
    ["E032", "Щит на 24 модуля", "Джалал-Абад", "4", "1,17", "3,4", "48", "OK"],
    ["E005", "Провод ПВ-3 1×6", "Ош", "7", "1,87", "3,8", "45", "OK"],
    ["E018", "Реле напряжения 63 А", "Бишкек", "9", "2,14", "4,2", "50", "OK"],
    ["E001", "Кабель ВВГнг 3×1,5", "Ош", "15", "3,21", "4,7", "40", "OK"],
  ].map(r => r.map((c, j) => ({ text: c, options: {
    color: j === 7 && c.startsWith("OOS") ? C.accent3 : C.text1, bold: j === 7 && c.startsWith("OOS"),
    align: j >= 3 && j <= 6 ? "right" : "left" } })));
  s.addTable([hdr, ...rows], {
    x: M, y: 1.4, w: 8.4, colW: [0.65, 2.15, 1.35, 0.85, 0.9, 1.0, 1.0, 1.1].map(v => v * 8.4 / 9.0),
    fontSize: 12, fontFace: THEME.bodyFontFace, rowH: 0.42, border: { type: "solid", pt: 0.5, color: "DDE2E6" },
    margin: [0.04, 0.08, 0.04, 0.08], valign: "middle", objectName: "Deficit table",
  });
  T(s, "* темп занижен: товара не было почти весь 90-дневный период, реальный спрос выше",
    { x: M, y: 5.85, w: 8.4, h: 0.3, fontSize: 11, italic: true, color: C.text2 });

  const rx = 9.4, rw = W - M - rx;
  stat(s, { x: rx, y: 1.4, w: rw, h: 1.75, value: "16,5 дн", label: "медианное покрытие у 91 пары OK; у всех них остаток ниже цели", accent: C.accent3, name: "cover" });
  stat(s, { x: rx, y: 3.35, w: rw, h: 1.6, value: "~289 шт", label: "упущенных продаж E013 в Бишкеке за авг–окт", accent: C.accent3, name: "lost" });
  T(s, "Нет данных на 31.10: E015 Бишкек, E033 Джалал-Абад — нужна сверка остатка. Без продаж 90 дней: E012 Джалал-Абад, E030 Ош.",
    { x: rx, y: 5.15, w: rw, h: 1.6, fontSize: 13, color: C.text1, valign: "top" });

  s.addNotes("OK в постановке задачи означает лишь «не выше цели». Цель — темп × норматив 32–55 дней, а у OK-пар медиана 16,5 дня, " +
    "поэтому OK не равно «всё в порядке». Если поставка занимает 2–3 недели, все пары с покрытием меньше 14 дней (37 штук) рискуют уйти в OOS.");
}

// ---------------------------------------------------------------- 5. Действия
pres.addSection({ title: "Действия" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Действия" });
  s.addText("Три действия для закупок", { placeholder: "title" });

  const cards = [
    { n: "1", head: "Перебросить, а не покупать", num: "963 ед. · 4,3 млн KGS", color: C.accent2, items: [
      "E003 Ош → Бишкек: 118 бухт (в Бишкеке 5,7 дн)",
      "E005 Бишкек → Ош: 77 бухт (в Оше 3,8 дн)",
      "E018 Ош → Бишкек: 99 шт (4,2 дн)",
      "E032 Бишкек → Джалал-Абад: 52 шт (3,4 дн)",
      "E001 Джалал-Абад → Ош: 90 бухт (4,7 дн)" ] },
    { n: "2", head: "Срочно закупить", num: "1 056 ед. · 0,65 млн KGS", color: C.accent3, items: [
      "E013 Бишкек: 157 шт (OOS весь октябрь)",
      "E007 Бишкек: 220 шт · E023 Бишкек: 141 шт",
      "E009 Ош: 64 шт и Бишкек: 139 шт",
      "E035 Ош: 59 шт · E017 Бишкек: 74 шт",
      "E006, E021 Джалал-Абад: 14 и 37 шт" ] },
    { n: "3", head: "Заморозить закупки", num: "8 пар · 4,5 млн KGS излишка", color: C.accent1, items: [
      "E002 Бишкек: 1,58 млн, 74 дн покрытия",
      "E003 Ош: 0,93 млн, 100 дн",
      "E016 Джалал-Абад: 189 дн, E018 Ош: 143 дн",
      "Вернуться к закупкам, когда покрытие дойдёт до норматива",
      "Сверить остатки E015 и E033 (нет снимка)" ] },
  ];
  const cw = (W - 2 * M - 2 * 0.3) / 3, cy = 1.4, ch = 5.0;
  cards.forEach((c, i) => {
    const x = M + i * (cw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: C.background2 }, line: { type: "none" }, objectName: "action card " + c.n });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: cy + 0.3, w: 0.6, h: 0.6, fill: { color: c.color }, line: { type: "none" }, objectName: "action badge " + c.n });
    T(s, c.n, { x: x + 0.3, y: cy + 0.3, w: 0.6, h: 0.6, fontSize: 22, bold: true, align: "center", valign: "middle", color: C.background1, fontFace: THEME.headFontFace });
    T(s, c.head, { x: x + 1.05, y: cy + 0.3, w: cw - 1.3, h: 0.6, fontSize: 19, bold: true, valign: "middle", color: C.text1, fontFace: THEME.headFontFace });
    T(s, c.num, { x: x + 0.3, y: cy + 1.1, w: cw - 0.6, h: 0.45, fontSize: 17, bold: true, color: c.color });
    T(s, c.items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c.items.length - 1 } })),
      { x: x + 0.3, y: cy + 1.7, w: cw - 0.6, h: ch - 1.9, fontSize: 15, color: C.text1, valign: "top", paraSpaceAfter: 6 });
  });

  s.addNotes("Порядок: сначала перемещения, они закрывают дефицит быстрее и без затрат на закупку. " +
    "Потом закупка по OOS и парам с покрытием меньше недели — список в output/replenishment.csv, план перемещений в output/transfer_plan.csv. " +
    "По OVERSTOCK-парам закупки на паузе; после перемещений излишек сокращается с 4,5 до примерно 0,2 млн KGS.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
