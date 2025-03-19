import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type Column, type Task, type InsertBoard, type Team, type User } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Pencil, Star, Users, Building2, Calendar } from "lucide-react";
import { BoardForm } from "@/components/board/board-form";
import { Badge } from "@/components/ui/badge";

// Define the default columns for the Kanban board
const defaultColumns = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" }
];

export function Board() {
  const { id } = useParams<{ id: string }>();
  const boardId = parseInt(id);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard, setCurrentBoard } = useStore();
  const [showEditForm, setShowEditForm] = useState(false);

  // Fetch board data
  const { data: board, isLoading: isBoardLoading, error: boardError } = useQuery<Board>({
    queryKey: ["/api/boards", boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Boards");
      }
      return response.json();
    },
  });

  // Fetch teams data
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

  // Fetch users data
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

  // Get team and user names
  const getTeamAndUserInfo = () => {
    if (!board) return { teams: [], users: [] };

    const boardTeams = teams.filter(team => board.team_ids?.includes(team.id));
    const boardUsers = users.filter(user => board.assigned_user_ids?.includes(user.id));

    return { teams: boardTeams, users: boardUsers };
  };

  useEffect(() => {
    if (board) {
      setCurrentBoard(board);
    }
  }, [board, setCurrentBoard]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/boards", boardId, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/tasks`);
      if (!res.ok) {
        throw new Error("Fehler beim Laden der Tasks");
      }
      return res.json();
    },
  });

  const updateBoard = useMutation({
    mutationFn: async (data: InsertBoard) => {
      if (!boardId) return null;
      return await apiRequest("PATCH", `/api/boards/${boardId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      toast({ title: "Board erfolgreich aktualisiert" });
      setShowEditForm(false);
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!boardId) return null;
      return await apiRequest('PATCH', `/api/boards/${boardId}/favorite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      toast({ title: "Favoriten-Status aktualisiert" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task) => {
      return await apiRequest<Task>("PATCH", `/api/tasks/${updatedTask.id}`, updatedTask);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", boardId, "tasks"],
      });
      toast({ title: "Task erfolgreich aktualisiert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const taskId = parseInt(draggableId);
    const draggedTask = tasks.find(t => t.id === taskId);

    if (!draggedTask) {
      console.error("Task nicht gefunden:", taskId);
      return;
    }

    try {
      const updatedTasks = [...tasks];
      const sourceIndex = updatedTasks.findIndex(t => t.id === taskId);
      const [movedTask] = updatedTasks.splice(sourceIndex, 1);

      const insertIndex = destination.index;
      updatedTasks.splice(insertIndex, 0, {
        ...movedTask,
        status: destination.droppableId,
        order: destination.index,
      });

      const columnTasks = updatedTasks.filter(t => t.status === destination.droppableId);
      columnTasks.forEach((task, index) => {
        task.order = index;
      });

      queryClient.setQueryData(["/api/boards", boardId, "tasks"], updatedTasks);

      await updateTask.mutateAsync({
        ...draggedTask,
        status: destination.droppableId,
        order: destination.index,
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", boardId, "tasks"],
      });
      toast({
        title: "Fehler beim Verschieben",
        description: "Bitte versuchen Sie es erneut",
        variant: "destructive",
      });
    }
  };

  if (isBoardLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (boardError || !board) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">
          Fehler: {boardError?.message || "Board nicht gefunden"}
        </p>
      </div>
    );
  }

  const { teams: boardTeams, users: boardUsers } = getTeamAndUserInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/90">
      <div className="absolute inset-0 bg-[radial-gradient(at_80%_0%,rgb(24,29,40)_0px,transparent_50%),radial-gradient(at_0%_50%,rgb(26,32,44)_0px,transparent_50%)] pointer-events-none" />

      <div className="relative p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-start gap-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {board?.title}
              </h1>
              {board?.project && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Projekt: {board.project.title}
                </p>
              )}

              <div className="flex gap-4 mt-4">
                {/* Teams Section */}
                {boardTeams.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {boardTeams.map((team) => (
                        <Badge key={team.id} variant="outline" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {team.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users Section */}
                {boardUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {boardUsers.map((user) => (
                        <Badge key={user.id} variant="outline" className="bg-secondary/10 text-secondary hover:bg-secondary/20">
                          {user.username}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleFavorite.mutate()}
                className="hover:bg-yellow-100/10"
              >
                <Star
                  className={`h-5 w-5 ${board?.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEditForm(true)}
                className="hover:bg-muted/10"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <BoardSelector />
        </div>

        <div className="flex-1 overflow-x-auto relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-lg -z-10" />
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 pb-4">
              {defaultColumns.map((column) => {
                const columnTasks = tasks
                  .filter(task => task.status === column.id)
                  .sort((a, b) => a.order - b.order);

                return (
                  <ColumnComponent
                    key={column.id}
                    column={column}
                    tasks={columnTasks}
                    onUpdate={updateTask.mutate}
                  />
                );
              })}
            </div>
          </DragDropContext>
        </div>

        <BoardForm
          open={showEditForm}
          onClose={() => setShowEditForm(false)}
          defaultValues={{
            ...board,
            team_ids: board?.team_ids || [],
          }}
          onSubmit={async (data) => {
            await updateBoard.mutateAsync(data);
          }}
        />
      </div>
    </div>
  );
}

export default Board;