
import { useState } from 'react';
import { Task } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface BoardTableViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function BoardTableView({ tasks, onTaskClick }: BoardTableViewProps) {
  const [sortField, setSortField] = useState<keyof Task>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedTasks = [...tasks].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof Task) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onClick={() => handleSort('title')} className="cursor-pointer">
              Titel {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead onClick={() => handleSort('status')} className="cursor-pointer">
              Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead onClick={() => handleSort('priority')} className="cursor-pointer">
              Priorität {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead>Labels</TableHead>
            <TableHead onClick={() => handleSort('due_date')} className="cursor-pointer">
              Fällig am {sortField === 'due_date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => (
            <TableRow 
              key={task.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onTaskClick(task)}
            >
              <TableCell>{task.title}</TableCell>
              <TableCell>
                <div className={cn(
                  "px-2 py-1 rounded-full text-xs inline-block",
                  task.status === 'todo' && "bg-blue-100 text-blue-800",
                  task.status === 'in-progress' && "bg-amber-100 text-amber-800",
                  task.status === 'done' && "bg-green-100 text-green-800",
                  task.status === 'review' && "bg-purple-100 text-purple-800"
                )}>
                  {task.status}
                </div>
              </TableCell>
              <TableCell>
                <div className={cn(
                  "px-2 py-1 rounded-full text-xs inline-block",
                  task.priority === 'high' && "bg-red-100 text-red-800",
                  task.priority === 'medium' && "bg-yellow-100 text-yellow-800",
                  task.priority === 'low' && "bg-green-100 text-green-800"
                )}>
                  {task.priority}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {task.labels?.map((label, index) => (
                    <span key={index} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {label}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
