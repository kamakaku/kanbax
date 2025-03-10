import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWikiArticleSchema, type InsertWikiArticle, type WikiArticle } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WikiArticleFormProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  existingArticle?: WikiArticle;
}

export function WikiArticleForm({ open, onClose, projectId, existingArticle }: WikiArticleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertWikiArticle>({
    resolver: zodResolver(existingArticle ? insertWikiArticleSchema.partial() : insertWikiArticleSchema),
    defaultValues: {
      title: existingArticle?.title || "",
      content: existingArticle?.content || "",
      projectId: projectId,
    },
  });

  const createArticle = useMutation({
    mutationFn: async (data: InsertWikiArticle) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/wiki`, data);
      if (!res.ok) {
        throw new Error("Failed to create wiki article");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wiki`] });
      toast({ title: "Wiki article created successfully" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to create wiki article",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateArticle = useMutation({
    mutationFn: async (data: Partial<InsertWikiArticle>) => {
      if (!existingArticle) return;
      
      const res = await apiRequest(
        "PATCH",
        `/api/wiki/${existingArticle.id}`,
        data
      );
      
      if (!res.ok) {
        throw new Error("Failed to update wiki article");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wiki`] });
      toast({ title: "Wiki article updated successfully" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to update wiki article",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertWikiArticle) => {
    if (existingArticle) {
      await updateArticle.mutateAsync(data);
    } else {
      await createArticle.mutateAsync(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingArticle ? "Edit Wiki Article" : "Create New Wiki Article"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={15}
                      placeholder="Write your article content here..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createArticle.isPending || updateArticle.isPending}
            >
              {existingArticle ? "Save Changes" : "Create Article"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
