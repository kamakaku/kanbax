import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Bell, 
  CheckSquare, 
  ClipboardList, 
  FileText, 
  Flag, 
  MessageSquare, 
  Target, 
  Users, 
  Trash, 
  ChevronDown, 
  ChevronUp, 
  AtSign, 
  Pin, 
  Kanban, 
  BarChart, 
  Edit
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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
    const iconProps = { className: "h-5 w-5" };
    
    switch (type) {
      // Aufgaben-Benachrichtigungen
      case "task":
        return <ClipboardList {...iconProps} />;
      case "task_update":
        return <Edit {...iconProps} />;
      case "task_delete":
        return <Trash {...iconProps} />;
      case "task_comment":
        return <MessageSquare {...iconProps} />;
      
      // Board-Benachrichtigungen
      case "board":
        return <Kanban {...iconProps} />;
      case "board_update":
        return <Kanban {...iconProps} />;
      
      // Projekt-Benachrichtigungen
      case "project":
        return <FileText {...iconProps} />;
      case "project_update":
        return <FileText {...iconProps} />;
      
      // Team-Benachrichtigungen
      case "team":
        return <Users {...iconProps} />;
      case "team_update":
        return <Users {...iconProps} />;
      
      // OKR-Benachrichtigungen
      case "okr":
        return <Target {...iconProps} />;
      case "okr_update":
        return <BarChart {...iconProps} />;
      case "okr_delete":
        return <Trash {...iconProps} />;
      case "okr_comment":
        return <MessageSquare {...iconProps} />;
      
      // Allgemeine Benachrichtigungen
      case "approval":
        return <CheckSquare {...iconProps} />;
      case "mention":
        return <AtSign {...iconProps} />;
      case "assignment":
        return <Pin {...iconProps} />;
      case "comment":
        return <MessageSquare {...iconProps} />;
      
      default:
        return <Bell {...iconProps} />;
    }
  };
  
  const getNotificationTypeClass = (type: string) => {
    // Gruppierung nach Kategorien für konsistente Farbgebung
    if (type.startsWith("task")) {
      // Aufgaben-Benachrichtigungen in Lila
      return type === "task_delete" ? "text-red-500 bg-red-500" : "text-purple-500 bg-purple-500";
    }
    
    if (type.startsWith("board")) {
      // Board-Benachrichtigungen in Cyan
      return "text-cyan-500 bg-cyan-500";
    }
    
    if (type.startsWith("project")) {
      // Projekt-Benachrichtigungen in Indigo
      return "text-indigo-500 bg-indigo-500";
    }
    
    if (type.startsWith("team")) {
      // Team-Benachrichtigungen in Pink
      return "text-pink-500 bg-pink-500";
    }
    
    if (type.startsWith("okr")) {
      // OKR-Benachrichtigungen in Orange, Löschungen in Rot
      return type === "okr_delete" ? "text-red-500 bg-red-500" : "text-orange-500 bg-orange-500";
    }
    
    // Spezifische Typen
    switch (type) {
      case "approval":
        return "text-green-500 bg-green-500";
      case "mention":
        return "text-blue-500 bg-blue-500";
      case "assignment":
        return "text-amber-500 bg-amber-500";
      case "comment":
        return "text-blue-500 bg-blue-500";
      default:
        return "text-gray-500 bg-gray-500";
    }
  };

  // Funktion zur Formatierung des Benachrichtigungstyps für die Anzeige
  const formatNotificationType = (type: string) => {
    // Formatiere den Typ für eine bessere Anzeige: task_update -> Task Update
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  // Funktion, um die relativen Zeitangaben zu formatieren
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return "Gerade eben";
    } else if (diffInMinutes < 60) {
      return `vor ${diffInMinutes} Min.`;
    } else if (diffInHours < 24) {
      return `vor ${diffInHours} Std.`;
    } else if (diffInDays < 7) {
      return `vor ${diffInDays} Tag${diffInDays !== 1 ? 'en' : ''}`;
    } else {
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full text-[10px] text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex justify-between items-center">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <p className="text-sm font-medium leading-none">Benachrichtigungen</p>
                {unreadCount > 0 && (
                  <Badge className="h-5 text-xs px-1.5">{unreadCount}</Badge>
                )}
              </div>
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
        <ScrollArea className="h-[400px]">
          <DropdownMenuGroup>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground gap-2">
                <Bell className="h-10 w-10 text-muted-foreground/50" />
                <p>Keine Benachrichtigungen vorhanden</p>
                <p className="text-xs text-muted-foreground/70">Hier werden Ihre Benachrichtigungen zu Aufgaben, Projekten und Teams angezeigt.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start p-3 space-x-3 cursor-pointer ${
                    !notification.read ? "bg-primary/5 dark:bg-primary/10" : ""
                  } hover:bg-secondary transition-colors duration-200 border-b border-border/40`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={`flex-shrink-0 flex items-center justify-center p-2 rounded-full ${getNotificationTypeClass(notification.type).split(' ')[1]} bg-opacity-10`}>
                    <div className={getNotificationTypeClass(notification.type).split(' ')[0]}>
                      {renderNotificationIcon(notification.type)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium leading-none">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <Badge 
                        variant={notification.type.includes("delete") ? "destructive" : "secondary"} 
                        className="text-[10px] h-5 px-1.5"
                      >
                        {formatNotificationType(notification.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2 mt-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                        {getRelativeTime(notification.createdAt.toString())}
                      </div>
                      {notification.link && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 cursor-pointer hover:bg-secondary">
                          Anzeigen
                        </Badge>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs" 
            onClick={() => {
              setLocation("/profile");
              setOpen(false);
            }}
          >
            Benachrichtigungseinstellungen
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}