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
    },
    {
      id: "taskDue",
      label: "Aufgabenfälligkeit",
      description: "Wenn eine Aufgabe bald fällig ist",
    },
    {
      id: "boardInvite",
      label: "Board-Einladungen",
      description: "Wenn ich zu einem Board eingeladen werde",
    },
    {
      id: "teamInvite",
      label: "Team-Einladungen",
      description: "Wenn ich zu einem Team eingeladen werde",
    },
    {
      id: "projectUpdate",
      label: "Projekt-Updates",
      description: "Bei wichtigen Änderungen in meinen Projekten",
    },
    {
      id: "okrProgress",
      label: "OKR-Fortschritt",
      description: "Bei Änderungen am Fortschritt meiner OKRs",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benachrichtigungseinstellungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationTypes.map(({ id, label, description }) => (
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
              checked={settings[id as keyof NotificationSettings]}
              onCheckedChange={() => handleToggle(id as keyof NotificationSettings)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
