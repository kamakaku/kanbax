import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InsertTeam, insertTeamSchema, type Team } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type User } from "@shared/schema";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface TeamFormProps {
  open: boolean;
  onClose: () => void;
  existingTeam?: Team;
}

export function TeamForm({ open, onClose, existingTeam }: TeamFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available users
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

  const userOptions: Option[] = users.map(user => ({
    value: user.id.toString(),
    label: user.username
  }));

  const form = useForm<InsertTeam>({
    resolver: zodResolver(existingTeam ? insertTeamSchema.partial() : insertTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      memberIds: [],
    },
  });

  // Reset form when existingTeam changes
  useEffect(() => {
    if (existingTeam) {
      console.log("Resetting form with existing team:", existingTeam);
      // Get team members for this team
      const getTeamMembers = async () => {
        try {
          const response = await fetch(`/api/teams/${existingTeam.id}/members`);
          if (!response.ok) {
            throw new Error("Failed to fetch team members");
          }
          const members = await response.json();
          const memberIds = members.map((member: { userId: number }) => member.userId);

          form.reset({
            name: existingTeam.name,
            description: existingTeam.description,
            memberIds: memberIds,
          });
        } catch (error) {
          console.error("Error fetching team members:", error);
          toast({
            title: "Fehler",
            description: "Teammitglieder konnten nicht geladen werden",
            variant: "destructive",
          });
        }
      };
      getTeamMembers();
    } else {
      form.reset({
        name: "",
        description: "",
        memberIds: [],
      });
    }
  }, [existingTeam, form, toast]);

  const createTeam = useMutation({
    mutationFn: async (data: InsertTeam) => {
      const payload = {
        ...data,
        memberIds: data.memberIds?.map(Number) || []
      };
      console.log("Creating team with payload:", payload);
      return await apiRequest("POST", "/api/teams", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team erfolgreich erstellt" });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Team konnte nicht erstellt werden",
        variant: "destructive",
      });
      console.error("Team creation error:", error);
    },
  });

  const updateTeam = useMutation({
    mutationFn: async (data: Partial<InsertTeam>) => {
      if (!existingTeam) return;

      const payload = {
        ...data,
        memberIds: data.memberIds?.map(Number) || []
      };

      console.log("Updating team with payload:", payload);

      return await apiRequest(
        "PATCH",
        `/api/teams/${existingTeam.id}`,
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team erfolgreich aktualisiert" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Team konnte nicht aktualisiert werden",
        variant: "destructive",
      });
      console.error("Team update error:", error);
    },
  });

  const onSubmit = async (data: InsertTeam) => {
    console.log("Form data before submission:", data);
    if (existingTeam) {
      await updateTeam.mutateAsync(data);
    } else {
      await createTeam.mutateAsync(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {existingTeam ? "Team bearbeiten" : "Neues Team erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Entwicklungsteam" {...field} />
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
                      placeholder="Beschreiben Sie das Team..."
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
              name="memberIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team-Mitglieder</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={userOptions}
                      selected={field.value?.map(String) || []}
                      onChange={(values) => {
                        console.log("MultiSelect onChange values:", values);
                        const numberValues = values.map(Number);
                        console.log("Converted to numbers:", numberValues);
                        field.onChange(numberValues);
                      }}
                      placeholder="Mitglieder auswählen"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              {existingTeam ? "Team aktualisieren" : "Team erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}