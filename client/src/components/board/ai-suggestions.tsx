import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { insertTaskSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function AISuggestions() {
  const { currentBoard } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const generateSuggestions = async () => {
    if (!currentBoard) return;
    
    setIsGenerating(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/suggest-tasks`
      );
      
      if (!res.ok) {
        throw new Error("Failed to generate suggestions");
      }
      
      const data = await res.json();
      setSuggestions(data.suggestions);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate task suggestions",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const createTask = useMutation({
    mutationFn: async (title: string) => {
      if (!currentBoard) return;
      
      const taskData = {
        title,
        description: "",
        status: "todo",
        order: 0,
        boardId: currentBoard.id,
        columnId: 1, // Default to first column
        priority: "medium",
        labels: [],
      };

      const result = insertTaskSchema.safeParse(taskData);
      if (!result.success) {
        throw new Error("Invalid task data");
      }

      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/tasks`,
        result.data
      );
      
      if (!res.ok) {
        throw new Error("Failed to create task");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Task created successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Task Suggestions
        </CardTitle>
        <CardDescription>
          Get AI-powered suggestions for new tasks based on your current board
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={generateSuggestions}
            disabled={isGenerating || !currentBoard}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating suggestions...
              </>
            ) : (
              "Generate Suggestions"
            )}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <p className="text-sm">{suggestion}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => createTask.mutate(suggestion)}
                    disabled={createTask.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
