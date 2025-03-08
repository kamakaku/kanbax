import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ChecklistItem, type InsertChecklistItem } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus } from 'lucide-react';

interface ChecklistSectionProps {
  taskId: number;
}

export function ChecklistSection({ taskId }: ChecklistSectionProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['/api/tasks', taskId, 'checklist'],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`);
      if (!res.ok) {
        throw new Error('Failed to fetch checklist items');
      }
      return res.json();
    },
  });

  const createItem = useMutation({
    mutationFn: async (item: InsertChecklistItem) => {
      const res = await apiRequest(
        'POST',
        `/api/tasks/${taskId}/checklist`,
        item
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'checklist'] });
      setNewItemTitle('');
      toast({ title: 'Checklist item added' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add checklist item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ChecklistItem> & { id: number }) => {
      const res = await apiRequest('PATCH', `/api/checklist/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'checklist'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update checklist item',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const maxOrder = items.reduce((max, item) => Math.max(max, item.itemOrder), -1);

    createItem.mutate({
      taskId,
      title: newItemTitle.trim(),
      completed: false,
      itemOrder: maxOrder + 1,
    });
  };

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const percentage = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Checklist</h3>
        <span className="text-sm text-muted-foreground">
          {percentage}% complete
        </span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox
              checked={item.completed}
              onCheckedChange={(checked) =>
                updateItem.mutate({ id: item.id, completed: checked as boolean })
              }
            />
            <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
              {item.title}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Add an item"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
        />
        <Button type="submit" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}