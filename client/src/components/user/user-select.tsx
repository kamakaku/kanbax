import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";
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
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UserSelect({ value, onChange, placeholder = "Benutzer auswählen...", disabled = false }: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  const handleSelect = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter(id => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== userId));
  };

  const filteredUsers = searchQuery
    ? users.filter(user =>
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const selectedUsers = users.filter(user => value.includes(user.id.toString()));

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
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1 pl-1 pr-1">
                    <Avatar className="h-4 w-4 mr-1">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px]">{user.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate">{user.username}</span>
                    <button 
                      className="ml-1 rounded-full hover:bg-muted" 
                      onClick={(e) => removeUser(user.id.toString(), e)}
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
              placeholder="Benutzer suchen..." 
              onValueChange={setSearchQuery}
              value={searchQuery}
              className="h-10" 
            />
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Lade Benutzer...
              </div>
            ) : (
              <>
                {filteredUsers.length === 0 && (
                  <CommandEmpty>Keine Benutzer gefunden.</CommandEmpty>
                )}
                <CommandGroup>
                  <ScrollArea className="max-h-[300px]">
                    {filteredUsers.map(user => (
                      <CommandItem
                        key={user.id}
                        value={user.id.toString()}
                        onSelect={() => handleSelect(user.id.toString())}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatarUrl || ""} />
                          <AvatarFallback>{user.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 truncate">
                          <p className="text-sm font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 opacity-0 transition-opacity",
                            value.includes(user.id.toString()) && "opacity-100"
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