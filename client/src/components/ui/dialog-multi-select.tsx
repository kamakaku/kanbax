import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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

  const handleSelect = (value: string) => {
    setLocalSelected(prev => {
      if (prev.includes(value)) {
        return prev.filter(item => item !== value);
      } else {
        return [...prev, value];
      }
    });
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
        <DialogContent className="p-2 w-[300px] max-w-[96vw]" onInteractOutside={(e) => {
          // Verhindern, dass der Dialog geschlossen wird, wenn man außerhalb klickt
          e.preventDefault();
        }}>
          <div className="flex items-center border-b px-3 mb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex h-11 w-full border-0 bg-transparent py-3 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          
          <div className="flex flex-col">
            <ScrollArea className="h-60 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm">
                  Keine Ergebnisse gefunden.
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = localSelected.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSelect(option.value)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50"
                        )}
                      >
                        {isSelected && <Check className="h-4 w-4" />}
                      </div>
                      <span>{option.label}</span>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>
          
          <div className="flex justify-end p-2 border-t mt-2">
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