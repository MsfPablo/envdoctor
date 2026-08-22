// envdoctor site — copy buttons + install tabs
(function () {
  "use strict";

  var COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  function flash(btn, labelSpan) {
    var original = labelSpan ? labelSpan.textContent : "";
    btn.classList.add("copied");
    btn.querySelector(".copy-ic").innerHTML = CHECK;
    if (labelSpan) labelSpan.textContent = "Copied";
    setTimeout(function () {
      btn.classList.remove("copied");
      btn.querySelector(".copy-ic").innerHTML = COPY;
      if (labelSpan) labelSpan.textContent = original;
    }, 1600);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn");
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    if (!text) {
      var field = btn.closest(".copy-field");
      var code = field && field.querySelector("code");
      text = code ? code.textContent : "";
    }
    var label = btn.querySelector(".copy-label");
    function ok() { flash(btn, label); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { legacy(text, ok); });
    } else {
      legacy(text, ok);
    }
  });

  function legacy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (err) {}
    document.body.removeChild(ta);
    done();
  }

  // Install tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));

  function select(id) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-target") === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      p.hidden = p.id !== id;
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { select(tab.getAttribute("data-target")); });
    tab.addEventListener("keydown", function (e) {
      var next;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); select(next.getAttribute("data-target")); }
    });
  });
})();
