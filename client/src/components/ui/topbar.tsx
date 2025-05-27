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

  const getNavItems = (subscriptionTier: string) => {
    const baseItems = [
      { name: 'Dashboard', href: '/' },
      { name: 'Projekte', href: '/projects' },
      { name: 'Boards', href: '/all-boards' },
      { name: 'Meine Aufgaben', href: '/my-tasks' },
    ];

    // Teams und OKRs nur für höhere Pakete anzeigen
    if (subscriptionTier && ['organisation', 'enterprise'].includes(subscriptionTier.toLowerCase())) {
      baseItems.push(
        { name: 'Teams', href: '/teams' },
        { name: 'OKRs', href: '/all-okrs' }
      );
    }

    return baseItems;
  };

  const mainNavItems = getNavItems(user?.subscriptionTier || 'free');


  return (
    <div className="fixed top-0 right-0 left-0 h-14 z-50 flex items-center justify-between bg-white/80 backdrop-blur-lg border-b">
      {/* Logo */}
      <div className="flex items-center pl-4">
        <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center">
          Kanbax
        </div>
      </div>

      {/* Suchleiste */}
      <div className="flex-1 max-w-xl mx-8">
        <Button
          variant="outline"
          className="relative w-full justify-start text-sm text-muted-foreground bg-gray-50 border-gray-100 hover:bg-gray-100 transition-colors"
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
        <CommandInput placeholder="Suche nach Projekten und Boards..." />
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
          {/* OKRs removed for free/freelancer users */}
        </CommandList>
      </CommandDialog>
    </div>
  );
}