import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { DragDropContext } from 'react-beautiful-dnd';
import { Column } from '../components/board/column';
import { BoardTableView } from '../components/board/board-table-view';
import { Task } from '../../shared/schema';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';

export const Board = () => {
  const { boardId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <Button onClick={() => setViewMode(viewMode === 'kanban' ? 'table' : 'kanban')}>
            {viewMode === 'kanban' ? 'Zur Tabellenansicht' : 'Zur Kanban-Ansicht'}
          </Button>
          <div className="flex items-center space-x-2">
            <Switch
              checked={showArchivedTasks}
              onCheckedChange={setShowArchivedTasks}
            />
            <span>Archivierte Tasks anzeigen</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={() => {}}>
            <div className="flex gap-4 p-4 h-full">
              <Column status="backlog" tasks={tasks} />
              <Column status="todo" tasks={tasks} />
              <Column status="in-progress" tasks={tasks} />
              <Column status="review" tasks={tasks} />
              <Column status="done" tasks={tasks} />
            </div>
          </DragDropContext>
        ) : (
          <div className="px-4">
            <BoardTableView 
              tasks={tasks}
              showArchivedTasks={showArchivedTasks}
              searchQuery={searchQuery}
              selectedLabels={selectedLabels}
              selectedPriorities={selectedPriorities}
              selectedDate={selectedDate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Board;