/* Arabic Tools — pure string transforms, nothing leaves the page. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;

  // Harakat U+064B–U+0652 (fathatan…sukun), extended marks U+0653–U+065F, superscript alef U+0670,
  // Quranic annotation marks U+0610–U+061A and U+06D6–U+06ED (small high/low signs, not letters).
  var TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
  var TASHKEEL_NO_SHADDA = /[ؐ-ًؚ-ِْ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
  var TATWEEL = /ـ/g;
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩", FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

  function clean(text, o) {
    var t = text;
    if (o.tashkeel) t = t.replace(o.keepShadda ? TASHKEEL_NO_SHADDA : TASHKEEL, "");
    if (o.tatweel) t = t.replace(TATWEEL, "");
    if (o.alef) t = t.replace(/[آأإٱ]/g, "ا");
    if (o.ya) t = t.replace(/[ىی]/g, "ي");
    if (o.ta) t = t.replace(/ة/g, "ه");
    if (o.hamza) t = t.replace(/ؤ/g, "و").replace(/ئ/g, "ي");
    if (o.punct) t = t.replace(/,/g, "،").replace(/;/g, "؛").replace(/\?/g, "؟");
    if (o.digits === "western") t = t.replace(/[٠-٩]/g, function (d) { return AR_DIGITS.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return FA_DIGITS.indexOf(d); });
    if (o.digits === "arabic") t = t.replace(/[0-9]/g, function (d) { return AR_DIGITS[d]; }).replace(/[۰-۹]/g, function (d) { return AR_DIGITS[FA_DIGITS.indexOf(d)]; });
    return t;
  }

  // ---------- Arabizi → Arabic ----------
  var CONS = { b: "ب", c: "ك", d: "د", f: "ف", g: "ج", h: "ه", j: "ج", k: "ك", l: "ل", m: "م", n: "ن", p: "ب", q: "ق", r: "ر", s: "س",
    t: "ت", v: "ف", w: "و", x: "كس", y: "ي", z: "ز", "2": "ء", "3": "ع", "5": "خ", "6": "ط", "7": "ح", "8": "ق", "9": "ص",
    "3'": "غ", "6'": "ظ", "7'": "خ", "9'": "ض", sh: "ش", ch: "ش", kh: "خ", gh: "غ", th: "ث", dh: "ذ" };
  var LONG = { aa: "ا", ee: "ي", ii: "ي", ei: "ي", ey: "ي", ai: "ي", ay: "ي", oo: "و", ou: "و", uu: "و" };
  var MULTI = ["3'", "6'", "7'", "9'", "sh", "ch", "kh", "gh", "th", "dh", "aa", "ee", "ii", "ei", "ey", "ai", "ay", "oo", "ou", "uu"];
  var VOWEL = /^[aeiou]$/;

  function word(w) {
    w = w.toLowerCase();
    if (/^\d+$/.test(w) || !/[a-z]/.test(w)) return w; // plain numbers stay numbers
    var units = [];
    for (var i = 0; i < w.length;) {
      var two = w.substr(i, 2), u = MULTI.indexOf(two) >= 0 ? two : w[i];
      units.push(u); i += u.length;
    }
    var out = "", last = "";
    units.forEach(function (u, i) {
      var first = i === 0, end = i === units.length - 1, ch;
      if (u === "'") return;
      if (LONG[u]) ch = first ? "ا" + (u[0] === "a" ? "" : LONG[u]) : LONG[u];
      else if (VOWEL.test(u)) {
        if (first) ch = "ا";
        else if (end) ch = { a: "ا", e: "ه", i: "ي", o: "و", u: "و" }[u];
        else ch = { a: "", e: "", i: "ي", o: "و", u: "" }[u];
      } else if (u === "2" && first) ch = "أ";
      else ch = CONS[u] != null ? CONS[u] : u;
      if (ch && ch === last && CONS[u] && !LONG[u]) return; // doubled consonant (shadda) → one letter
      out += ch; if (ch) last = ch;
    });
    return out;
  }

  function arabizi(text) {
    var parts = text.split(/([A-Za-z0-9']+)/), out = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (i % 2 === 0) { out += p.replace(/,/g, "،").replace(/;/g, "؛").replace(/\?/g, "؟"); continue; }
      if (/^(el|al|il)$/i.test(p) && /^[ -]$/.test(parts[i + 1] || "") && /[a-z]/i.test(parts[i + 2] || "")) {
        out += "ال" + word(parts[i + 2]); i += 2; continue;
      }
      out += word(p);
    }
    return out;
  }

  function counts(text) {
    var letters = (text.match(/[ء-غف-يٱ-ۓۺ-ۿ]/g) || []).length;
    var marks = (text.match(TASHKEEL) || []).length;
    var words = (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}ـ]*/gu) || []).length;
    return { letters: letters, marks: marks, words: words, chars: Array.from(text).length };
  }

  // ---------- UI ----------
  var DEFAULTS = { tashkeel: true, keepShadda: false, tatweel: true, alef: false, ya: false, ta: false, hamza: false, punct: false, digits: "keep" };
  var input = $("#input"), out = $("#out"), statsEl = $("#stats");
  var saved = S3.store("ar.opts") || {};
  var opts = {}; Object.keys(DEFAULTS).forEach(function (k) { opts[k] = k in saved ? saved[k] : DEFAULTS[k]; });
  var mode = S3.store("ar.mode") === "arabizi" ? "arabizi" : "clean";
  var SAMPLE = {
    clean: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nإِنَّ الْعِلْمَ نُورٌ، وَالْجَهْلَ ظَــــلَامٌ.\nالسعر: ٢٥٠ ديناراً للمدرسة الأولى؟",
    arabizi: "mar7aba, kifak? ana b5eir w enta?\nel bait kteer 7elo, yalla ta3al nshoof el madrase.\n3'ali 3alay, shukran 7abibi"
  };

  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () {
        $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(b.dataset.v);
      });
    });
  }
  function stat(label, value) { return '<div class="stat"><b>' + S3.esc(value) + "</b><span>" + label + "</span></div>"; }

  function syncOpts() {
    $$("#cleanOpts input[data-o]").forEach(function (c) { c.checked = !!opts[c.dataset.o]; });
    $("[data-o=keepShadda]").disabled = !opts.tashkeel;
    $$("#digits button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === opts.digits)); });
  }
  function setMode(m) {
    mode = m; S3.store("ar.mode", m);
    $("#cleanOpts").hidden = m !== "clean"; $("#arabiziOpts").hidden = m !== "arabizi";
    $("#reset").hidden = m !== "clean";
    input.setAttribute("dir", m === "arabizi" ? "ltr" : "auto");
    input.placeholder = m === "arabizi" ? "Type Arabizi, e.g. mar7aba, kifak?" : "الصق النص العربي هنا…";
    $("#inputHint").textContent = m === "arabizi" ? "Arabizi (Arabic in Latin letters and numbers)" : "Arabic text to clean";
    render();
  }

  function render() {
    var t = input.value, res = !t ? "" : mode === "arabizi" ? arabizi(t) : clean(t, opts);
    out.textContent = res;
    var c = counts(res), before = counts(t);
    statsEl.innerHTML = stat("Arabic letters · حروف", c.letters.toLocaleString()) + stat("words · كلمات", c.words.toLocaleString()) +
      stat("characters · أحرف", c.chars.toLocaleString()) +
      (mode === "clean" ? stat("marks removed · حركات", Math.max(0, before.marks - c.marks).toLocaleString()) : "");
  }

  // Arabizi reference chart
  var map = $("#map");
  [["2", "ء"], ["3", "ع"], ["3'", "غ"], ["5", "خ"], ["6", "ط"], ["6'", "ظ"], ["7", "ح"], ["7'", "خ"], ["8", "ق"], ["9", "ص"], ["9'", "ض"],
    ["sh", "ش"], ["kh", "خ"], ["gh", "غ"], ["th", "ث"], ["dh", "ذ"], ["j / g", "ج"], ["q", "ق"], ["aa", "ا"], ["ee", "ي"], ["oo", "و"]]
    .forEach(function (p) { map.appendChild(S3.h("div", {}, [S3.h("b", { text: p[0] }), S3.h("span", { lang: "ar", text: p[1] })])); });

  $$("#cleanOpts input[data-o]").forEach(function (c) {
    c.addEventListener("change", function () { opts[c.dataset.o] = c.checked; S3.store("ar.opts", opts); syncOpts(); render(); });
  });
  seg($("#digits"), opts.digits, function (v) { opts.digits = v; S3.store("ar.opts", opts); render(); });
  seg($("#mode"), mode, setMode);
  $("#reset").addEventListener("click", function () { opts = Object.assign({}, DEFAULTS); S3.store("ar.opts", undefined); syncOpts(); render(); });
  input.addEventListener("input", S3.debounce(render, 100));
  $("#clear").addEventListener("click", function () { input.value = ""; render(); input.focus(); });
  $("#sample").addEventListener("click", function () { input.value = SAMPLE[mode]; render(); });
  $("#copy").addEventListener("click", function () {
    if (!out.textContent) { S3.toast("Nothing to copy yet", "error"); return; }
    S3.copy(out.textContent); S3.done();
  });
  $("#save").addEventListener("click", function () { if (out.textContent) { S3.download(out.textContent, "arabic.txt", "text/plain;charset=utf-8"); S3.done(); } });
  $("#use").addEventListener("click", function () { if (out.textContent) { input.value = out.textContent; if (mode === "arabizi") $("#mode button[data-v=clean]").click(); else render(); } });

  syncOpts();
  setMode(mode);

  window.S3_DEMO = function () { $("#mode button[data-v=clean]").click(); input.value = SAMPLE.clean; render(); };

  window.S3_SELFTEST = function () {
    var all = { tashkeel: true, tatweel: true, alef: true, ya: true, ta: true, hamza: true, digits: "western" };
    var t = [
      [clean("مُحَمَّدٌ", { tashkeel: true }), "محمد"],
      [clean("مُحَمَّدٌ", { tashkeel: true, keepShadda: true }), "محمّد"],
      [clean("هٰذا الرَّحْمَٰنِ", { tashkeel: true }), "هذا الرحمن"],
      [clean("مـــرحبا", { tatweel: true }), "مرحبا"],
      [clean("أحمد إبراهيم آمال ٱلله", { alef: true }), "احمد ابراهيم امال الله"],
      [clean("على مدرسة سؤال قائم", all), "علي مدرسه سوال قايم"],
      [clean("١٢٣ ۴۵", { digits: "western" }), "123 45"],
      [clean("2026", { digits: "arabic" }), "٢٠٢٦"],
      [clean("كيف حالك? نعم, لا;", { punct: true }), "كيف حالك؟ نعم، لا؛"],
      [clean("نص بدون تغيير", {}), "نص بدون تغيير"],
      [arabizi("mar7aba"), "مرحبا"],
      [arabizi("7abibi"), "حبيبي"],
      [arabizi("3arabi"), "عربي"],
      [arabizi("ana"), "انا"],
      [arabizi("kteer"), "كتير"],
      [arabizi("5ala9"), "خلص"],
      [arabizi("sho"), "شو"],
      [arabizi("3'arb"), "غرب"],
      [arabizi("yalla"), "يلا"],
      [arabizi("el bait"), "البيت"],
      [arabizi("shukran, kifak?"), "شكرن، كيفك؟"],
      [arabizi("2ana 3 days 2026"), "أنا 3 ديس 2026"]
    ];
    var c = counts("مُحَمَّدٌ رسول");
    return t.every(function (p) { return p[0] === p[1]; }) && c.letters === 8 && c.marks === 5 && c.words === 2;
  };
})();
