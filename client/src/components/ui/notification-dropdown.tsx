import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Notification } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function NotificationDropdown() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: number) => {
    try {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };
  
  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert, dass das Dropdown geschlossen wird
    try {
      await apiRequest("PATCH", `/api/notifications/read-all`);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      setLocation(notification.link);
    }
    setOpen(false);
  };

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "task":
        return "📋";
      case "board":
        return "📊";
      case "project":
        return "📁";
      case "team":
        return "👥";
      case "okr":
        return "🎯";
      case "approval":
        return "✅";
      case "mention":
        return "💬";
      case "assignment":
        return "📌";
      default:
        return "📬";
    }
  };
  
  const getNotificationTypeClass = (type: string) => {
    switch (type) {
      case "approval":
        return "text-green-500";
      case "mention":
        return "text-blue-500";
      case "assignment":
        return "text-amber-500";
      case "task":
        return "text-purple-500";
      case "board":
        return "text-cyan-500";
      case "project":
        return "text-indigo-500";
      case "team":
        return "text-pink-500";
      case "okr":
        return "text-orange-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full text-[10px] text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex justify-between items-center">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Benachrichtigungen</p>
              <p className="text-xs leading-none text-muted-foreground">
                {unreadCount
                  ? `${unreadCount} ungelesene Benachrichtigung${unreadCount !== 1 ? "en" : ""}`
                  : "Keine neuen Benachrichtigungen"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={markAllAsRead}
              >
                Alle als gelesen markieren
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          <DropdownMenuGroup>
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Keine Benachrichtigungen vorhanden
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start p-3 space-x-3 cursor-pointer ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className={`text-xl ${getNotificationTypeClass(notification.type)}`}>
                    {renderNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}