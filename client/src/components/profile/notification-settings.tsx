import { useQuery, useMutation } from "@tanstack/react-query";
import { type NotificationSettings } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { 
  Bell,
  CheckSquare, 
  ClipboardList, 
  FileText, 
  MessageSquare, 
  Target, 
  Users, 
  AtSign, 
  Pin, 
  Kanban,
  Calendar,
  Info
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function NotificationSettingsForm() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notification-settings"],
    queryFn: async () => {
      const res = await fetch("/api/notification-settings");
      if (!res.ok) throw new Error("Failed to fetch notification settings");
      return res.json();
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (data: Partial<NotificationSettings>) => {
      return await apiRequest("PATCH", "/api/notification-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings"] });
      toast({ title: "Benachrichtigungseinstellungen aktualisiert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationSettings) => {
    if (!settings) return;
    updateSettings.mutate({ [key]: !settings[key] });
  };

  if (isLoading) {
    return <div>Lädt...</div>;
  }

  if (!settings) {
    return <div>Keine Einstellungen gefunden</div>;
  }

  const notificationTypes = [
    {
      id: "taskAssigned",
      label: "Aufgabenzuweisung",
      description: "Wenn mir eine neue Aufgabe zugewiesen wird",
      category: "Aufgaben",
      icon: Pin,
      color: "text-purple-500",
      notification_type: "assignment"
    },
    {
      id: "taskDue",
      label: "Aufgabenfälligkeit",
      description: "Wenn eine Aufgabe bald fällig ist",
      category: "Aufgaben",
      icon: Calendar,
      color: "text-purple-500",
      notification_type: "task"
    },
    {
      id: "taskUpdates",
      label: "Aufgaben-Updates",
      description: "Wenn eine Aufgabe aktualisiert wurde, an der ich beteiligt bin",
      category: "Aufgaben",
      icon: ClipboardList,
      color: "text-purple-500",
      notification_type: "task_update"
    },
    {
      id: "taskComments",
      label: "Aufgabenkommentare",
      description: "Wenn jemand einen Kommentar zu meinen Aufgaben hinterlässt",
      category: "Aufgaben",
      icon: MessageSquare,
      color: "text-purple-500",
      notification_type: "task_comment"
    },
    {
      id: "boardInvite",
      label: "Board-Einladungen",
      description: "Wenn ich zu einem Board eingeladen werde",
      category: "Boards",
      icon: Kanban,
      color: "text-cyan-500",
      notification_type: "board"
    },
    {
      id: "boardUpdates",
      label: "Board-Updates",
      description: "Wenn Änderungen an Boards vorgenommen werden, an denen ich beteiligt bin",
      category: "Boards",
      icon: Kanban,
      color: "text-cyan-500",
      notification_type: "board_update"
    },
    {
      id: "teamInvite",
      label: "Team-Einladungen",
      description: "Wenn ich zu einem Team eingeladen werde",
      category: "Teams",
      icon: Users,
      color: "text-pink-500",
      notification_type: "team"
    },
    {
      id: "teamUpdates",
      label: "Team-Updates",
      description: "Wenn es Änderungen in meinen Teams gibt",
      category: "Teams",
      icon: Users,
      color: "text-pink-500",
      notification_type: "team_update"
    },
    {
      id: "projectUpdate",
      label: "Projekt-Updates",
      description: "Bei wichtigen Änderungen in meinen Projekten",
      category: "Projekte",
      icon: FileText,
      color: "text-indigo-500",
      notification_type: "project_update"
    },
    {
      id: "okrProgress",
      label: "OKR-Fortschritt",
      description: "Bei Änderungen am Fortschritt meiner OKRs",
      category: "OKRs",
      icon: Target,
      color: "text-orange-500",
      notification_type: "okr_update"
    },
    {
      id: "okrComments",
      label: "OKR-Kommentare",
      description: "Wenn jemand einen Kommentar zu meinen OKRs hinterlässt",
      category: "OKRs",
      icon: MessageSquare,
      color: "text-orange-500",
      notification_type: "okr_comment"
    },
    {
      id: "mentions",
      label: "Erwähnungen",
      description: "Wenn ich in Kommentaren oder Aufgaben erwähnt werde",
      category: "Allgemein",
      icon: AtSign,
      color: "text-blue-500",
      notification_type: "mention"
    },
  ];

  // Gruppiere die Benachrichtigungstypen nach Kategorien
  const categorizedTypes = notificationTypes.reduce((acc, type) => {
    const { category } = type;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(type);
    return acc;
  }, {} as Record<string, typeof notificationTypes>);

  // Sortierung der Kategorien definieren
  const categoryOrder = ["Allgemein", "Aufgaben", "Boards", "Projekte", "Teams", "OKRs"];
  
  // Kategorien sortieren
  const sortedCategories = Object.keys(categorizedTypes).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  // Icon-Komponente mit Farbe und Hintergrund
  const NotificationIcon = ({ type }: { type: typeof notificationTypes[0] }) => {
    const IconComponent = type.icon;
    return (
      <div className={`flex items-center justify-center p-2 rounded-full ${type.color} bg-opacity-10 ${type.color.replace('text-', 'bg-')}`}>
        <IconComponent className="h-4 w-4" />
      </div>
    );
  };

  // Funktion zur Formatierung des Benachrichtigungstyps für die Anzeige
  const formatNotificationType = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Benachrichtigungseinstellungen
        </CardTitle>
        <CardDescription>
          Legen Sie fest, welche Benachrichtigungen Sie erhalten möchten. Diese Einstellungen beeinflussen sowohl App-Benachrichtigungen als auch E-Mail-Benachrichtigungen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {sortedCategories.map((category) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{category}</h3>
              <Badge variant="outline" className="ml-2">{categorizedTypes[category].length}</Badge>
            </div>
            <Separator />
            <div className="space-y-6">
              {categorizedTypes[category].map((type) => (
                <div
                  key={type.id}
                  className="flex items-start justify-between space-x-4 hover:bg-secondary/30 p-2 rounded-md transition-colors"
                >
                  <div className="flex items-start space-x-4">
                    <NotificationIcon type={type} />
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <Label htmlFor={type.id} className="font-medium">{type.label}</Label>
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {formatNotificationType(type.notification_type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={type.id}
                    checked={settings[type.id as keyof NotificationSettings] ?? false}
                    onCheckedChange={() => handleToggle(type.id as keyof NotificationSettings)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}