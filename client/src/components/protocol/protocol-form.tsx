import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserSelect } from "@/components/user/user-select";
import { TeamSelect } from "@/components/team/team-select";
import { DatePicker } from "@/components/ui/date-picker";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Plus, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

// Schema für einen einzelnen Agenda-Punkt
const agendaItemSchema = z.object({
  id: z.string(), // Einzigartige ID für jeden Punkt
  title: z.string().min(1, "Titel ist erforderlich"),
  notes: z.string().optional().default(""),
  richNotes: z.string().optional().default(""), // Für Rich-Text-Editor
  assignment: z.string().optional().default(""),
  categories: z.array(z.enum(["information", "task", "decision"])).default([]),
});

// Validierungsschema für ein Protokoll
const protocolSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  date: z.date(),
  teamId: z.number().optional().nullable(),
  projectId: z.number().optional().nullable(),
  objectiveId: z.number().optional().nullable(),
  agenda: z.string().optional().nullable(), // Legacy-Feld
  decisions: z.string().optional().nullable(), // Legacy-Feld
  agendaItems: z.array(agendaItemSchema).default([]),
  participants: z.array(z.string()).optional().default([]),
  teamParticipants: z.array(z.number()).optional().default([]),
});

type AgendaItem = z.infer<typeof agendaItemSchema>;
type ProtocolFormValues = z.infer<typeof protocolSchema>;

interface ProtocolFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: number;
  projectId?: number;
  objectiveId?: number;
  onSuccess?: () => void;
  initialValues?: Partial<ProtocolFormValues>;
  editMode?: boolean;
  protocolId?: number;
}

export function ProtocolForm({
  open,
  onOpenChange,
  teamId,
  projectId,
  objectiveId,
  onSuccess,
  initialValues,
  editMode = false,
  protocolId,
}: ProtocolFormProps) {
  const queryClient = useQueryClient();

  // Funktion zum Generieren einer eindeutigen ID
  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  };

  // Default-Werte setzen
  const defaultValues: Partial<ProtocolFormValues> = {
    title: "",
    date: new Date(),
    teamId: teamId || null,
    projectId: projectId || null,
    objectiveId: objectiveId || null,
    agenda: "",
    decisions: "",
    agendaItems: initialValues?.agendaItems || [],
    participants: [],
    teamParticipants: [],
    ...initialValues,
  };

  const form = useForm<ProtocolFormValues>({
    resolver: zodResolver(protocolSchema),
    defaultValues,
  });

  // Field-Array für Agenda-Punkte
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "agendaItems",
  });

  // Neuen Agenda-Punkt hinzufügen
  const addAgendaItem = () => {
    append({
      id: generateId(),
      title: "",
      notes: "",
      richNotes: "", // Rich-Text-Content initialisieren
      assignment: "",
      categories: []
    });
  };

  // Erstellen eines neuen Protokolls
  const createMutation = useMutation({
    mutationFn: async (values: ProtocolFormValues) => {
      return apiRequest("POST", "/api/protocols", values);
    },
    onSuccess: () => {
      toast({
        title: "Protokoll erstellt",
        description: "Das Protokoll wurde erfolgreich erstellt",
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
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      console.error("Error creating protocol:", error);
      toast({
        title: "Fehler",
        description: error?.message || "Fehler beim Erstellen des Protokolls",
        variant: "destructive",
      });
    },
  });

  // Aktualisieren eines vorhandenen Protokolls
  const updateMutation = useMutation({
    mutationFn: async (values: ProtocolFormValues) => {
      return apiRequest("PATCH", `/api/protocols/${protocolId}`, values);
    },
    onSuccess: () => {
      toast({
        title: "Protokoll aktualisiert",
        description: "Das Protokoll wurde erfolgreich aktualisiert",
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
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      console.error("Error updating protocol:", error);
      toast({
        title: "Fehler",
        description: error?.message || "Fehler beim Aktualisieren des Protokolls",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProtocolFormValues) => {
    // API-Anfrage Daten vorbereiten
    // WICHTIG: Wir lassen date als Date-Objekt (nicht toISOString), da das Backend Zod-Validierung mit z.date() verwendet
    // Füge creatorId hinzu, die vom Backend erwartet wird
    const formattedValues = {
      ...values,
      creatorId: 1, // Fester Wert für den aktuellen Benutzer, der im Backend bereits über req.userId verfügbar ist
    };

    if (editMode && protocolId) {
      updateMutation.mutate(formattedValues as any);
    } else {
      createMutation.mutate(formattedValues as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle>
              {editMode ? "Protokoll bearbeiten" : "Neues Protokoll erstellen"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto px-6 py-2" style={{ maxHeight: "calc(80vh - 200px)" }}>
          <Form {...form}>
            <form
              id="protocol-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input placeholder="Titel des Meetings" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Datum</FormLabel>
                    <DatePicker
                      date={field.value}
                      setDate={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Teilnehmer</h3>
                
                <FormField
                  control={form.control}
                  name="participants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personen</FormLabel>
                      <FormControl>
                        <UserSelect
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Personen auswählen"
                          teamId={teamId}
                          projectId={projectId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {(projectId || objectiveId) && (
                  <FormField
                    control={form.control}
                    name="teamParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teams</FormLabel>
                        <FormControl>
                          <TeamSelect
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Teams auswählen"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Strukturierte Agenda-Punkte</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAgendaItem}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Punkt hinzufügen
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                    Keine Agenda-Punkte vorhanden. Klicken Sie auf "Punkt hinzufügen", um zu beginnen.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="relative overflow-hidden">
                        <div className="absolute right-2 top-2 flex gap-1">
                          {index > 0 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => move(index, index - 1)}
                              className="h-7 w-7"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          )}
                          {index < fields.length - 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => move(index, index + 1)}
                              className="h-7 w-7"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardContent className="pt-4 pb-3">
                          <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name={`agendaItems.${index}.title`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Titel</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Titel des Agenda-Punkts" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`agendaItems.${index}.notes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Notizen (Einfacher Text)</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Beschreibung und Notizen (einfacher Text)"
                                      className="min-h-[80px]"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                              
                            <FormField
                              control={form.control}
                              name={`agendaItems.${index}.richNotes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Beschlüsse/Notizen (Rich-Text)</FormLabel>
                                  <FormControl>
                                    <RichTextEditor
                                      content={field.value}
                                      onChange={field.onChange}
                                      placeholder="Beschlüsse und Notizen mit Formatierung"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`agendaItems.${index}.assignment`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Zuordnung</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Verantwortliche Person/Team" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`agendaItems.${index}.categories`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Kategorien</FormLabel>
                                  <div className="flex flex-wrap gap-3 mt-1.5">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${field.id}-information`}
                                        checked={field.value.includes("information")}
                                        onCheckedChange={(checked) => {
                                          const updatedValue = checked
                                            ? [...field.value, "information"]
                                            : field.value.filter((value) => value !== "information");
                                          field.onChange(updatedValue);
                                        }}
                                      />
                                      <Label htmlFor={`${field.id}-information`}>Information</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${field.id}-task`}
                                        checked={field.value.includes("task")}
                                        onCheckedChange={(checked) => {
                                          const updatedValue = checked
                                            ? [...field.value, "task"]
                                            : field.value.filter((value) => value !== "task");
                                          field.onChange(updatedValue);
                                        }}
                                      />
                                      <Label htmlFor={`${field.id}-task`}>Aufgabe</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${field.id}-decision`}
                                        checked={field.value.includes("decision")}
                                        onCheckedChange={(checked) => {
                                          const updatedValue = checked
                                            ? [...field.value, "decision"]
                                            : field.value.filter((value) => value !== "decision");
                                          field.onChange(updatedValue);
                                        }}
                                      />
                                      <Label htmlFor={`${field.id}-decision`}>Beschluss</Label>
                                    </div>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Wir haben keine Legacy-Felder mehr, diese wurden entfernt */}

              {/* Versteckte Felder für Team-, Projekt- oder Objective-ID */}
              {teamId && (
                <input type="hidden" {...form.register("teamId", { valueAsNumber: true })} value={teamId} />
              )}
              {projectId && (
                <input type="hidden" {...form.register("projectId", { valueAsNumber: true })} value={projectId} />
              )}
              {objectiveId && (
                <input type="hidden" {...form.register("objectiveId", { valueAsNumber: true })} value={objectiveId} />
              )}
            </form>
          </Form>
        </div>

        <div className="p-6 border-t flex flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="protocol-form"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
          >
            {createMutation.isPending || updateMutation.isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}