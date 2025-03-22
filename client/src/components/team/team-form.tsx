import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InsertTeam, insertTeamSchema } from "@shared/schema";
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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DialogMultiSelect, type Option } from "@/components/ui/dialog-multi-select";
import { type User } from "@shared/schema";
import { useEffect } from "react";

interface TeamFormProps {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<InsertTeam>;
  onSubmit?: (data: InsertTeam) => Promise<void>;
}

export function TeamForm({ open, onClose, defaultValues, onSubmit }: TeamFormProps) {
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
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      member_ids: [], // Umbenannt von memberIds zu member_ids
    },
  });

  // Reset form when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        description: defaultValues.description,
        member_ids: defaultValues.member_ids, // Umbenannt von memberIds zu member_ids
      });
    } else {
      form.reset({
        name: "",
        description: "",
        member_ids: [], // Umbenannt von memberIds zu member_ids
      });
    }
  }, [defaultValues, form.reset]);

  const handleSubmit = async (data: InsertTeam) => {
    try {
      console.log("Submitting team data:", JSON.stringify(data, null, 2));

      if (onSubmit) {
        await onSubmit(data);
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...data,
            member_ids: data.member_ids?.map(id => parseInt(id)) || [] // Umbenannt von memberIds zu member_ids
          })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create team");
        }

        await queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
        toast({ title: "Team erfolgreich erstellt" });
        form.reset();
        onClose();
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Das Team konnte nicht erstellt werden",
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
            {defaultValues ? "Team bearbeiten" : "Neues Team erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              name="member_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team-Mitglieder</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={userOptions}
                      selected={field.value || []}
                      onChange={field.onChange}
                      placeholder="Mitglieder auswählen"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              {defaultValues ? "Team aktualisieren" : "Team erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}