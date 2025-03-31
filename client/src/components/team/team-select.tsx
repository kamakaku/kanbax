import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Team } from "@shared/schema";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamSelectProps {
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  companyId?: number;
}

export function TeamSelect({ 
  value, 
  onChange, 
  placeholder = "Teams auswählen...", 
  disabled = false,
  companyId
}: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams", { companyId }],
    queryFn: async () => {
      const url = companyId 
        ? `/api/teams?companyId=${companyId}` 
        : "/api/teams";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    },
  });

  const handleSelect = (teamId: number) => {
    if (value.includes(teamId)) {
      onChange(value.filter(id => id !== teamId));
    } else {
      onChange([...value, teamId]);
    }
  };

  const removeTeam = (teamId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== teamId));
  };

  const filteredTeams = searchQuery
    ? teams.filter(team =>
        team.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : teams;

  const selectedTeams = teams.filter(team => value.includes(team.id));

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between w-full h-auto min-h-10 py-2",
              !value.length && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            {value.length > 0 ? (
              <div className="flex flex-wrap gap-1 mr-2">
                {selectedTeams.map(team => (
                  <Badge key={team.id} variant="secondary" className="flex items-center gap-1 pl-1 pr-1">
                    <Users className="h-3 w-3 mr-1" />
                    <span className="max-w-[100px] truncate">{team.name}</span>
                    <button 
                      className="ml-1 rounded-full hover:bg-muted" 
                      onClick={(e) => removeTeam(team.id, e)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-full min-w-[280px]">
          <Command>
            <CommandInput 
              placeholder="Teams suchen..." 
              onValueChange={setSearchQuery}
              value={searchQuery}
              className="h-10" 
            />
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Lade Teams...
              </div>
            ) : (
              <>
                {filteredTeams.length === 0 && (
                  <CommandEmpty>Keine Teams gefunden.</CommandEmpty>
                )}
                <CommandGroup>
                  <ScrollArea className="max-h-[300px]">
                    {filteredTeams.map(team => (
                      <CommandItem
                        key={team.id}
                        value={team.id.toString()}
                        onSelect={() => handleSelect(team.id)}
                        className="flex items-center gap-2"
                      >
                        <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-sm font-medium">{team.name}</p>
                          {team.description && (
                            <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                          )}
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 opacity-0 transition-opacity",
                            value.includes(team.id) && "opacity-100"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}