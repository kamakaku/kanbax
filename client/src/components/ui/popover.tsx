import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

// Dieser Wrapper ersetzt den Standard-Popover-Root
// und fügt die Event-Dispatching-Funktionalität hinzu
const PopoverRoot = ({ children, open, onOpenChange, ...props }: PopoverPrimitive.PopoverProps) => {
  // Event-Dispatching zu DialogContent
  React.useEffect(() => {
    if (open) {
      document.dispatchEvent(new CustomEvent('popover-state-change', { detail: 'open' }));
    } else {
      document.dispatchEvent(new CustomEvent('popover-state-change', { detail: 'close' }));
    }
  }, [open]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </PopoverPrimitive.Root>
  );
}

const Popover = PopoverRoot;

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[9999] w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
