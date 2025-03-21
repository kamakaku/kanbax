import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { UserCircle, LogOut, Settings, Search, Bell } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Board, type Project, type Objective } from "@shared/schema";
import { NotificationDropdown } from "./notification-dropdown";

export function Topbar() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch data for search
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const res = await fetch("/api/objectives");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="fixed top-0 right-0 left-0 h-16 z-50 px-4 flex items-center justify-between bg-white/30 backdrop-blur-md border-b border-white/20">
      {/* Logo */}
      <div className="flex items-center">
        <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            {/* Kanban Board Logo */}
            <path d="M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M7 3v18" />
            <path d="M14 3v18" />
            <rect x="3" y="7" width="4" height="4" />
            <rect x="8" y="7" width="6" height="7" />
            <rect x="15" y="7" width="6" height="10" />
          </svg>
          Kanbax
        </div>
      </div>

      {/* Suchleiste */}
      <div className="flex-1 max-w-xl mx-8">
        <Button
          variant="outline"
          className="relative w-full justify-start text-sm text-muted-foreground bg-white/50 border-white/20 hover:bg-white/60 transition-colors"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span>Globale Suche...</span>
          <kbd className="pointer-events-none absolute right-2 top-[50%] -translate-y-[50%] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</span>K
          </kbd>
        </Button>
      </div>

      {/* Rechte Seite */}
      <div className="flex items-center gap-2">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.username} />
                ) : (
                  <AvatarFallback>
                    <UserCircle className="h-6 w-6" />
                  </AvatarFallback>
                )}
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>Mein Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setLocation("/profile")}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Profileinstellungen</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Abmelden</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Suche nach Projekten, Boards, OKRs..." />
        <CommandList>
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
          <CommandGroup heading="Projekte">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => {
                  setLocation(`/projects/${project.id}`);
                  setSearchOpen(false);
                }}
              >
                <div className="truncate">{project.title}</div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Boards">
            {boards.map((board) => (
              <CommandItem
                key={board.id}
                onSelect={() => {
                  setLocation(`/boards/${board.id}`);
                  setSearchOpen(false);
                }}
              >
                <div className="truncate">{board.title}</div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="OKRs">
            {objectives.map((objective) => (
              <CommandItem
                key={objective.id}
                onSelect={() => {
                  setLocation(`/all-okrs/${objective.id}`);
                  setSearchOpen(false);
                }}
              >
                <div className="truncate">{objective.title}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}