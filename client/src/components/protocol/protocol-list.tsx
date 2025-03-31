import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileEdit, FileX, Calendar, Users, Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ProtocolForm } from "./protocol-form";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";

interface ProtocolListProps {
  teamId?: number;
  projectId?: number;
  objectiveId?: number;
}

export function ProtocolList({ teamId, projectId, objectiveId }: ProtocolListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<any>(null);
  const [protocolToDelete, setProtocolToDelete] = useState<number | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const queryClient = useQueryClient();

  // Abfrage der Protokolle basierend auf Team, Projekt oder Objective
  const protocolsQuery = useQuery({
    queryKey: teamId
      ? [`/api/protocols/team/${teamId}`]
      : projectId
      ? [`/api/protocols/project/${projectId}`]
      : objectiveId
      ? [`/api/protocols/objective/${objectiveId}`]
      : [],
    queryFn: async () => {
      if (!teamId && !projectId && !objectiveId) return [];

      let endpoint = "";
      if (teamId) {
        endpoint = `/api/protocols/team/${teamId}`;
      } else if (projectId) {
        endpoint = `/api/protocols/project/${projectId}`;
      } else if (objectiveId) {
        endpoint = `/api/protocols/objective/${objectiveId}`;
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Fehler beim Abrufen der Protokolle: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!(teamId || projectId || objectiveId), // Abfrage nur ausführen, wenn teamId, projectId oder objectiveId vorhanden ist
  });

  // Mutation zum Löschen eines Protokolls
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/protocols/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Protokoll gelöscht",
        description: "Das Protokoll wurde erfolgreich gelöscht",
      });
      // Cache invalidieren
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: [`/api/protocols/team/${teamId}`] });
      }
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/protocols/project/${projectId}`] });
      }
      if (objectiveId) {
        queryClient.invalidateQueries({ queryKey: [`/api/protocols/objective/${objectiveId}`] });
      }
      setProtocolToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting protocol:", error);
      toast({
        title: "Fehler",
        description: error?.message || "Fehler beim Löschen des Protokolls",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    setProtocolToDelete(id);
  };

  const confirmDelete = () => {
    if (protocolToDelete) {
      deleteMutation.mutate(protocolToDelete);
    }
  };

  // Rendering der Liste von Protokollen
  const renderProtocols = () => {
    if (protocolsQuery.isLoading) {
      return <div className="text-center py-6">Protokolle werden geladen...</div>;
    }

    if (protocolsQuery.isError) {
      return (
        <div className="text-center py-6 text-red-500">
          Fehler beim Laden der Protokolle: {(protocolsQuery.error as Error).message}
        </div>
      );
    }

    const protocols = protocolsQuery.data || [];

    if (protocols.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          Keine Protokolle vorhanden. Erstellen Sie ein neues Protokoll mit dem Button oben.
        </div>
      );
    }

    // Protokolle nach Datum sortieren (neueste zuerst)
    const sortedProtocols = [...protocols].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
      <Accordion type="single" collapsible className="w-full space-y-4">
        {sortedProtocols.map((protocol: any) => (
          <AccordionItem
            key={protocol.id}
            value={`protocol-${protocol.id}`}
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 transition-all">
              <div className="flex-1 flex items-center justify-between pr-4">
                <div className="text-left">
                  <h3 className="font-medium">{protocol.title}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(protocol.date), "dd. MMMM yyyy", { locale: de })}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {protocol.participantDetails?.slice(0, 3).map((user: any) => (
                      <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={user.avatarUrl || ""} />
                        <AvatarFallback className="text-xs">
                          {user.username?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {protocol.participantDetails?.length > 3 && (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                        +{protocol.participantDetails.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-3 border-t">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Erstellt von</h4>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={protocol.creator?.avatarUrl || ""} />
                      <AvatarFallback>
                        {protocol.creator?.username?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{protocol.creator?.username}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium mb-1">Teilnehmer</h4>
                  
                  {protocol.participantDetails?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Personen</h5>
                      <div className="flex flex-wrap gap-2">
                        {protocol.participantDetails?.map((user: any) => (
                          <div key={user.id} className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.avatarUrl || ""} />
                              <AvatarFallback className="text-xs">
                                {user.username?.charAt(0).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{user.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {protocol.teamParticipantDetails?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Teams</h5>
                      <div className="flex flex-wrap gap-2">
                        {protocol.teamParticipantDetails?.map((team: any) => (
                          <div key={team.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2 py-1">
                            <Users className="h-4 w-4" />
                            <span className="text-xs">{team.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {protocol.agendaItems && protocol.agendaItems.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Agenda-Punkte</h4>
                    <div className="space-y-3">
                      {protocol.agendaItems.map((item, index) => (
                        <div key={item.id} className="bg-muted/50 p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <h5 className="text-sm font-medium">{index + 1}. {item.title}</h5>
                            <div className="flex gap-1">
                              {item.categories && item.categories.map(category => {
                                let color = "";
                                let text = "";
                                
                                if (category === "information") {
                                  color = "bg-blue-100 text-blue-800";
                                  text = "Information";
                                } else if (category === "task") {
                                  color = "bg-amber-100 text-amber-800";
                                  text = "Aufgabe";
                                } else if (category === "decision") {
                                  color = "bg-green-100 text-green-800";
                                  text = "Beschluss";
                                }
                                
                                return (
                                  <span key={category} className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
                                    {text}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          
                          {(item.notes || item.richNotes) && (
                            <div className="mt-2">
                              <h6 className="text-xs font-medium text-muted-foreground mb-0.5">Beschlüsse/Notizen</h6>
                              {item.richNotes ? (
                                <div 
                                  className="text-sm prose prose-sm max-w-none" 
                                  dangerouslySetInnerHTML={{ __html: item.richNotes }}
                                />
                              ) : (
                                <p className="text-sm whitespace-pre-line">{item.notes}</p>
                              )}
                            </div>
                          )}
                          
                          {item.assignment && (
                            <div className="mt-2">
                              <h6 className="text-xs font-medium text-muted-foreground mb-0.5">Zuordnung</h6>
                              <p className="text-sm">{item.assignment}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-muted/20 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Keine Agenda-Punkte vorhanden.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingProtocol({
                        ...protocol,
                        date: new Date(protocol.date),
                        participants: protocol.participantDetails?.map((u: any) => u.id.toString()) || [],
                        teamParticipants: protocol.teamParticipantDetails?.map((t: any) => t.id) || [],
                      });
                    }}
                  >
                    <FileEdit className="h-4 w-4 mr-1" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Protokoll duplizieren
                      const now = new Date();
                      setShowCreateForm(true);
                      // Deep Copy aller Daten erstellen, um eine komplette Kopie zu haben
                      const duplicateProtocol = {
                        ...JSON.parse(JSON.stringify(protocol)), // Deep Copy um alle verschachtelten Objekte zu kopieren
                        title: `${protocol.title} (Kopie)`,
                        date: now, // Aktuelles Datum für die Kopie
                        // Teilnehmer korrekt kopieren
                        participants: protocol.participantDetails?.map((u: any) => u.id.toString()) || [],
                        teamParticipants: protocol.teamParticipantDetails?.map((t: any) => t.id) || [],
                        // Sicherstellen, dass agendaItems vollständig kopiert werden
                        agendaItems: protocol.agendaItems?.map((item: any) => ({
                          ...item,
                          // Neue ID für jeden Agenda-Punkt generieren
                          id: Date.now().toString() + Math.random().toString(36).substring(2, 9)
                        })) || []
                      };
                      // ID und andere Metadaten entfernen, damit es als neues Protokoll angelegt wird
                      delete duplicateProtocol.id;
                      delete duplicateProtocol.createdAt;
                      delete duplicateProtocol.updatedAt;
                      delete duplicateProtocol.participantDetails;
                      delete duplicateProtocol.teamParticipantDetails;
                      delete duplicateProtocol.creator;
                      
                      setDuplicateData(duplicateProtocol);
                    }}
                  >
                    <svg 
                      className="h-4 w-4 mr-1" 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <rect x="8" y="8" width="12" height="12" rx="2" ry="2"></rect>
                      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
                    </svg>
                    Duplizieren
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(protocol.id)}
                  >
                    <FileX className="h-4 w-4 mr-1" />
                    Löschen
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Protokolle</h2>
        <Button
          variant="default"
          size="sm"
          className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
          onClick={() => setShowCreateForm(true)}
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Neues Protokoll
        </Button>
      </div>

      {renderProtocols()}

      {/* Formular zum Erstellen eines neuen Protokolls */}
      <ProtocolForm
        open={showCreateForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateForm(false);
            setDuplicateData(null); // Wenn wir schließen, setzen wir die duplizierten Daten zurück
          }
        }}
        teamId={teamId}
        projectId={projectId}
        objectiveId={objectiveId}
        initialValues={duplicateData} // Verwenden der duplizierten Protokolldaten wenn vorhanden
        onSuccess={() => {
          if (teamId) {
            queryClient.invalidateQueries({ queryKey: [`/api/protocols/team/${teamId}`] });
          }
          if (projectId) {
            queryClient.invalidateQueries({ queryKey: [`/api/protocols/project/${projectId}`] });
          }
          if (objectiveId) {
            queryClient.invalidateQueries({ queryKey: [`/api/protocols/objective/${objectiveId}`] });
          }
          setDuplicateData(null); // Nach dem Speichern zurücksetzen
        }}
      />

      {/* Formular zum Bearbeiten eines Protokolls */}
      {editingProtocol && (
        <ProtocolForm
          open={!!editingProtocol}
          onOpenChange={(open) => {
            if (!open) setEditingProtocol(null);
          }}
          teamId={teamId}
          projectId={projectId}
          objectiveId={objectiveId}
          initialValues={editingProtocol}
          editMode={true}
          protocolId={editingProtocol.id}
          onSuccess={() => {
            if (teamId) {
              queryClient.invalidateQueries({ queryKey: [`/api/protocols/team/${teamId}`] });
            }
            if (projectId) {
              queryClient.invalidateQueries({ queryKey: [`/api/protocols/project/${projectId}`] });
            }
            if (objectiveId) {
              queryClient.invalidateQueries({ queryKey: [`/api/protocols/objective/${objectiveId}`] });
            }
          }}
        />
      )}

      {/* Bestätigungsdialog zum Löschen eines Protokolls */}
      <AlertDialog open={!!protocolToDelete} onOpenChange={(open) => !open && setProtocolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie dieses Protokoll löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}