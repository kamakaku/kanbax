import { cn } from "@/lib/utils";

interface CircularProgressIndicatorProps {
  value: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const textSizeClasses = {
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-base",
};

export function CircularProgressIndicator({
  value,
  size = "md",
  label,
  className,
}: CircularProgressIndicatorProps) {
  // Ensure value is between 0 and 100
  const normalizedValue = Math.min(Math.max(value || 0, 0), 100);

  // Calculate circle properties based on size
  const svgSize = size === "sm" ? 32 : size === "md" ? 48 : 64;
  const strokeWidth = size === "sm" ? 3 : size === "md" ? 4 : 5;
  const radius = (svgSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      <svg className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          className="text-muted-foreground/20"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
        {/* Progress circle */}
        <circle
          className={cn(
            "transition-all duration-300 ease-in-out",
            normalizedValue === 100 ? "text-green-500" : "text-primary"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
      </svg>
      {label && (
        <span 
          className={cn(
            "absolute text-center font-medium",
            textSizeClasses[size]
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}