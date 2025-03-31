import React from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserSelect } from "@/components/user/user-select";
import { DatePicker } from "@/components/ui/date-picker";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

// Validierungsschema für ein Protokoll
const protocolSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  date: z.date(),
  teamId: z.number().optional().nullable(),
  projectId: z.number().optional().nullable(),
  objectiveId: z.number().optional().nullable(),
  agenda: z.string().optional().nullable(),
  decisions: z.string().optional().nullable(),
  participants: z.array(z.string()).min(1, "Mindestens ein Teilnehmer ist erforderlich"),
});

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

  // Default-Werte setzen
  const defaultValues: Partial<ProtocolFormValues> = {
    title: "",
    date: new Date(),
    teamId: teamId || null,
    projectId: projectId || null,
    objectiveId: objectiveId || null,
    agenda: "",
    decisions: "",
    participants: [],
    ...initialValues,
  };

  const form = useForm<ProtocolFormValues>({
    resolver: zodResolver(protocolSchema),
    defaultValues,
  });

  // Erstellen eines neuen Protokolls
  const createMutation = useMutation({
    mutationFn: async (values: ProtocolFormValues) => {
      return apiRequest("/api/protocols", {
        method: "POST",
        body: JSON.stringify(values),
      });
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
      return apiRequest(`/api/protocols/${protocolId}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
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
    // Formatiertes Datum für API-Anfrage
    const formattedValues = {
      ...values,
      date: values.date.toISOString(),
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

              <FormField
                control={form.control}
                name="participants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teilnehmer</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Teilnehmer auswählen"
                        teamId={teamId}
                        projectId={projectId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agenda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agenda</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tagesordnungspunkte"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="decisions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschlüsse</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Getroffene Entscheidungen"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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