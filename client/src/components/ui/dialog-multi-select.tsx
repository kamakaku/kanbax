import * as React from "react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

interface DialogMultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function DialogMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Auswählen...",
  className,
}: DialogMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [portal, setPortal] = React.useState<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Erstellen eines Portal-Elements, das direkt am Body angehängt wird
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.zIndex = "9999";
    div.style.top = "0";
    div.style.left = "0";
    document.body.appendChild(div);
    setPortal(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  // Position des Dropdown-Inhalts basierend auf dem Trigger-Button
  React.useEffect(() => {
    if (open && portal && triggerRef.current && contentRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      contentRef.current.style.position = "absolute";
      contentRef.current.style.width = `${rect.width}px`;
      contentRef.current.style.top = `${rect.bottom + window.scrollY}px`;
      contentRef.current.style.left = `${rect.left + window.scrollX}px`;
    }
  }, [open, portal]);

  // Schließen des Dropdowns bei Klick außerhalb
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        open &&
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const handleUnselect = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between", className)}
        onClick={() => setOpen(!open)}
      >
        <div className="flex gap-1 flex-wrap">
          {selected.length === 0 && placeholder}
          {selected.map((value) => (
            <Badge
              variant="secondary"
              key={value}
              className="mr-1 mb-1"
            >
              {options.find((option) => option.value === value)?.label}
              <span
                role="button"
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnselect(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(value);
                  }
                }}
                tabIndex={0}
              >
                <X className="h-3 w-3" />
              </span>
            </Badge>
          ))}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && portal && createPortal(
        <div 
          ref={contentRef}
          className="z-[9999] w-72 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
        >
          <Command>
            <CommandInput placeholder="Suchen..." />
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-60">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </Command>
        </div>,
        portal
      )}
    </>
  );
}