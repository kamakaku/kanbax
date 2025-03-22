import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  placeholder = "Items auswählen...",
  className,
}: DialogMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [localSelected, setLocalSelected] = React.useState<string[]>([]);

  // Initialisiere die lokale Auswahl mit der übergebenen Auswahl
  React.useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  const handleUnselect = (item: string) => {
    setLocalSelected(localSelected.filter((i) => i !== item));
  };

  const handleSelect = (value: string) => {
    if (localSelected.includes(value)) {
      setLocalSelected(localSelected.filter((item) => item !== value));
    } else {
      setLocalSelected([...localSelected, value]);
    }
  };

  const handleSave = () => {
    onChange(localSelected);
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalSelected(selected);
    setOpen(false);
  };

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  return (
    <div className="relative w-full">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
            onClick={() => setOpen(true)}
          >
            <div className="flex flex-wrap gap-1 mr-2">
              {selected.length > 0 ? (
                selected.map((item) => (
                  <Badge
                    variant="secondary"
                    key={item}
                    className="mr-1 mb-1"
                  >
                    {options.find((option) => option.value === item)?.label}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0 w-[300px] max-w-[96vw]" onInteractOutside={(e) => {
          // Verhindern, dass der Dialog geschlossen wird, wenn man außerhalb klickt
          e.preventDefault();
        }}>
          <div className="p-2">
            <CommandInput 
              placeholder="Suchen..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
          </div>
          <Command>
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-60 overflow-auto">
                {filteredOptions.map((option) => {
                  const isSelected = localSelected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
          </Command>
          <div className="flex justify-end p-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancel}
              className="mr-2"
            >
              Abbrechen
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
            >
              Auswählen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}