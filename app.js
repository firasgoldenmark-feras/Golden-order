/* Golden Mark — تطبيق الطلبات (جهة صاحب العمل) */
(function () {
  'use strict';

  var CAT = window.GM_DATA;
  var H = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var PRICE_KEY = 'gm_prices_v1';
  var WA_KEY = 'gm_wa_v1';
  var DEFAULT_WA = '962795899111';

  var money = function (n) {
    return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };
  var r3 = function (n) { return Math.round((Number(n) || 0) * 1000) / 1000; };

  /* ---------- state ---------- */
  var prices = {};   // code -> string price of the largest unit
  var qty = {};      // key -> {qty, ui}   (preview only)
  CAT.products.forEach(function (p) { qty[p.key] = { qty: 0, ui: 0 }; });
  var filterBrand = 'all', q = '';

  function loadPrices() {
    try {
      var raw = localStorage.getItem(PRICE_KEY);
      if (raw) prices = JSON.parse(raw) || {};
    } catch (e) { prices = {}; }
  }
  var saveT;
  function savePrices() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try {
        localStorage.setItem(PRICE_KEY, JSON.stringify(prices));
        flashSaved();
      } catch (e) { toast('⚠️ تعذّر حفظ الأسعار على الجهاز'); }
    }, 250);
  }
  function flashSaved() {
    var t = $('#savedTag');
    if (!t) return;
    t.textContent = '✅ تم الحفظ';
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(function () { t.textContent = '💾 يُحفظ تلقائياً'; }, 1400);
  }
  function getWa() {
    try { return localStorage.getItem(WA_KEY) || DEFAULT_WA; } catch (e) { return DEFAULT_WA; }
  }
  function setWa(v) { try { localStorage.setItem(WA_KEY, v); } catch (e) {} }

  /* ---------- pricing ---------- */
  function basePrice(p) {
    var v = prices[p.code];
    return (v === undefined || v === null || v === '') ? null : Number(v);
  }
  function unitPrice(p, i) {
    var b = basePrice(p);
    return b === null ? null : b / p.units[i].per;
  }

  /* ---------- rendering ---------- */
  function renderChips() {
    var c = $('#chips'); c.innerHTML = '';
    function mk(id, label) {
      var b = document.createElement('button');
      b.className = 'chip' + (filterBrand === id ? ' on' : '');
      b.textContent = label;
      b.onclick = function () { filterBrand = id; renderChips(); render(); };
      return b;
    }
    c.appendChild(mk('all', 'الكل (' + CAT.products.length + ')'));
    CAT.brands.forEach(function (br) {
      var n = CAT.products.filter(function (p) { return p.brand === br; }).length;
      c.appendChild(mk(br, (CAT.brand_ar[br] || br) + ' (' + n + ')'));
    });
  }

  function render() {
    var root = $('#catalog'); root.innerHTML = '';
    var client = H.dataset.mode === 'client';
    var shown = 0;
    CAT.brands.forEach(function (br) {
      var list = CAT.products.filter(function (p) { return p.brand === br; });
      if (filterBrand !== 'all') list = list.filter(function (p) { return p.brand === filterBrand; });
      if (q) {
        var qq = q.trim();
        list = list.filter(function (p) {
          return (p.name + ' ' + p.brand + ' ' + p.brand_ar + ' ' + p.code).indexOf(qq) !== -1;
        });
      }
      if (!list.length) return;
      shown += list.length;
      var h = document.createElement('div'); h.className = 'brandhead';
      h.innerHTML = '<span class="bar"></span><h2>' + (CAT.brand_ar[br] || br) +
        '</h2><span class="cnt">' + list.length + ' صنف</span>';
      root.appendChild(h);
      var g = document.createElement('div'); g.className = 'grid';
      list.forEach(function (p) { g.appendChild(card(p, client)); });
      root.appendChild(g);
    });
    if (!shown) {
      var e = document.createElement('div'); e.className = 'empty';
      e.textContent = 'لا توجد أصناف مطابقة للبحث';
      root.appendChild(e);
    }
    updateSummary();
  }

  function card(p, client) {
    var st = qty[p.key];
    var c = document.createElement('div');
    c.className = 'card' + (!client && basePrice(p) !== null ? ' priced' : '') + (client && st.qty > 0 ? ' priced' : '');
    c.dataset.key = p.key;

    var mid;
    if (client) {
      var opts = p.units.map(function (u, i) {
        return '<option value="' + i + '"' + (st.ui === i ? ' selected' : '') + '>' + u.n + '</option>';
      }).join('');
      mid = '<div class="prow" data-price="' + p.key + '"></div>' +
        '<div class="qtygrp"><select class="unit-sel" data-unit="' + p.key + '">' + opts + '</select>' +
        '<input class="qty-in" type="number" min="0" step="1" inputmode="numeric" placeholder="الكمية" value="' +
        (st.qty || '') + '" data-qty="' + p.key + '"></div>' +
        '<div class="linetot" data-line="' + p.key + '"></div>';
    } else {
      var v = prices[p.code];
      mid = '<div class="plabel">سعر ال' + p.units[0].n + ':</div>' +
        '<input class="price-in" type="number" step="0.001" min="0" inputmode="decimal" placeholder="0.000" value="' +
        (v == null ? '' : v) + '" data-price-in="' + p.code + '">' +
        '<div class="breakdown" data-bd="' + p.key + '"></div>';
    }

    c.innerHTML = '<div class="pic"><img loading="lazy" src="' + p.img + '" alt=""></div><div class="body">' +
      '<span class="brandtag">' + (p.brand_ar || p.brand) + '</span>' +
      '<div class="pname">' + p.name + '</div>' +
      '<div class="pack">' + p.pack + '</div>' +
      '<div class="bc"><img src="' + p.bc + '" alt="' + p.code + '"></div>' +
      mid + '</div>';
    return c;
  }

  function prod(k) {
    for (var i = 0; i < CAT.products.length; i++) if (CAT.products[i].key === k) return CAT.products[i];
    return null;
  }

  function paintBreakdown(p) {
    var el = document.querySelector('[data-bd="' + p.key + '"]');
    if (!el) return;
    if (basePrice(p) === null || p.units.length < 2) { el.textContent = ''; return; }
    el.textContent = p.units.slice(1).map(function (u, i) {
      return u.n + ' ' + money(unitPrice(p, i + 1));
    }).join(' · ');
  }
  function paintPrice(k) {
    var el = document.querySelector('[data-price="' + k + '"]');
    if (!el) return;
    var p = prod(k), st = qty[k], up = unitPrice(p, st.ui);
    el.innerHTML = up == null ? '<small>السعر عند الطلب</small>'
      : money(up) + ' د.أ <small>/ ' + p.units[st.ui].n + '</small>';
  }
  function paintLine(k) {
    var el = document.querySelector('[data-line="' + k + '"]');
    if (!el) return;
    var p = prod(k), st = qty[k], up = unitPrice(p, st.ui);
    el.textContent = (st.qty > 0 && up != null) ? ('= ' + money(r3(up * st.qty)) + ' د.أ') : '';
  }

  function updateSummary() {
    if (H.dataset.mode === 'client') {
      var cnt = 0, tot = 0;
      CAT.products.forEach(function (p) {
        var st = qty[p.key];
        if (st.qty > 0) { cnt++; var up = unitPrice(p, st.ui); if (up != null) tot += r3(up * st.qty); }
        paintPrice(p.key); paintLine(p.key);
      });
      $('#count').textContent = cnt;
      $('#countLbl').textContent = 'صنف مطلوب';
      $('#total').textContent = money(tot);
      $('#totLbl').textContent = 'د.أ';
    } else {
      var n = CAT.products.filter(function (p) { return basePrice(p) !== null; }).length;
      CAT.products.forEach(paintBreakdown);
      $('#count').textContent = n;
      $('#countLbl').textContent = 'صنف مسعّر';
      $('#total').textContent = String(CAT.products.length - n);
      $('#totLbl').textContent = 'بلا سعر';
    }
  }

  /* ---------- events ---------- */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.priceIn != null) {
      var code = t.dataset.priceIn;
      if (t.value === '') delete prices[code]; else prices[code] = t.value;
      var cd = t.closest('.card');
      if (cd) cd.classList.toggle('priced', t.value !== '');
      var p = CAT.products.filter(function (x) { return x.code === code; })[0];
      if (p) paintBreakdown(p);
      savePrices(); updateSummary();
    }
    if (t.dataset.qty != null) {
      var k = t.dataset.qty;
      qty[k].qty = Math.max(0, parseInt(t.value || '0', 10) || 0);
      var c2 = document.querySelector('.card[data-key="' + k + '"]');
      if (c2) c2.classList.toggle('priced', qty[k].qty > 0);
      updateSummary();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.unit != null) { qty[t.dataset.unit].ui = parseInt(t.value, 10) || 0; updateSummary(); }
  });

  $('#search').addEventListener('input', function (e) { q = e.target.value; render(); });

  var waIn = $('#waInput');
  waIn.value = getWa();
  waIn.addEventListener('input', function (e) {
    var v = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = v; setWa(v); flashSaved();
  });

  $('#clearPrices').addEventListener('click', function () {
    if (!confirm('مسح كل الأسعار المحفوظة؟')) return;
    prices = {}; savePrices(); render(); toast('تم مسح الأسعار');
  });

  /* ---------- preview ---------- */
  $('#previewBtn').addEventListener('click', function () {
    H.dataset.mode = 'client'; render(); window.scrollTo(0, 0);
    toast('هذه معاينة لما سيراه العميل');
  });
  $('#backBtn').addEventListener('click', function () {
    H.dataset.mode = 'owner';
    CAT.products.forEach(function (p) { qty[p.key] = { qty: 0, ui: 0 }; });
    render(); window.scrollTo(0, 0);
  });

  /* ---------- generate client file ---------- */
  $('#prepBtn').addEventListener('click', function () {
    var priced = CAT.products.filter(function (p) { return basePrice(p) !== null; }).length;
    if (priced === 0 && !confirm('لم تُدخل أي أسعار. هل تريد المتابعة وإرسال الكتالوج بدون أسعار؟')) return;
    var wa = (getWa() || '').replace(/[^0-9]/g, '');
    if (wa.length < 8) { toast('⚠️ أدخل رقم واتساب صحيح لاستلام الطلبات'); waIn.focus(); return; }

    var baked = JSON.parse(JSON.stringify(CAT));
    baked.products.forEach(function (p) {
      var v = prices[p.code];
      p.price = (v === undefined || v === null || v === '') ? null : v;
    });
    var json = JSON.stringify(baked).split('</').join('<\\/');
    var src = window.GM_CLIENT_TEMPLATE.replace('__DATA__', json).replace('__WA__', wa);

    var blob = new Blob([src], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'طلب-شراء-Golden-Mark.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('✅ تم تنزيل نسخة العميل — أرسلها عبر واتساب');
  });

  /* ---------- toast ---------- */
  var tt;
  function toast(m) {
    var el = $('#toast'); el.textContent = m; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- install prompt ---------- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    var b = $('#installBtn'); if (b) b.style.display = '';
  });
  $('#installBtn').addEventListener('click', function () {
    if (!deferred) { toast('افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية»'); return; }
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; $('#installBtn').style.display = 'none'; });
  });
  window.addEventListener('appinstalled', function () {
    var b = $('#installBtn'); if (b) b.style.display = 'none';
    toast('✅ تم تثبيت التطبيق');
  });

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(function () {});
    });
  }

  /* ---------- init ---------- */
  $('#logo').src = CAT.logo;
  loadPrices();
  renderChips();
  render();
})();
