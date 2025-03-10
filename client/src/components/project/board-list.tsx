import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type InsertBoard, insertBoardSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useStore } from "@/lib/store";

interface BoardListProps {
  projectId: number;
}

export function BoardList({ projectId }: BoardListProps) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { setCurrentBoard } = useStore();

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: projectId,
    },
  });

  const { data: boards, isLoading } = useQuery<Board[]>({
    queryKey: [`/api/projects/${projectId}/boards`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  const createBoard = useMutation({
    mutationFn: async (data: InsertBoard) => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/boards`,
        data
      );

      if (!res.ok) {
        throw new Error("Failed to create board");
      }

      return res.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/boards`],
      });
      setCurrentBoard(newBoard);
      setLocation("/board");
      toast({ title: "Board erfolgreich erstellt" });
      setShowForm(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen des Boards",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertBoard) => {
    createBoard.mutate({ ...data, projectId });
  };

  const handleBoardClick = (board: Board) => {
    setCurrentBoard(board);
    setLocation("/board");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-lg text-muted-foreground">Lade Boards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Boards</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Board
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {boards?.map((board) => (
          <Card
            key={board.id}
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => handleBoardClick(board)}
          >
            <CardHeader>
              <CardTitle>{board.title}</CardTitle>
              <CardDescription>{board.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Board erstellen</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input placeholder="Mein neues Board" {...field} />
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Board erstellen
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}