/**
 * 描画ヘルパー：SVGゲージ、ドーナツ、フォーマッタなど。
 */
window.Render = (function () {
  function yen(n) { return '¥' + Math.round(Number(n) || 0).toLocaleString(); }
  function num(n) { return (Number(n) || 0).toLocaleString(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var STATUS = {
    over: { cls: 'g-red', label: '超過', color: '#ff6582' },
    soon: { cls: 'g-amber', label: 'そろそろ', color: '#ffce5e' },
    ok: { cls: 'g-green', label: '余裕', color: '#2effbc' }
  };

  // タコメーター風の開いた円弧ゲージ（270度）
  function gauge(a) {
    var R = 34, C = 2 * Math.PI * R, START = 135, SWEEP = 270;
    var st = STATUS[a.status] || STATUS.ok;
    var frac = Math.max(0, Math.min(1, a.pct));
    var len = C * (SWEEP / 360), filled = len * frac, col = st.color;
    var ticks = '';
    for (var i = 0; i <= 10; i++) {
      var ang = (START + SWEEP / 10 * i) * Math.PI / 180;
      ticks += '<line x1="' + (44 + 39 * Math.cos(ang)).toFixed(1) + '" y1="' + (44 + 39 * Math.sin(ang)).toFixed(1) +
        '" x2="' + (44 + 43 * Math.cos(ang)).toFixed(1) + '" y2="' + (44 + 43 * Math.sin(ang)).toFixed(1) +
        '" stroke="rgba(94,236,255,.25)" stroke-width="1"/>';
    }
    var valTxt = (a.unit === 'km' && Math.abs(a.value) >= 1000) ? (a.value / 1000).toFixed(1) + 'k' : a.value;
    return '' +
      '<div class="gauge panel ' + st.cls + '" data-cat="' + esc(a.category) + '">' +
        '<svg viewBox="0 0 88 88">' +
          '<g transform="rotate(' + START + ' 44 44)">' +
            '<circle cx="44" cy="44" r="' + R + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + len + ' ' + C + '"/>' +
            '<circle cx="44" cy="44" r="' + R + '" fill="none" stroke="' + col + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + filled + ' ' + C + '" style="filter:drop-shadow(0 0 4px ' + col + ')">' +
              '<animate attributeName="stroke-dasharray" from="0 ' + C + '" to="' + filled + ' ' + C + '" dur="1s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>' +
            '</circle>' +
          '</g>' + ticks +
        '</svg>' +
        '<div class="center"><div class="v">' + valTxt + '</div><div class="u">' + esc(a.unit) + '</div></div>' +
        '<div class="label">' + esc(a.label) + '</div>' +
        '<div class="status">' + st.label + '</div>' +
      '</div>';
  }

  var PALETTE = ['#5eecff', '#b187ff', '#ff5cf3', '#2effbc', '#ffce5e', '#ff6582', '#9bbcd4', '#5a8fd6'];

  function donut(breakdown, total) {
    var r = 54, cx = 64, cy = 64, sw = 13, Cc = 2 * Math.PI * r, off = 0, svg = '';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="' + sw + '"/>';
    breakdown.forEach(function (b, i) {
      var frac = total ? b.amount / total : 0, dash = Cc * frac, col = b.color || PALETTE[i % PALETTE.length];
      b._color = col;
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw +
        '" stroke-dasharray="' + dash + ' ' + Cc + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="filter:drop-shadow(0 0 2px ' + col + ')">' +
        '<animate attributeName="stroke-dasharray" from="0 ' + Cc + '" to="' + dash + ' ' + Cc + '" dur="0.9s" begin="' + (i * 0.1) + 's" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/></circle>';
      off += dash;
    });
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="44" fill="#081222"/><circle cx="' + cx + '" cy="' + cy + '" r="44" fill="none" stroke="rgba(94,236,255,.18)" stroke-width="1"/>';
    return svg;
  }

  function legend(breakdown) {
    return breakdown.map(function (b) {
      return '<div class="row"><span class="sw" style="background:' + b._color + ';color:' + b._color + '"></span>' +
        '<span class="nm">' + esc(b.category) + '</span><span class="amt">' + yen(b.amount) + '</span></div>';
    }).join('');
  }

  // 起動カウントアップ
  function countUp(el, target, fmt) {
    target = Number(target) || 0; fmt = fmt || num;
    var n = 0, step = Math.max(1, Math.ceil(target / 40));
    var iv = setInterval(function () { n += step; if (n >= target) { n = target; clearInterval(iv); } el.textContent = fmt(n); }, 22);
  }

  return { yen: yen, num: num, esc: esc, gauge: gauge, donut: donut, legend: legend, countUp: countUp, STATUS: STATUS, PALETTE: PALETTE };
})();
