import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type WikiArticle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { WikiArticleForm } from "./wiki-article-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WikiListProps {
  projectId: number;
}

export function WikiList({ projectId }: WikiListProps) {
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: articles, isLoading } = useQuery<WikiArticle[]>({
    queryKey: [`/api/projects/${projectId}/wiki`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/wiki`);
      if (!res.ok) {
        throw new Error("Failed to fetch wiki articles");
      }
      return res.json();
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (articleId: number) => {
      const res = await apiRequest("DELETE", `/api/wiki/${articleId}`);
      if (!res.ok) {
        throw new Error("Failed to delete wiki article");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wiki`] });
      toast({ title: "Wiki article deleted successfully" });
      setShowDeleteDialog(false);
      setSelectedArticle(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete wiki article",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (article: WikiArticle) => {
    setSelectedArticle(article);
    setShowForm(true);
  };

  const handleDelete = (article: WikiArticle) => {
    setSelectedArticle(article);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedArticle) {
      deleteArticle.mutate(selectedArticle.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-lg text-muted-foreground">Loading wiki articles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Wiki Articles</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Article
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles?.map((article) => (
          <Card key={article.id}>
            <CardHeader>
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Last updated: {new Date(article.updatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {article.content}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(article)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(article)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <WikiArticleForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setSelectedArticle(null);
        }}
        projectId={projectId}
        existingArticle={selectedArticle || undefined}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the wiki
              article.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
