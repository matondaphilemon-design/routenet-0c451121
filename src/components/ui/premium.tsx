import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared premium primitives used across the redesigned Routenet UI.
 * These keep visual language consistent so any page picking them up
 * inherits the same rounded corners, gradient chrome and motion.
 */

export function PremiumCard({
  children,
  className,
  onClick,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: any;
}) {
  const Comp: any = onClick ? motion.button : motion[Tag as keyof typeof motion] ?? motion.div;
  return (
    <Comp
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card/90 to-background/70 text-left shadow-card backdrop-blur-xl transition-all",
        onClick && "hover:border-primary/40 hover:shadow-glow",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  actionLabel = "See all",
  className,
}: {
  title: string;
  subtitle?: string;
  action?: () => void;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 px-1", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-black tracking-tight text-foreground">{title}</h2>
        {subtitle && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action}
          className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Horizontal snap-scroll row. Renders children in a single scrollable line
 * with hidden scrollbars, snapping stops, and lazy-loaded content.
 */
export function HorizontalRow({
  children,
  className,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("relative -mx-4", className)}>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 scrollbar-hide">
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div key={i} className={cn("snap-start shrink-0", itemClassName)}>
                {child}
              </div>
            ))
          : (
              <div className={cn("snap-start shrink-0", itemClassName)}>{children}</div>
            )}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-2xl bg-muted/50", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-black text-foreground">{title}</p>
        {description && <p className="mt-1 text-xs font-medium text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
          Retry
        </button>
      )}
    </div>
  );
}
