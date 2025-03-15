import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBoardSchema, type InsertBoard, type Project, type User, type Team } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface BoardFormProps {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<InsertBoard>;
  onSubmit?: (data: InsertBoard) => Promise<void>;
}

export function BoardForm({ open, onClose, defaultValues, onSubmit }: BoardFormProps) {
  const { currentProject, setCurrentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
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

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: defaultValues || {
      title: "",
      description: "",
      projectId: currentProject?.id,
      memberIds: [],
      teamIds: [],
      guestEmails: [],
    },
  });

  const handleSubmit = async (data: InsertBoard) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Construct the correct API endpoint based on whether we have a projectId
        const endpoint = data.projectId 
          ? `/api/projects/${data.projectId}/boards`
          : '/api/boards';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create board");
        }

        const newBoard = await res.json();
        queryClient.invalidateQueries({ queryKey: ["all-boards"] });
        if (data.projectId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/projects/${data.projectId}/boards`] 
          });
        }

        toast({ title: "Board erfolgreich erstellt" });
        form.reset();
        onClose();
        setCurrentBoard(newBoard);
        setLocation(`/board`);
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Board konnte nicht erstellt werden",
        variant: "destructive",
      });
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {defaultValues ? "Board bearbeiten" : "Neues Board erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Mein Board" {...field} />
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
                      placeholder="Beschreiben Sie Ihr Board..."
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
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projekt (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Projekt (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Kein Projekt</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="memberIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mitglieder</FormLabel>
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
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value?.map((userId) => {
                      const user = users.find((u) => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary">
                          {user?.username}
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

            <FormField
              control={form.control}
              name="guestEmails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gäste (E-Mail-Adressen)</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="beispiel@domain.de"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.currentTarget;
                            const email = input.value.trim();
                            if (email && !field.value?.includes(email)) {
                              field.onChange([...(field.value || []), email]);
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        {field.value?.map((email) => (
                          <Badge key={email} variant="secondary">
                            {email}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => {
                                field.onChange(field.value?.filter((e) => e !== email));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              {defaultValues ? "Board aktualisieren" : "Board erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}