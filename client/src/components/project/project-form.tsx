import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema, type InsertProject, type Project, type Team, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { DialogMultiSelect } from "@/components/ui/dialog-multi-select";

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  existingProject?: Project;
  onSuccess?: () => void;
}

export function ProjectForm({ open, onClose, existingProject, onSuccess }: ProjectFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Prüfe, ob der Benutzer Teams und Benutzer zuweisen darf
  const canAssignTeamsAndUsers = user?.subscriptionTier && 
    !['free', 'freelancer'].includes(user.subscriptionTier.toLowerCase());

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    },
  });
  
  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(existingProject ? insertProjectSchema.partial() : insertProjectSchema),
    defaultValues: {
      title: existingProject?.title || "",
      description: existingProject?.description || "",
      teamIds: existingProject?.teamIds || [],
      memberIds: existingProject?.members?.map(m => m.id) || [],
      companyId: existingProject?.companyId || user?.companyId || null, // Geändert von 0 zu null, da companyId null sein kann
      creator_id: existingProject?.creator_id || user?.id || 0,
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: InsertProject) => {
      const projectData = {
        ...data,
        teamIds: data.teamIds || [],
        memberIds: data.memberIds || [],
        creator_id: user?.id,
        companyId: user?.companyId || data.companyId,
        userId: user?.id, // Füge die userId für die Aktivitätsprotokollierung hinzu
      };
      console.log("Creating project with data:", projectData);
      // KORRIGIERT: apiRequest hat die Reihenfolge (method, url, data)
      return await apiRequest("POST", "/api/projects", projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Projekt erfolgreich erstellt" });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      console.error("Project creation error:", error);
      
      // Verbesserte Fehlerbehandlung für 403-Fehler (Zugriffsverbot/Limit erreicht)
      let errorMessage = "Das Projekt konnte nicht erstellt werden";
      
      if (error.response) {
        // Wenn es eine Antwort vom Server gibt
        if (error.response.status === 403) {
          errorMessage = error.response.data?.details || 
                        "Projektlimit erreicht. Bitte upgraden Sie Ihr Abonnement, um weitere Projekte zu erstellen.";
        } else {
          errorMessage = error.response.data?.message || error.message || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Fehler beim Erstellen des Projekts",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateProject = useMutation({
    mutationFn: async (data: Partial<InsertProject>) => {
      if (!existingProject) return;

      const updateData = {
        ...data,
        teamIds: data.teamIds || [],
        memberIds: data.memberIds || [],
        companyId: user?.companyId || data.companyId || existingProject.companyId,
        creator_id: existingProject.creator_id || user?.id,
        userId: user?.id, // Füge die userId für die Aktivitätsprotokollierung hinzu
      };
      console.log("Updating project with data:", updateData);

      // KORRIGIERT: apiRequest hat die Reihenfolge (method, url, data)
      return await apiRequest(
        "PATCH",
        `/api/projects/${existingProject.id}`,
        updateData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Projekt erfolgreich aktualisiert" });
      // Rufe den onSuccess-Callback auf, wenn er existiert
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren des Projekts",
        description: error instanceof Error ? error.message : "Das Projekt konnte nicht aktualisiert werden",
        variant: "destructive",
      });
      console.error("Project update error:", error);
    },
  });

  const onSubmit = async (data: InsertProject) => {
    console.log("Formular wird abgeschickt:", data);
    console.log("Formularfehler:", form.formState.errors);
    console.log("Form-Status:", {
      isDirty: form.formState.isDirty,
      isValid: form.formState.isValid,
      isSubmitting: form.formState.isSubmitting,
      isSubmitted: form.formState.isSubmitted,
      submitCount: form.formState.submitCount
    });
    
    if (!user?.id) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um ein Projekt zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    // Prüfen der Schema-Validierung manuell
    const validationResult = insertProjectSchema.safeParse(data);
    if (!validationResult.success) {
      console.error("Validierungsfehler:", validationResult.error);
      toast({
        title: "Validierungsfehler",
        description: "Das Formular enthält ungültige Werte. Bitte überprüfen Sie Ihre Eingaben.",
        variant: "destructive",
      });
      return;
    }

    // Debug-Toast hinzufügen
    toast({
      title: "Formular wird verarbeitet",
      description: "Daten werden an den Server gesendet...",
    });

    try {
      if (existingProject) {
        await updateProject.mutateAsync(data);
      } else {
        await createProject.mutateAsync(data);
      }
    } catch (error) {
      console.error("Fehler beim Speichern des Projekts:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0" aria-describedby="project-form-description">
        <div className="p-6 pb-0">
          <DialogTitle>{existingProject ? "Projekt bearbeiten" : "Neues Projekt erstellen"}</DialogTitle>
          <DialogDescription id="project-form-description">
            {existingProject 
              ? "Bearbeiten Sie die Projektdetails und klicken Sie auf 'Änderungen speichern', um fortzufahren."
              : "Geben Sie Projektdetails ein und klicken Sie auf 'Projekt erstellen', um fortzufahren."}
          </DialogDescription>
        </div>
        
        <div className="overflow-y-auto px-6 pb-0 pt-2" style={{ maxHeight: "calc(85vh - 160px)" }}>
          <Form {...form}>
            <form id="project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Teams
                      {!canAssignTeamsAndUsers && (
                        <span className="ml-2 text-xs text-amber-500 font-normal">
                          (Premium-Funktion)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <DialogMultiSelect
                        placeholder={canAssignTeamsAndUsers 
                          ? "Teams auswählen..." 
                          : "Nur mit Premium-Abonnement verfügbar"}
                        options={teams.map(team => ({
                          value: team.id.toString(),
                          label: team.name
                        }))}
                        selected={Array.isArray(field.value) ? field.value.map((id: number) => id.toString()) : []}
                        onChange={(values: string[]) => {
                          const numberValues = values.map((v: string) => parseInt(v));
                          field.onChange(numberValues);
                        }}
                        disabled={!canAssignTeamsAndUsers}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="memberIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Mitglieder
                      {!canAssignTeamsAndUsers && (
                        <span className="ml-2 text-xs text-amber-500 font-normal">
                          (Premium-Funktion)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <DialogMultiSelect
                        placeholder={canAssignTeamsAndUsers 
                          ? "Mitglieder auswählen..." 
                          : "Nur mit Premium-Abonnement verfügbar"}
                        options={users.map(user => ({
                          value: user.id.toString(),
                          label: user.username
                        }))}
                        selected={Array.isArray(field.value) ? field.value.map((id: number) => id.toString()) : []}
                        onChange={(values: string[]) => {
                          const numberValues = values.map((v: string) => parseInt(v));
                          field.onChange(numberValues);
                        }}
                        disabled={!canAssignTeamsAndUsers}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        
        <div className="p-6 border-t flex flex-row justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="project-form"
            disabled={createProject.isPending || updateProject.isPending}
            className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
          >
            {existingProject ? "Änderungen speichern" : "Projekt erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}