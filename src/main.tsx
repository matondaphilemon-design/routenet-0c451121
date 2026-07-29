import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppPwa } from "./registerAppPwa";

// Apply saved theme on load
const savedTheme = localStorage.getItem("tunestream-theme") || "dark";
document.documentElement.classList.add(savedTheme);

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
registerAppPwa();

// One-time purge of legacy cached stream URLs and iframe-only blacklist.
// User requested a clean slate so the new accurate-search pipeline can
// re-resolve every link via the single stable Piped instance.
(() => {
  const PURGE_KEY = "tunestream_stream_cache_purged_v2";
  if (localStorage.getItem(PURGE_KEY)) return;
  try {
    localStorage.removeItem("tunestream_iframe_only");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("accsong_") || k.startsWith("yt_cache_") || k.startsWith("piped_")) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(PURGE_KEY, String(Date.now()));
  } catch {}
})();
