import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Comment, type InsertComment } from '@shared/schema';
import { RichTextEditor, RichTextContent } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

interface CommentSectionProps {
  taskId: number;
}

export function CommentSection({ taskId }: CommentSectionProps) {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/tasks', taskId, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) {
        throw new Error('Failed to fetch comments');
      }
      return res.json();
    },
  });

  const createComment = useMutation({
    mutationFn: async (comment: InsertComment) => {
      const res = await apiRequest(
        'POST',
        `/api/tasks/${taskId}/comments`,
        comment
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      setContent('');
      toast({ title: 'Comment added successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !authorName.trim()) {
      toast({
        title: 'Invalid comment',
        description: 'Please provide both content and your name',
        variant: 'destructive',
      });
      return;
    }

    createComment.mutate({
      content,
      authorName,
      taskId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{comment.authorName}</span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(comment.createdAt), 'PPp')}
              </span>
            </div>
            <RichTextContent content={comment.content} />
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="Your name"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="mb-4"
        />
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Write a comment..."
        />
        <Button type="submit" className="w-full">
          Add Comment
        </Button>
      </form>
    </div>
  );
}
