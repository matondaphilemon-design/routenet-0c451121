import { useNavigate } from "react-router-dom";

const PILLS = [
  { label: "All",      bg: "from-pink-500 to-pink-400",      active: true,  q: "trending" },
  { label: "Comedy",   bg: "from-indigo-500 to-blue-500",    q: "comedy podcast" },
  { label: "Business", bg: "from-slate-500 to-slate-400",    q: "business podcast" },
  { label: "Music",    bg: "from-slate-600 to-slate-500",    q: "top music" },
  { label: "Religion", bg: "from-purple-500 to-fuchsia-500", q: "gospel worship" },
  { label: "Romance",  bg: "from-blue-500 to-cyan-500",      q: "love songs" },
];

export function CategoryPillsV2() {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 gap-2 mb-6">
      {PILLS.map((p) => (
        <button
          key={p.label}
          onClick={() => navigate(`/search?q=${encodeURIComponent(p.q)}`)}
          className={`relative h-12 rounded-xl overflow-hidden bg-gradient-to-br ${p.bg} active:scale-[0.98] transition-transform shadow-md`}
        >
          <span className={`absolute inset-0 flex items-center justify-start pl-3 text-[15px] font-extrabold text-white ${p.active ? "" : "text-white/95"}`}>
            {p.label}
          </span>
          {/* faint photo wash for non-active */}
          {!p.active && <span className="absolute inset-0 bg-black/10" />}
        </button>
      ))}
    </div>
  );
}