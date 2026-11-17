const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/convert.js');
const { HEADER, ROWS } = require('./fixture.js');

test('姓名：去掉先生／小姐', () => {
  assert.deepEqual(C.cleanName('王大明先生'), { value: '王大明', flag: false });
  assert.deepEqual(C.cleanName('陳美麗小姐'), { value: '陳美麗', flag: false });
  assert.deepEqual(C.cleanName('穎琦小姐'), { value: '穎琦', flag: false });
});

test('姓名：只有姓氏時保留稱謂', () => {
  assert.deepEqual(C.cleanName('林小姐'), { value: '林小姐', flag: false });
  assert.deepEqual(C.cleanName('陳先生'), { value: '陳先生', flag: false });
});

test('姓名：「空白＋姓＋稱謂」整段移除', () => {
  assert.deepEqual(C.cleanName('鄭君怡 鄭先生'), { value: '鄭君怡', flag: false });
  assert.deepEqual(C.cleanName('  鄭君怡　鄭先生 '), { value: '鄭君怡', flag: false });
});

test('姓名：含數字、收、符號、英文 → 保留並標紅', () => {
  assert.deepEqual(C.cleanName('軒軒2先生'), { value: '軒軒2', flag: true });
  assert.deepEqual(C.cleanName('IC先生'), { value: 'IC', flag: true });
  assert.deepEqual(C.cleanName('亞昕科技-B1倉庫Kevin收先生'), { value: '亞昕科技-B1倉庫Kevin收', flag: true });
  assert.equal(C.cleanName('李收收小姐').flag, true);
  assert.equal(C.cleanName('王(大)明').flag, true);
  assert.equal(C.cleanName('王 明').flag, true);
});

test('備註：「送」字判斷，排除配送用語', () => {
  assert.equal(C.cleanNote('週一至週五區間送達').flag, false);
  assert.equal(C.cleanNote('送到紅不讓，請平日早配').flag, false);
  assert.equal(C.cleanNote('宅配平日配送時間12-21').flag, false);
  assert.equal(C.cleanNote('寄送前請電聯，送貨請放管理室').flag, false);
  assert.equal(C.cleanNote('贈送米果巧克力 2包').flag, true);
  assert.equal(C.cleanNote('20包送1包').flag, true);
  assert.equal(C.cleanNote('因為送公司，麻煩平日送達').flag, true);
  assert.equal(C.cleanNote('請下午三點後到貨').flag, false);
});

test('備註：原樣保留換行，空白視為沒有備註', () => {
  assert.equal(C.cleanNote('收發室\n周一-周五').value, '收發室\n周一-周五');
  assert.equal(C.cleanNote('A\r\nB').value, 'A\nB');
  assert.equal(C.cleanNote('  ').value, null);
  assert.equal(C.cleanNote(null).value, null);
});

test('金額與數量解析', () => {
  assert.equal(C.toNumber('NT$2,500'), 2500);
  assert.equal(C.toNumber('$100'), 100);
  assert.equal(C.toNumber(5400), 5400);
  assert.equal(C.toNumber('50'), 50);
  assert.equal(C.toNumber('１２０'), 120);
  assert.equal(C.toNumber('請洽客服'), null);
  assert.equal(C.toNumber(null), null);
});

test('電話：去空白、補回被吃掉的 0', () => {
  assert.equal(C.cleanPhone(' 0912345678 '), '0912345678');
  assert.equal(C.cleanPhone(912345678), '0912345678');
  assert.equal(C.cleanPhone('02-25570658'), '02-25570658');
});

test('整份轉換結果', () => {
  const { rows, excludedPostal } = C.convert(ROWS);
  assert.equal(rows.length, 10);
  assert.equal(excludedPostal, 2);

  const by = Object.fromEntries(rows.map((r) => [r.values[2], r]));

  // 銀行匯款：代收空白；50 件 → 10
  assert.deepEqual(by['0911111111'].values, [null, '王大明', '0911111111', null, '100臺北市中正區測試路1號', 1, 10, null, null]);
  // 貨到付款：代收 = 總計
  assert.equal(by['0922222222'].values[8], 2000);
  // 108 件（數字）→ 20；總計是數字
  assert.equal(by['0933333333'].values[1], '林小姐');
  assert.equal(by['0933333333'].values[6], 20);
  assert.equal(by['0933333333'].values[8], 5400);
  // 剛好 100 件 → 20
  assert.equal(by['0944444444'].values[6], 20);
  assert.equal(by['0944444444'].values[1], '張測試');
  // 99 件 → 10；送達不標紅
  assert.equal(by['0955555555'].values[6], 10);
  assert.equal(by['0955555555'].flags.note, false);
  assert.equal(by['0955555555'].flags.name, true);
  // 贈品備註標紅
  assert.equal(by['0966666666'].flags.note, true);
  // 換行原樣保留
  assert.equal(by['0977777777'].values[7], '收發室\n周一-周五 0900-1800可收貨');
  // 電話被存成數字
  assert.equal(by['0988888888'].values[1], '黃小華');
  // 銀行匯款即使 100 件也不代收
  assert.equal(by['0912345678'].values[8], null);
  assert.equal(by['0912345678'].values[6], 20);
  // 數量、金額讀不到 → 重量 10、代收保留原文，兩者標紅
  const bad = by['0923456789'];
  assert.equal(bad.values[6], 10);
  assert.equal(bad.values[8], '請洽客服');
  assert.equal(bad.flags.weight, true);
  assert.equal(bad.flags.cod, true);

  // 維持原檔順序
  assert.deepEqual(rows.map((r) => r.values[2]).slice(0, 3), ['0911111111', '0922222222', '0933333333']);
});

test('沒有「寄郵局」時全部轉換', () => {
  const noMarker = ROWS.filter((r) => r[0] !== '寄郵局');
  const { rows, excludedPostal } = C.convert(noMarker);
  assert.equal(rows.length, 12);
  assert.equal(excludedPostal, 0);
});

test('欄位順序不同也能找到', () => {
  const idx = HEADER.map((_, i) => i).reverse();
  const shuffled = ROWS.slice(0, 4).map((r) => idx.map((i) => r[i]));
  const { rows } = C.convert(shuffled);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].values[1], '王大明');
});

test('缺少必要欄位時丟出錯誤', () => {
  const broken = [HEADER.filter((h) => h !== '總計' && h !== '付款方式')];
  assert.throws(() => C.convert(broken), (e) => e instanceof C.ConvertError
    && e.missing.includes('總計') && e.missing.includes('付款方式'));
  assert.throws(() => C.convert([['A', 'B']]), C.ConvertError);
});

test('輸出檔名', () => {
  assert.equal(C.outputFileName('顧客資料.xlsx'), '顧客資料_已編輯.xlsx');
  assert.equal(C.outputFileName('舊檔.XLS'), '舊檔_已編輯.xlsx');
});
