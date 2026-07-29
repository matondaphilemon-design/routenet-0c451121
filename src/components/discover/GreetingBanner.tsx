import { motion } from "framer-motion";

export function GreetingBanner() {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <h1 className="text-2xl font-bold text-foreground">{getGreeting()}</h1>
      <p className="text-sm text-muted-foreground">What do you want to listen to?</p>
    </motion.div>
  );
}
