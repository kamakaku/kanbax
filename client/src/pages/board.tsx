import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { DragDropContext } from 'react-beautiful-dnd';
import { Column } from '../components/board/column';
import { BoardTableView } from '../components/board/board-table-view';
import { Task } from '../../shared/schema';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';

export default function Board() {
  const { boardId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  // Task loading logic here...

  const handleDragEnd = (result: any) => {
    // Drag and drop logic here...
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 bg-white/50 backdrop-blur-sm border-b">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              onClick={() => setViewMode('kanban')}
              size="sm"
            >
              Kanban
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              onClick={() => setViewMode('table')}
              size="sm"
            >
              Tabelle
            </Button>
          </div>
          <Switch
            id="show-archived"
            checked={showArchivedTasks}
            onCheckedChange={setShowArchivedTasks}
          />
        </div>
      </div>

      <div className="flex-1">
        {viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 pb-4">
              <Column
                title="Backlog"
                tasks={tasks.filter(task => task.status === 'backlog')}
                status="backlog"
              />
              <Column
                title="To Do"
                tasks={tasks.filter(task => task.status === 'todo')}
                status="todo"
              />
              <Column
                title="In Progress"
                tasks={tasks.filter(task => task.status === 'in-progress')}
                status="in-progress"
              />
              <Column
                title="Review"
                tasks={tasks.filter(task => task.status === 'review')}
                status="review"
              />
              <Column
                title="Done"
                tasks={tasks.filter(task => task.status === 'done')}
                status="done"
              />
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
}