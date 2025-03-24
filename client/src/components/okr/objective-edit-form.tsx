import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type Objective, type Project, type Team, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const objectiveEditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  teamIds: z.array(z.number()).optional(),
  userIds: z.array(z.number()).optional(),
  status: z.enum(["active", "completed", "archived"]).default("active"),
});

interface ObjectiveEditFormProps {
  objective: Objective;
  onSuccess?: () => void;
}

export function ObjectiveEditForm({ objective, onSuccess }: ObjectiveEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available data for dropdowns
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
      }
      return response.json();
    }
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    }
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    }
  });

  const form = useForm<z.infer<typeof objectiveEditSchema>>({
    resolver: zodResolver(objectiveEditSchema),
    defaultValues: {
      title: objective.title,
      description: objective.description || "",
      projectId: objective.projectId?.toString(),
      teamIds: objective.teamIds || [],
      userIds: objective.userIds || [],
      status: objective.status as "active" | "completed" | "archived",
    },
  });

  async function onSubmit(values: z.infer<typeof objectiveEditSchema>) {
    try {
      const payload = {
        title: values.title,
        description: values.description,
        projectId: values.projectId ? parseInt(values.projectId) : null,
        teamIds: values.teamIds || [],
        userIds: values.userIds || [],
        status: values.status,
      };

      await apiRequest("PATCH", `/api/objectives/${objective.id}`, payload);

      await queryClient.invalidateQueries({ 
        queryKey: ["/api/objectives"]
      });
      
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/objectives", objective.id]
      });
      
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/activity"]
      });

      toast({ title: "Objective erfolgreich aktualisiert" });
      onSuccess?.();
    } catch (error) {
      console.error("Error in objective update:", error);
      toast({
        title: "Fehler beim Aktualisieren des Objective",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form id="objective-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input placeholder="Umsatz um 20% steigern" {...field} />
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
                <Textarea 
                  placeholder="Beschreiben Sie das Ziel und den gewünschten Outcome" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                    <SelectItem value="archived">Archiviert</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Projekt (optional)</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teamIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teams (optional)</FormLabel>
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

        <FormField
          control={form.control}
          name="userIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Benutzer (optional)</FormLabel>
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
                    <SelectValue placeholder="Benutzer hinzufügen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="z-50">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {field.value?.map((userId) => {
                  const userItem = users.find((u) => u.id === userId);
                  return (
                    <Badge key={userId} variant="secondary">
                      {userItem?.username}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1"
                        onClick={() => {
                          field.onChange(field.value?.filter((id) => id !== userId));
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
  );
}