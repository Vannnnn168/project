(() => {
  if (window.__GAPT_GUARD || window.top === window) return; // Run only inside subframes
  window.__GAPT_GUARD = true;

  const FREE_WORDS = ["free trial", "start your free trial", "免费试用", "US$0.00", "$0.00", "0,00", "€0.00", "won't be charged", "不会向您收费", "不会收费"];
  const PAID_WORDS = ["/mo after", "/month after", "per month after", "立即付款", "pay now", "今日扣款", "charged today"];

  let bar = null;
  function paint(kind, text) {
    if (!document.body) return;
    if (!bar) {
      bar = document.createElement("div");
      bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:10px 14px;" +
        "font:13px/1.5 -apple-system,Segoe UI,Roboto,'Microsoft YaHei',sans-serif;text-align:center;font-weight:600;";
      document.body.appendChild(bar);
    }
    bar.style.background = kind === "ok" ? "#1a7f37" : (kind === "bad" ? "#c62828" : "#616161");
    bar.style.color = "#fff";
    bar.textContent = text;
  }

  function judge() {
    let t = "";
    try {
      t = (document.body && document.body.innerText || "").toLowerCase();
    } catch (e) {
      return;
    }
    if (!t || t.length < 5) return;
    const free = FREE_WORDS.some((w) => t.includes(w.toLowerCase()));
    const paid = PAID_WORDS.some((w) => t.includes(w.toLowerCase()));

    if (free && !paid) {
      paint("ok", "✅ Free trial detected — Safe to subscribe (please double-check the amount is $0.00)");
    } else if (paid && !free) {
      paint("bad", "❌ No free trial detected, may charge immediately — Do NOT subscribe, go back and switch layers");
    } else if (free && paid) {
      paint("warn", "⚠️ Both free and paid terms detected — Please manually verify the amount before clicking");
    } else {
      paint("warn", "… Pricing terms not recognized yet (may still be loading)");
    }
  }

  setTimeout(judge, 1200);
  setTimeout(judge, 3000);
  setTimeout(judge, 6000);
  try {
    const mo = new MutationObserver(() => judge());
    document.addEventListener("DOMContentLoaded", () => mo.observe(document.body, { childList: true, subtree: true, characterData: true }));
  } catch (e) {}
})();
