/*
 * Excel 讀取（SheetJS）與輸出（ExcelJS），格式完全比照物流匯入範本。
 * 函式庫由呼叫端傳入，方便瀏覽器與 Node 測試共用。
 */
(function (root) {
  'use strict';

  var SHEET_NAME = 'hungsongV1';
  var FONT = { name: '新細明體', size: 12, family: 1, charset: 136 };
  var RED_FONT = { name: '新細明體', size: 12, family: 1, charset: 136, color: { argb: 'FFFF0000' } };
  var THIN = { style: 'thin', color: { argb: 'FF000000' } };
  var BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  var HEADERS = [
    '訂單號碼\n長度限制: 20碼\n請勿使用中文',
    '收貨人姓名(必填)\n長度限制: 20碼',
    '收貨人電話(必填)\n長度限制: 15碼',
    '電話二',
    '收貨人地址(必填)\n中文限制: 50字',
    '件數\n<100',
    '重量\n10 / 20',
    '託運備註\n中文限制: 50字',
    '代收貨款\n限數字'
  ];
  var WIDTHS = [14.5, 17.1719, 17.3516, 15.5, 40.6719, 6.35156, 7.0, 36.0, 9.85156];
  var V_ALIGN = ['middle', 'middle', 'bottom', 'middle', 'bottom', 'middle', 'middle', 'bottom', 'middle'];
  var TEXT_COLS = [1, 2, 3, 4, 7]; // 以文字格式（@）儲存，保住電話開頭的 0
  var FLAG_COL = { name: 1, weight: 6, note: 7, cod: 8 };

  var HEADER_HEIGHT = 48.4;
  var ROW_HEIGHT = 17;
  var LINE_HEIGHT = 16.5;
  var NOTE_WIDTH_UNITS = 36; // H 欄寬，中文字約佔 2 單位

  /** 讀取第一個工作表為二維陣列 */
  function readRows(XLSX, arrayBuffer) {
    var wb = XLSX.read(arrayBuffer, { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  }

  /** 估算備註需要幾行，讓自動換行的列高足夠 */
  function noteLines(text) {
    if (!text) return 1;
    return String(text).split('\n').reduce(function (sum, line) {
      var units = 0;
      for (var ch of line) units += ch.charCodeAt(0) > 0xff ? 2 : 1;
      return sum + Math.max(1, Math.ceil(units / NOTE_WIDTH_UNITS));
    }, 0);
  }

  /** 依轉換結果建立 ExcelJS 活頁簿 */
  function buildWorkbook(ExcelJS, result) {
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet(SHEET_NAME);

    ws.columns = WIDTHS.map(function (w) { return { width: w }; });

    var head = ws.getRow(1);
    HEADERS.forEach(function (text, i) {
      var cell = head.getCell(i + 1);
      cell.value = text;
      cell.font = FONT;
      cell.numFmt = '@';
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    });
    head.height = HEADER_HEIGHT;

    result.rows.forEach(function (item, r) {
      var row = ws.getRow(r + 2);
      var red = {};
      Object.keys(item.flags).forEach(function (k) { if (item.flags[k]) red[FLAG_COL[k]] = true; });

      item.values.forEach(function (v, i) {
        var cell = row.getCell(i + 1);
        if (v !== null && v !== undefined) cell.value = v;
        cell.font = red[i] ? RED_FONT : FONT;
        cell.border = BORDER;
        cell.alignment = i === 7
          ? { vertical: V_ALIGN[i], wrapText: true }
          : { vertical: V_ALIGN[i] };
        if (TEXT_COLS.indexOf(i) !== -1) cell.numFmt = '@';
      });

      row.height = Math.max(ROW_HEIGHT, noteLines(item.values[7]) * LINE_HEIGHT + 0.5);
    });

    return wb;
  }

  var api = { readRows: readRows, buildWorkbook: buildWorkbook, SHEET_NAME: SHEET_NAME, HEADERS: HEADERS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Workbook = api;
})(this);
