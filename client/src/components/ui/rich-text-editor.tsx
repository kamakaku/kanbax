import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichTextEditor({ 
  content = '', 
  onChange, 
  placeholder = 'Write something...', 
  editable = true 
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  return (
    <div className="border rounded-md overflow-hidden">
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[100px] focus:outline-none"
      />
    </div>
  );
}

export function RichTextContent({ content }: { content: string }) {
  return (
    <div 
      className="prose prose-sm max-w-none" 
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
}
