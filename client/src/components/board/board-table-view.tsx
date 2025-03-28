import { useState } from "react";
import { Task } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/board/task-dialog";

interface BoardTableViewProps {
  tasks: Task[];
}

export function BoardTableView({ tasks }: BoardTableViewProps) {
  const [sortField, setSortField] = useState<keyof Task>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSort = (field: keyof Task) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="p-4">
              <Button variant="ghost" onClick={() => handleSort("title")} className="text-left w-full">
                Titel {sortField === "title" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </th>
            <th className="p-4">
              <Button variant="ghost" onClick={() => handleSort("status")} className="text-left w-full">
                Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </th>
            <th className="p-4">
              <Button variant="ghost" onClick={() => handleSort("priority")} className="text-left w-full">
                Priorität {sortField === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </th>
            <th className="p-4">
              <Button variant="ghost" onClick={() => handleSort("dueDate")} className="text-left w-full">
                Fällig {sortField === "dueDate" && (sortDirection === "asc" ? "↑" : "↓")}
              </Button>
            </th>
            <th className="p-4 text-left">Labels</th>
            <th className="p-4 text-left">Zugewiesen</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => (
            <tr 
              key={task.id} 
              className="border-b hover:bg-muted/50 cursor-pointer" 
              onClick={() => handleTaskClick(task)}
            >
              <td className="p-4">{task.title}</td>
              <td className="p-4 w-48"> {/* Added w-48 class here */}
                <Badge>{task.status}</Badge>
              </td>
              <td className="p-4">
                <Badge variant={task.priority === "high" ? "destructive" : "secondary"}>
                  {task.priority}
                </Badge>
              </td>
              <td className="p-4">
                {task.dueDate && format(new Date(task.dueDate), "dd.MM.yyyy")}
              </td>
              <td className="p-4">
                <div className="flex gap-1 flex-wrap">
                  {task.labels?.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="p-4">
                <div className="flex -space-x-2">
                  {task.assignedUsers?.map((user) => (
                    <Avatar key={user.id} className="h-8 w-8 border-2 border-background">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          mode="details"
        />
      )}
    </div>
  );
}