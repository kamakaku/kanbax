import { useQuery, useMutation } from "@tanstack/react-query";
import { type NotificationSettings } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

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
    },
    {
      id: "taskDue",
      label: "Aufgabenfälligkeit",
      description: "Wenn eine Aufgabe bald fällig ist",
      category: "Aufgaben",
    },
    {
      id: "taskUpdates",
      label: "Aufgaben-Updates",
      description: "Wenn eine Aufgabe aktualisiert wurde, an der ich beteiligt bin",
      category: "Aufgaben",
    },
    {
      id: "taskComments",
      label: "Aufgabenkommentare",
      description: "Wenn jemand einen Kommentar zu meinen Aufgaben hinterlässt",
      category: "Aufgaben",
    },
    {
      id: "boardInvite",
      label: "Board-Einladungen",
      description: "Wenn ich zu einem Board eingeladen werde",
      category: "Boards",
    },
    {
      id: "boardUpdates",
      label: "Board-Updates",
      description: "Wenn Änderungen an Boards vorgenommen werden, an denen ich beteiligt bin",
      category: "Boards",
    },
    {
      id: "teamInvite",
      label: "Team-Einladungen",
      description: "Wenn ich zu einem Team eingeladen werde",
      category: "Teams",
    },
    {
      id: "teamUpdates",
      label: "Team-Updates",
      description: "Wenn es Änderungen in meinen Teams gibt",
      category: "Teams",
    },
    {
      id: "projectUpdate",
      label: "Projekt-Updates",
      description: "Bei wichtigen Änderungen in meinen Projekten",
      category: "Projekte",
    },
    {
      id: "okrProgress",
      label: "OKR-Fortschritt",
      description: "Bei Änderungen am Fortschritt meiner OKRs",
      category: "OKRs",
    },
    {
      id: "okrComments",
      label: "OKR-Kommentare",
      description: "Wenn jemand einen Kommentar zu meinen OKRs hinterlässt",
      category: "OKRs",
    },
    {
      id: "mentions",
      label: "Erwähnungen",
      description: "Wenn ich in Kommentaren oder Aufgaben erwähnt werde",
      category: "Allgemein",
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benachrichtigungseinstellungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {sortedCategories.map((category) => (
          <div key={category} className="space-y-4">
            <h3 className="text-lg font-semibold">{category}</h3>
            <div className="space-y-6 pl-2">
              {categorizedTypes[category].map(({ id, label, description }) => (
                <div
                  key={id}
                  className="flex items-center justify-between space-x-4"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={id}>{label}</Label>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <Switch
                    id={id}
                    checked={settings[id as keyof NotificationSettings] ?? false}
                    onCheckedChange={() => handleToggle(id as keyof NotificationSettings)}
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