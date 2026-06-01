/**
 * エクスポートモジュール。
 *   - CSV ダウンロード（整備履歴 / 給油履歴 / 年間維持費）
 *   - 印刷用レポート（新ウィンドウで開きブラウザの印刷→PDF保存）
 * すべてクライアントサイドで完結する。バックエンドへの追加は不要。
 */
window.Exporter = (function () {

  /* ---- CSV ---- */

  function toCsv(headers, rows) {
    var lines = [headers.map(q).join(',')];
    rows.forEach(function (r) { lines.push(r.map(q).join(',')); });
    return '﻿' + lines.join('\r\n'); // BOM付きUTF-8 → Excelで文字化けしない
  }

  function q(v) {
    var s = (v == null) ? '' : String(v);
    return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function download(filename, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  var catMap = function () {
    var m = {}; (Store.categories() || []).forEach(function (c) { m[c.code] = c; }); return m;
  };

  async function csvRecords(vehicleId) {
    var v = Store.current();
    var recs = await API.get('getRecords', { vehicle_id: vehicleId });
    var cats = catMap();
    var headers = ['日付', '種類', '走行距離(km)', '費用(円)', '場所', 'メモ'];
    var rows = recs.map(function (r) {
      var lbl = (cats[r.category] || {}).label || r.category;
      return [r.date, lbl, r.odo || '', r.cost || '', r.place || '', r.note || ''];
    });
    var fname = [slug_(v), '整備履歴', today_()].join('_') + '.csv';
    download(fname, toCsv(headers, rows));
    return recs.length;
  }

  async function csvRefuelings(vehicleId) {
    var v = Store.current();
    var refs = await API.get('getRefuelings', { vehicle_id: vehicleId });
    var headers = ['日付', '店舗', '油種', '給油量(L)', '単価(円/L)', '合計(円)', '走行距離(km)', '燃費(km/L)', '満タン'];
    var rows = refs.map(function (r) {
      return [r.date, r.station || '', r.fuel_type || '', r.liters || '', r.unit_price || '',
              r.total || '', r.odo || '', r.fuel_economy || '', r.full_tank ? '○' : ''];
    });
    var fname = [slug_(v), '給油履歴', today_()].join('_') + '.csv';
    download(fname, toCsv(headers, rows));
    return refs.length;
  }

  async function csvAnnualCost(vehicleId, year) {
    var v = Store.current();
    var ann = await API.get('getAnnualCost', { vehicle_id: vehicleId, year: year });
    var fixed = await API.get('getFixedCosts', { vehicle_id: vehicleId, year: year });
    var refs = await API.get('getRefuelings', { vehicle_id: vehicleId });
    var recs = await API.get('getRecords', { vehicle_id: vehicleId });
    var ystr = String(year);

    var headers = ['種別', '日付 / サイクル', '項目', '金額(円)'];
    var rows = [];

    // 給油明細
    refs.filter(function (r) { return String(r.date).slice(0, 4) === ystr; }).forEach(function (r) {
      rows.push(['燃料', r.date, (r.station || '給油') + ' ' + (r.fuel_type || ''), r.total || 0]);
    });
    // 整備明細
    recs.filter(function (r) { return String(r.date).slice(0, 4) === ystr; }).forEach(function (r) {
      var cats = catMap();
      rows.push(['整備・車検', r.date, (cats[r.category] || {}).label || r.category, r.cost || 0]);
    });
    // 固定費
    fixed.forEach(function (f) {
      var cyc = f.cycle === 'monthly' ? '月額×12' : f.cycle === 'once' ? '単発' : '年額';
      var amt = Number(f.amount) * (f.cycle === 'monthly' ? 12 : 1);
      rows.push([f.category, cyc + (f.note ? ' / ' + f.note : ''), f.category, amt]);
    });
    // 集計行
    rows.push(['', '', '─── 合計 ───', ann.total]);

    var fname = [slug_(v), ystr + '年間維持費', today_()].join('_') + '.csv';
    download(fname, toCsv(headers, rows));
    return rows.length;
  }

  /* ---- 印刷レポート ---- */

  async function printReport(vehicleId, year) {
    var v = Store.current();
    var recs = await API.get('getRecords', { vehicle_id: vehicleId });
    var refs = await API.get('getRefuelings', { vehicle_id: vehicleId });
    var ann = await API.get('getAnnualCost', { vehicle_id: vehicleId, year: year });
    var fixed = await API.get('getFixedCosts', { vehicle_id: vehicleId, year: year });
    var cats = catMap();
    var ystr = String(year);
    var now = new Date().toLocaleString('ja-JP');

    var html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<title>${esc(v.name)} 整備レポート ${ystr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:"Noto Sans JP",sans-serif;font-size:11px;color:#1a1a2e;background:#fff;padding:16mm 14mm;}
  h1{font-size:20px;color:#0a1a3a;border-bottom:3px solid #5eecff;padding-bottom:8px;margin-bottom:16px;letter-spacing:1px;}
  h2{font-size:13px;color:#0a3a6a;border-left:4px solid #5eecff;padding-left:8px;margin:20px 0 8px;}
  h3{font-size:11px;color:#2a4a7a;margin:14px 0 5px;font-weight:700;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
  .header .vehicle{background:#f0f8ff;border:1px solid #c0d8f0;padding:10px 14px;min-width:260px;}
  .header .vehicle .vname{font-size:16px;font-weight:700;color:#0a1a3a;}
  .header .vehicle .vmeta{font-size:10px;color:#4a6a8a;margin-top:3px;}
  .header .vehicle .vodo{font-size:14px;font-weight:700;color:#0a5a9a;margin-top:5px;}
  .header .meta{text-align:right;font-size:9px;color:#6a8aaa;line-height:1.7;}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  th{background:#0a1a3a;color:#fff;padding:5px 7px;text-align:left;font-size:10px;}
  td{padding:4px 7px;border-bottom:1px solid #e8eef4;}
  tr:nth-child(even) td{background:#f7fbff;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  .total-row td{font-weight:700;background:#e8f4ff !important;border-top:2px solid #5eecff;}
  .alert-red{color:#c0392b;font-weight:700;}
  .alert-amber{color:#d68910;}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
  .kpi{background:#f0f8ff;border:1px solid #c0d8f0;padding:8px 10px;text-align:center;}
  .kpi .k{font-size:9px;color:#6a8aaa;}
  .kpi .v{font-size:16px;font-weight:700;color:#0a3a6a;margin-top:3px;}
  .donut-row{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px;}
  .donut-row .legend{flex:1;}
  .legend-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:10px;}
  .legend-sw{width:10px;height:10px;flex:none;}
  .legend-amt{margin-left:auto;font-variant-numeric:tabular-nums;}
  .note{font-size:9px;color:#8a9aaa;margin-top:16px;border-top:1px solid #d0dde8;padding-top:8px;}
  .page-break{page-break-before:always;}
  @media print{body{padding:8mm 10mm;} .no-print{display:none;}}
</style>
</head>
<body>

<div class="header">
  <div class="vehicle">
    <div class="vname">${esc(v.name)}</div>
    <div class="vmeta">${esc([v.maker, v.model, v.year, v.grade].filter(Boolean).join(' '))}${v.plate ? ' ・ ' + esc(v.plate) : ''}</div>
    <div class="vmeta">初度登録: ${esc(v.first_reg_date || '—')}</div>
    <div class="vodo">総走行距離: ${fmtNum(v.current_odo)} km</div>
  </div>
  <div class="meta">
    出力日時: ${esc(now)}<br>
    対象年: ${ystr}年<br>
    MyCar Console
  </div>
</div>

<h1>🚙 車両整備レポート ${ystr}年</h1>

<!-- サマリー -->
<h2>年間維持費サマリー</h2>
<div class="summary-grid">
  <div class="kpi"><div class="k">年間総額</div><div class="v">¥${fmtNum(ann.total)}</div></div>
  <div class="kpi"><div class="k">月平均</div><div class="v">¥${fmtNum(ann.monthly_avg)}</div></div>
  <div class="kpi"><div class="k">前年比</div><div class="v">${ann.yoy_pct != null ? (ann.yoy_pct <= 0 ? '▼' : '▲') + Math.abs(ann.yoy_pct) + '%' : '—'}</div></div>
</div>

<h3>内訳</h3>
<div class="donut-row">
  <svg width="120" height="120">${donutSvg(ann.breakdown, ann.total)}</svg>
  <div class="legend">${ann.breakdown.map(function (b, i) {
    var col = ['#5eecff','#b187ff','#ff5cf3','#2effbc','#ffce5e','#ff6582','#9bbcd4'][i % 7];
    return '<div class="legend-row"><span class="legend-sw" style="background:' + col + '"></span>' +
      '<span>' + esc(b.category) + '</span><span class="legend-amt">¥' + fmtNum(b.amount) + '</span></div>';
  }).join('')}</div>
</div>

<!-- 整備履歴 -->
<h2>整備・実施履歴</h2>
${buildMaintenanceTable(recs, cats)}

<!-- 給油履歴 -->
<h2>給油履歴（${ystr}年）</h2>
${buildRefuelTable(refs.filter(function(r){return String(r.date).slice(0,4)===ystr;}), refs)}

<!-- 固定費 -->
<h2>固定費 ${ystr}年</h2>
${buildFixedTable(fixed)}

<!-- 年間推移 -->
${ann.trend && ann.trend.length ? '<h2>年間維持費 推移</h2>' + buildTrendTable(ann.trend) : ''}

<div class="note">
  ※ このレポートは MyCar Console アプリの登録データをもとに自動生成されました。<br>
  ※ 出力日時: ${esc(now)} ／ データはデモモードの場合はサンプルデータです。
</div>

<script>window.onload=function(){window.print();}</script>
</body>
</html>`;

    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  /* ---- HTML部品ビルダー ---- */

  function buildMaintenanceTable(recs, cats) {
    if (!recs.length) return '<p style="color:#8a9aaa;font-size:10px">記録なし</p>';
    var rows = recs.map(function (r) {
      var lbl = (cats[r.category] || {}).label || r.category;
      return '<tr><td>' + esc(r.date) + '</td><td>' + esc(lbl) + '</td><td class="num">' +
        (r.odo ? fmtNum(r.odo) + ' km' : '—') + '</td><td>' + esc(r.place || '—') + '</td>' +
        '<td class="num">' + (r.cost ? '¥' + fmtNum(r.cost) : '—') + '</td>' +
        '<td>' + esc(r.note || '') + '</td></tr>';
    }).join('');
    var total = recs.reduce(function (s, r) { return s + (Number(r.cost) || 0); }, 0);
    return '<table><thead><tr><th>日付</th><th>種類</th><th>走行距離</th><th>場所</th><th>費用</th><th>メモ</th></tr></thead><tbody>' +
      rows + '<tr class="total-row"><td colspan="4">合計</td><td class="num">¥' + fmtNum(total) + '</td><td></td></tr></tbody></table>';
  }

  function buildRefuelTable(refs, allRefs) {
    if (!refs.length) return '<p style="color:#8a9aaa;font-size:10px">記録なし</p>';
    var rows = refs.map(function (r) {
      return '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.station || '—') + '</td><td>' + esc(r.fuel_type || '') + '</td>' +
        '<td class="num">' + (r.liters || '—') + ' L</td><td class="num">¥' + (r.unit_price || '—') + '/L</td>' +
        '<td class="num">¥' + fmtNum(r.total) + '</td><td class="num">' + (r.fuel_economy ? r.fuel_economy + ' km/L' : '—') + '</td></tr>';
    }).join('');
    var total = refs.reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0);
    var avgEco = (function () {
      var e = refs.filter(function (r) { return r.fuel_economy > 0; });
      return e.length ? (e.reduce(function (s, r) { return s + r.fuel_economy; }, 0) / e.length).toFixed(1) : '—';
    })();
    return '<table><thead><tr><th>日付</th><th>店舗</th><th>油種</th><th>給油量</th><th>単価</th><th>合計</th><th>燃費</th></tr></thead><tbody>' +
      rows + '<tr class="total-row"><td colspan="5">合計 / 平均燃費</td><td class="num">¥' + fmtNum(total) + '</td><td class="num">' + avgEco + (avgEco !== '—' ? ' km/L' : '') + '</td></tr></tbody></table>';
  }

  function buildFixedTable(fixed) {
    if (!fixed.length) return '<p style="color:#8a9aaa;font-size:10px">登録なし</p>';
    var rows = fixed.map(function (f) {
      var cyc = f.cycle === 'monthly' ? '毎月' : f.cycle === 'once' ? '単発' : '毎年';
      var ann = Number(f.amount) * (f.cycle === 'monthly' ? 12 : 1);
      return '<tr><td>' + esc(f.category) + '</td><td>' + cyc + '</td><td class="num">¥' + fmtNum(f.amount) + '</td>' +
        '<td class="num">¥' + fmtNum(ann) + '</td><td>' + esc(f.note || '') + '</td></tr>';
    }).join('');
    var total = fixed.reduce(function (s, f) { return s + Number(f.amount) * (f.cycle === 'monthly' ? 12 : 1); }, 0);
    return '<table><thead><tr><th>項目</th><th>サイクル</th><th>金額</th><th>年換算</th><th>メモ</th></tr></thead><tbody>' +
      rows + '<tr class="total-row"><td colspan="3">年間合計</td><td class="num">¥' + fmtNum(total) + '</td><td></td></tr></tbody></table>';
  }

  function buildTrendTable(trend) {
    var rows = trend.map(function (t) {
      return '<tr><td>' + t.year + '年</td><td class="num">¥' + fmtNum(t.total) + '</td>' +
        '<td class="num">¥' + fmtNum(Math.round(t.total / 12)) + '/月</td></tr>';
    }).join('');
    return '<table><thead><tr><th>年</th><th>年間総額</th><th>月平均</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---- ドーナツ SVG（印刷用・白背景版）---- */
  function donutSvg(breakdown, total) {
    var r = 45, cx = 60, cy = 60, sw = 14, Cc = 2 * Math.PI * r, off = 0;
    var palette = ['#5eecff','#b187ff','#ff5cf3','#2effbc','#ffce5e','#ff6582','#9bbcd4'];
    var out = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#e8eef4" stroke-width="' + sw + '"/>';
    breakdown.forEach(function (b, i) {
      var frac = total ? b.amount / total : 0, dash = Cc * frac, col = palette[i % palette.length];
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col +
        '" stroke-width="' + sw + '" stroke-dasharray="' + dash + ' ' + Cc + '" stroke-dashoffset="' + (-off) +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      off += dash;
    });
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="34" fill="#fff"/>';
    out += '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" font-size="8" fill="#6a8aaa">TOTAL</text>';
    out += '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="#0a1a3a">¥' + fmtNum(total) + '</text>';
    return out;
  }

  /* ---- ユーティリティ ---- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  function fmtNum(n) { return Math.round(Number(n) || 0).toLocaleString(); }
  function today_() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
  function slug_(v) { return [v.maker, v.model].filter(Boolean).join('_').replace(/\s+/g, '_') || 'vehicle'; }

  return { csvRecords, csvRefuelings, csvAnnualCost, printReport };
})();
