import { useState } from "react";
import { Task, Board, Project } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { LayoutGrid, LayoutList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Column } from "@/components/board/column";
import { TaskDialog } from "@/components/board/task-dialog";
import { DragDropContext, DropResult } from "react-beautiful-dnd";

interface TaskWithDetails extends Task {
  boardTitle: string;
  projectTitle: string;
  projectId: number;
}

export default function AllTasks() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
  });

  const boardQueries = useQuery({
    queryKey: ["all-boards", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return [];

      const allBoards = await Promise.all(
        projects.map(async (project) => {
          const res = await fetch(`/api/projects/${project.id}/boards`);
          if (!res.ok) return [];
          const boards = await res.json();
          return boards.map((board: Board) => ({
            ...board,
            projectTitle: project.title,
            projectId: project.id
          }));
        })
      );

      return allBoards.flat();
    },
    enabled: !!projects
  });

  const taskQueries = useQuery({
    queryKey: ["all-tasks", boardQueries.data?.map(b => b.id)],
    queryFn: async () => {
      if (!boardQueries.data) return [];

      const allTasks = await Promise.all(
        boardQueries.data.map(async (board) => {
          const res = await fetch(`/api/boards/${board.id}/tasks`);
          if (!res.ok) return [];
          const tasks = await res.json();
          return tasks.map((task: Task) => ({
            ...task,
            boardTitle: board.title,
            projectTitle: board.projectTitle,
            projectId: board.projectId
          }));
        })
      );

      return allTasks.flat();
    },
    enabled: !!boardQueries.data
  });

  const handleTaskUpdate = async () => {
    console.log("Task update callback triggered");

    // Invalidate and refetch queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
      queryClient.refetchQueries({ queryKey: ["all-tasks"] }),
      ...(boardQueries.data?.map(board =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: [`/api/boards/${board.id}/tasks`]
          }),
          queryClient.refetchQueries({
            queryKey: [`/api/boards/${board.id}/tasks`]
          })
        ])
      ) || [])
    ]);

    setSelectedTask(null);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.type !== "task") return;

    const { source, destination, draggableId } = result;
    const task = allTasks.find(t => t.id.toString() === draggableId);

    if (!task) return;

    try {
      console.log("Updating task status:", {
        taskId: task.id,
        boardId: task.boardId,
        newStatus: destination.droppableId
      });

      const res = await fetch(`/api/boards/${task.boardId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: destination.droppableId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to update task status:", errorData);
        throw new Error('Failed to update task status');
      }

      const updatedTask = await res.json();
      console.log("Task successfully updated:", updatedTask);

      // Aktualisiere die Queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.refetchQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({
          queryKey: [`/api/boards/${task.boardId}/tasks`]
        }),
        queryClient.refetchQueries({
          queryKey: [`/api/boards/${task.boardId}/tasks`]
        })
      ]);

      toast({
        title: "Status aktualisiert",
        description: "Der Task-Status wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Fehler",
        description: "Der Task-Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  if (projectsLoading || boardQueries.isLoading || taskQueries.isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Aufgaben...</p>
        </div>
      </div>
    );
  }

  const allTasks = taskQueries.data || [];

  // Filtern der Tasks basierend auf der Suche
  const filteredTasks = allTasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.title.toLowerCase().includes(searchLower) ||
      (task.description || "").toLowerCase().includes(searchLower) ||
      (task.boardTitle || "").toLowerCase().includes(searchLower) ||
      (task.projectTitle || "").toLowerCase().includes(searchLower)
    );
  });

  // Gruppieren der Tasks nach Status
  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const status = task.status || 'todo';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(task);
    return acc;
  }, {} as Record<string, TaskWithDetails[]>);

  // Erstellen der Columns aus gruppierten Tasks
  const columns = Object.entries(groupedTasks).map(([status, tasks]) => ({
    id: status,
    title: status.charAt(0).toUpperCase() + status.slice(1).replace("-", " "),
    tasks
  }));

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle Aufgaben
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller Aufgaben aus allen Boards</p>
        </div>
      </div>

      <div className="max-w-sm mb-6">
        <Label htmlFor="search">Suche</Label>
        <Input
          id="search"
          placeholder="Nach Aufgaben, Boards oder Projekten suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="kanban" className="mt-6">
        <TabsList>
          <TabsTrigger value="kanban">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list">
            <LayoutList className="h-4 w-4 mr-2" />
            Liste
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kanban">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {columns.map(column => (
                <Column
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  tasks={column.tasks}
                  isAllTasksView={true}
                />
              ))}
            </div>
          </DragDropContext>
        </TabsContent>
        <TabsContent value="list">
          <div>Liste Ansicht (noch nicht implementiert)</div>
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskDialog
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onUpdate={handleTaskUpdate}
          projects={projects || []}
          boards={boardQueries.data || []}
        />
      )}
    </div>
  );
}