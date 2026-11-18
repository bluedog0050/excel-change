# CLAUDE.md

給 Claude Code 的專案說明。使用者以繁體中文溝通，commit 訊息、註解、介面文字也都用繁體中文。

## 專案是什麼

「華記蜜餞創始店 新竹物流 Excel轉換工具」：把網路商店匯出的訂單 Excel（.xlsx / .xls）轉成新竹物流宅配匯入格式的單頁網頁工具。
網址：https://dwlin321-username.github.io/excel-change/

詳細轉換規則寫在 `README.md`，**修改規則時要同步更新 README 的規則表**。

## 指令

```bash
npm test                      # node --test tests/*.test.js（不需要 npm install，沒有任何相依套件）
python3 -m http.server 8000   # 本機預覽 http://localhost:8000
```

沒有建置步驟。推送到 `main` 後 `.github/workflows/deploy.yml` 會先跑測試，通過才發布到 GitHub Pages（只打包 `index.html css js vendor`）。

## 架構

純 HTML + 原生 JS（ES5 風格的 IIFE，`'use strict'`），沒有框架、沒有打包工具。`index.html` 依序載入：

1. `vendor/xlsx.full.min.js`：SheetJS 0.20.3，**用來讀檔**，全域 `XLSX`
2. `vendor/exceljs.min.js`：ExcelJS 4.4.0，**用來寫檔**（支援字型、框線、紅字 rich text），全域 `ExcelJS`
3. `js/convert.js`：轉換規則，純邏輯，不碰 DOM 和網路。全域 `Converter`，在 Node 中用 `module.exports`
4. `js/workbook.js`：Excel 讀取與輸出格式（工作表 `hungsongV1`、新細明體 12、欄寬、框線、標題列紅字）。全域 `Workbook`。函式庫由呼叫端傳入，瀏覽器和測試可以共用
5. `js/app.js`：畫面流程（拖曳／選檔 → 處理中，至少 0.5 秒 → 下載／錯誤）。切換 `index.html` 裡的 `view-drop / view-busy / view-done / view-error`

資料流：`Workbook.readRows(XLSX, buffer)` → `Converter.convert(rows)` → `Workbook.buildWorkbook(ExcelJS, result)` → 下載 `原檔名_已編輯.xlsx`。

`convert.js` 開頭集中放規則常數：欄位別名 `COLUMNS`、`STOP_MARKER`（郵局）、`DELIVERY_WORDS`、`HEAVY_QTY`、提醒文字。調整規則通常從這裡改。

新增的 JS 模組要沿用同樣的 UMD 寫法（`module.exports` 或掛到全域），這樣 Node 測試才能 `require()`。

## 必須遵守

- **隱私是核心承諾**：檔案只在瀏覽器本機處理。`index.html` 的 CSP 設定為 `connect-src 'none'`、`script-src 'self'`。
  - 不可加入任何網路請求、外部 CDN、字型、追蹤或統計程式碼
  - 新函式庫要放進 `vendor/`
  - 不可內嵌 `<script>` 或 `style`，CSP 會擋
- **這是公開 repo**：`.gitignore` 排除了 `*.xlsx / *.xls / *.csv`，絕對不要 commit 真實訂單或顧客資料。測試只用 `tests/fixture.js` 的虛構資料。
- 修改轉換規則時，要在 `tests/convert.test.js` 加測試；修改輸出格式時，要在 `tests/workbook.test.js` 加測試。

## 測試

- `tests/convert.test.js`：各規則的單元測試（姓名、備註、電話、金額、重量、郵局截斷等）
- `tests/workbook.test.js`：用真的 SheetJS／ExcelJS（從 `vendor/` require）驗證讀寫與格式
- `tests/fixture.js`：虛構的原始訂單 `HEADER`、`ROWS`
