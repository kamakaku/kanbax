
import React from 'react';
import { Task } from '../../../shared/schema';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

interface BoardTableViewProps {
  tasks: Task[];
  showArchivedTasks: boolean;
  searchQuery: string;
  selectedLabels: string[];
  selectedPriorities: string[];
  selectedDate: Date | undefined;
}

export const BoardTableView: React.FC<BoardTableViewProps> = ({
  tasks,
  showArchivedTasks,
  searchQuery,
  selectedLabels,
  selectedPriorities,
  selectedDate
}) => {
  const filteredTasks = tasks.filter(task => {
    if (!showArchivedTasks && task.isArchived) return false;
    return true;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priorität</TableHead>
          <TableHead>Labels</TableHead>
          <TableHead>Fällig am</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredTasks.map(task => (
          <TableRow key={task.id}>
            <TableCell>{task.title}</TableCell>
            <TableCell>{task.status}</TableCell>
            <TableCell>{task.priority}</TableCell>
            <TableCell>{task.labels?.join(', ')}</TableCell>
            <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
