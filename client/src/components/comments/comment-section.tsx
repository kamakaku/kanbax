import { useAuth } from '@/lib/auth-store';
import { CommentList } from './comment-list';
import { CommentEditor } from './comment-editor';

interface CommentSectionProps {
  taskId: number;
}

export function CommentSection({ taskId }: CommentSectionProps) {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <CommentList taskId={taskId} />
      </div>

      {user && (
        <div className="space-y-4">
          <CommentEditor 
            taskId={taskId}
            onCommentAdded={() => {
              // Refresh wird durch die Komponente selbst gehandhabt
            }}
          />
        </div>
      )}
    </div>
  );
}
