import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { UserCircle, LogOut, Settings } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="fixed top-0 right-0 left-0 h-16 z-50 px-4 flex items-center justify-end bg-white/30 backdrop-blur-md border-b border-white/20">
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
  );
}