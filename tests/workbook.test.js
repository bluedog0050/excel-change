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
    W.HEADERS.forEach((h, i) => assert.equal(ws.getRow(1).getCell(i + 1).value, h));
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

test('紅字標示只出現在需要檢查的儲存格', async () => {
  const ws = await roundTrip('xlsx');
  const red = (cell) => cell.font?.color?.argb === 'FFFF0000';
  const rowByPhone = {};
  ws.eachRow((row, n) => { if (n > 1) rowByPhone[row.getCell(3).value] = row; });

  assert.equal(red(rowByPhone['0955555555'].getCell(2)), true);  // 小明2
  assert.equal(red(rowByPhone['0955555555'].getCell(8)), false); // 送達
  assert.equal(red(rowByPhone['0966666666'].getCell(8)), true);  // 贈送
  assert.equal(red(rowByPhone['0922222222'].getCell(2)), false);
  assert.equal(red(rowByPhone['0923456789'].getCell(7)), true);  // 數量讀不到
  assert.equal(red(rowByPhone['0923456789'].getCell(9)), true);  // 金額讀不到

  const multi = rowByPhone['0977777777'];
  assert.equal(multi.getCell(8).alignment.wrapText, true);
  assert.ok(multi.height > 17);
});
