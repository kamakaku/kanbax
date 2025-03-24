import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  
  // Event-Listener für Popover-Statusänderungen
  React.useEffect(() => {
    const handlePopoverOpen = (e: Event) => {
      if ((e as CustomEvent).detail === 'open') {
        setPopoverOpen(true);
      }
      if ((e as CustomEvent).detail === 'close') {
        setPopoverOpen(false);
      }
    };

    document.addEventListener('popover-state-change', handlePopoverOpen);
    return () => {
      document.removeEventListener('popover-state-change', handlePopoverOpen);
    };
  }, []);
  
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-[40] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      style={{ pointerEvents: popoverOpen ? 'none' : 'auto' }}
      {...props}
    />
  );
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { 
    showBottomBar?: boolean,
    bottomBarClassName?: string,
    bottomBarContent?: React.ReactNode
  }
>(({ className, children, showBottomBar = false, bottomBarClassName, bottomBarContent, ...props }, ref) => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Diese Funktion verfolgt, ob ein Popover geöffnet ist
  React.useEffect(() => {
    // Füge einen globalen Event Listener hinzu, um zu erkennen wenn ein Popover geöffnet wird
    const handlePopoverOpen = (e: Event) => {
      if ((e as CustomEvent).detail === 'open') {
        setPopoverOpen(true);
      }
      if ((e as CustomEvent).detail === 'close') {
        setPopoverOpen(false);
      }
    };

    document.addEventListener('popover-state-change', handlePopoverOpen);
    return () => {
      document.removeEventListener('popover-state-change', handlePopoverOpen);
    };
  }, []);

  // Wir prüfen das children-Prop, um herauszufinden, ob ein DialogFooter vorhanden ist
  // Wenn ja, aktivieren wir automatisch die Bottom Bar
  let containsFooter = false;
  let footerContent = null;
  
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === DialogFooter) {
      containsFooter = true;
      footerContent = child;
    }
  });

  // Filtere das DialogFooter-Element aus den children heraus, wenn wir es in der BottomBar anzeigen
  const filteredChildren = showBottomBar || containsFooter
    ? React.Children.toArray(children).filter(
        child => !React.isValidElement(child) || child.type !== DialogFooter
      )
    : children;

  const shouldShowBottomBar = showBottomBar || containsFooter;
  const bottomBarContentToShow = bottomBarContent || footerContent;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-[50] grid max-w-lg max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg overflow-hidden w-full",
          shouldShowBottomBar ? "pb-0" : "p-6",
          className
        )}
        onPointerDownOutside={(e) => {
          // Wenn ein Popover geöffnet ist, verhindern wir das Schließen des Dialogs
          if (popoverOpen) {
            e.preventDefault();
            return;
          }
          
          // Prüfen, ob das Klick-Ziel ein Popover-Element ist
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
            return;
          }
          
          props.onPointerDownOutside?.(e);
        }}
        {...props}
      >
        <div className={shouldShowBottomBar ? "flex-grow overflow-y-auto p-6 pb-4 max-h-[calc(85vh-6rem)] min-h-[5rem]" : ""}>
          {filteredChildren}
        </div>
        
        {shouldShowBottomBar && bottomBarContentToShow && (
          <div className={cn(
            "border-t px-6 py-4 bg-background shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex items-center justify-end gap-2 w-full z-10",
            bottomBarClassName
          )}>
            {bottomBarContentToShow}
          </div>
        )}
        
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
