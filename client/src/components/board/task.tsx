export function Task({ task, index, showBoardTitle, onClick }: TaskProps) {
  return (
    <div className="task" onClick={onClick}>
      {showBoardTitle && (
        <div className="task-title">{task.board.title}</div>
      )}
      <div className="task-content">{task.content}</div>
    </div>
  );
}