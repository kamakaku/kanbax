import React, { useEffect, useState } from "react"; // React explizit importieren für useEffect und useState
import { useAuth } from "@/lib/auth-store";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { formatDistanceToNow } from 'date-fns';
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Plus, ChevronsRight, InfoIcon } from "lucide-react";
import { CardTitle, CardDescription, CardContent, CardHeader, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  TableHead, 
  TableRow, 
  TableHeader, 
  TableCell, 
  TableBody, 
  Table 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getPriorityColor } from "@/lib/utils";
import { ActivityFeed, getActivityVerb, getActivityIcon, ActivityEntityLink } from "@/components/activity/activity-feed";
import { useQuery } from "@tanstack/react-query";
import { Project, Board, Objective, Task, KeyResult } from "@/types/index";
import type { UserProductivityMetrics } from "@/types/index";
import { ExtendedActivityLog } from "@/components/activity/activity-feed";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  SimpleTooltip
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

// Produktivitäts-Metriken-Komponente
interface ProductivityMetricsCardProps {
  userId: number;
  hideOkrData?: boolean; // Flag, um OKR-bezogene Daten auszublenden
}

function ProductivityMetricsCard({ userId, hideOkrData = false }: ProductivityMetricsCardProps) {
  const [, setLocation] = useLocation();
  
  // API-Abfragen für alle benötigten Daten
  const { data: metrics, isLoading: metricsLoading } = useQuery<UserProductivityMetrics[]>({
    queryKey: [`/api/productivity/metrics/${userId}`, { days: 7 }],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/productivity/metrics/${userId}?days=7`);
      if (!res.ok) throw new Error("Fehler beim Laden der Produktivitätsdaten");
      return res.json();
    },
    enabled: !!userId
  });
  
  // Alle Tasks für alle Boards abrufen
  const { data: allTasksData, isLoading: tasksLoading } = useQuery<Record<number, Task[]>>({
    queryKey: ['/api/all-tasks'],
    queryFn: async () => {
      const res = await fetch("/api/all-tasks");
      if (!res.ok) throw new Error("Fehler beim Laden der Tasks");
      return res.json();
    }
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    }
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
    queryFn: async () => {
      const response = await fetch('/api/objectives');
      if (!response.ok) {
        throw new Error('Failed to fetch objectives');
      }
      return response.json();
    }
  });

  // Key Results abfragen
  const { data: keyResults = [], isLoading: keyResultsLoading } = useQuery<KeyResult[]>({
    queryKey: ['/api/key-results'],
    queryFn: async () => {
      const response = await fetch('/api/key-results');
      if (!response.ok) {
        throw new Error('Failed to fetch key results');
      }
      return response.json();
    }
  });

  // Lade-Status
  if (metricsLoading || tasksLoading || projectsLoading || objectivesLoading || keyResultsLoading) {
    return <div className="text-sm text-muted-foreground">Lade Produktivitätsdaten...</div>;
  }

  // Alle Tasks über alle Boards hinweg sammeln
  const allTasks: Task[] = [];
  if (allTasksData) {
    Object.values(allTasksData).forEach(boardTasks => {
      allTasks.push(...boardTasks);
    });
  }

  // Berechnungen für Fortschrittsbalken
  const completedProjects = projects.filter(project => project.archived).length;
  const projectProgress = projects.length > 0 ? Math.round((completedProjects / projects.length) * 100) : 0;
  
  const completedObjectives = objectives.filter(obj => obj.progress === 100).length;
  const keyResultProgress = objectives.length > 0 ? Math.round((completedObjectives / objectives.length) * 100) : 0;

  // Hilfsfunktion, um die Balkenfarbe basierend auf dem Fortschritt zu bestimmen
  const getBarColor = (progress: number, category: 'project' | 'task' | 'okr') => {
    const baseColors = {
      project: 'bg-blue-500',
      task: 'bg-green-500',
      okr: 'bg-purple-500'
    };
    
    return baseColors[category];
  };

  // Berechne die Statusverteilung über alle Tasks
  const getTaskStatusCounts = () => {
    // Statusverteilung zählen
    const counts = {
      backlog: 0,
      todo: 0,
      inProgress: 0,
      review: 0,
      done: 0
    };
    
    allTasks.forEach(task => {
      const taskStatus = task.status ? task.status.toLowerCase().trim() : 'backlog';
      
      if (taskStatus === 'backlog') {
        counts.backlog++;
      } else if (taskStatus === 'todo') {
        counts.todo++;
      } else if (taskStatus === 'in-progress') {
        counts.inProgress++;
      } else if (taskStatus === 'review') {
        counts.review++;
      } else if (taskStatus === 'done') {
        counts.done++;
      } else {
        // Unbekannter Status - als Backlog zählen
        counts.backlog++;
      }
    });
    
    return counts;
  };
  
  const statusCounts = getTaskStatusCounts();
  const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  
  // Farben und Beschreibungen für jeden Status - passend zu den Spaltenfarben im Board
  const statusConfig = {
    backlog: {
      color: "bg-slate-300",
      label: "Backlog",
      description: "Noch nicht begonnene Aufgaben"
    },
    todo: {
      color: "bg-blue-300",
      label: "To-Do",
      description: "Geplante Aufgaben, die als nächstes bearbeitet werden"
    },
    inProgress: {
      color: "bg-amber-400",
      label: "In Bearbeitung", 
      description: "Aufgaben, die aktuell bearbeitet werden"
    },
    review: {
      color: "bg-purple-400",
      label: "Review",
      description: "Aufgaben, die auf Überprüfung warten"
    },
    done: {
      color: "bg-green-400",
      label: "Erledigt",
      description: "Abgeschlossene Aufgaben"
    }
  };
  
  // Prozentanteile für die Fortschrittsbalken
  const percentages = {
    backlog: (statusCounts.backlog / totalTasks) * 100 || 0,
    todo: (statusCounts.todo / totalTasks) * 100 || 0, 
    inProgress: (statusCounts.inProgress / totalTasks) * 100 || 0,
    review: (statusCounts.review / totalTasks) * 100 || 0,
    done: (statusCounts.done / totalTasks) * 100 || 0
  };
  
  // Berechne den durchschnittlichen Fortschritt der Objectives
  const averageProgress = objectives.length > 0
    ? Math.round(objectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / objectives.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className={`flex justify-between items-end h-48 gap-12 mb-4 ${hideOkrData ? 'justify-evenly' : ''}`}>
        {/* Projekt-Fortschritt mit SimpleTooltip */}
        <div className="flex flex-col items-center flex-1">
          <span className="text-sm font-medium mb-2">Projekte</span>
          <SimpleTooltip 
            side="top"
            content={
              <div>
                <div className="text-xs font-medium mb-1">Projektfortschritt</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="text-xs">
                    <span className="font-medium">{completedProjects}</span> von <span className="font-medium">{projects.length}</span> Projekten abgeschlossen
                  </div>
                </div>
                {projects.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {projects.length - completedProjects} Projekte noch in Bearbeitung
                  </div>
                )}
              </div>
            }
          >
            <button type="button" className="w-full h-36 bg-gray-100 relative rounded-md overflow-hidden cursor-help border-0 m-0 p-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)' }}>
              <div 
                className={`absolute bottom-0 w-full ${getBarColor(projectProgress, 'project')} transition-all`} 
                style={{ height: `${projectProgress}%` }}
              />
              <div className="absolute inset-0 flex items-end justify-center p-2">
                <span className="text-sm font-bold text-white bg-black/30 px-2 py-0.5 rounded">
                  {projectProgress}%
                </span>
              </div>
            </button>
          </SimpleTooltip>
          <div className="w-full h-px bg-gray-300 mt-1" />
          <div className="text-xs text-muted-foreground mt-1">
            {completedProjects}/{projects.length}
          </div>
        </div>
        
        {/* Key-Results-Fortschritt mit SimpleTooltip - wird nur angezeigt, wenn hideOkrData false ist */}
        {!hideOkrData && (
          <div className="flex flex-col items-center flex-1">
            <span className="text-sm font-medium mb-2">Key Results</span>
            <SimpleTooltip 
              side="top"
              content={
                <div className="p-1">
                  <div className="text-xs font-medium mb-1">Key Results Fortschritt</div>
                  {keyResults && keyResults.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <div className="text-xs">
                          <span className="font-medium">{keyResults.filter(kr => (kr.currentValue || 0) >= (kr.targetValue || 1)).length}</span> von <span className="font-medium">{keyResults.length}</span> Key Results abgeschlossen
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Durchschnittlicher Fortschritt: {
                          Math.round(keyResults.reduce((acc, kr) => {
                            // Berechne den Fortschritt für jedes Key Result als Prozentsatz
                            const progress = Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100);
                            return acc + progress;
                          }, 0) / keyResults.length)
                        }%
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Keine Key Results gefunden
                    </div>
                  )}
                  {keyResults.length > 0 && (
                    <div className="text-xs space-y-1 mt-2 pt-1 border-t border-gray-100">
                      <div className="font-medium">Objectives mit Key Results:</div>
                      {objectives.slice(0, 3).map(obj => (
                        <div key={obj.id} className="text-xs truncate max-w-40">{obj.title}</div>
                      ))}
                      {objectives.length > 3 && (
                        <div className="text-xs text-gray-500">...und {objectives.length - 3} weitere</div>
                      )}
                    </div>
                  )}
                </div>
              }
            >
              <button type="button" className="w-full h-36 bg-gray-100 relative rounded-md overflow-hidden cursor-help border-0 m-0 p-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)' }}>
                <div 
                  className={`absolute bottom-0 w-full ${getBarColor(0, 'okr')} transition-all`} 
                  style={{ 
                    height: `${
                      keyResults && keyResults.length > 0 ? 
                      Math.round(keyResults.reduce((acc, kr) => {
                        // Berechne den Fortschritt für jedes Key Result als Prozentsatz
                        const progress = Math.min(Math.round(((kr.currentValue || 0) / (kr.targetValue || 1)) * 100), 100);
                        return acc + progress;
                      }, 0) / (keyResults.length || 1)) : 0
                    }%` 
                  }}
                />
                <div className="absolute inset-0 flex items-end justify-center p-2">
                  <span className="text-sm font-bold text-white bg-black/30 px-2 py-0.5 rounded">
                    {
                      keyResults && keyResults.length > 0 ? 
                      Math.round(keyResults.reduce((acc, kr) => {
                        // Berechne den Fortschritt für jedes Key Result als Prozentsatz
                        const progress = Math.min(Math.round(((kr.currentValue || 0) / (kr.targetValue || 1)) * 100), 100);
                        return acc + progress;
                      }, 0) / (keyResults.length || 1)) : 0
                    }%
                  </span>
                </div>
              </button>
            </SimpleTooltip>
            <div className="w-full h-px bg-gray-300 mt-1" />
            <div className="text-xs text-muted-foreground mt-1">
              {keyResults && keyResults.length > 0 ? 
                `${keyResults.filter(kr => (kr.currentValue || 0) >= (kr.targetValue || 1)).length}/${keyResults.length}` : 
                "0/0"
              }
            </div>
          </div>
        )}
        
        {/* Tasks-Fortschritt mit SimpleTooltip - Ein Gesamtdiagramm */}
        <div className="flex flex-col items-center flex-1">
          <span className="text-sm font-medium mb-2">Alle Tasks</span>
          
          {/* Ein einziges Gesamtdiagramm für Tasks */}
          <SimpleTooltip 
            side="top"
            content={
              <div className="p-1">
                <div className="text-xs font-medium mb-1">Verteilung aller Tasks</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <div className="text-xs">
                      <span className="font-medium">Backlog:</span> {statusCounts.backlog} ({percentages.backlog.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-300" />
                    <div className="text-xs">
                      <span className="font-medium">To-Do:</span> {statusCounts.todo} ({percentages.todo.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="text-xs">
                      <span className="font-medium">In Arbeit:</span> {statusCounts.inProgress} ({percentages.inProgress.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <div className="text-xs">
                      <span className="font-medium">Review:</span> {statusCounts.review} ({percentages.review.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <div className="text-xs">
                      <span className="font-medium">Erledigt:</span> {statusCounts.done} ({percentages.done.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-1 border-t border-gray-100">
                  Gesamt: {totalTasks} Tasks
                </div>
              </div>
            }
          >
            <button type="button" className="w-full h-36 bg-gray-100 relative rounded-md overflow-hidden cursor-help border-0 m-0 p-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)' }}>
              {/* Einfacherer horizontaler gestapelter Balken mit fixer Höhe */}
              <div className="absolute bottom-0 w-full h-full flex flex-col-reverse">
                {/* Debug Logs für die Entwicklung (könnte später entfernt werden) */}
                {console.log && console.log("Statusverteilung:", statusCounts)}
                {console.log && console.log("Prozentsätze:", percentages)}
                
                {/* Feste Höhenwerte und keine absoluten Positionierungen */}
                {percentages.done > 0 && (
                  <div 
                    className={`w-full ${statusConfig.done.color}`} 
                    style={{ height: `${percentages.done}%` }}
                  ></div>
                )}
                {percentages.review > 0 && (
                  <div 
                    className={`w-full ${statusConfig.review.color}`} 
                    style={{ height: `${percentages.review}%` }}
                  ></div>
                )}
                {percentages.inProgress > 0 && (
                  <div 
                    className={`w-full ${statusConfig.inProgress.color}`} 
                    style={{ height: `${percentages.inProgress}%` }}
                  ></div>
                )}
                {percentages.todo > 0 && (
                  <div 
                    className={`w-full ${statusConfig.todo.color}`} 
                    style={{ height: `${percentages.todo}%` }}
                  ></div>
                )}
                {percentages.backlog > 0 && (
                  <div 
                    className={`w-full ${statusConfig.backlog.color}`} 
                    style={{ height: `${percentages.backlog}%` }}
                  ></div>
                )}
              </div>
              <div className="absolute inset-0 flex items-end justify-center p-2">
                <span className="text-sm font-bold text-white bg-black/30 px-2 py-0.5 rounded">
                  {totalTasks} Tasks
                </span>
              </div>
            </button>
          </SimpleTooltip>
          <div className="w-full h-px bg-gray-300 mt-1" />
          <div className="text-xs text-muted-foreground mt-1">
            {totalTasks} Aufgaben
          </div>
        </div>
      </div>
      
      {/* Wenn OKR-Funktionen ausgeblendet sind, zeigen wir eine Hinweismeldung zum Upgrade an */}
      {hideOkrData && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 mb-4">
          <p><strong>Key Results und OKR-Funktionen freischalten</strong></p>
          <p className="mt-1">Diese erweiterten Funktionen sind nur in höheren Abonnementpaketen verfügbar. 
            Upgraden Sie auf "Organisation" oder "Enterprise", um Ihre strategischen Ziele besser verfolgen zu können.</p>
          <div className="mt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-blue-700 border-blue-300 hover:bg-blue-100"
              onClick={() => setLocation("/subscription")}
            >
              Abonnement anzeigen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard-Tasks-Komponente
function DashboardTaskRows() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/user-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/user-tasks");
      if (!res.ok) throw new Error("Fehler beim Laden der Aufgaben");
      return res.json();
    }
  });

  // Filtern auf ToDo, In Progress und In Review
  const activeTasks = myTasks
    .filter(task => ["todo", "in-progress", "in-review"].includes(task.status) && !task.archived)
    .slice(0, 5); // Begrenze auf 5 Einträge

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-center py-4">Lade Aufgaben...</TableCell>
      </TableRow>
    );
  }

  if (activeTasks.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-center py-4">Keine aktiven Aufgaben gefunden</TableCell>
      </TableRow>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "todo": return "Zu erledigen";
      case "in-progress": return "In Bearbeitung";
      case "in-review": return "In Überprüfung";
      default: return status;
    }
  };

  return (
    <>
      {activeTasks.map((task) => (
        <TableRow 
          key={task.id} 
          className="hover:bg-slate-50 cursor-pointer"
          onClick={() => {
            // Wenn es eine boardId gibt, zum Board mit taskId navigieren, ansonsten zur persönlichen Aufgabenliste
            if (task.boardId) {
              setLocation(`/boards/${task.boardId}?taskId=${task.id}`);
            } else {
              setLocation(`/my-tasks?taskId=${task.id}`);
            }
          }}
        >
          <TableCell className="font-medium truncate max-w-[200px]">{task.title}</TableCell>
          <TableCell>
            <Badge variant="outline" className="bg-slate-100">{getStatusText(task.status)}</Badge>
          </TableCell>
          <TableCell>
            <Badge 
              variant="outline" 
              className={`${getPriorityColor(task.priority)}`}
            >
              {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
            </Badge>
          </TableCell>
          <TableCell>
            {task.dueDate ? format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de }) : "-"}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// Neuer Dashboard Activity Feed für den Dashboard-Bereich
function DashboardActivityFeed() {
  // Verbesserte Fallback-Methode mit umfangreichen Debug-Informationen:
  // Abrufen der Aktivitäten über normalen API-Endpunkt, falls spezialisierter Endpunkt fehlschlägt
  const { data: activities = [], isLoading, error } = useQuery<ExtendedActivityLog[]>({
    queryKey: ["/api/dashboard/activity"],
    queryFn: async () => {
      const limit = 30; // Limitiere die Anzahl der Aktivitäten
      // Versuche zuerst den spezialisierten Endpunkt
      const specializedUrl = `/api/dashboard/activity?limit=${limit}`;
      
      console.log("[DASHBOARD_DEBUG] Fetching activities from specialized endpoint:", specializedUrl);
      
      try {
        // Session-Cookie und Auth prüfen
        console.log("[DASHBOARD_DEBUG] Checking if user is logged in:", document.cookie.includes('connect.sid'));
        
        // Versuche den spezialisierten Endpoint
        const response = await fetch(specializedUrl, {
          credentials: 'include', // Wichtig: Stellt sicher, dass Cookies mitgesendet werden
          headers: {
            'Accept': 'application/json'
          }
        });
        console.log("[DASHBOARD_DEBUG] Response status from specialized endpoint:", response.status);
        console.log("[DASHBOARD_DEBUG] Response headers:", 
          Object.fromEntries([...response.headers.entries()].map(([k, v]) => [k, v])));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[DASHBOARD_DEBUG] Failed to fetch from specialized endpoint:", response.status, errorText);
          
          // Bei Fehler: Versuche den generischen Activity-Endpunkt als Fallback
          console.log("[DASHBOARD_DEBUG] Falling back to generic activity endpoint");
          const fallbackUrl = `/api/activity?limit=${limit}`;
          const fallbackResponse = await fetch(fallbackUrl, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          console.log("[DASHBOARD_DEBUG] Fallback response status:", fallbackResponse.status);
          
          if (!fallbackResponse.ok) {
            const fallbackErrorText = await fallbackResponse.text();
            console.error("[DASHBOARD_DEBUG] Fallback also failed:", fallbackResponse.status, fallbackErrorText);
            
            // ZWEITER FALLBACK: Versuche direkt Benachrichtigungen zu laden, die oft mit Aktivitäten zusammenhängen
            console.log("[DASHBOARD_DEBUG] Attempting second fallback to notifications endpoint");
            const notificationsUrl = `/api/notifications?limit=${limit}`;
            const notificationsResponse = await fetch(notificationsUrl, {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            });
            
            if (!notificationsResponse.ok) {
              console.error("[DASHBOARD_DEBUG] All fallbacks failed. Returning empty array");
              return [];
            }
            
            const notificationsData = await notificationsResponse.json();
            console.log("[DASHBOARD_DEBUG] Converting notifications to activity format:", notificationsData.length);
            
            // Wandele Benachrichtigungen in ein Format um, das dem Activity-Format ähnelt
            const convertedActivities = notificationsData.map(notification => ({
              id: notification.id,
              action: "notification",
              details: notification.message,
              userId: notification.userId,
              username: "System", // Platzhalter, bis wir den Benutzernamen aus der Datenbank abrufen können
              created_at: notification.createdAt,
              avatar_url: null
            }));
            
            return convertedActivities;
          }
          
          const fallbackData = await fallbackResponse.json();
          console.log("[DASHBOARD_DEBUG] Received activities from fallback:", fallbackData.length);
          if (fallbackData.length === 0) {
            console.log("[DASHBOARD_DEBUG] Fallback returned empty array - this indicates an auth or filter issue");
          }
          return fallbackData;
        }
        
        // Spezialisierter Endpunkt war erfolgreich
        const data = await response.json();
        console.log("[DASHBOARD_DEBUG] Received activities from specialized endpoint:", data.length);
        if (data.length === 0) {
          console.log("[DASHBOARD_DEBUG] Dashboard endpoint returned empty array - checking if activities exist in DB");
          
          // Optional: Versuch eine Zählung der Aktivitäten zu bekommen
          try {
            const countResponse = await fetch('/api/activity/count', { credentials: 'include' });
            if (countResponse.ok) {
              const countData = await countResponse.json();
              console.log("[DASHBOARD_DEBUG] Total activities in database:", countData.count);
            }
          } catch (countError) {
            console.log("[DASHBOARD_DEBUG] Could not get activity count:", countError);
          }
        }
        return data;
      } catch (error) {
        console.error("[DASHBOARD_DEBUG] Error fetching activities:", error);
        console.error("[DASHBOARD_DEBUG] Error details:", error instanceof Error ? error.stack : String(error));
        return [];
      }
    }
  });
  
  // Logge Fehler oder leere Aktivitätenliste für Debugging
  useEffect(() => {
    if (error) {
      console.error("[DASHBOARD_DEBUG] Query error:", error);
    }
    if (activities && activities.length === 0 && !isLoading) {
      console.log("[DASHBOARD_DEBUG] No activities found, but query completed successfully");
      // Logge zusätzliche Informationen
      console.log("[DASHBOARD_DEBUG] Activity Feed component state:", {
        hasActivities: Array.isArray(activities),
        activitiesLength: Array.isArray(activities) ? activities.length : 'not an array',
        isLoading,
        hasError: !!error
      });
    }
  }, [activities, isLoading, error]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Aktuelle Aktivitäten</h3>
      <ScrollArea className="h-[400px] pr-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine Aktivitäten gefunden</p>
            <p className="text-sm mt-1">Hier werden Aktivitäten angezeigt, sobald Sie mit dem System arbeiten.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const createdAt = activity.created_at || activity.createdAt;
              const formattedDate = formatDistanceToNow(new Date(createdAt), { 
                locale: de, 
                addSuffix: true 
              });
              
              return (
                <div key={activity.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activity.avatar_url} alt={activity.username} />
                    <AvatarFallback>{activity.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="font-medium">{activity.username}</span>{" "}
                      <span className="text-muted-foreground">
                        {getActivityVerb(activity)}
                      </span>{" "}
                      <ActivityEntityLink activity={activity} />
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <span>{formattedDate}</span>
                      <span className="mx-1">•</span>
                      <span>
                        {getActivityIcon(activity)}
                      </span>
                      {activity.details && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="truncate max-w-[200px]">{activity.details}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Automatische Abo-Aktualisierung beim Laden
  useEffect(() => {
    const checkAndUpdateSubscription = async () => {
      const targetTier = localStorage.getItem('targetSubscriptionTier');
      const targetCycle = localStorage.getItem('targetSubscriptionBillingCycle');
      
      if (targetTier) {
        console.log("DASHBOARD: Nicht angewendetes Abonnement-Update gefunden:", targetTier, targetCycle);
        
        try {
          setLoading(true);
          // Direkter API-Aufruf an den neuen garantierten Update-Endpunkt
          const response = await fetch('/api/subscription/guaranteed-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tier: targetTier.toLowerCase(),
              billingCycle: targetCycle || 'monthly'
            }),
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            console.log("✅ DASHBOARD: Automatisches Update erfolgreich:", result);
            localStorage.removeItem('targetSubscriptionTier');
            localStorage.removeItem('targetSubscriptionBillingCycle');
            localStorage.removeItem('fromSuccessfulPayment');
            
            // Cache invalidieren
            if (window.queryClient) {
              window.queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
              window.queryClient.invalidateQueries({ queryKey: ['/api/subscription/usage'] });
            }
            
            // Erfolgsmeldung anzeigen
            toast({
              title: "Abonnement aktualisiert",
              description: `Ihr Abonnement wurde auf ${targetTier} aktualisiert.`,
              duration: 5000,
            });
          } else {
            console.error("❌ DASHBOARD: Automatisches Update fehlgeschlagen:", result);
          }
        } catch (error) {
          console.error("❌ DASHBOARD: Fehler beim automatischen Update:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    // Kurze Verzögerung, damit die Seite erst geladen wird
    const timer = setTimeout(() => {
      checkAndUpdateSubscription();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    }
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
    queryFn: async () => {
      const response = await fetch('/api/objectives');
      if (!response.ok) {
        throw new Error('Failed to fetch objectives');
      }
      return response.json();
    }
  });

  const boardQueries = useQuery({
    queryKey: ["dashboard-boards"],
    queryFn: async () => {
      const allBoardsRes = await fetch('/api/boards');
      if (!allBoardsRes.ok) {
        throw new Error('Failed to fetch boards');
      }
      const allBoards = await allBoardsRes.json();

      return allBoards.map((board: Board) => {
        const project = projects?.find(p => p.id === board.project_id);
        return {
          ...board,
          projectTitle: project?.title || 'Kein Projekt'
        };
      });
    },
    enabled: true
  });

  if (projectsLoading || boardQueries.isLoading || objectivesLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  const allBoards = boardQueries.data || [];
  const activeObjectives = objectives.filter(obj => obj.status === "active");
  const completedObjectives = objectives.filter(obj => obj.progress === 100);
  // Beziehe alle Objectives (aktive und abgeschlossene) in die Berechnung ein
  const averageProgress = objectives.length > 0
    ? Math.round(objectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / objectives.length)
    : 0;

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Willkommen, {user?.username}!
          </h1>
          <p className="text-muted-foreground mt-2">Hier ist eine Übersicht Ihres Arbeitsbereichs</p>
        </div>
        {/* "Neues Projekt"-Button nur für aktive Benutzer anzeigen */}
        {(!user?.companyId || user?.isActive) && (
          <Button onClick={() => setLocation("/projects")} className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200">
            <Plus className="mr-2 h-4 w-4" />
            Neues Projekt
          </Button>
        )}
      </div>
      
      {/* Warnhinweis für nicht freigeschaltete Benutzer */}
      {user?.companyId && !user?.isActive ? (
        <div className="p-8 bg-amber-50 border border-amber-200 rounded-lg shadow-md text-center">
          <div className="flex flex-col items-center justify-center">
            <InfoIcon className="h-12 w-12 text-amber-500 mb-4" />
            <h2 className="text-2xl font-bold text-amber-800 mb-2">Ihr Konto ist noch nicht freigeschaltet</h2>
            <p className="text-lg text-amber-700 max-w-2xl mb-4">
              Der Administrator Ihres Unternehmens muss Ihr Konto zuerst freischalten.
              Bis dahin haben Sie nur eingeschränkten Zugriff auf die Plattform.
            </p>
            <p className="text-amber-700 max-w-2xl">
              Bitte kontaktieren Sie Ihren Administrator für weitere Informationen.
              Sobald Ihr Konto freigeschaltet wurde, erhalten Sie vollen Zugriff auf alle Funktionen.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Statistics Cards */}
          <div className="w-full lg:w-2/3">
            {/* Erste Zeile: Projekte, Boards und OKR Progress in einer Reihe */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardHeader className="py-4">
                  <CardTitle>Projekte</CardTitle>
                  <CardDescription>Gesamtzahl Ihrer Projekte</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{projects?.length || 0}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardHeader className="py-4">
                  <CardTitle>Boards</CardTitle>
                  <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{allBoards.length}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardHeader className="py-4">
                  <CardTitle>OKR Progress</CardTitle>
                  <CardDescription>
                    {(!user?.subscriptionTier || !['free', 'freelancer'].includes(user.subscriptionTier.toLowerCase())) 
                      ? `Alle Objectives (${objectives.length})`
                      : 'Nicht verfügbar'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(!user?.subscriptionTier || !['free', 'freelancer'].includes(user.subscriptionTier.toLowerCase())) ? (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-primary">{averageProgress}%</p>
                      <div className="text-sm text-muted-foreground">
                        Abgeschlossen: {completedObjectives.length}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      OKR-Funktionen sind nur in den Paketen "Organisation" und "Enterprise" verfügbar.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Produktivitäts-Card in voller Breite */}
            <div className="mb-4">
              <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardHeader className="py-4">
                  <CardTitle>Produktivität</CardTitle>
                  <CardDescription>Ihre Aktivitäten</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Wir zeigen die ProductivityMetricsCard für alle Benutzer an, aber in einer modifizierten Version für Free und Freelancer */}
                  <ProductivityMetricsCard 
                    userId={user?.id || 0} 
                    hideOkrData={!!user?.subscriptionTier && ['free', 'freelancer'].includes(user.subscriptionTier.toLowerCase())} 
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Aufgaben in "ToDo" und "In Progress" */}
            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Meine aktuellen Aufgaben</CardTitle>
                    <CardDescription>Aufgaben in "ToDo", "In Progress" und "In Review"</CardDescription>
                  </div>
                  {(!user?.subscriptionTier || !['free'].includes(user.subscriptionTier.toLowerCase())) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary"
                      onClick={() => setLocation("/my-tasks")}
                    >
                      Alle ansehen <ChevronsRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(!user?.subscriptionTier || ['free'].includes(user.subscriptionTier.toLowerCase())) ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Die Aufgabenverwaltung ist nur in höheren Abonnement-Paketen verfügbar.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Bitte upgraden Sie Ihr Abonnement, um diese Funktion nutzen zu können.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aufgabe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priorität</TableHead>
                        <TableHead>Fälligkeit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <DashboardTaskRows />
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed Section */}
          <div className="w-full lg:w-1/3">
            <DashboardActivityFeed />
          </div>
        </div>
      )}
    </div>
  );
}