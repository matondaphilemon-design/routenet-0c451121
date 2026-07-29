import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Moon,
  Smartphone,
  Download,
  Volume2,
  Wifi,
  Lock,
  Palette,
  Sparkles,
  Music2,
  Sliders,
  Timer,
  Eye,
  Type,
  Info,
  Mail,
  KeyRound,
  Trash2,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PremiumCard, SectionHeader } from "@/components/ui/premium";
import { cn } from "@/lib/utils";

type SubPage =
  | null
  | "account"
  | "playback"
  | "ai"
  | "downloads"
  | "notifications"
  | "appearance"
  | "accessibility"
  | "about";

interface Prefs {
  audioQuality: "auto" | "normal" | "high" | "lossless";
  downloadQuality: "normal" | "high" | "lossless";
  crossfade: number;
  gapless: boolean;
  normalize: boolean;
  dataSaver: boolean;
  aiRecommend: boolean;
  aiPlaylists: boolean;
  aiHistoryTracking: boolean;
  discoverNewArtists: boolean;
  notifNewReleases: boolean;
  notifArtists: boolean;
  notifPlaylists: boolean;
  notifFriends: boolean;
  reducedMotion: boolean;
  largerText: boolean;
  fontSize: number;
  wifiOnlyDownload: boolean;
  offlineMode: boolean;
}

const DEFAULTS: Prefs = {
  audioQuality: "high",
  downloadQuality: "high",
  crossfade: 0,
  gapless: true,
  normalize: true,
  dataSaver: false,
  aiRecommend: true,
  aiPlaylists: true,
  aiHistoryTracking: true,
  discoverNewArtists: true,
  notifNewReleases: true,
  notifArtists: true,
  notifPlaylists: false,
  notifFriends: false,
  reducedMotion: false,
  largerText: false,
  fontSize: 100,
  wifiOnlyDownload: true,
  offlineMode: false,
};

const PREFS_KEY = "routenet-prefs-v1";

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

async function persistPrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, settings: prefs as any });
    }
  } catch {}
}

function Row({
  icon: Icon,
  label,
  desc,
  onClick,
  right,
  destructive,
}: {
  icon?: any;
  label: string;
  desc?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <motion.button
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
    >
      {Icon && (
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            destructive ? "bg-destructive/15 text-destructive" : "bg-primary/12 text-primary",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-bold", destructive && "text-destructive")}>{label}</p>
        {desc && <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{desc}</p>}
      </div>
      {right ?? (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />)}
    </motion.button>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title && (
        <p className="px-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <PremiumCard className="divide-y divide-border/40 !p-0">{children}</PremiumCard>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      persistPrefs(next);
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  const handleResetRecommendations = () => {
    localStorage.removeItem("routenet_taste_events");
    toast.success("Recommendations reset. Your feed will regenerate.");
  };

  const back = () => setSubPage(null);

  const initials = useMemo(() => {
    const src = user?.user_metadata?.display_name || user?.email || "R N";
    return src.trim().slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <main className="min-h-screen bg-background pb-32">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.25),transparent_60%)]" />

        <header className="relative z-10 flex items-center justify-between px-5 pt-10">
          <button
            onClick={() => (subPage ? back() : navigate(-1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 backdrop-blur-md"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-black">
            {subPage ? SUB_TITLES[subPage] : "Settings"}
          </h1>
          <div className="h-10 w-10" />
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={subPage || "root"}
            initial={{ opacity: 0, x: subPage ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: subPage ? -20 : 20 }}
            transition={{ duration: 0.25 }}
            className="relative z-10 mx-auto max-w-lg px-5 pt-6"
          >
            {subPage === null && (
              <div className="space-y-6">
                {/* Profile header */}
                <PremiumCard className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-lg font-black text-primary-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black">
                        {user?.user_metadata?.display_name || user?.email || "Guest listener"}
                      </p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {user ? "Routenet · Free plan" : "Not signed in"}
                      </p>
                    </div>
                    <button
                      onClick={() => (user ? navigate("/profile") : navigate("/auth"))}
                      className="rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary"
                    >
                      {user ? "View" : "Sign in"}
                    </button>
                  </div>
                </PremiumCard>

                <Group>
                  <Row icon={User} label="Account" desc="Profile, subscription, security" onClick={() => setSubPage("account")} />
                  <Row icon={Volume2} label="Playback" desc="Audio quality, crossfade, EQ" onClick={() => setSubPage("playback")} />
                  <Row icon={Sparkles} label="AI & Recommendations" desc="Tune what Routenet learns" onClick={() => setSubPage("ai")} />
                  <Row icon={Download} label="Downloads" desc="Storage, quality, offline mode" onClick={() => setSubPage("downloads")} />
                  <Row icon={Bell} label="Notifications" desc="Releases, artists, friends" onClick={() => setSubPage("notifications")} />
                  <Row icon={Palette} label="Appearance" desc="Theme & colors" onClick={() => setSubPage("appearance")} />
                  <Row icon={Eye} label="Accessibility" desc="Motion, text, contrast" onClick={() => setSubPage("accessibility")} />
                  <Row icon={Info} label="About" desc="Version, legal, feedback" onClick={() => setSubPage("about")} />
                </Group>

                {user && (
                  <Group>
                    <Row icon={LogOut} label="Sign out" onClick={handleLogout} destructive />
                  </Group>
                )}
                <p className="pt-2 text-center text-[11px] font-medium text-muted-foreground">
                  Routenet · v2.0
                </p>
              </div>
            )}

            {subPage === "account" && (
              <div className="space-y-6">
                <Group title="Profile">
                  <Row icon={User} label="Edit profile" desc="Name, avatar, bio" onClick={() => navigate("/profile")} />
                  <Row icon={Mail} label="Email" desc={user?.email || "Not signed in"} />
                  <Row icon={KeyRound} label="Change password" onClick={() => toast.info("Check your email for a reset link")} />
                </Group>
                <Group title="Subscription">
                  <Row icon={Zap} label="Routenet Premium" desc="Ad-free · Lossless · Downloads" onClick={() => navigate("/premium")} />
                  <Row icon={Smartphone} label="Connected devices" desc="Manage active sessions" />
                </Group>
                <Group title="Privacy">
                  <Row icon={Lock} label="Private session" right={<Switch checked={false} />} />
                  <Row icon={Shield} label="Data & permissions" desc="Manage your data" />
                  <Row icon={Trash2} label="Delete account" destructive onClick={() => toast.error("Contact support to delete your account")} />
                </Group>
              </div>
            )}

            {subPage === "playback" && (
              <div className="space-y-6">
                <Group title="Streaming quality">
                  {(["auto", "normal", "high", "lossless"] as const).map((q) => (
                    <Row
                      key={q}
                      icon={Music2}
                      label={q === "auto" ? "Automatic" : q === "normal" ? "Normal (96 kbps)" : q === "high" ? "High (320 kbps)" : "Lossless (FLAC)"}
                      onClick={() => set("audioQuality", q)}
                      right={
                        prefs.audioQuality === q ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5 rounded-full border border-border" />
                        )
                      }
                    />
                  ))}
                </Group>
                <Group title="Player">
                  <Row
                    icon={Sliders}
                    label="Crossfade"
                    desc={prefs.crossfade === 0 ? "Off" : `${prefs.crossfade}s between songs`}
                  />
                  <div className="px-4 pb-4">
                    <Slider
                      value={[prefs.crossfade]}
                      max={12}
                      step={1}
                      onValueChange={([v]) => set("crossfade", v)}
                    />
                  </div>
                  <Row
                    icon={Music2}
                    label="Gapless playback"
                    right={<Switch checked={prefs.gapless} onCheckedChange={(v) => set("gapless", v)} />}
                  />
                  <Row
                    icon={Volume2}
                    label="Normalize volume"
                    desc="Keep every song at a consistent loudness"
                    right={<Switch checked={prefs.normalize} onCheckedChange={(v) => set("normalize", v)} />}
                  />
                  <Row icon={Sliders} label="Equalizer" onClick={() => navigate("/equalizer")} />
                  <Row icon={Timer} label="Sleep timer" onClick={() => navigate("/sleep-timer")} />
                </Group>
                <Group title="Data">
                  <Row
                    icon={Wifi}
                    label="Data saver"
                    desc="Lower streaming quality on cellular"
                    right={<Switch checked={prefs.dataSaver} onCheckedChange={(v) => set("dataSaver", v)} />}
                  />
                </Group>
              </div>
            )}

            {subPage === "ai" && (
              <div className="space-y-6">
                <PremiumCard className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Powered by Routenet AI</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        Routenet learns from what you play, like, skip and save to build a queue that keeps improving.
                      </p>
                    </div>
                  </div>
                </PremiumCard>
                <Group title="Personalization">
                  <Row
                    icon={Sparkles}
                    label="AI recommendations"
                    right={<Switch checked={prefs.aiRecommend} onCheckedChange={(v) => set("aiRecommend", v)} />}
                  />
                  <Row
                    icon={Music2}
                    label="AI-curated playlists"
                    desc="Daily Mix, Fresh Friday, Discover Weekly"
                    right={<Switch checked={prefs.aiPlaylists} onCheckedChange={(v) => set("aiPlaylists", v)} />}
                  />
                  <Row
                    icon={Eye}
                    label="Listening history"
                    desc="Let Routenet track plays to improve suggestions"
                    right={<Switch checked={prefs.aiHistoryTracking} onCheckedChange={(v) => set("aiHistoryTracking", v)} />}
                  />
                  <Row
                    icon={User}
                    label="Discover new artists"
                    right={<Switch checked={prefs.discoverNewArtists} onCheckedChange={(v) => set("discoverNewArtists", v)} />}
                  />
                </Group>
                <Group>
                  <Row icon={Trash2} label="Reset recommendations" desc="Start fresh — clears learned taste" destructive onClick={handleResetRecommendations} />
                </Group>
              </div>
            )}

            {subPage === "downloads" && (
              <div className="space-y-6">
                <Group title="Storage">
                  <Row icon={Download} label="Manage downloads" onClick={() => navigate("/library")} />
                  <Row icon={Smartphone} label="Storage used" desc="Tap to view usage" />
                </Group>
                <Group title="Quality">
                  {(["normal", "high", "lossless"] as const).map((q) => (
                    <Row
                      key={q}
                      icon={Music2}
                      label={q === "normal" ? "Normal" : q === "high" ? "High" : "Lossless"}
                      onClick={() => set("downloadQuality", q)}
                      right={
                        prefs.downloadQuality === q ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5 rounded-full border border-border" />
                        )
                      }
                    />
                  ))}
                </Group>
                <Group title="Behavior">
                  <Row icon={Wifi} label="Download over Wi-Fi only"
                    right={<Switch checked={prefs.wifiOnlyDownload} onCheckedChange={(v) => set("wifiOnlyDownload", v)} />} />
                  <Row icon={Zap} label="Offline mode" desc="Only play downloaded music"
                    right={<Switch checked={prefs.offlineMode} onCheckedChange={(v) => set("offlineMode", v)} />} />
                </Group>
              </div>
            )}

            {subPage === "notifications" && (
              <Group title="Notifications">
                <Row icon={Music2} label="New releases" right={<Switch checked={prefs.notifNewReleases} onCheckedChange={(v) => set("notifNewReleases", v)} />} />
                <Row icon={User} label="Artist updates" right={<Switch checked={prefs.notifArtists} onCheckedChange={(v) => set("notifArtists", v)} />} />
                <Row icon={Music2} label="Playlist updates" right={<Switch checked={prefs.notifPlaylists} onCheckedChange={(v) => set("notifPlaylists", v)} />} />
                <Row icon={Bell} label="Friend activity" right={<Switch checked={prefs.notifFriends} onCheckedChange={(v) => set("notifFriends", v)} />} />
              </Group>
            )}

            {subPage === "appearance" && (
              <div className="space-y-6">
                <Group title="Theme">
                  <Row icon={Moon} label="Dark mode" desc="Routenet is optimized for dark" right={<Switch checked disabled />} />
                </Group>
                <Group title="Accent color">
                  <div className="grid grid-cols-5 gap-3 p-4">
                    {["#E11D2E", "#F97316", "#8B5CF6", "#10B981", "#3B82F6"].map((c) => (
                      <button
                        key={c}
                        onClick={() => toast.info("Custom colors coming soon")}
                        className="aspect-square rounded-full ring-2 ring-transparent transition-all hover:scale-110 hover:ring-white/40"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </Group>
              </div>
            )}

            {subPage === "accessibility" && (
              <div className="space-y-6">
                <Group>
                  <Row icon={Zap} label="Reduced motion" right={<Switch checked={prefs.reducedMotion} onCheckedChange={(v) => set("reducedMotion", v)} />} />
                  <Row icon={Type} label="Larger text" right={<Switch checked={prefs.largerText} onCheckedChange={(v) => set("largerText", v)} />} />
                </Group>
                <Group title="Font size">
                  <div className="px-4 py-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Scale</span>
                      <span className="text-sm font-black">{prefs.fontSize}%</span>
                    </div>
                    <Slider
                      className="mt-3"
                      value={[prefs.fontSize]}
                      min={80}
                      max={140}
                      step={5}
                      onValueChange={([v]) => set("fontSize", v)}
                    />
                  </div>
                </Group>
              </div>
            )}

            {subPage === "about" && (
              <div className="space-y-6">
                <Group>
                  <Row icon={Info} label="Version" desc="Routenet 2.0.0" />
                  <Row icon={Shield} label="Privacy policy" />
                  <Row icon={Shield} label="Terms of service" />
                  <Row icon={Info} label="Open-source licenses" />
                </Group>
                <Group>
                  <Row icon={HelpCircle} label="Help center" />
                  <Row icon={Mail} label="Contact support" />
                  <Row icon={Sparkles} label="Send feedback" />
                </Group>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

const SUB_TITLES: Record<Exclude<SubPage, null>, string> = {
  account: "Account",
  playback: "Playback",
  ai: "AI & Recommendations",
  downloads: "Downloads",
  notifications: "Notifications",
  appearance: "Appearance",
  accessibility: "Accessibility",
  about: "About",
};
