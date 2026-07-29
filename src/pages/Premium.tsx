import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";

const benefits = [
  { title: "Offline", desc: "Listen anywhere without internet" },
  { title: "High-quality audio", desc: "Crystal clear sound" },
  { title: "Ad-free", desc: "No interruptions" },
  { title: "Personalized AI DJ", desc: "Intelligent mixing for you" },
];

export default function Premium() {
  const navigate = useNavigate();

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24 bg-background">
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 bg-background/80 px-4 pb-4 pt-12 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 text-foreground hover:bg-muted/20"><ChevronLeft className="h-6 w-6" /></button>
          <h1 className="text-lg font-bold text-foreground">Go Premium</h1>
          <div className="w-10" />
        </div>
      </motion.header>

      {/* Lightning Logo with red glow */}
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className="flex flex-col items-center pt-6 pb-8">
        <div className="relative">
          {[1, 2, 3].map((i) => (
            <motion.div key={i} className="absolute inset-0 rounded-full"
              style={{ width: `${80 + i * 30}px`, height: `${80 + i * 30}px`, top: `${-i * 15}px`, left: `${-i * 15}px` }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.03, 0.1] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.3 }}>
              <div className="h-full w-full rounded-full border border-primary/20" />
            </motion.div>
          ))}
          <AppLogo className="h-20 w-20 rounded-full border border-border/60 p-2" />
        </div>
        <h2 className="mt-6 text-2xl font-extrabold text-foreground text-center">Get the most<br />of Routenet</h2>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-xs">Routenet Premium streaming.</p>
      </motion.div>

      {/* Benefits */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="mx-6 space-y-3 mb-8">
        {benefits.map((b, i) => (
          <motion.div key={b.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            className="flex items-center gap-3">
            <Check className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-sm text-foreground">{b.title}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="px-6">
        <button className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground"
          style={{ boxShadow: "0 0 30px hsl(346 100% 59% / 0.3)" }}>
          Upgrade
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Try it free for 1 month. Cancel anytime.</p>
      </motion.div>
    </div>
  );
}
