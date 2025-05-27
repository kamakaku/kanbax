
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

  // Tasks are already filtered by archived status from the parent component

  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
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
    <div className="border rounded-lg text-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer text-xs font-medium" 
              onClick={() => handleSort("title")}
            >
              Titel
            </TableHead>
            <TableHead 
              className="cursor-pointer text-xs font-medium" 
              onClick={() => handleSort("status")}
            >
              Status
            </TableHead>
            <TableHead 
              className="cursor-pointer text-xs font-medium" 
              onClick={() => handleSort("priority")}
            >
              Priorität
            </TableHead>
            <TableHead className="text-xs font-medium">Labels</TableHead>
            <TableHead 
              className="cursor-pointer text-xs font-medium" 
              onClick={() => handleSort("dueDate")}
            >
              Fällig
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {sortedTasks.map((task) => (
            <TableRow 
              key={task.id} 
              className="border-b hover:bg-muted/50 cursor-pointer" 
              onClick={() => handleTaskClick(task)}
            >
              <TableCell className="py-2">{task.title}</TableCell>
              <TableCell className="py-2">{task.status}</TableCell>
              <TableCell className="py-2">
                <Badge variant="outline" className={`${getPriorityColor(task.priority)} text-xs py-0 px-2`}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="py-2">
                <div className="flex gap-1 flex-wrap">
                  {task.labels?.map((label, index) => (
                    <Badge key={index} variant="secondary" className="text-xs py-0 px-1.5">{label}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2 text-xs">
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
