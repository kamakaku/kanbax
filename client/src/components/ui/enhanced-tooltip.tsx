import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"

const tooltipVariants = cva(
  "z-50 overflow-hidden rounded-md bg-white px-3 py-1.5 text-sm text-slate-950 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:bg-slate-950 dark:text-slate-50",
  {
    variants: {
      variant: {
        default: "border border-slate-200",
        info: "border-2 border-blue-100 bg-blue-50 text-blue-900",
        warning: "border-2 border-yellow-100 bg-yellow-50 text-yellow-900",
        success: "border-2 border-green-100 bg-green-50 text-green-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface EnhancedTooltipProps extends VariantProps<typeof tooltipVariants> {
  children: React.ReactNode
  content: React.ReactNode
  description?: string
  shortcut?: string
  className?: string
  interactive?: boolean
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

export function EnhancedTooltip({
  children,
  content,
  description,
  shortcut,
  className,
  variant,
  interactive = false,
  side = "top",
  align = "center",
}: EnhancedTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn(tooltipVariants({ variant }), className)}
          sideOffset={8}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              {content}
              {shortcut && (
                <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium opacity-100 dark:border-slate-700 dark:bg-slate-900">
                  {shortcut}
                </kbd>
              )}
            </div>
            {description && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {description}
              </span>
            )}
          </motion.div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
