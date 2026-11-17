/*
 * 轉換規則（純邏輯，不碰 DOM、不碰網路）
 * 瀏覽器中為全域 Converter；在 Node 測試中以 require() 載入。
 */
(function (root) {
  'use strict';

  // 原檔欄位標題（可接受的別名）
  var COLUMNS = {
    name: ['收貨人姓名'],
    phone: ['收貨人聯絡電話', '收貨人電話'],
    address: ['收貨人聯絡地址', '收貨人地址'],
    payment: ['付款方式'],
    note: ['訂單備註'],
    qty: ['商品總數'],
    total: ['總計']
  };

  var STOP_MARKER = '郵局'; // A 欄出現此字樣，該列以下全部排除
  var DELIVERY_WORDS = /送達|送到|配送|寄送|送貨/g; // 不算贈品的「送」
  var HEAVY_QTY = 100; // 商品總數 ≥ 100 → 重量 20
  var NAME_HINT = '（建議檢查）';
  var NOTE_HINT = '（建議刪除）';

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  function normHeader(v) {
    return isBlank(v) ? '' : String(v).replace(/\s+/g, '');
  }

  function toHalfWidth(s) {
    return s.replace(/[０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
  }

  /** 把 'NT$2,500'、'$100'、'50'、5400 轉成數字；讀不出來回傳 null */
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (isBlank(v)) return null;
    var s = toHalfWidth(String(v)).replace(/NT\$|\$|＄|,|，|元|\s/gi, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }

  /** 收貨人姓名：去掉「先生/小姐」，回傳 { value, flag } */
  function cleanName(raw) {
    var s = String(raw).replace(/　/g, ' ').trim();

    // 「鄭君怡 鄭先生」→「鄭君怡」（空白＋單一姓氏＋稱謂）
    var m = s.match(/^(.*\S)\s+\S(?:先生|小姐)$/u);
    if (m) {
      s = m[1].trim();
    } else if (/(先生|小姐)$/.test(s)) {
      var base = s.slice(0, -2).trim();
      // 去掉後只剩 1 個字（例如「林小姐」）就保留原樣
      if (Array.from(base).length >= 2) s = base;
    }

    // 含數字、英文、符號、空白（任何非漢字）或「收」字 → 建議檢查
    var flag = /[^\p{Script=Han}]/u.test(s) || s.indexOf('收') !== -1;
    return { value: s, flag: flag };
  }

  function cleanPhone(raw) {
    if (isBlank(raw)) return null;
    if (typeof raw === 'number') {
      var n = String(raw);
      // 被存成數字而掉了開頭 0 的手機號碼
      return /^9\d{8}$/.test(n) ? '0' + n : n;
    }
    return String(raw).trim();
  }

  function cleanNote(raw) {
    if (isBlank(raw)) return { value: null, flag: false };
    var s = String(raw).replace(/\r\n?/g, '\n');
    var flag = s.replace(DELIVERY_WORDS, '').indexOf('送') !== -1;
    return { value: s, flag: flag };
  }

  function findHeader(rows) {
    var limit = Math.min(rows.length, 20);
    for (var r = 0; r < limit; r++) {
      var row = rows[r] || [];
      var map = {};
      for (var c = 0; c < row.length; c++) {
        var h = normHeader(row[c]);
        if (h && !(h in map)) map[h] = c;
      }
      if ('收貨人姓名' in map) return { index: r, map: map };
    }
    return null;
  }

  function ConvertError(message, missing) {
    this.name = 'ConvertError';
    this.message = message;
    this.missing = missing || [];
  }
  ConvertError.prototype = Object.create(Error.prototype);

  /**
   * rows: 二維陣列（第一個工作表，含標題列）
   * 回傳 { rows: [{ values: [9 欄], flags: {name, weight, note, cod} }], excludedPostal }
   * 姓名、備註需提醒時，在文字後面加上「（建議檢查）」「（建議刪除）」；
   * 重量、代收貨款讀不到時由輸出端標紅字。
   */
  function convert(rows) {
    var header = findHeader(rows || []);
    if (!header) throw new ConvertError('找不到「收貨人姓名」欄位', ['收貨人姓名']);

    var col = {};
    var missing = [];
    Object.keys(COLUMNS).forEach(function (key) {
      var names = COLUMNS[key];
      for (var i = 0; i < names.length; i++) {
        if (names[i] in header.map) { col[key] = header.map[names[i]]; return; }
      }
      missing.push(names[0]);
    });
    if (missing.length) throw new ConvertError('缺少必要欄位：' + missing.join('、'), missing);

    var out = [];
    var excludedPostal = 0;
    var stopped = false;

    for (var r = header.index + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var first = row[0];

      if (!stopped && !isBlank(first) && String(first).indexOf(STOP_MARKER) !== -1) {
        stopped = true;
        continue;
      }
      if (isBlank(row[col.name])) continue; // 空白列或缺收貨人
      if (stopped) { excludedPostal++; continue; }

      var name = cleanName(row[col.name]);
      var note = cleanNote(row[col.note]);

      var qty = toNumber(row[col.qty]);
      var weight = qty === null ? 10 : (qty >= HEAVY_QTY ? 20 : 10);

      var cod = null;
      var codFlag = false;
      if (!isBlank(row[col.payment]) && String(row[col.payment]).indexOf('貨到付款') !== -1) {
        cod = toNumber(row[col.total]);
        if (cod === null) {
          codFlag = true;
          cod = isBlank(row[col.total]) ? null : String(row[col.total]);
        }
      }

      out.push({
        values: [
          null,                                   // 訂單號碼
          name.flag ? name.value + NAME_HINT : name.value, // 收貨人姓名
          cleanPhone(row[col.phone]),             // 收貨人電話
          null,                                   // 電話二
          isBlank(row[col.address]) ? null : String(row[col.address]).trim(), // 收貨人地址
          1,                                      // 件數
          weight,                                 // 重量
          note.flag ? note.value + NOTE_HINT : note.value, // 託運備註
          cod                                     // 代收貨款
        ],
        flags: { name: name.flag, weight: qty === null, note: note.flag, cod: codFlag }
      });
    }

    return { rows: out, excludedPostal: excludedPostal };
  }

  /** 'ABC.xlsx' → 'ABC_已編輯.xlsx' */
  function outputFileName(original) {
    var base = String(original || '檔案').replace(/\.(xlsx|xls)$/i, '');
    return base + '_已編輯.xlsx';
  }

  var api = {
    convert: convert,
    cleanName: cleanName,
    cleanNote: cleanNote,
    cleanPhone: cleanPhone,
    toNumber: toNumber,
    outputFileName: outputFileName,
    ConvertError: ConvertError
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Converter = api;
})(this);
