import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from "./button";
import { Upload, Image, Link, Bold, Italic, List, ListOrdered } from "lucide-react";
import { useState, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onAttachmentUpload?: (attachments: string[]) => void;
  placeholder?: string;
  editable?: boolean;
  attachments?: string[];
  uploadType?: 'task' | 'objective' | 'keyResult' | 'comment';
  entityId?: number;
}

export function RichTextEditor({ 
  content = '', 
  onChange, 
  onAttachmentUpload,
  placeholder = 'Write something...', 
  editable = true,
  attachments = [],
  uploadType = 'task',
  entityId
}: RichTextEditorProps) {
  const [files, setFiles] = useState<string[]>(attachments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('type', uploadType);
    if (entityId) {
      formData.append('entityId', entityId.toString());
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const filePath = data.filePath;
        
        setFiles(prevFiles => {
          const newFiles = [...prevFiles, filePath];
          if (onAttachmentUpload) {
            onAttachmentUpload(newFiles);
          }
          return newFiles;
        });
      } else {
        console.error('Fehler beim Datei-Upload');
      }
    } catch (error) {
      console.error('Fehler beim Datei-Upload', error);
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLinkClick = () => {
    const url = window.prompt('URL eingeben:');
    if (url && editor) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div className="border rounded-md overflow-hidden flex flex-col">
      {editable && (
        <div className="flex items-center border-b p-2 gap-1 bg-muted/50">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`h-8 w-8 ${editor?.isActive('bold') ? 'bg-muted' : ''}`}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`h-8 w-8 ${editor?.isActive('italic') ? 'bg-muted' : ''}`}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`h-8 w-8 ${editor?.isActive('bulletList') ? 'bg-muted' : ''}`}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`h-8 w-8 ${editor?.isActive('orderedList') ? 'bg-muted' : ''}`}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={handleLinkClick}
            className={`h-8 w-8 ${editor?.isActive('link') ? 'bg-muted' : ''}`}
          >
            <Link className="h-4 w-4" />
          </Button>
          <div className="ml-auto">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={handleFileClick}
              className="h-8 flex items-center gap-1"
            >
              <Upload className="h-4 w-4" />
              <span className="text-xs">Upload</span>
            </Button>
            <input 
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[100px] focus:outline-none"
      />
      {files.length > 0 && (
        <div className="border-t p-2">
          <div className="text-xs font-medium mb-2">Anhänge ({files.length})</div>
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <AttachmentThumbnail key={index} file={file} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentThumbnail({ file }: { file: string }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const fileName = file.split('/').pop() || 'Datei';
  
  if (isImage) {
    return (
      <a href={file} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative w-20 h-20 border rounded overflow-hidden group">
          <img src={file} alt={fileName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Image className="w-5 h-5 text-white" />
          </div>
        </div>
      </a>
    );
  }
  
  return (
    <a 
      href={file} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block border rounded p-2 text-xs text-center w-20 h-20 flex flex-col items-center justify-center hover:bg-muted transition-colors"
    >
      <div className="text-muted-foreground mb-1">
        <Upload className="w-5 h-5 mx-auto" />
      </div>
      <div className="truncate w-full">{fileName}</div>
    </a>
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
