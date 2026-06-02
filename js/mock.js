/**
 * デモモード用のインメモリ・バックエンド。
 * GAS API と同じ action / レスポンス形を返すので、DEMO_MODE を切り替えるだけで本番に移行できる。
 */
(function () {
  var uid = function () { return 'id-' + Math.random().toString(36).slice(2, 10); };
  var todayStr = new Date().toISOString().slice(0, 10);
  var Y = new Date().getFullYear();

  var DB = {
    user: { email: 'kyantyome@gmail.com', display_name: 'kyan', role: 'admin' },
    users: [
      { email: 'kyantyome@gmail.com', display_name: 'kyan', role: 'admin' },
      { email: 'family@example.com', display_name: '配偶者', role: 'member' }
    ],
    categories: [
      { code: 'oil', label: 'エンジンオイル', icon: '🛢️' },
      { code: 'oil_filter', label: 'オイルエレメント', icon: '🧰' },
      { code: 'wash', label: '洗車', icon: '🧽' },
      { code: 'inspection', label: '車検', icon: '🔧' },
      { code: 'tire', label: 'タイヤ交換', icon: '🛞' },
      { code: 'tire_rot', label: 'タイヤローテーション', icon: '🔄' },
      { code: 'battery', label: 'バッテリー', icon: '🔋' },
      { code: 'wiper', label: 'ワイパー', icon: '🌧️' },
      { code: 'brake', label: 'ブレーキパッド', icon: '🛑' },
      { code: 'ac_filter', label: 'エアコンフィルター', icon: '❄️' },
      { code: 'other', label: 'その他', icon: '🔩' }
    ],
    vehicles: [
      { vehicle_id: 'v1', name: 'マイカー（サンプル）', maker: 'TOYOTA', model: 'ルーミー', year: 2018,
        grade: 'カスタム G-T', plate: '品川 300 あ 00-00', current_odo: 34000, first_reg_date: '2018-05-01', photo_file_id: '' }
    ],
    rules: [
      { rule_id: 'r1', vehicle_id: 'v1', category: 'oil', interval_km: 5000, interval_months: 6, warn_threshold_pct: 0.15, last_done_odo: 28900, last_done_date: '2025-11-20' },
      { rule_id: 'r2', vehicle_id: 'v1', category: 'battery', interval_km: '', interval_months: 36, warn_threshold_pct: 0.15, last_done_odo: 18000, last_done_date: '2023-08-01' },
      { rule_id: 'r3', vehicle_id: 'v1', category: 'tire_rot', interval_km: 5000, interval_months: '', warn_threshold_pct: 0.2, last_done_odo: 32500, last_done_date: '2026-03-01' },
      { rule_id: 'r5', vehicle_id: 'v1', category: 'ac_filter', interval_km: 10000, interval_months: 12, warn_threshold_pct: 0.15, last_done_odo: 26000, last_done_date: '2025-05-10' }
    ],
    deadlines: [
      { deadline_id: 'd1', vehicle_id: 'v1', type: '車検', due_date: '2027-05-01', note: '初度登録日から自動計算（新車3年・以降2年ごと）' }
    ],
    records: [
      { record_id: 'm1', vehicle_id: 'v1', category: 'oil', date: '2025-11-20', odo: 28900, cost: 6600, place: 'オートバックス', note: '0W-20 化学合成', created_by: 'kyan' },
      { record_id: 'm2', vehicle_id: 'v1', category: 'wash', date: '2026-05-10', odo: 33600, cost: 1200, place: 'コイン洗車', note: '', created_by: 'kyan' },
      { record_id: 'm3', vehicle_id: 'v1', category: 'tire_rot', date: '2026-03-01', odo: 32500, cost: 0, place: '自宅', note: '前後入替', created_by: 'kyan' },
      { record_id: 'm4', vehicle_id: 'v1', category: 'inspection', date: '2025-05-12', odo: 30100, cost: 102000, place: 'ディーラー', note: '車検（2年）', created_by: 'kyan' }
    ],
    refuelings: [
      { refuel_id: 'f1', vehicle_id: 'v1', date: '2026-05-18', station: 'ガソリンスタンドA', fuel_type: 'ハイオク', liters: 30.2, unit_price: 183, total: 5527, odo: 34000, full_tank: true, fuel_economy: 15.2 },
      { refuel_id: 'f2', vehicle_id: 'v1', date: '2026-05-02', station: 'ガソリンスタンドB', fuel_type: 'ハイオク', liters: 29.5, unit_price: 180, total: 5310, odo: 33540, full_tank: true, fuel_economy: 14.8 },
      { refuel_id: 'f3', vehicle_id: 'v1', date: '2026-04-15', station: 'ガソリンスタンドA', fuel_type: 'ハイオク', liters: 30.0, unit_price: 186, total: 5580, odo: 33103, full_tank: true, fuel_economy: 15.5 }
    ],
    fixed: [
      { cost_id: 'c1', vehicle_id: 'v1', category: '自動車税', amount: 34500, cycle: 'yearly', target_year: Y, note: '' },
      { cost_id: 'c2', vehicle_id: 'v1', category: '任意保険', amount: 68000, cycle: 'yearly', target_year: Y, note: '' },
      { cost_id: 'c3', vehicle_id: 'v1', category: '自賠責', amount: 12000, cycle: 'yearly', target_year: Y, note: '' },
      { cost_id: 'c4', vehicle_id: 'v1', category: '駐車場', amount: 8000, cycle: 'monthly', target_year: Y, note: '月極' },
      { cost_id: 'c5', vehicle_id: 'v1', category: 'その他', amount: 4000, cycle: 'yearly', target_year: Y, note: 'JAF会費' }
    ]
  };

  // ---- 集計（サーバ側ロジックのクライアント版） ----
  function addMonths(d, m) { var x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function computeAlerts(vid) {
    var v = DB.vehicles.filter(function (x) { return x.vehicle_id === vid; })[0];
    if (!v) return [];
    var now = new Date();
    var catMap = {}; DB.categories.forEach(function (c) { catMap[c.code] = c; });
    var out = DB.rules.filter(function (r) { return r.vehicle_id === vid && r.is_active !== false; }).map(function (r) {
      var cat = catMap[r.category] || { label: r.category, icon: '🔧' };
      var dims = [];
      if (r.interval_km !== '' && num(r.interval_km) > 0) {
        var remKm = (num(r.last_done_odo) + num(r.interval_km)) - num(v.current_odo);
        dims.push({ unit: 'km', remaining: remKm, pct: remKm / num(r.interval_km), value: Math.round(remKm) });
      }
      if (r.interval_months !== '' && num(r.interval_months) > 0 && r.last_done_date) {
        var due = addMonths(r.last_done_date, num(r.interval_months));
        var remDays = Math.round((due - now) / 86400000);
        var totalDays = num(r.interval_months) * 30;
        dims.push({ unit: 'か月', remaining: remDays, pct: remDays / totalDays, value: Math.round(remDays / 30 * 10) / 10, due_date: due.toISOString().slice(0, 10) });
      }
      if (!dims.length) return null;
      dims.sort(function (a, b) { return a.pct - b.pct; });
      var gov = dims[0];
      var warn = r.warn_threshold_pct === '' ? 0.15 : Number(r.warn_threshold_pct);
      var status = gov.remaining < 0 ? 'over' : (gov.pct <= warn ? 'soon' : 'ok');
      return { category: r.category, label: cat.label, icon: cat.icon, status: status,
        pct: Math.max(-0.2, Math.min(1, gov.pct)), value: gov.value, unit: gov.unit,
        last_done_odo: num(r.last_done_odo), last_done_date: r.last_done_date, due_date: gov.due_date || '' };
    }).filter(Boolean);
    var order = { over: 0, soon: 1, ok: 2 };
    out.sort(function (a, b) { return order[a.status] - order[b.status]; });
    return out;
  }

  function annualCost(vid, year) {
    var ystr = String(year);
    var fuel = DB.refuelings.filter(function (r) { return r.vehicle_id === vid && String(r.date).slice(0, 4) === ystr; })
      .reduce(function (s, r) { return s + num(r.total); }, 0);
    var maint = DB.records.filter(function (r) { return r.vehicle_id === vid && String(r.date).slice(0, 4) === ystr; })
      .reduce(function (s, r) { return s + num(r.cost); }, 0);
    var breakdown = [{ category: '燃料', amount: fuel }, { category: '整備・車検', amount: maint }];
    var byCat = {};
    DB.fixed.filter(function (f) { return f.vehicle_id === vid && String(f.target_year) === ystr; }).forEach(function (f) {
      var amt = num(f.amount) * (f.cycle === 'monthly' ? 12 : 1);
      byCat[f.category] = (byCat[f.category] || 0) + amt;
    });
    Object.keys(byCat).forEach(function (k) { breakdown.push({ category: k, amount: byCat[k] }); });
    var total = breakdown.reduce(function (s, b) { return s + b.amount; }, 0);
    return { year: year, total: total, breakdown: breakdown.filter(function (b) { return b.amount > 0; }) };
  }

  // デモ用：過去年は実データが薄いので代表値で推移を見せる（本番は実データ集計）
  function histTotal(vid, year) {
    if (year === Y) return annualCost(vid, year).total;
    var dummy = {}; dummy[Y - 3] = 402000; dummy[Y - 2] = 455000; dummy[Y - 1] = 433000;
    return dummy[year] != null ? dummy[year] : annualCost(vid, year).total;
  }

  function getAnnual(vid, year) {
    year = year || Y;
    var cur = annualCost(vid, year);
    var prev = histTotal(vid, year - 1);
    cur.prev_total = prev;
    cur.yoy_pct = prev ? Math.round((cur.total - prev) / prev * 1000) / 10 : null;
    cur.monthly_avg = Math.round(cur.total / 12);
    cur.trend = [];
    for (var y = year - 3; y <= year; y++) cur.trend.push({ year: y, total: histTotal(vid, y) });
    return cur;
  }

  // 起動カウントアップ用にデモ年は揃える
  var demoNews = [
    { tag: 'RECALL', title: '一部年式のアクアで燃料ポンプ対象届出', summary: '該当ロットは無償点検対象。販売店で確認を。', url: '' },
    { tag: 'TOPIC', title: 'ハイブリッド車の冬季燃費を保つコツ', summary: '暖機とタイヤ空気圧の管理で実燃費が改善。', url: '' },
    { tag: 'TOPIC', title: '純正対応エアコンフィルター比較', summary: '交換目安は1年または1万km。花粉対応も。', url: '' }
  ];

  // ---- ルータ（GAS と同じ action） ----
  var handlers = {
    ping: function () { return { pong: true }; },
    getUsers: function () { return DB.users; },
    getBootstrap: function () { return { user: DB.user, vehicles: DB.vehicles, categories: DB.categories }; },
    getVehicles: function () { return DB.vehicles; },
    getCategories: function () { return DB.categories; },
    getDashboard: function (p) {
      var v = DB.vehicles.filter(function (x) { return x.vehicle_id === p.vehicle_id; })[0];
      var ym = new Date().toISOString().slice(0, 7);
      var refs = DB.refuelings.filter(function (r) { return r.vehicle_id === p.vehicle_id; });
      var recs = DB.records.filter(function (r) { return r.vehicle_id === p.vehicle_id; });
      var eco = refs.filter(function (r) { return r.fuel_economy > 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      return {
        vehicle: v,
        alerts: computeAlerts(p.vehicle_id),
        deadlines: DB.deadlines.filter(function (d) { return d.vehicle_id === p.vehicle_id; }),
        month_fuel_cost: refs.filter(function (r) { return r.date.slice(0, 7) === ym; }).reduce(function (s, r) { return s + num(r.total); }, 0),
        month_maint_cost: recs.filter(function (r) { return r.date.slice(0, 7) === ym; }).reduce(function (s, r) { return s + num(r.cost); }, 0),
        recent_economy: eco ? eco.fuel_economy : null,
        annual: getAnnual(p.vehicle_id, Y)
      };
    },
    getRecords: function (p) { return DB.records.filter(function (r) { return r.vehicle_id === p.vehicle_id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }); },
    getRefuelings: function (p) { return DB.refuelings.filter(function (r) { return r.vehicle_id === p.vehicle_id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }); },
    getFixedCosts: function (p) { return DB.fixed.filter(function (f) { return f.vehicle_id === p.vehicle_id && (!p.year || String(f.target_year) === String(p.year)); }); },
    getAnnualCost: function (p) { return getAnnual(p.vehicle_id, num(p.year) || Y); },
    getAlerts: function (p) { return computeAlerts(p.vehicle_id); },
    getRules: function (p) { return DB.rules.filter(function (r) { return r.vehicle_id === p.vehicle_id && r.is_active !== false; }); },
    getNews: function () { return demoNews; },
    getDueNotifications: function () {
      var now = new Date();
      return DB.vehicles.map(function (v) {
        var items = [];
        computeAlerts(v.vehicle_id).forEach(function (a) {
          if (a.status === 'over') items.push('🔴 ' + a.label + 'が交換時期を過ぎています');
          else if (a.status === 'soon') items.push('🟡 ' + a.label + 'がそろそろ交換時期（残り' + a.value + a.unit + '）');
        });
        DB.deadlines.filter(function (d) { return d.vehicle_id === v.vehicle_id; }).forEach(function (dl) {
          var days = Math.round((new Date(dl.due_date) - now) / 86400000);
          if (days <= 45) items.push((days < 0 ? '🔴 ' : '🟡 ') + dl.type + '期限まで' + days + '日（' + dl.due_date + '）');
        });
        return { vehicle_id: v.vehicle_id, vehicle_name: v.name, items: items, sig: items.join('|') };
      }).filter(function (x) { return x.items.length > 0; });
    },
    ocrReceipt: function () {
      // デモ：固定のダミー抽出結果
      return { date: todayStr, station: 'ENEOS 田町', fuel_type: 'レギュラー', liters: 27.5, unit_price: 171, total: 4703 };
    },
    saveVehicle: function (p) { var o = p.vehicle || p; if (!o.vehicle_id) { o.vehicle_id = uid(); DB.vehicles.push(o); } else { merge(DB.vehicles, 'vehicle_id', o); } return o; },
    saveRecord: function (p) { var o = p.record || p; o.created_by = DB.user.display_name; if (!o.record_id) { o.record_id = uid(); DB.records.push(o); } else merge(DB.records, 'record_id', o); bumpOdo(o.vehicle_id, o.odo); touchRule(o); return o; },
    saveRefueling: function (p) { var o = p.refueling || p; o.created_by = DB.user.display_name; if (!o.unit_price && o.liters) o.unit_price = Math.round(o.total / o.liters * 10) / 10; if (!o.refuel_id) { o.refuel_id = uid(); DB.refuelings.push(o); } else merge(DB.refuelings, 'refuel_id', o); bumpOdo(o.vehicle_id, o.odo); return o; },
    saveFixedCost: function (p) { var o = p.fixedCost || p; if (!o.cost_id) { o.cost_id = uid(); DB.fixed.push(o); } else merge(DB.fixed, 'cost_id', o); return o; },
    saveRule: function (p) { var o = p.rule || p; if (!o.rule_id) { o.rule_id = uid(); DB.rules.push(o); } else merge(DB.rules, 'rule_id', o); return o; },
    deleteRecord: function (p) { DB.records = DB.records.filter(function (r) { return r.record_id !== p.id; }); return { deleted: true }; },
    deleteRefueling: function (p) { DB.refuelings = DB.refuelings.filter(function (r) { return r.refuel_id !== p.id; }); return { deleted: true }; },
    deleteFixedCost: function (p) { DB.fixed = DB.fixed.filter(function (r) { return r.cost_id !== p.id; }); return { deleted: true }; }
  };

  function merge(arr, key, o) { for (var i = 0; i < arr.length; i++) if (arr[i][key] === o[key]) { arr[i] = Object.assign(arr[i], o); return; } }
  function bumpOdo(vid, odo) { var v = DB.vehicles.filter(function (x) { return x.vehicle_id === vid; })[0]; if (v && num(odo) > num(v.current_odo)) v.current_odo = num(odo); }
  function touchRule(o) { DB.rules.forEach(function (r) { if (r.vehicle_id === o.vehicle_id && r.category === o.category) { r.last_done_odo = num(o.odo); r.last_done_date = o.date; } }); }

  window.MockBackend = {
    handle: function (action, params) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var h = handlers[action];
          if (!h) return reject(new Error('mock: unknown action ' + action));
          try { resolve(h(params || {})); } catch (e) { reject(e); }
        }, 120); // 軽い遅延でローディングを再現
      });
    }
  };
})();
