import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface Props {
  isActive: boolean;
  isLoading: boolean;
  progress?: number; // 0 to 1
  artwork?: string;
}

export default function DJCircle({ isActive, isLoading, progress = 0, artwork }: Props) {
  const size = 152;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0 rounded-full blur-[60px] opacity-15" style={{ background: "hsl(170 100% 45%)" }} />

      {/* Progress ring */}
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(170 100% 45% / 0.1)" strokeWidth={strokeWidth} />
        {/* Fill */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="hsl(170 100% 45%)" strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>

      {/* Visualizer rings */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360;
        return (
          <motion.div key={i} className="absolute" style={{ width: "80%", height: "80%", borderRadius: "50%", border: "1px solid transparent", borderTopColor: "hsl(170 100% 45% / 0.2)", transform: `rotate(${angle}deg)` }}
            animate={isActive ? { scale: [1, 1 + Math.random() * 0.06, 1], rotate: [angle, angle + (Math.random() > 0.5 ? 3 : -3), angle] }
              : isLoading ? { rotate: [angle, angle + 360] } : {}}
            transition={isActive ? { duration: 0.3 + Math.random() * 0.4, repeat: Infinity, ease: "easeInOut" }
              : isLoading ? { duration: 3, repeat: Infinity, ease: "linear" } : {}} />
        );
      })}

      {/* Center content - artwork or emoji */}
      <motion.div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full overflow-hidden"
        style={{
          background: artwork ? undefined : "linear-gradient(135deg, hsl(220 10% 15% / 0.9), hsl(220 10% 10%))",
          border: "2px solid hsl(170 100% 45% / 0.3)",
          boxShadow: "0 0 40px hsl(170 100% 45% / 0.15)",
        }}
        animate={isActive ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
        {isLoading ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : artwork ? (
          <img src={artwork} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl"></span>
        )}
      </motion.div>
    </div>
  );
}
