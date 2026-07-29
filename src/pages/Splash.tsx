import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const onboarded =
      localStorage.getItem("routenet-onboarded") ||
      localStorage.getItem("tunestream-onboarded");
    // Returning users go straight in; first-timers get a brief brand moment.
    const timer = setTimeout(
      () => navigate(onboarded === "true" ? "/home" : "/onboarding"),
      onboarded === "true" ? 350 : 1200,
    );
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.18 }}
          transition={{ duration: 1.5 }}
          className="absolute -top-1/4 -left-1/4 h-[80vh] w-[80vh] rounded-full blur-[120px]"
          style={{ background: "hsl(var(--primary))" }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="absolute -bottom-1/4 -right-1/4 h-[60vh] w-[60vh] rounded-full blur-[100px]"
          style={{ background: "hsl(var(--primary-glow))" }}
        />
      </div>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/25"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.6 + i * 0.35, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
        <AppLogo className="relative h-24 w-24 rounded-full border border-border/60 p-3 shadow-glow" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-8 text-4xl font-black tracking-tight text-foreground"
      >
        <span className="text-primary">route</span>net
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-2 text-sm font-medium text-muted-foreground"
      >
        Your Sound, Your Vibe
      </motion.p>
    </div>
  );
}
