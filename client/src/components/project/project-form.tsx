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
  DialogFooter
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

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  existingProject?: Project;
}

export function ProjectForm({ open, onClose, existingProject }: ProjectFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      companyId: existingProject?.companyId || user?.companyId || 0,
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: InsertProject) => {
      const projectData = {
        ...data,
        teamIds: data.teamIds || [],
        creator_id: user?.id,
        userId: user?.id, // Füge die userId für die Aktivitätsprotokollierung hinzu
      };
      console.log("Creating project with data:", projectData);
      return await apiRequest("POST", "/api/projects", projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Projekt erfolgreich erstellt" });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen des Projekts",
        description: error instanceof Error ? error.message : "Das Projekt konnte nicht erstellt werden",
        variant: "destructive",
      });
      console.error("Project creation error:", error);
    },
  });

  const updateProject = useMutation({
    mutationFn: async (data: Partial<InsertProject>) => {
      if (!existingProject) return;

      const updateData = {
        ...data,
        teamIds: data.teamIds || [],
        memberIds: data.memberIds || [],
        userId: user?.id, // Füge die userId für die Aktivitätsprotokollierung hinzu
      };
      console.log("Updating project with data:", updateData);

      return await apiRequest(
        "PATCH",
        `/api/projects/${existingProject.id}`,
        updateData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Projekt erfolgreich aktualisiert" });
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
    if (!user?.id) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um ein Projekt zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    if (existingProject) {
      await updateProject.mutateAsync(data);
    } else {
      await createProject.mutateAsync(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <div className="p-6 pb-0">
          <DialogTitle>{existingProject ? "Projekt bearbeiten" : "Neues Projekt erstellen"}</DialogTitle>
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
                    <FormLabel>Teams</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const id = parseInt(value);
                        if (!field.value?.includes(id)) {
                          field.onChange([...(field.value || []), id]);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Team hinzufügen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {field.value?.map((teamId) => {
                        const team = teams.find((t) => t.id === teamId);
                        return (
                          <Badge key={teamId} variant="secondary">
                            {team?.name}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => {
                                field.onChange(field.value?.filter((id) => id !== teamId));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
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
          >
            {existingProject ? "Änderungen speichern" : "Projekt erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}