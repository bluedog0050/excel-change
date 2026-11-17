/* 畫面流程：拖曳／選檔 → 處理中（至少 0.5 秒）→ 下載 */
(function () {
  'use strict';

  var MIN_WAIT_MS = 500;
  var ACCEPT = /\.(xlsx|xls)$/i;

  var views = {
    drop: document.getElementById('view-drop'),
    busy: document.getElementById('view-busy'),
    done: document.getElementById('view-done'),
    error: document.getElementById('view-error')
  };
  var dropzone = document.getElementById('dropzone');
  var input = document.getElementById('file-input');
  var downloadBtn = document.getElementById('download');
  var errorText = document.getElementById('error-text');
  var downloadUrl = null;

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
  }

  function reset() {
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
    input.value = '';
    show('drop');
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function process(file) {
    var name = Converter.outputFileName(file.name);
    var rows = Workbook.readRows(XLSX, await readFile(file));
    var result = Converter.convert(rows);
    if (!result.rows.length) throw new Converter.ConvertError('檔案中沒有可轉換的訂單資料');
    var buffer = await Workbook.buildWorkbook(ExcelJS, result).xlsx.writeBuffer();
    var blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    return { name: name, url: URL.createObjectURL(blob) };
  }

  async function handle(file) {
    if (!file) return;
    if (!ACCEPT.test(file.name)) {
      errorText.textContent = '只支援 .xlsx 或 .xls 檔案';
      show('error');
      return;
    }
    show('busy');
    try {
      var out = (await Promise.all([process(file), wait(MIN_WAIT_MS)]))[0];
      downloadUrl = out.url;
      downloadBtn.dataset.filename = out.name;
      show('done');
    } catch (err) {
      console.error(err);
      errorText.textContent = err instanceof Converter.ConvertError
        ? '這個檔案好像不是訂單匯出檔（' + err.message + '）'
        : '無法讀取這個檔案，請確認它是正常的 Excel 檔';
      show('error');
    }
  }

  // 下載
  downloadBtn.addEventListener('click', function () {
    if (!downloadUrl) return;
    var a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadBtn.dataset.filename || '已編輯.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  document.querySelectorAll('[data-action="reset"]').forEach(function (btn) {
    btn.addEventListener('click', reset);
  });

  // 點擊選檔
  dropzone.addEventListener('click', function () { input.click(); });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', function () { handle(input.files[0]); });

  // 拖曳
  var depth = 0;
  dropzone.addEventListener('dragenter', function (e) {
    e.preventDefault(); depth++; dropzone.classList.add('is-over');
  });
  dropzone.addEventListener('dragleave', function () {
    if (--depth <= 0) { depth = 0; dropzone.classList.remove('is-over'); }
  });
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault(); depth = 0; dropzone.classList.remove('is-over');
    handle(e.dataTransfer.files[0]);
  });

  // 檔案拖到框外時，避免瀏覽器直接打開它而離開本頁
  ['dragover', 'drop'].forEach(function (type) {
    window.addEventListener(type, function (e) { e.preventDefault(); });
  });
})();
