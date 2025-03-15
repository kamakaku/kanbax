import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { type KeyResult } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
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
import { apiRequest } from "@/lib/queryClient";

// Define the schema for key result creation
const keyResultSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional().nullable(),
  targetValue: z.number().min(0, "Zielwert muss größer als 0 sein"),
  currentValue: z.number().min(0).optional().nullable(),
  type: z.string().default("numeric"),
  status: z.string().default("active"),
});

type KeyResultFormData = z.infer<typeof keyResultSchema>;

interface KeyResultFormProps {
  objectiveId: number;
  onSuccess?: () => void;
}

export function KeyResultForm({ objectiveId, onSuccess }: KeyResultFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<KeyResultFormData>({
    resolver: zodResolver(keyResultSchema),
    defaultValues: {
      title: "",
      description: "",
      targetValue: 100,
      currentValue: 0,
      type: "numeric",
      status: "active",
    },
  });

  const createKeyResult = useMutation({
    mutationFn: async (data: KeyResultFormData) => {
      return await apiRequest<KeyResult>(
        "POST",
        `/api/objectives/${objectiveId}/key-results`,
        {
          ...data,
          objectiveId,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/objectives", objectiveId, "key-results"],
      });
      toast({ title: "Key Result erfolgreich erstellt" });
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error("Create key result error:", error);
      toast({
        title: "Fehler beim Erstellen des Key Results",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createKeyResult.mutate(data))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input placeholder="Key Result Titel" {...field} />
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
                  placeholder="Beschreiben Sie das Key Result..."
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
          name="targetValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zielwert</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={createKeyResult.isPending}
        >
          {createKeyResult.isPending
            ? "Wird erstellt..."
            : "Key Result erstellen"}
        </Button>
      </form>
    </Form>
  );
}