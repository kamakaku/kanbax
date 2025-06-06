import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

// Vereinfachter TooltipProvider mit standardmäßiger Verzögerung
const TooltipProvider = ({
  children,
  delayDuration = 300,
  skipDelayDuration = 0,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider 
    delayDuration={delayDuration} 
    skipDelayDuration={skipDelayDuration} 
    {...props}
  >
    {children}
  </TooltipPrimitive.Provider>
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Helper-Komponente für einfachere Tooltip-Nutzung
const SimpleTooltip = ({ 
  content,
  children,
  side = "top",
  className = ""
}: { 
  content: React.ReactNode; 
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      {children}
    </TooltipTrigger>
    <TooltipContent side={side} className={cn("bg-white p-2 rounded shadow-lg border border-gray-200", className)}>
      {content}
    </TooltipContent>
  </Tooltip>
);

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip }
