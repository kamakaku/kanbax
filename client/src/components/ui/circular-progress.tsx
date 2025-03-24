import { cn } from "@/lib/utils";

interface CircularProgressIndicatorProps {
  value: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  onClick?: () => void;
  useStripedBackground?: boolean;
}

const sizeClasses = {
  sm: "w-10 h-10", 
  md: "w-14 h-14", 
  lg: "w-20 h-20", 
};

const textSizeClasses = {
  sm: "text-[8px]", 
  md: "text-xs", 
  lg: "text-sm", 
};

export function CircularProgressIndicator({
  value,
  size = "md",
  label,
  className,
  onClick,
  useStripedBackground = false,
}: CircularProgressIndicatorProps) {
  // Ensure value is between 0 and 100
  const normalizedValue = Math.min(Math.max(value || 0, 0), 100);

  // Calculate circle properties based on size
  const svgSize = size === "sm" ? 40 : size === "md" ? 56 : 80; 
  const strokeWidth = size === "sm" ? 3 : size === "md" ? 4 : 5;
  const radius = (svgSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  // Eindeutige ID für den Pattern und Mask, um Konflikte zu vermeiden
  const patternId = `diagonalHatchCircle-${Math.random().toString(36).substr(2, 9)}`;
  const maskId = `progressMask-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      <svg className="w-full h-full -rotate-90">
        {useStripedBackground && (
          <defs>
            {/* Pattern für diagonale Schraffur */}
            <pattern 
              id={patternId} 
              width="4" 
              height="4" 
              patternUnits="userSpaceOnUse" 
              patternTransform="rotate(45)"
            >
              <line 
                x1="0" 
                y1="0" 
                x2="0" 
                y2="4" 
                stroke="#888" 
                strokeWidth="1.5" 
                strokeOpacity="0.65"
              />
            </pattern>
            
            {/* Maske für den Progress-Bereich */}
            <mask id={maskId}>
              <circle
                fill="white"
                r={radius}
                cx="50%"
                cy="50%"
              />
            </mask>
          </defs>
        )}
        
        {/* Background circle */}
        {useStripedBackground ? (
          <circle
            fill={`url(#${patternId})`}
            r={radius}
            cx="50%"
            cy="50%"
            mask={`url(#${maskId})`}
          />
        ) : (
          <circle
            className="text-muted-foreground/20"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50%"
            cy="50%"
          />
        )}
        
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
            normalizedValue === 100 ? "text-green-600" : "text-muted-foreground",
            textSizeClasses[size]
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}