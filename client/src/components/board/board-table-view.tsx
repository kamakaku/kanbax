import { useState } from "react";
import { Task } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BoardTableViewProps {
  tasks: Task[];
}

export function BoardTableView({ tasks }: BoardTableViewProps) {
  const [sortField, setSortField] = useState<keyof Task>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedTasks = [...tasks].sort((a, b) => {
    const aValue = a[sortField] as string;
    const bValue = b[sortField] as string;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="p-4 text-left">Titel</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Priorität</th>
            <th className="p-4 text-left">Fällig</th>
            <th className="p-4 text-left">Labels</th>
            <th className="p-4 text-left">Zugewiesen</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => (
            <tr key={task.id} className="border-b hover:bg-muted/50">
              <td className="p-4">{task.title}</td>
              <td className="p-4">
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
    </div>
  );
}