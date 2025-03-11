import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Task } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "wouter";
import { Search } from "lucide-react";

export default function AllTasks() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return res.json();
    },
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tasks, searchTerm]);

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return "bg-gray-100 text-gray-800";
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">All Tasks</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTasks && filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => navigate(`/boards/${task.boardId}`)}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">{task.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  {task.priority && (
                    <Badge variant="outline" className={`${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  )}
                  {task.labels && task.labels.map((label, idx) => (
                    <Badge key={idx} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                  <Badge variant="outline">
                    Status: {task.status}
                  </Badge>
                </div>
                <div className="mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/boards/${task.boardId}`);
                    }}
                  >
                    View Board
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center p-8">
            <p className="text-lg text-muted-foreground">No tasks found</p>
          </div>
        )}
      </div>
    </div>
  );
}