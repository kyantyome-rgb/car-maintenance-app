/**
 * アプリ本体：状態管理・画面ルーティング・各画面描画・フォーム。
 */
var Store = (function () {
  var state = { user: null, vehicles: [], currentVehicleId: null, categories: [] };
  return {
    userEmail: function () { return state.user && state.user.email; },
    state: state,
    async init() {
      var boot = await API.get('getBootstrap');
      state.user = boot.user; state.vehicles = boot.vehicles || []; state.categories = boot.categories || [];
      if (state.vehicles.length) state.currentVehicleId = state.vehicles[0].vehicle_id;
    },
    vehicles: function () { return state.vehicles; },
    categories: function () { return state.categories; },
    current: function () { return state.vehicles.filter(function (v) { return v.vehicle_id === state.currentVehicleId; })[0]; },
    setVehicle: function (id) { state.currentVehicleId = id; },
    async reload() { state.vehicles = await API.get('getVehicles'); }
  };
})();

var App = (function () {
  var R = window.Render;
  var screenEl, currentScreen = 'dashboard';
  var appBooted = false, appBooting = false;

  /* ---------- 共通UI ---------- */
  function el(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = el('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function openModal(title, bodyHtml) {
    el('modalTitle').textContent = title;
    el('modalBody').innerHTML = bodyHtml;
    el('modalWrap').classList.add('open');
  }
  function closeModal() { el('modalWrap').classList.remove('open'); }

  function renderVehicleBar() {
    var v = Store.current();
    var bar = el('vehicleBar');
    if (!v) { bar.innerHTML = '<div class="meta"><div class="name">車両未登録</div><div class="sub">＋ から車両を追加</div></div>'; return; }
    bar.innerHTML =
      '<div class="pic">🚙</div>' +
      '<div class="meta"><div class="name">' + R.esc(v.name) + '</div>' +
        '<div class="sub">' + R.esc([v.maker, v.model, v.year].filter(Boolean).join(' ')) + (v.plate ? ' · ' + R.esc(v.plate) : '') + '</div></div>' +
      '<div class="odo"><div class="num">' + R.num(v.current_odo) + '</div><div class="lbl">TOTAL km</div></div>' +
      (Store.vehicles().length > 1 ? '<div class="chev">▾</div>' : '');
    bar.onclick = Store.vehicles().length > 1 ? openVehiclePicker : null;
    bar.classList.toggle('clickable', Store.vehicles().length > 1);
  }

  function openVehiclePicker() {
    var html = Store.vehicles().map(function (v) {
      return '<button class="listitem" data-vid="' + v.vehicle_id + '"><span class="li-ico">🚙</span>' +
        '<span class="li-main"><span class="li-ttl">' + R.esc(v.name) + '</span>' +
        '<span class="li-sub">' + R.esc([v.maker, v.model].filter(Boolean).join(' ')) + '</span></span>' +
        '<span class="li-right">' + R.num(v.current_odo) + ' km</span></button>';
    }).join('');
    openModal('車両を切り替え', '<div class="list">' + html + '</div>');
    el('modalBody').querySelectorAll('[data-vid]').forEach(function (b) {
      b.onclick = function () { Store.setVehicle(b.dataset.vid); closeModal(); renderVehicleBar(); show(currentScreen); };
    });
  }

  /* ---------- ルーティング ---------- */
  function setNav(name) {
    document.querySelectorAll('.nav button[data-screen]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.screen === name);
    });
  }
  async function show(name) {
    currentScreen = name; setNav(name);
    screenEl.innerHTML = '<div class="loading">読み込み中…</div>';
    try {
      if (name === 'dashboard') await screenDashboard();
      else if (name === 'history') await screenHistory();
      else if (name === 'refuel') await screenRefuel();
      else if (name === 'cost') await screenCost();
      else if (name === 'alerts') await screenAlerts();
      else if (name === 'settings') await screenSettings();
    } catch (e) {
      screenEl.innerHTML = '<div class="loading err">エラー: ' + R.esc(e.message) + '</div>';
    }
  }

  /* ---------- ダッシュボード ---------- */
  async function screenDashboard() {
    var vid = Store.current() && Store.current().vehicle_id;
    if (!vid) { screenEl.innerHTML = emptyVehicle(); bindEmpty(); return; }
    var d = await API.get('getDashboard', { vehicle_id: vid });
    var news = [];
    try { news = await API.get('getNews', { vehicle_id: vid }); } catch (e) {}

    var topAlerts = d.alerts.slice(0, 3);
    var restAlerts = d.alerts.slice(3);
    var ann = d.annual;

    var html = '';
    // gauges
    html += secAction('MAINTENANCE', '設定', 'gotoAlerts');
    html += topAlerts.length ? '<div class="gauges">' + topAlerts.map(R.gauge).join('') + '</div>'
      : '<div class="panel pad muted tappable" id="setupAlerts">メンテ項目が未設定です。タップして追加できます。</div>';

    // annual cost
    html += secYear('ANNUAL COST', ann.year);
    html += '<div class="cost panel">' +
      '<div class="cost-top"><div class="donut"><svg viewBox="0 0 128 128">' + R.donut(ann.breakdown, ann.total) + '</svg>' +
        '<div class="ctr"><div class="cap">TOTAL / YEAR</div><div class="big"><small>¥</small><span id="annTotal">0</span></div></div></div>' +
        '<div class="legend">' + R.legend(ann.breakdown) + '</div></div>' +
      '<div class="cost-foot">' +
        kpi('月平均', R.yen(ann.monthly_avg)) +
        kpi('前年比', ann.yoy_pct == null ? '—' : (ann.yoy_pct <= 0 ? '▼ ' : '▲ ') + Math.abs(ann.yoy_pct) + '%', ann.yoy_pct == null ? '' : (ann.yoy_pct <= 0 ? 'up' : 'dn')) +
        kpi('総額', R.yen(ann.total)) +
      '</div>' + trend(ann.trend) + '</div>';

    // this month
    html += sec('THIS MONTH');
    html += '<div class="tiles">' +
      tile('⛽ 平均燃費', (d.recent_economy ? d.recent_economy : '—') + '<small> km/L</small>') +
      tile('💴 今月の費用', '<small>¥</small>' + R.num(d.month_fuel_cost + d.month_maint_cost), '燃料 ' + R.yen(d.month_fuel_cost) + ' / 整備 ' + R.yen(d.month_maint_cost)) +
      '</div>';

    // alerts + deadlines
    html += sec('ALERTS & DEADLINES');
    html += '<div class="alerts">';
    (d.deadlines || []).forEach(function (dl) {
      var days = Math.round((new Date(dl.due_date) - new Date()) / 86400000);
      var cls = days < 30 ? 'warn' : 'ok';
      html += alertRow('🔧', dl.type, '期限 ' + dl.due_date, days + ' 日', cls);
    });
    restAlerts.forEach(function (a) {
      var st = R.STATUS[a.status];
      html += alertRow(a.icon, a.label, a.last_done_date ? '前回 ' + a.last_done_date : '', (a.value) + ' ' + a.unit, a.status === 'over' ? 'crit' : a.status === 'soon' ? 'warn' : 'ok', st.label);
    });
    if (!restAlerts.length && !(d.deadlines || []).length) html += '<div class="panel pad muted">直近の通知はありません。</div>';
    html += '</div>';

    // news
    html += sec((Store.current().model || '車種') + ' NEWS');
    html += '<div class="news">' + (news.length ? news.map(newsCard).join('') : '<div class="panel pad muted">情報なし</div>') + '</div>';
    html += '<div class="foot">⚠ ニュースはAI生成のため正確性は保証されません</div>';

    screenEl.innerHTML = html;
    var t = el('annTotal'); if (t) R.countUp(t, ann.total);
    // メンテ設定への導線
    var goAlerts = el('gotoAlerts'); if (goAlerts) goAlerts.onclick = function () { show('alerts'); };
    var setupAlerts = el('setupAlerts'); if (setupAlerts) setupAlerts.onclick = function () { show('alerts'); };
    // ゲージをタップ → 該当ルールを編集
    screenEl.querySelectorAll('.gauge[data-cat]').forEach(function (g) {
      g.style.cursor = 'pointer';
      g.onclick = function () { editRuleByCategory(g.dataset.cat); };
    });
  }

  // ダッシュボードのゲージから直接ルール編集へ
  async function editRuleByCategory(category) {
    await show('alerts');
    try {
      var vid = Store.current().vehicle_id;
      var rules = await API.get('getRules', { vehicle_id: vid });
      var rule = rules.filter(function (r) { return r.category === category; })[0];
      if (rule) openRuleForm(rule);
    } catch (e) {}
  }

  function newsCard(n) {
    var tag = (n.tag === 'RECALL') ? '<div class="tag recall">● RECALL</div>' : '<div class="tag">● ' + R.esc(n.tag || 'TOPIC') + '</div>';
    var inner = '<div class="nt">' + R.esc(n.title) + '</div><div class="ns">' + R.esc(n.summary) + '</div>';
    return n.url ? '<a class="ncard" href="' + R.esc(n.url) + '" target="_blank" rel="noopener">' + tag + inner + '</a>'
      : '<div class="ncard">' + tag + inner + '</div>';
  }

  /* ---------- 履歴 ---------- */
  async function screenHistory() {
    var vid = Store.current().vehicle_id;
    var recs = await API.get('getRecords', { vehicle_id: vid });
    var catMap = {}; Store.categories().forEach(function (c) { catMap[c.code] = c; });
    var html = sec('整備・実施履歴');
    if (!recs.length) { html += '<div class="panel pad muted">記録がありません。＋ から追加できます。</div>'; }
    else {
      html += '<div class="list">' + recs.map(function (r) {
        var c = catMap[r.category] || { label: r.category, icon: '🔩' };
        return '<div class="listitem"><span class="li-ico">' + (c.icon || '🔩') + '</span>' +
          '<span class="li-main"><span class="li-ttl">' + R.esc(c.label) + '</span>' +
          '<span class="li-sub">' + r.date + (r.odo ? ' · ' + R.num(r.odo) + 'km' : '') + (r.place ? ' · ' + R.esc(r.place) : '') + '</span></span>' +
          '<span class="li-right">' + (r.cost ? R.yen(r.cost) : '—') + '</span></div>';
      }).join('') + '</div>';
    }
    screenEl.innerHTML = html;
  }

  /* ---------- 給油 ---------- */
  async function screenRefuel() {
    var vid = Store.current().vehicle_id;
    var refs = await API.get('getRefuelings', { vehicle_id: vid });
    var ecoList = refs.filter(function (r) { return r.fuel_economy > 0; });
    var avgEco = ecoList.length ? (ecoList.reduce(function (s, r) { return s + r.fuel_economy; }, 0) / ecoList.length).toFixed(1) : '—';
    var avgPrice = refs.length ? Math.round(refs.reduce(function (s, r) { return s + r.unit_price; }, 0) / refs.length) : '—';
    var html = sec('給油');
    html += '<div class="tiles">' + tile('平均燃費', avgEco + '<small> km/L</small>') + tile('平均単価', '<small>¥</small>' + avgPrice + '<small>/L</small>') + '</div>';
    html += sec('給油履歴');
    if (!refs.length) html += '<div class="panel pad muted">記録がありません。＋ から追加（レシート読取り対応）。</div>';
    else html += '<div class="list">' + refs.map(function (r) {
      return '<div class="listitem"><span class="li-ico">⛽</span>' +
        '<span class="li-main"><span class="li-ttl">' + R.esc(r.station || '給油') + '</span>' +
        '<span class="li-sub">' + r.date + ' · ' + r.liters + 'L · ¥' + r.unit_price + '/L' + (r.fuel_economy ? ' · ' + r.fuel_economy + 'km/L' : '') + '</span></span>' +
        '<span class="li-right">' + R.yen(r.total) + '</span></div>';
    }).join('') + '</div>';
    screenEl.innerHTML = html;
  }

  /* ---------- 維持費 ---------- */
  var costYear = new Date().getFullYear();
  async function screenCost() {
    var vid = Store.current().vehicle_id;
    var ann = await API.get('getAnnualCost', { vehicle_id: vid, year: costYear });
    var fixed = await API.get('getFixedCosts', { vehicle_id: vid, year: costYear });
    var html = secYear('年間維持費', costYear, true);
    html += '<div class="cost panel">' +
      '<div class="cost-top"><div class="donut"><svg viewBox="0 0 128 128">' + R.donut(ann.breakdown, ann.total) + '</svg>' +
        '<div class="ctr"><div class="cap">TOTAL / YEAR</div><div class="big"><small>¥</small><span id="annTotal2">0</span></div></div></div>' +
        '<div class="legend">' + R.legend(ann.breakdown) + '</div></div>' +
      '<div class="cost-foot">' + kpi('月平均', R.yen(ann.monthly_avg)) +
        kpi('前年比', ann.yoy_pct == null ? '—' : (ann.yoy_pct <= 0 ? '▼ ' : '▲ ') + Math.abs(ann.yoy_pct) + '%', ann.yoy_pct == null ? '' : (ann.yoy_pct <= 0 ? 'up' : 'dn')) +
        kpi('総額', R.yen(ann.total)) + '</div>' + trend(ann.trend) + '</div>';

    html += sec('固定費 · ' + costYear);
    html += '<div class="chips">' + fixed.map(function (f) {
      var cyc = f.cycle === 'monthly' ? '月' : f.cycle === 'once' ? '単発' : '年';
      return '<div class="chip" data-cost="' + f.cost_id + '"><span>' + iconForFixed(f.category) + '</span><span>' + R.esc(f.category) + '</span>' +
        '<span class="amt">' + R.yen(f.amount) + '</span><span class="cyc">/' + cyc + '</span></div>';
    }).join('') + '<div class="chip add" id="addFixed"><span>＋</span>固定費を追加</div></div>';

    screenEl.innerHTML = html;
    var t = el('annTotal2'); if (t) R.countUp(t, ann.total);
    // year nav
    screenEl.querySelectorAll('[data-yr]').forEach(function (b) {
      b.onclick = function () { costYear += Number(b.dataset.yr); show('cost'); };
    });
    el('addFixed').onclick = function () { openFixedForm(); };
    screenEl.querySelectorAll('[data-cost]').forEach(function (c) {
      c.onclick = function () { var f = fixed.filter(function (x) { return x.cost_id === c.dataset.cost; })[0]; openFixedForm(f); };
    });
  }

  function iconForFixed(cat) {
    return ({ '自動車税': '🏷️', '任意保険': '🛡️', '自賠責': '📄', '駐車場': '🅿️', '車検費用': '🔧', 'ローン': '🏦', 'JAF・会費': '🚗' })[cat] || '💴';
  }

  /* ---------- アラート設定 ---------- */
  var WARN_OPTS = [
    { pct: 0.25, label: '早め（残り25%）' },
    { pct: 0.15, label: '標準（残り15%）' },
    { pct: 0.10, label: 'ギリギリ（残り10%）' }
  ];

  async function screenAlerts() {
    var vid = Store.current().vehicle_id;
    var rules = await API.get('getRules', { vehicle_id: vid });
    var alerts = await API.get('getAlerts', { vehicle_id: vid });
    var catMap = {}; Store.categories().forEach(function (c) { catMap[c.code] = c; });
    var statusMap = {}; alerts.forEach(function (a) { statusMap[a.category] = a; });

    var html = '<div class="alerts-intro panel pad small">各メンテ項目に「交換の目安」を設定すると、走行距離や経過期間からダッシュボードに通知されます。距離と期間の<b>両方</b>を設定した場合は、先に到達した方で判定します。</div>';

    html += sec('アラート項目');
    if (!rules.length) {
      html += '<div class="panel pad muted">まだ設定がありません。下のボタンから追加してください。</div>';
    } else {
      html += '<div class="list">' + rules.map(function (r) {
        var c = catMap[r.category] || { label: r.category, icon: '🔧' };
        var intervals = [];
        if (r.interval_km !== '' && r.interval_km != null && Number(r.interval_km) > 0) intervals.push(R.num(r.interval_km) + ' km');
        if (r.interval_months !== '' && r.interval_months != null && Number(r.interval_months) > 0) intervals.push(r.interval_months + ' ヶ月');
        var st = statusMap[r.category];
        var stHtml = st ? '<span class="rule-status ' + R.STATUS[st.status].cls + '">' + R.STATUS[st.status].label + '</span>' : '';
        return '<button class="listitem" data-rule="' + r.rule_id + '">' +
          '<span class="li-ico">' + (c.icon || '🔧') + '</span>' +
          '<span class="li-main"><span class="li-ttl">' + R.esc(c.label) + ' ' + stHtml + '</span>' +
          '<span class="li-sub">目安 ' + (intervals.join(' / ') || '未設定') +
          (r.last_done_date ? ' ・ 前回 ' + r.last_done_date : '') + '</span></span>' +
          '<span class="li-right">編集 ›</span></button>';
      }).join('') + '</div>';
    }
    html += '<button class="btn ghost block" id="addRule">＋ アラート項目を追加</button>';

    screenEl.innerHTML = html;
    el('addRule').onclick = function () { openRuleForm(); };
    screenEl.querySelectorAll('[data-rule]').forEach(function (b) {
      b.onclick = function () { openRuleForm(rules.filter(function (r) { return r.rule_id === b.dataset.rule; })[0]); };
    });
  }

  function openRuleForm(rule) {
    rule = rule || {};
    var isEdit = !!rule.rule_id;
    // 編集時はそのカテゴリ固定、新規時は未使用カテゴリから選択
    var cats = Store.categories().filter(function (c) { return c.code !== 'refuel'; });
    var catField;
    if (isEdit) {
      var cc = cats.filter(function (c) { return c.code === rule.category; })[0] || { code: rule.category, label: rule.category, icon: '🔧' };
      catField = '<div class="rule-cat-fixed">' + (cc.icon || '🔧') + ' ' + R.esc(cc.label) + '</div>';
    } else {
      catField = '<select id="r_cat">' + cats.map(function (c) {
        return '<option value="' + c.code + '">' + c.icon + ' ' + c.label + '</option>';
      }).join('') + '</select>';
    }

    var curPct = rule.warn_threshold_pct === '' || rule.warn_threshold_pct == null ? 0.15 : Number(rule.warn_threshold_pct);
    var warnSel = '<select id="r_warn">' + WARN_OPTS.map(function (o) {
      return '<option value="' + o.pct + '"' + (Math.abs(o.pct - curPct) < 0.001 ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('') + '</select>';

    openModal(isEdit ? 'アラートを編集' : 'アラート項目を追加', '<form id="frm">' +
      field('項目', catField) +
      '<div class="rule-hint">交換・点検の目安（片方だけでも可）</div>' +
      '<div class="grid2">' +
        field('距離の目安 (km)', input('r_km', 'number', rule.interval_km, 'min="0" placeholder="例 5000"')) +
        field('期間の目安 (ヶ月)', input('r_months', 'number', rule.interval_months, 'min="0" placeholder="例 6"')) +
      '</div>' +
      field('警告を出すタイミング', warnSel) +
      '<div class="rule-hint">前回実施（記録を追加すると自動更新されます）</div>' +
      '<div class="grid2">' +
        field('前回の走行距離 (km)', input('r_odo', 'number', rule.last_done_odo, 'min="0"')) +
        field('前回の実施日', input('r_date', 'date', rule.last_done_date)) +
      '</div>' +
      submitBar(isEdit ? 'del' : '') + '</form>');

    bindForm(function () {
      var km = el('r_km').value, months = el('r_months').value;
      return API.post('saveRule', { rule: {
        rule_id: rule.rule_id || '',
        vehicle_id: Store.current().vehicle_id,
        category: isEdit ? rule.category : el('r_cat').value,
        interval_km: km === '' ? '' : Number(km),
        interval_months: months === '' ? '' : Number(months),
        warn_threshold_pct: Number(el('r_warn').value),
        last_done_odo: el('r_odo').value === '' ? '' : Number(el('r_odo').value),
        last_done_date: el('r_date').value,
        is_active: true
      } });
    }, 'アラート設定を保存しました', 'alerts');

    // 「削除」= 無効化（is_active=false で保存）
    if (isEdit) {
      var b = el('frmDel'); if (b) b.onclick = async function () {
        if (!confirm('このアラート項目を削除しますか？')) return;
        try {
          await API.post('saveRule', { rule: Object.assign({}, rule, { is_active: false }) });
          closeModal(); toast('削除しました'); show('alerts');
        } catch (e) { toast('削除失敗: ' + e.message); }
      };
    }
  }

  /* ---------- 設定 ---------- */
  async function screenSettings() {
    var users = [];
    try { users = await API.get('getUsers'); } catch (e) {}
    var v = Store.current();
    var year = new Date().getFullYear();

    // ---- アカウント ----
    var au = (window.Auth && Auth.user()) || Store.state.user || {};
    var html = sec('アカウント');
    html += '<div class="panel pad account">';
    html += '<div class="account-row"><span class="li-ico">👤</span>' +
      '<span class="li-main"><span class="li-ttl">' + R.esc(au.name || au.display_name || 'ユーザー') + '</span>' +
      '<span class="li-sub">' + R.esc(au.email || '') + '</span></span></div>';
    if (CONFIG.DEMO_MODE) {
      html += '<div class="account-note">DEMOモード：Googleログインはスキップされています。</div>';
    } else {
      html += '<button class="btn ghost block" id="signOutBtn">サインアウト</button>';
    }
    html += '</div>';

    html += sec('車両');
    html += '<div class="list">' + Store.vehicles().map(function (vv) {
      return '<button class="listitem" data-editv="' + vv.vehicle_id + '"><span class="li-ico">🚙</span>' +
        '<span class="li-main"><span class="li-ttl">' + R.esc(vv.name) + '</span><span class="li-sub">' + R.esc([vv.maker, vv.model, vv.year].filter(Boolean).join(' ')) + '</span></span>' +
        '<span class="li-right">編集 ›</span></button>';
    }).join('') + '</div>';
    html += '<button class="btn ghost block" id="addVehicle">＋ 車両を追加</button>';

    html += sec('メンテナンス');
    html += '<button class="listitem" id="gotoAlertsSetting"><span class="li-ico">🔔</span>' +
      '<span class="li-main"><span class="li-ttl">アラート設定</span>' +
      '<span class="li-sub">オイル・タイヤ・車検など交換目安の管理</span></span>' +
      '<span class="li-right">›</span></button>';

    // ---- 通知 ----
    html += sec('通知');
    html += notifyPanelHtml();

    html += sec('メンバー（家族共有）');
    html += '<div class="list">' + (users.length ? users : [Store.state.user]).filter(Boolean).map(function (u) {
      return '<div class="listitem"><span class="li-ico">👤</span><span class="li-main"><span class="li-ttl">' + R.esc(u.display_name) + '</span>' +
        '<span class="li-sub">' + R.esc(u.email) + '</span></span><span class="li-right">' + R.esc(u.role || '') + '</span></div>';
    }).join('') + '</div>';

    // ---- エクスポート ----
    html += sec('エクスポート');
    html += '<div class="export-panel panel pad">';
    html += '<div class="export-vehicle">';
    html += '<span class="ex-ico">🚙</span>';
    html += '<span class="ex-vname">' + R.esc(v ? v.name : '—') + '</span>';
    html += '<span class="ex-vsub">' + R.esc(v ? [v.maker, v.model, v.year].filter(Boolean).join(' ') : '') + '</span>';
    html += '</div>';
    html += '<div class="export-grid">';

    var exBtns = [
      { id: 'exRecordCsv',   ico: '📋', label: '整備履歴 CSV', sub: '全期間の整備・実施記録' },
      { id: 'exRefuelCsv',   ico: '⛽', label: '給油履歴 CSV', sub: '全期間の給油記録・燃費' },
      { id: 'exCostCsv',     ico: '💴', label: '維持費 CSV',   sub: year + '年の給油＋整備＋固定費' },
      { id: 'exPrintReport', ico: '🖨️', label: '整備レポート', sub: '印刷・PDF保存用レポート' }
    ];
    exBtns.forEach(function (b) {
      html += '<button class="ex-btn" id="' + b.id + '">' +
        '<span class="ex-btn-ico">' + b.ico + '</span>' +
        '<span class="ex-btn-label">' + b.label + '</span>' +
        '<span class="ex-btn-sub">' + b.sub + '</span>' +
        '</button>';
    });
    html += '</div>'; // export-grid
    html += '<div class="ex-note">CSV は Excel・スプレッドシートで開けます。<br>整備レポートは印刷ダイアログから「PDF に保存」できます。</div>';
    html += '</div>'; // export-panel

    html += sec('アプリ情報');
    html += '<div class="panel pad small">' +
      'モード: ' + (CONFIG.DEMO_MODE ? '<b style="color:var(--amber)">DEMO</b>（バックエンド未接続）' : '本番') + '<br>' +
      'バックエンド: ' + (CONFIG.API_BASE || '未設定') + '</div>';

    screenEl.innerHTML = html;
    el('addVehicle').onclick = function () { openVehicleForm(); };
    el('gotoAlertsSetting').onclick = function () { show('alerts'); };
    screenEl.querySelectorAll('[data-editv]').forEach(function (b) {
      b.onclick = function () { openVehicleForm(Store.vehicles().filter(function (vv) { return vv.vehicle_id === b.dataset.editv; })[0]); };
    });
    bindNotifyPanel();
    var so = el('signOutBtn');
    if (so) so.onclick = function () {
      Auth.signOut();
      toast('サインアウトしました');
      el('loginScreen').hidden = false;
      document.body.classList.add('logged-out');
      Auth.renderButton(el('gbtn'));
    };

    // エクスポートボタンのバインド
    if (v) bindExportButtons(v.vehicle_id, year);
  }

  /* ---------- 通知パネル ---------- */
  function notifyPanelHtml() {
    var perm = Notify.permission();
    var enabled = Notify.isEnabled();
    var statusText, statusCls, toggleLabel;
    if (perm === 'unsupported') {
      statusText = 'この端末は通知に非対応'; statusCls = 'off'; toggleLabel = null;
    } else if (perm === 'denied') {
      statusText = 'ブロック中（ブラウザ設定で許可が必要）'; statusCls = 'off'; toggleLabel = null;
    } else if (enabled) {
      statusText = '有効'; statusCls = 'on'; toggleLabel = '通知をオフにする';
    } else {
      statusText = '無効'; statusCls = 'off'; toggleLabel = '通知をオンにする';
    }
    var h = '<div class="panel pad notify-panel">';
    h += '<div class="notify-head"><span class="ex-ico">🔔</span><span class="notify-ttl">メンテ・車検の通知</span>' +
      '<span class="notify-state ' + statusCls + '">' + statusText + '</span></div>';
    h += '<div class="notify-desc">交換時期の超過・車検期限が近づくとお知らせします。アプリを開いたときと、対応端末ではバックグラウンドでチェックします。</div>';
    h += '<div class="notify-actions">';
    if (toggleLabel) h += '<button class="btn ' + (enabled ? 'ghost' : 'primary') + '" id="notifyToggle">' + toggleLabel + '</button>';
    h += '<button class="btn ghost" id="notifyTest">テスト通知</button>';
    h += '</div>';
    if (perm === 'denied') h += '<div class="notify-hint">※ ブラウザ／OSの設定でこのサイトの通知を許可してください。</div>';
    h += '</div>';
    return h;
  }

  function bindNotifyPanel() {
    var t = el('notifyToggle');
    if (t) t.onclick = async function () {
      if (Notify.isEnabled()) {
        Notify.disable(); toast('通知をオフにしました'); show('settings');
      } else {
        try { await Notify.enable(); toast('通知をオンにしました'); await Notify.checkAndNotify(); show('settings'); }
        catch (e) { toast(e.message); show('settings'); }
      }
    };
    var test = el('notifyTest');
    if (test) test.onclick = async function () {
      try { await Notify.test(); toast('テスト通知を送信しました'); }
      catch (e) { toast(e.message); }
    };
  }

  function bindExportButtons(vid, year) {
    async function withLoading(btnId, fn, doneMsg) {
      var btn = el(btnId); if (!btn) return;
      var orig = btn.querySelector('.ex-btn-label').textContent;
      btn.classList.add('loading'); btn.querySelector('.ex-btn-label').textContent = '処理中…';
      try {
        var n = await fn();
        toast(doneMsg + (n ? '（' + n + '件）' : ''));
      } catch (e) { toast('失敗: ' + e.message); }
      btn.classList.remove('loading'); btn.querySelector('.ex-btn-label').textContent = orig;
    }
    el('exRecordCsv').onclick = function () {
      withLoading('exRecordCsv', function () { return Exporter.csvRecords(vid); }, '整備履歴をダウンロードしました');
    };
    el('exRefuelCsv').onclick = function () {
      withLoading('exRefuelCsv', function () { return Exporter.csvRefuelings(vid); }, '給油履歴をダウンロードしました');
    };
    el('exCostCsv').onclick = function () {
      withLoading('exCostCsv', function () { return Exporter.csvAnnualCost(vid, year); }, year + '年維持費をダウンロードしました');
    };
    el('exPrintReport').onclick = function () {
      withLoading('exPrintReport', async function () { await Exporter.printReport(vid, year); }, 'レポートを開きました');
    };
  }

  /* ---------- FAB アクションシート ---------- */
  function openAddSheet() {
    var items = [
      ['🔧', '整備・実施記録', function () { closeModal(); openRecordForm(); }],
      ['⛽', '給油（レシート読取り）', function () { closeModal(); openRefuelForm(); }],
      ['💴', '固定費（税・保険など）', function () { closeModal(); openFixedForm(); }],
      ['🚙', '車両を追加', function () { closeModal(); openVehicleForm(); }]
    ];
    openModal('追加', '<div class="list">' + items.map(function (it, i) {
      return '<button class="listitem" data-add="' + i + '"><span class="li-ico">' + it[0] + '</span><span class="li-main"><span class="li-ttl">' + it[1] + '</span></span><span class="li-right">›</span></button>';
    }).join('') + '</div>');
    el('modalBody').querySelectorAll('[data-add]').forEach(function (b, i) { b.onclick = items[i][2]; });
  }

  /* ---------- フォーム ---------- */
  function field(label, inner) { return '<label class="fld"><span>' + label + '</span>' + inner + '</label>'; }
  function input(id, type, val, attrs) { return '<input id="' + id + '" type="' + type + '" value="' + (val == null ? '' : R.esc(val)) + '" ' + (attrs || '') + '>'; }
  function today() { return new Date().toISOString().slice(0, 10); }

  function openRecordForm(rec) {
    rec = rec || {};
    var opts = Store.categories().filter(function (c) { return c.code !== 'refuel'; }).map(function (c) {
      return '<option value="' + c.code + '"' + (rec.category === c.code ? ' selected' : '') + '>' + c.icon + ' ' + c.label + '</option>';
    }).join('');
    openModal('整備・実施記録', '<form id="frm">' +
      field('種類', '<select id="f_cat">' + opts + '</select>') +
      field('日付', input('f_date', 'date', rec.date || today())) +
      field('走行距離 (km)', input('f_odo', 'number', rec.odo || (Store.current() && Store.current().current_odo), 'min="0"')) +
      field('費用 (円)', input('f_cost', 'number', rec.cost, 'min="0"')) +
      field('場所', input('f_place', 'text', rec.place)) +
      field('メモ', '<textarea id="f_note" rows="2">' + R.esc(rec.note || '') + '</textarea>') +
      submitBar() + '</form>');
    bindForm(function () {
      return API.post('saveRecord', { record: {
        record_id: rec.record_id || '', vehicle_id: Store.current().vehicle_id,
        category: el('f_cat').value, date: el('f_date').value, odo: el('f_odo').value,
        cost: el('f_cost').value, place: el('f_place').value, note: el('f_note').value
      } });
    }, '記録を保存しました', 'history');
  }

  function openRefuelForm(ref) {
    ref = ref || {};
    openModal('給油記録', '<form id="frm">' +
      '<div class="ocr-row"><label class="btn ghost" for="f_receipt">📷 レシートを読み取る</label>' +
      '<input id="f_receipt" type="file" accept="image/*" hidden></div>' +
      '<div id="ocrStatus" class="ocr-status"></div>' +
      field('日付', input('f_date', 'date', ref.date || today())) +
      field('店舗', input('f_station', 'text', ref.station)) +
      field('油種', '<select id="f_fuel"><option>レギュラー</option><option>ハイオク</option><option>軽油</option></select>') +
      '<div class="grid2">' + field('給油量 (L)', input('f_liters', 'number', ref.liters, 'step="0.01" min="0"')) +
      field('単価 (円/L)', input('f_price', 'number', ref.unit_price, 'min="0"')) + '</div>' +
      '<div class="grid2">' + field('合計 (円)', input('f_total', 'number', ref.total, 'min="0"')) +
      field('走行距離 (km)', input('f_odo', 'number', ref.odo || (Store.current() && Store.current().current_odo), 'min="0"')) + '</div>' +
      field('', '<label class="chk"><input id="f_full" type="checkbox" checked> 満タン給油（燃費計算に使用）</label>') +
      submitBar() + '</form>');
    el('f_receipt').onchange = handleReceiptOcr;
    bindForm(function () {
      return API.post('saveRefueling', { refueling: {
        vehicle_id: Store.current().vehicle_id, date: el('f_date').value, station: el('f_station').value,
        fuel_type: el('f_fuel').value, liters: el('f_liters').value, unit_price: el('f_price').value,
        total: el('f_total').value, odo: el('f_odo').value, full_tank: el('f_full').checked
      } });
    }, '給油を保存しました', 'refuel');
  }

  async function handleReceiptOcr(e) {
    var file = e.target.files[0]; if (!file) return;
    var status = el('ocrStatus'); status.textContent = '読み取り中…'; status.className = 'ocr-status loading';
    try {
      var dataUrl = await fileToDataUrl(file);
      var base64 = dataUrl.split(',')[1];
      var r = await API.post('ocrReceipt', { imageBase64: base64, mimeType: file.type });
      if (r.date) el('f_date').value = r.date;
      if (r.station) el('f_station').value = r.station;
      if (r.liters) el('f_liters').value = r.liters;
      if (r.unit_price) el('f_price').value = r.unit_price;
      if (r.total) el('f_total').value = r.total;
      if (r.fuel_type) { Array.from(el('f_fuel').options).forEach(function (o) { if (o.value === r.fuel_type) el('f_fuel').value = r.fuel_type; }); }
      status.textContent = '✓ 読み取り完了（内容を確認してください）'; status.className = 'ocr-status ok';
    } catch (err) {
      status.textContent = '読み取り失敗: ' + err.message; status.className = 'ocr-status err';
    }
  }

  function openFixedForm(fc) {
    fc = fc || {};
    var cats = ['自動車税', '任意保険', '自賠責', '車検費用', '駐車場', 'ローン', 'JAF・会費', 'その他'];
    var opts = cats.map(function (c) { return '<option' + (fc.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var cyc = function (v, l) { return '<option value="' + v + '"' + (fc.cycle === v ? ' selected' : '') + '>' + l + '</option>'; };
    openModal('固定費', '<form id="frm">' +
      field('項目', '<select id="f_cat">' + opts + '</select>') +
      field('金額 (円)', input('f_amount', 'number', fc.amount, 'min="0"')) +
      '<div class="grid2">' +
      field('サイクル', '<select id="f_cycle">' + cyc('yearly', '毎年') + cyc('monthly', '毎月') + cyc('once', '単発') + '</select>') +
      field('対象年', input('f_year', 'number', fc.target_year || new Date().getFullYear(), 'min="2000"')) + '</div>' +
      field('メモ', input('f_note', 'text', fc.note)) +
      submitBar(fc.cost_id ? 'del' : '') + '</form>');
    bindForm(function () {
      return API.post('saveFixedCost', { fixedCost: {
        cost_id: fc.cost_id || '', vehicle_id: Store.current().vehicle_id, category: el('f_cat').value,
        amount: el('f_amount').value, cycle: el('f_cycle').value, target_year: el('f_year').value, note: el('f_note').value
      } });
    }, '固定費を保存しました', 'cost');
    bindDelete(fc.cost_id, function () { return API.post('deleteFixedCost', { id: fc.cost_id }); }, 'cost');
  }

  function openVehicleForm(v) {
    v = v || {};
    openModal(v.vehicle_id ? '車両を編集' : '車両を追加', '<form id="frm">' +
      field('愛称', input('f_name', 'text', v.name)) +
      '<div class="grid2">' + field('メーカー', input('f_maker', 'text', v.maker)) + field('車種', input('f_model', 'text', v.model)) + '</div>' +
      '<div class="grid2">' + field('年式', input('f_year', 'number', v.year, 'min="1950"')) + field('グレード', input('f_grade', 'text', v.grade)) + '</div>' +
      field('ナンバー', input('f_plate', 'text', v.plate)) +
      '<div class="grid2">' + field('現在の走行距離 (km)', input('f_odo', 'number', v.current_odo, 'min="0"')) + field('初度登録日', input('f_reg', 'date', v.first_reg_date)) + '</div>' +
      submitBar() + '</form>');
    bindForm(function () {
      return API.post('saveVehicle', { vehicle: {
        vehicle_id: v.vehicle_id || '', name: el('f_name').value, maker: el('f_maker').value, model: el('f_model').value,
        year: el('f_year').value, grade: el('f_grade').value, plate: el('f_plate').value,
        current_odo: el('f_odo').value, first_reg_date: el('f_reg').value
      } });
    }, '車両を保存しました', currentScreen, true);
  }

  function submitBar(withDelete) {
    return '<div class="form-actions">' +
      (withDelete === 'del' ? '<button type="button" class="btn danger" id="frmDel">削除</button>' : '') +
      '<button type="submit" class="btn primary">保存</button></div>';
  }

  function bindForm(saveFn, okMsg, refreshScreen, reloadVehicles) {
    el('frm').onsubmit = async function (ev) {
      ev.preventDefault();
      var btn = el('frm').querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = '保存中…';
      try {
        await saveFn();
        if (reloadVehicles) { await Store.reload(); renderVehicleBar(); }
        closeModal(); toast(okMsg); show(refreshScreen || currentScreen);
      } catch (e) { btn.disabled = false; btn.textContent = '保存'; toast('保存失敗: ' + e.message); }
    };
  }
  function bindDelete(id, delFn, refreshScreen) {
    if (!id) return; var b = el('frmDel'); if (!b) return;
    b.onclick = async function () {
      if (!confirm('削除しますか？')) return;
      try { await delFn(); closeModal(); toast('削除しました'); show(refreshScreen || currentScreen); }
      catch (e) { toast('削除失敗: ' + e.message); }
    };
  }

  function fileToDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  }

  /* ---------- 小物テンプレ ---------- */
  function sec(t) { return '<div class="sec-h"><h2>' + R.esc(t) + '</h2></div>'; }
  function secAction(t, actionLabel, actionId) {
    return '<div class="sec-h"><h2>' + R.esc(t) + '</h2>' +
      '<button class="sec-action" id="' + actionId + '">' + R.esc(actionLabel) + ' ›</button></div>';
  }
  function secYear(t, year, withNav) {
    var nav = withNav ? '<div class="yr"><button data-yr="-1">◂</button><b>' + year + '</b><button data-yr="1">▸</button></div>'
      : '<div class="yr"><b>' + year + '</b></div>';
    return '<div class="sec-h"><h2>' + R.esc(t) + '</h2>' + nav + '</div>';
  }
  function kpi(k, v, cls) { return '<div class="kpi"><div class="k">' + k + '</div><div class="vv ' + (cls || '') + '">' + v + '</div></div>'; }
  function tile(lbl, val, sub) { return '<div class="tile panel"><div class="t-lbl">' + lbl + '</div><div class="t-val">' + val + '</div>' + (sub ? '<div class="t-sub">' + sub + '</div>' : '') + '</div>'; }
  function trend(arr) {
    if (!arr || !arr.length) return '';
    var max = Math.max.apply(null, arr.map(function (x) { return x.total || 1; }));
    return '<div class="trend">' + arr.map(function (x, i) {
      var cur = i === arr.length - 1;
      return '<div class="col' + (cur ? ' cur' : '') + '"><span class="av">' + Math.round((x.total || 0) / 10000) + '万</span>' +
        '<div class="bar" style="height:' + (max ? (x.total / max * 100) : 0).toFixed(0) + '%"></div>' +
        '<span class="yl">\'' + String(x.year).slice(2) + '</span></div>';
    }).join('') + '</div>';
  }
  function alertRow(ico, ttl, sub, right, cls, smallRight) {
    return '<div class="alert ' + cls + '"><div class="ico">' + ico + '</div>' +
      '<div class="a-main"><div class="a-ttl">' + R.esc(ttl) + '</div>' + (sub ? '<div class="a-sub">' + R.esc(sub) + '</div>' : '') + '</div>' +
      '<div class="a-right"><div class="big">' + R.esc(right) + '</div>' + (smallRight ? '<div class="small">' + R.esc(smallRight) + '</div>' : '') + '</div></div>';
  }
  function emptyVehicle() { return '<div class="panel pad center"><div style="font-size:40px">🚙</div><p>まず車両を登録しましょう</p><button class="btn primary" id="firstVehicle">＋ 車両を追加</button></div>'; }
  function bindEmpty() { var b = el('firstVehicle'); if (b) b.onclick = function () { openVehicleForm(); }; }

  /* ---------- 起動 ---------- */
  /* ---------- ログイン ---------- */
  function showLogin(note) {
    el('loginScreen').hidden = false;
    document.body.classList.add('logged-out');
    var n = el('loginNote');
    if (n) n.textContent = note || '';
    Auth.renderButton(el('gbtn'));
  }
  function hideLogin() {
    el('loginScreen').hidden = true;
    document.body.classList.remove('logged-out');
  }

  async function bootApp() {
    if (appBooted || appBooting) { hideLogin(); return; }
    appBooting = true;
    hideLogin();
    try {
      await Store.init();
      if (window.Auth && Store.state.user) Auth.setUser(Store.state.user);
      renderVehicleBar();
      show('dashboard');
      appBooted = true;
      if (window.Notify && Notify.isEnabled()) Notify.checkAndNotify().catch(function () {});
    } catch (e) {
      appBooting = false;
      screenEl.innerHTML = '<div class="loading err">初期化に失敗: ' + R.esc(e.message) + '</div>';
    }
  }

  async function start() {
    screenEl = el('screen');
    document.querySelectorAll('[data-screen]').forEach(function (b) { b.onclick = function () { show(b.dataset.screen); }; });
    el('fab').onclick = openAddSheet;
    el('modalClose').onclick = closeModal;
    el('modalBackdrop').onclick = closeModal;
    el('appName').textContent = CONFIG.APP_NAME;

    // 認証切れ時の処理（アプリ起動済みならトーストのみ、未起動ならログイン画面へ）
    API.setAuthHandler(function (msg) {
      if (appBooted) {
        toast('セッションが切れました。ページを再読み込みしてください。');
      } else {
        Auth.signOut();
        showLogin(msg ? '再ログインが必要です: ' + msg : '');
      }
    });

    // ★ コールバックは init より前に登録（自動ログインの認証情報が先に届いても取りこぼさない）
    Auth.setOnChange(function () { hideLogin(); bootApp(); });

    await Auth.init();

    if (Auth.signedIn() || CONFIG.DEMO_MODE) {
      await bootApp();
    } else {
      showLogin();
      // 保険：自動ログインの認証情報が遅れて届くケースに備え、数回だけ再確認
      var tries = 0;
      var iv = setInterval(function () {
        if (appBooted || appBooting) { clearInterval(iv); return; }
        if (Auth.signedIn()) { clearInterval(iv); hideLogin(); bootApp(); return; }
        if (++tries > 10) clearInterval(iv);
      }, 500);
    }

    // アプリに戻ってきたときにも通知チェック
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && window.Notify && Notify.isEnabled()) {
        Notify.checkAndNotify().catch(function () {});
      }
    });
  }

  return { start: start };
})();

document.addEventListener('DOMContentLoaded', App.start);
