import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";
import { Button } from "@/components/ui/button";

export default function Splash() {
  const navigate = useNavigate();
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const onboarded =
      localStorage.getItem("routenet-onboarded") ||
      localStorage.getItem("tunestream-onboarded");
    if (onboarded === "true") {
      const timer = setTimeout(() => navigate("/home"), 500);
      return () => clearTimeout(timer);
    }
    setIsFirstVisit(true);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        <AppLogo className="relative h-28 w-28 bg-transparent" imageClassName="object-contain" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-8 text-4xl font-black tracking-tight text-foreground"
      >
        Routenet
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-2 text-sm font-medium text-muted-foreground"
      >
        Millions of songs. Personalized by AI.<br />Made for the way you listen.
      </motion.p>
      {isFirstVisit && (
        <Button onClick={() => navigate("/onboarding")} className="mt-10 w-56 rounded-full py-6 text-sm font-bold">
          Get Started
        </Button>
      )}
    </div>
  );
}
