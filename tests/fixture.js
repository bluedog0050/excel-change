/*
 * 測試用的「假」訂單資料（姓名、電話、地址皆為虛構），格式比照網路商店匯出檔。
 * 請勿把真實顧客資料放進這個 repo。
 */
const HEADER = [
  '訂單編號', '訂單日期', '發票類型', '發票號碼', '希望到貨日期時段', '購買人姓名',
  '訂購人聯絡電話', '訂購人E-mail', '訂購人聯絡地址', '付款方式', '運送方式', '訂單備註',
  '收貨人姓名', '收貨人聯絡電話', '收貨人聯絡地址', '訂單狀態', '物流商', '物流單號',
  '訂單明細', '商品總數', '全館優惠折扣', '優惠券折扣', '運費', '總計'
];

let seq = 1;
function order({ name, phone = '0900000000', address = '100臺北市中正區測試路1號', pay = '貨到付款',
  note = null, qty = '40', total = 'NT$2,000' }) {
  const id = '2026110100000' + String(seq++).padStart(2, '0');
  return [id, '2026-11-01 10:00:00', '未啟用開立發票', null, ' ', name, phone, 'test@example.com',
    address, pay, '宅配', note, name, phone, address,
    pay === '貨到付款' ? '處理中\n未付款\n' : '處理中\n已付款\n', null, null,
    '1. 測試商品  數量：1  金額：NT$50\n', qty, null, null, null, total];
}

const ROWS = [
  HEADER,
  order({ name: '王大明先生', phone: '0911111111', pay: '銀行匯款', qty: '50', total: 'NT$2,500' }),
  order({ name: '陳美麗小姐', phone: '0922222222', qty: '40', total: 'NT$2,000' }),
  order({ name: '林小姐', phone: '0933333333', qty: 108, total: 5400 }),
  order({ name: '張測試 張先生', phone: '0944444444', qty: '100', total: 'NT$5,000' }),
  order({ name: '小明2先生', phone: '0955555555', qty: '99', total: 'NT$4,950', note: '週一至週五區間送達' }),
  order({ name: '測試公司-B1倉庫Amy收先生', phone: '0966666666', note: '贈送測試商品*2' }),
  order({ name: 'IC先生', phone: '0977777777', note: '收發室\n周一-周五 0900-1800可收貨' }),
  order({ name: '黃小華先生', phone: 988888888, note: '因為送公司，麻煩平日送達' }),
  order({ name: '吳測試小姐', phone: '0912345678 ', pay: '銀行匯款', qty: '100', total: 'NT$5,000', note: '送到紅不讓，請平日早配' }),
  order({ name: '周測試小姐', phone: '0923456789', qty: '不明', total: '請洽客服' }),
  [null, null, null],
  [null, null, null],
  ['寄郵局', null, null],
  order({ name: '郵局甲先生', phone: '0934567890' }),
  order({ name: '郵局乙小姐', phone: '0945678901' })
];

module.exports = { HEADER, ROWS };
