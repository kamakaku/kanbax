import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type InsertObjective } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { DialogFooter } from "@/components/ui/dialog";

const objectiveFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
});

interface ObjectiveFormProps {
  onSuccess?: () => void;
}

export function ObjectiveForm({ onSuccess }: ObjectiveFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof objectiveFormSchema>>({
    resolver: zodResolver(objectiveFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof objectiveFormSchema>) {
    try {
      const payload: InsertObjective = {
        ...values,
        status: "active",
      };

      await apiRequest("POST", "/api/objectives", payload);

      await queryClient.invalidateQueries({ 
        queryKey: ["/api/objectives"]
      });

      toast({ title: "Objective erfolgreich erstellt" });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Fehler beim Erstellen des Objective:", error);
      toast({
        title: "Fehler beim Erstellen des Objective",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <DialogFooter>
          <Button type="submit">Objective erstellen</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
