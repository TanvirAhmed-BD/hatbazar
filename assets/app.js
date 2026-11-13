/* HatBazar v2 — shared helpers: formatting, geo cascade, Supabase REST, ad cards.
   Loaded on every page after config.js + data.js. */
(function () {
  'use strict';
  var CFG = window.HB_CONFIG || {};
  var GEO = window.HB_GEO || { div: [], dist: [], upa: [], uni: [] };
  var CATS = window.HB_CATEGORIES || [];
  var SUBS = window.HB_SUBCATS || {};
  var ICONS = window.HB_ICONS || {};

  /* ---------- basics ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) { return '৳' + Number(n || 0).toLocaleString('en-IN'); }
  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._hbTimer);
    t._hbTimer = setTimeout(function () { t.classList.remove('show'); }, 3400);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---------- geo ---------- */
  var DIV_BY_ID = {}, DIST_BY_ID = {}, UPA_BY_ID = {}, UNI_BY_ID = {};
  GEO.div.forEach(function (r) { DIV_BY_ID[r[0]] = r; });
  GEO.dist.forEach(function (r) { DIST_BY_ID[r[0]] = r; });
  GEO.upa.forEach(function (r) { UPA_BY_ID[r[0]] = r; });
  GEO.uni.forEach(function (r) { UNI_BY_ID[r[0]] = r; });
  function districtsOf(divId) { return GEO.dist.filter(function (r) { return r[1] === divId; }); }
  function upazilasOf(distId) { return GEO.upa.filter(function (r) { return r[1] === distId; }); }
  function unionsOf(upaId) { return GEO.uni.filter(function (r) { return r[1] === upaId; }); }
  function trailFromIds(div, dist, upa, uni) {
    var parts = [];
    if (uni && UNI_BY_ID[uni]) parts.push(UNI_BY_ID[uni][2]);
    if (upa && UPA_BY_ID[upa]) parts.push(UPA_BY_ID[upa][2]);
    if (dist && DIST_BY_ID[dist]) parts.push(DIST_BY_ID[dist][2]);
    if (!parts.length && div && DIV_BY_ID[div]) parts.push(DIV_BY_ID[div][1]);
    return parts.join(', ');
  }
  function adLocLabel(ad) {
    if (ad.loc_label) return ad.loc_label;
    var t = trailFromIds(ad.div, ad.dist, ad.upa, ad.uni);
    return t || 'Bangladesh';
  }

  /* ---------- categories ---------- */
  var CAT_BY_ID = {};
  CATS.forEach(function (c) { CAT_BY_ID[c.id] = c; });
  function catObj(id) { return CAT_BY_ID[id] || null; }
  function catName(id) { var c = catObj(id); return c ? c.name : (id || ''); }
  function catIcon(id) {
    var c = catObj(id);
    var key = c ? c.icon : 'else';
    return ICONS[key] || ICONS['else'] || '';
  }
  function subsFor(catId) { return SUBS[catId] || null; }
  function subObj(catId, subId) {
    var s = subsFor(catId);
    if (!s || !subId) return null;
    for (var i = 0; i < s.length; i++) if (s[i].id === subId) return s[i];
    return null;
  }
  function subLabel(ad) {
    var o = subObj(ad.cat, ad.sub);
    return o ? (o.en + ' • ' + o.bn) : '';
  }

  /* ---------- Supabase REST ---------- */
  function sbHeaders(extra) {
    var h = {
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function sbGet(path) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/' + path, { headers: sbHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('Supabase ' + r.status);
        return r.json();
      });
  }
  function sbPost(table, body) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 200)); });
      return true;
    });
  }
  function normalizeRow(r) {
    return {
      id: r.id, title: r.title, price: Number(r.price) || 0,
      cat: r.category, sub: r.subcategory || null,
      desc: r.description || '', photos: Array.isArray(r.photos) ? r.photos : [],
      seller_name: r.seller_name, verified: !!r.verified,
      cond: r.condition || 'Brand New',
      div: r.div_id, dist: r.dist_id, upa: r.upa_id, uni: r.uni_id,
      loc_label: r.loc_label || null, featured: !!r.featured,
      created_at: r.created_at || null, _db: true
    };
  }
  function normalizeFallback(a) {
    var o = {};
    for (var k in a) o[k] = a[k];
    o._db = false;
    o.created_at = null;
    return o;
  }
  function fetchLiveAds(limit) {
    return sbGet('ads?status=eq.live&order=created_at.desc&limit=' + (limit || 500))
      .then(function (rows) { return rows.map(normalizeRow); });
  }
  function fetchAdById(id) {
    return sbGet('ads?id=eq.' + encodeURIComponent(id) + '&status=eq.live')
      .then(function (rows) { return rows.length ? normalizeRow(rows[0]) : null; });
  }
  function fetchLiveAdsBySeller(name) {
    return sbGet('ads?status=eq.live&seller_name=eq.' + encodeURIComponent(name) + '&order=created_at.desc')
      .then(function (rows) { return rows.map(normalizeRow); });
  }
  function uploadPhoto(file, folder) {
    var safe = (file.name || 'photo.jpg').replace(/[^A-Za-z0-9._-]/g, '_');
    var path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
    return fetch(CFG.SUPABASE_URL + '/storage/v1/object/ad-photos/' + path, {
      method: 'POST',
      headers: {
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'image/jpeg'
      },
      body: file
    }).then(function (r) {
      if (!r.ok) throw new Error('Storage ' + r.status);
      return CFG.SUPABASE_URL + '/storage/v1/object/public/ad-photos/' + path;
    });
  }

  /* ---------- ad cards ---------- */
  function adHref(ad) { return ad._db ? ('ad.html?id=' + ad.id) : ('ad.html?f=' + ad.id); }
  function cardHTML(ad) {
    var photo = (ad.photos && ad.photos.length)
      ? '<img src="' + esc(ad.photos[0]) + '" alt="' + esc(ad.title) + '" loading="lazy">'
      : '<span class="ph-fallback">' + catIcon(ad.cat) + '</span>';
    var badge = '';
    if (ad.verified) badge = '<span class="badge hb-verified">🛡️ HATBAZAR VERIFIED</span>' + (ad.featured ? '<span class="badge feat feat2">FEATURED</span>' : '');
    else if (ad.featured) badge = '<span class="badge feat">FEATURED</span>';
    var sl = subLabel(ad);
    var tier = ad.verified
      ? '<span class="tier-line ver">🛡️ Verified Seller — HatBazar দিয়ে order করা যায়</span>'
      : '<span class="tier-line reg">' + esc(ad.seller_name || 'Seller') + '</span>';
    var date = fmtDate(ad.created_at);
    return '<a class="card" href="' + adHref(ad) + '"><span class="ph">' + photo + badge + '</span>' +
      '<span class="body"><span class="price">' + fmt(ad.price) + '</span>' +
      tier +
      (sl ? '<span class="sub-pill">' + esc(sl) + '</span>' : '') +
      '<h3>' + esc(ad.title) + '</h3>' +
      '<span class="meta"><span class="loc">📍 ' + esc(adLocLabel(ad)) + ' • ' + esc(ad.cond) + '</span>' + (date ? '<span>' + date + '</span>' : '') + '</span></span></a>';
  }

  /* ---------- location cascade ----------
     Markup contract (per form): selects with ids <p>Div <p>Dist <p>Upa <p>Uni,
     optional search inputs <p>DistSearch <p>UpaSearch <p>UniSearch,
     optional path label <p>LocPath. opts: {emptyLabel, onChange} */
  function wireCascade(p, opts) {
    opts = opts || {};
    var divSel = $(p + 'Div'), distSel = $(p + 'Dist'), upaSel = $(p + 'Upa'), uniSel = $(p + 'Uni');
    var state = { div: null, dist: null, upa: null, uni: null };
    if (!divSel) return { get: function () { return state; } };

    function fillDiv() {
      divSel.innerHTML = '';
      var o = document.createElement('option');
      o.value = '';
      o.textContent = opts.emptyLabel || '— বিভাগ বেছে নিন —';
      divSel.appendChild(o);
      GEO.div.forEach(function (r) {
        var op = document.createElement('option');
        op.value = r[0];
        op.textContent = r[1] + ' • ' + r[2];
        divSel.appendChild(op);
      });
    }
    function fillList(sel, rows, searchText, placeholder) {
      sel.innerHTML = '';
      var o = document.createElement('option');
      o.value = '';
      o.textContent = placeholder;
      sel.appendChild(o);
      var q = (searchText || '').toLowerCase();
      rows.forEach(function (r) {
        var en = r[2], bn = r[3];
        if (q && (en + ' ' + bn).toLowerCase().indexOf(q) === -1) return;
        var op = document.createElement('option');
        op.value = r[0];
        op.textContent = en + ' • ' + bn;
        sel.appendChild(op);
      });
      sel.disabled = !rows.length;
    }
    function refreshPath() {
      var el = $(p + 'LocPath');
      if (!el) return;
      var t = trailFromIds(state.div, state.dist, state.upa, state.uni);
      el.textContent = t ? ('📍 ' + t) : (opts.emptyPath || 'No location chosen yet');
    }
    function changed() { refreshPath(); if (opts.onChange) opts.onChange(state); }

    function fillDist() {
      var rows = state.div ? districtsOf(state.div) : [];
      fillList(distSel, rows, ($(p + 'DistSearch') || {}).value, '— জেলা —');
      distSel.value = state.dist ? String(state.dist) : '';
    }
    function fillUpa() {
      var rows = state.dist ? upazilasOf(state.dist) : [];
      fillList(upaSel, rows, ($(p + 'UpaSearch') || {}).value, '— উপজেলা —');
      upaSel.value = state.upa ? String(state.upa) : '';
    }
    function fillUni() {
      var rows = state.upa ? unionsOf(state.upa) : [];
      fillList(uniSel, rows, ($(p + 'UniSearch') || {}).value, '— ইউনিয়ন —');
      uniSel.value = state.uni ? String(state.uni) : '';
    }

    fillDiv();
    divSel.addEventListener('change', function () {
      state.div = divSel.value ? Number(divSel.value) : null;
      state.dist = null; state.upa = null; state.uni = null;
      fillDist(); fillUpa(); fillUni(); changed();
    });
    if (distSel) distSel.addEventListener('change', function () {
      state.dist = distSel.value ? Number(distSel.value) : null;
      state.upa = null; state.uni = null;
      fillUpa(); fillUni(); changed();
    });
    if (upaSel) upaSel.addEventListener('change', function () {
      state.upa = upaSel.value ? Number(upaSel.value) : null;
      state.uni = null;
      fillUni(); changed();
    });
    if (uniSel) uniSel.addEventListener('change', function () {
      state.uni = uniSel.value ? Number(uniSel.value) : null;
      changed();
    });
    [['DistSearch', fillDist], ['UpaSearch', fillUpa], ['UniSearch', fillUni]].forEach(function (pair) {
      var inp = $(p + pair[0]);
      if (inp) inp.addEventListener('input', pair[1]);
    });
    fillDist(); fillUpa(); fillUni(); refreshPath();

    return {
      get: function () { return state; },
      set: function (sel) {
        state.div = sel.div || null; state.dist = sel.dist || null;
        state.upa = sel.upa || null; state.uni = sel.uni || null;
        divSel.value = state.div ? String(state.div) : '';
        fillDist(); fillUpa(); fillUni(); changed();
      },
      clear: function () {
        state.div = state.dist = state.upa = state.uni = null;
        divSel.value = '';
        fillDist(); fillUpa(); fillUni(); changed();
      }
    };
  }

  /* ---------- local submissions (post.html -> seller.html) ---------- */
  var SUB_KEY = 'hb_submissions_v1';
  function getSubmissions() {
    try { return JSON.parse(localStorage.getItem(SUB_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveSubmission(rec) {
    var arr = getSubmissions();
    arr.push(rec);
    try { localStorage.setItem(SUB_KEY, JSON.stringify(arr.slice(-50))); } catch (e) {}
  }

  window.HB = {
    $: $, esc: esc, fmt: fmt, toast: toast, fmtDate: fmtDate,
    GEO: GEO, DIV_BY_ID: DIV_BY_ID, DIST_BY_ID: DIST_BY_ID, UPA_BY_ID: UPA_BY_ID, UNI_BY_ID: UNI_BY_ID,
    districtsOf: districtsOf, upazilasOf: upazilasOf, unionsOf: unionsOf,
    trailFromIds: trailFromIds, adLocLabel: adLocLabel,
    CATEGORIES: CATS, catObj: catObj, catName: catName, catIcon: catIcon,
    subsFor: subsFor, subObj: subObj, subLabel: subLabel,
    sbGet: sbGet, sbPost: sbPost, fetchLiveAds: fetchLiveAds, fetchAdById: fetchAdById,
    fetchLiveAdsBySeller: fetchLiveAdsBySeller, uploadPhoto: uploadPhoto,
    normalizeFallback: normalizeFallback, cardHTML: cardHTML, adHref: adHref,
    wireCascade: wireCascade, getSubmissions: getSubmissions, saveSubmission: saveSubmission,
    MESSENGER_URL: CFG.MESSENGER_URL
  };
})();
