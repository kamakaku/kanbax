import { cn } from "@/lib/utils";
import { Card, type CardProps } from "./card";

interface GlassCardProps extends CardProps {
  intensity?: "low" | "medium" | "high";
}

export function GlassCard({ 
  className, 
  intensity = "medium",
  ...props 
}: GlassCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden backdrop-blur-sm border-opacity-40",
        intensity === "low" && "bg-white/20 border-white/20",
        intensity === "medium" && "bg-white/30 border-white/30",
        intensity === "high" && "bg-white/40 border-white/40",
        "hover:bg-white/50 transition-all duration-300",
        "shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]",
        className
      )}
      {...props}
    />
  );
}