/* 端對端測試：使用與網站相同的 vendor 函式庫，讀 .xlsx / .xls → 轉換 → 寫出 → 再讀回檢查格式 */
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../vendor/xlsx.full.min.js');
const ExcelJS = require('../vendor/exceljs.min.js');
const C = require('../js/convert.js');
const W = require('../js/workbook.js');
const { ROWS } = require('./fixture.js');

function makeSource(bookType) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ROWS), 'Worksheet');
  return XLSX.write(wb, { type: 'buffer', bookType });
}

async function roundTrip(bookType) {
  const rows = W.readRows(XLSX, makeSource(bookType));
  const result = C.convert(rows);
  const buffer = await W.buildWorkbook(ExcelJS, result).xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
}

for (const type of ['xlsx', 'biff8']) {
  test(`讀取 ${type === 'biff8' ? '.xls' : '.xlsx'} 並輸出範本格式`, async () => {
    const ws = await roundTrip(type);

    assert.equal(ws.name, 'hungsongV1');
    assert.equal(ws.rowCount, 11); // 標題 + 10 筆
    W.HEADERS.forEach((h, i) => assert.equal(ws.getRow(1).getCell(i + 1).text, h));
    assert.equal(ws.getRow(1).height, 48.4);
    assert.equal(ws.getColumn(5).width, 40.6719);

    const r2 = ws.getRow(2);
    assert.equal(r2.getCell(2).value, '王大明');
    assert.equal(r2.getCell(3).value, '0911111111');
    assert.equal(r2.getCell(3).numFmt, '@');
    assert.equal(r2.getCell(2).font.name, '新細明體');
    assert.equal(r2.getCell(2).font.size, 12);
    assert.equal(r2.getCell(6).value, 1);
    assert.equal(r2.getCell(1).border.left.style, 'thin');
  });
}

test('標題列說明文字為紅字，與範本相同', async () => {
  const ws = await roundTrip('xlsx');
  const redRuns = (col) => ws.getRow(1).getCell(col).value.richText
    .filter((r) => r.font?.color?.argb === 'FFFF0000').map((r) => r.text);

  assert.deepEqual(redRuns(1), ['請勿使用中文']);
  assert.deepEqual(redRuns(2), ['(必填)', '長度限制: 20碼']);
  assert.deepEqual(redRuns(3), ['(必填)', '長度限制: 15碼']);
  assert.deepEqual(redRuns(5), ['(必填)', '中文限制: 50字']);
  assert.deepEqual(redRuns(6), ['<100']);
  assert.deepEqual(redRuns(7), ['10 / 20']);
  assert.deepEqual(redRuns(8), ['中文限制: 50字']);
  assert.deepEqual(redRuns(9), ['限數字']);
  assert.equal(ws.getRow(1).getCell(4).value, '電話二');
});

test('姓名、備註的提醒文字為紅字；讀不到的重量、金額整格紅字', async () => {
  const ws = await roundTrip('xlsx');
  const red = (cell) => cell.font?.color?.argb === 'FFFF0000';
  const rowByPhone = {};
  ws.eachRow((row, n) => { if (n > 1) rowByPhone[row.getCell(3).value] = row; });

  // 前段黑字、提醒文字紅字
  const runs = (cell) => cell.value.richText.map((r) => [r.text, r.font?.color?.argb === 'FFFF0000']);

  const named = rowByPhone['0955555555'];
  assert.equal(named.getCell(2).text, '小明2（建議檢查）');
  assert.deepEqual(runs(named.getCell(2)), [['小明2', false], ['（建議檢查）', true]]);
  assert.equal(red(named.getCell(2)), false);

  const gift = rowByPhone['0966666666'];
  assert.equal(gift.getCell(8).text, '贈送測試商品*2（建議刪除）');
  assert.deepEqual(runs(gift.getCell(8)), [['贈送測試商品*2', false], ['（建議刪除）', true]]);

  // 沒有提醒的姓名、備註維持一般文字
  assert.equal(rowByPhone['0922222222'].getCell(2).value, '陳美麗');
  assert.equal(rowByPhone['0955555555'].getCell(8).value, '週一至週五區間送達');

  assert.equal(red(rowByPhone['0923456789'].getCell(7)), true);  // 數量讀不到
  assert.equal(red(rowByPhone['0923456789'].getCell(9)), true);  // 金額讀不到

  const multi = rowByPhone['0977777777'];
  assert.equal(multi.getCell(8).alignment.wrapText, true);
  assert.ok(multi.height > 17);
});
