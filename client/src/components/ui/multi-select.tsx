import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export function MultiSelect({
  value = [],
  onValueChange,
  options = [],
  placeholder = "Auswählen...",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(value);

  React.useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleSelect = (itemValue: string) => {
    const newSelected = selected.includes(itemValue)
      ? selected.filter((value) => value !== itemValue)
      : [...selected, itemValue];

    setSelected(newSelected);
    onValueChange?.(newSelected);
  };

  const handleDeselect = (itemValue: string) => {
    const newSelected = selected.filter((value) => value !== itemValue);
    setSelected(newSelected);
    onValueChange?.(newSelected);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && placeholder}
            {selected.map((itemValue) => (
              <Badge
                key={itemValue}
                variant="secondary"
                className="mr-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeselect(itemValue);
                }}
              >
                {options.find((option) => option.value === itemValue)?.label || itemValue}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Suchen..." />
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const MultiSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PopoverTrigger>
>((props, ref) => <PopoverTrigger {...props} ref={ref} />);
MultiSelectTrigger.displayName = "MultiSelectTrigger";

export const MultiSelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PopoverContent>
>((props, ref) => <PopoverContent {...props} ref={ref} />);
MultiSelectContent.displayName = "MultiSelectContent";

export const MultiSelectItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CommandItem>
>((props, ref) => <CommandItem {...props} ref={ref} />);
MultiSelectItem.displayName = "MultiSelectItem";

export const MultiSelectValue = React.forwardRef<
  HTMLDivElement,
  { placeholder?: string }
>(({ placeholder }, ref) => (
  <span ref={ref} className="text-sm text-muted-foreground">
    {placeholder}
  </span>
));
MultiSelectValue.displayName = "MultiSelectValue";