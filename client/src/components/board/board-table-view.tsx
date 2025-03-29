
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task } from "@/types/tasks";
import { useState } from "react";
import { format } from "date-fns";
import { TaskDialog } from "./task-dialog";
import { Badge } from "../ui/badge";
import { getPriorityColor } from "@/lib/utils";

interface BoardTableViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  showArchivedTasks?: boolean;
}

export function BoardTableView({ tasks, onTaskClick, showArchivedTasks = false }: BoardTableViewProps) {
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

  // Filter tasks based on archived status
  const filteredTasks = tasks.filter(task => showArchivedTasks ? task.archived : !task.archived);

  // Sort filtered tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const aValue = a[sortField] || "";
    const bValue = b[sortField] || "";

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      setSelectedTask(task);
      setIsDialogOpen(true);
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer" 
              onClick={() => handleSort("title")}
            >
              Titel
            </TableHead>
            <TableHead 
              className="cursor-pointer" 
              onClick={() => handleSort("status")}
            >
              Status
            </TableHead>
            <TableHead 
              className="cursor-pointer" 
              onClick={() => handleSort("priority")}
            >
              Priorität
            </TableHead>
            <TableHead>Labels</TableHead>
            <TableHead 
              className="cursor-pointer" 
              onClick={() => handleSort("dueDate")}
            >
              Fällig
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => (
            <TableRow 
              key={task.id} 
              className="border-b hover:bg-muted/50 cursor-pointer" 
              onClick={() => handleTaskClick(task)}
            >
              <TableCell>{task.title}</TableCell>
              <TableCell>{task.status}</TableCell>
              <TableCell>
                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {task.labels?.map((label, index) => (
                    <Badge key={index} variant="secondary">{label}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {task.dueDate && format(new Date(task.dueDate), "dd.MM.yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!onTaskClick && (
        <TaskDialog
          task={selectedTask || undefined}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          mode="details"
        />
      )}
    </div>
  );
}
