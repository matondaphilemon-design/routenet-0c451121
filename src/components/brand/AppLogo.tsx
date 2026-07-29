import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  imageClassName?: string;
  alt?: string;
}

export function AppLogo({ className, imageClassName, alt = "Routenet logo" }: AppLogoProps) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-background", className)}>
      <img
        src="/logo.png"
        alt={alt}
        className={cn("h-full w-full object-contain", imageClassName)}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}