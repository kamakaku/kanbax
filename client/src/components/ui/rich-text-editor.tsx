import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import { Button } from "./button";
import {
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Paintbrush,
  X
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent } from "./dialog";

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
      StarterKit.configure({
        bold: {
          HTMLAttributes: {
            class: 'font-bold text-inherit'
          }
        },
        code: {
          HTMLAttributes: {
            class: 'font-mono bg-transparent p-0 text-inherit'
          }
        }
      }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Underline,
      Strike,
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full rounded-md',
        },
      }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-blue-500 underline',
        },
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
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const formData = new FormData();
    formData.append('file', uploadedFiles[0]);
    formData.append('type', uploadType);
    if (entityId) {
      formData.append('entityId', entityId.toString());
    }

    console.log(`Datei wird hochgeladen für ${uploadType} mit ID ${entityId}`, { 
      fileName: uploadedFiles[0].name,
      fileSize: uploadedFiles[0].size,
      fileType: uploadedFiles[0].type
    });

    try {
      // Verwende die apiRequest-Funktion mit credentials und korrektem Content-Type
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      let errorMessage = 'Fehler beim Hochladen der Datei';

      try {
        if (response.ok) {
          try {
            const data = await response.json();
            console.log('Server-Antwort beim Datei-Upload:', data);

            // Der Server gibt die URL in der Eigenschaft 'url' zurück
            const fileUrl = data.url;

            if (fileUrl) {
              console.log('Datei erfolgreich hochgeladen:', fileUrl);

              setFiles(prevFiles => {
                const newFiles = [...prevFiles, fileUrl];
                if (onAttachmentUpload) {
                  onAttachmentUpload(newFiles);
                }
                return newFiles;
              });

              // Datei-URL in den Editor einfügen, wenn es ein Bild ist
              if (editor && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl)) {
                editor.chain().focus().setImage({ src: fileUrl }).run();
              } else if (editor) {
                // Für andere Dateitypen einen Link einfügen
                const fileName = data.originalname || 'Anhang';
                editor.chain().focus()
                  .insertContent(`<a href="${fileUrl}" target="_blank">${fileName}</a>`)
                  .run();
              }
            } else {
              console.error('Fehler beim Datei-Upload: Keine URL in der Antwort');
              throw new Error('Keine URL in der Antwort');
            }
          } catch (jsonError) {
            console.error('Fehler beim Parsen der JSON-Antwort:', jsonError);
            const errorText = await response.text();
            console.error('Server-Antwort:', errorText);
            throw new Error('Ungültiges Antwortformat vom Server');
          }
        } else {
          // Versuche die Fehlermeldung als JSON zu lesen
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (jsonError) {
            // Wenn es kein gültiges JSON ist, verwende den Text
            const errorText = await response.text();
            console.error('Fehler beim Datei-Upload. Server-Antwort:', errorText);
            if (errorText.includes('<!DOCTYPE html>')) {
              errorMessage = 'Authentifizierungsfehler oder Serverprobleme beim Upload';
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
          throw new Error(errorMessage);
        }
      } catch (respError) {
        console.error('Upload-Fehler:', respError);
        // Hier können Sie eine Toast-Benachrichtigung oder UI-Rückmeldung hinzufügen
      }
    } catch (error) {
      console.error('Fehler beim Datei-Upload:', error);
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLinkClick = () => {
    const url = window.prompt('URL eingeben:');
    if (url && editor) {
      // Setze den Link beim selektierten Text oder füge einen neuen Link ein
      if (editor.view.state.selection.empty) {
        // Wenn kein Text ausgewählt ist, füge den Link als Text ein
        editor.chain().focus().insertContent(`<a href="${url}" target="_blank">${url}</a>`).run();
      } else {
        // Wenn Text ausgewählt ist
        if (editor.isActive('link')) {
          // Wenn bereits ein Link aktiv ist, entferne ihn
          editor.commands.unsetLink();
        }
        // Füge den Link hinzu (mit der API der Link-Extension)
        editor.commands.setLink({ href: url, target: '_blank' });
      }
    }
  };

  // Textfarbe-Funktionalität
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  // Liste der verfügbaren Farben
  const colors = [
    { name: 'Schwarz', value: '#000000' },
    { name: 'Dunkelgrau', value: '#555555' },
    { name: 'Rot', value: '#ff0000' },
    { name: 'Dunkelrot', value: '#990000' },
    { name: 'Orange', value: '#ff9900' },
    { name: 'Gelb', value: '#ffff00' },
    { name: 'Grün', value: '#00ff00' },
    { name: 'Dunkelgrün', value: '#006600' },
    { name: 'Blau', value: '#0000ff' },
    { name: 'Dunkelblau', value: '#000099' },
    { name: 'Lila', value: '#9900ff' },
    { name: 'Pink', value: '#ff00ff' },
  ];

  const handleColorClick = (event: React.MouseEvent) => {
    // Positioniere den Farbpicker relativ zum Button
    const rect = event.currentTarget.getBoundingClientRect();
    setColorPickerPosition({
      x: rect.left,
      y: rect.bottom + window.scrollY,
    });
    setShowColorPicker(!showColorPicker);
  };

  const setTextColor = (color: string) => {
    if (editor) {
      editor.chain().focus().setColor(color).run();
      setShowColorPicker(false);
    }
  };

  // Füge einen Stil-Tag hinzu, um sicherzustellen, dass Code-Blöcke korrekt dargestellt werden
  // und der Editor keine ungewollte Fokus-Umrandung hat
  const customStyles = `
    /* Code-Block Styling */
    .ProseMirror pre, .ProseMirror code,
    .prose pre, .prose code,
    .prose-sm pre, .prose-sm code,
    div[contenteditable="true"] pre, div[contenteditable="true"] code {
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      white-space: pre-wrap !important;
    }

    /* Fokus-Umrandung entfernen */
    .ProseMirror:focus, .ProseMirror:focus-visible {
      outline: none !important;
      box-shadow: none !important;
      border-color: transparent !important;
    }

    /* Links richtig darstellen */
    .ProseMirror a, .prose a, .prose-sm a {
      color: #3b82f6 !important;
      text-decoration: underline !important;
      font-family: inherit !important;
      font-size: inherit !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Korrekte Bildanzeige */
    .ProseMirror img, .prose img, .prose-sm img {
      display: block !important;
      max-width: 100% !important;
      height: auto !important;
      margin: 0.5rem 0 !important;
    }
  `;

  return (
    <div className="border rounded-md overflow-hidden flex flex-col">
      <style>{customStyles}</style>
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
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`h-8 w-8 ${editor?.isActive('underline') ? 'bg-muted' : ''}`}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`h-8 w-8 ${editor?.isActive('strike') ? 'bg-muted' : ''}`}
          >
            <Strikethrough className="h-4 w-4" />
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
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={handleColorClick}
            className="h-8 w-8 relative"
          >
            <Paintbrush className="h-4 w-4" />
          </Button>

          {/* Farbpicker */}
          {showColorPicker && (
            <div 
              className="absolute z-50 bg-white border rounded-md shadow-lg p-2"
              style={{ 
                top: colorPickerPosition.y, 
                left: colorPickerPosition.x,
                maxWidth: '220px'
              }}
            >
              <div className="grid grid-cols-4 gap-1">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className="w-10 h-10 rounded-md border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    onClick={() => setTextColor(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

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
        className="prose prose-sm max-w-none p-4 min-h-[100px] focus:outline-none w-full [&_.ProseMirror_pre]:m-0 [&_.ProseMirror_pre]:p-0 [&_.ProseMirror_code]:m-0 [&_.ProseMirror_code]:p-0 [&_.ProseMirror_code]:bg-transparent"
        style={{ width: '100%' }}
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

export function AttachmentThumbnail({ file }: { file: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isPdf = /\.pdf$/i.test(file);
  const isDoc = /\.(doc|docx)$/i.test(file);
  const isExcel = /\.(xls|xlsx|csv)$/i.test(file);
  const isZip = /\.(zip|rar|7z|tar|gz)$/i.test(file);
  const isVideo = /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(file);
  const isAudio = /\.(mp3|wav|ogg|flac|aac)$/i.test(file);

  const fileName = file.split('/').pop() || 'Datei';

  // Sorge für eine absolute URL
  const getAbsoluteUrl = (url: string) => {
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    if (!url.startsWith('http')) {
      return window.location.origin + '/' + url;
    }
    return url;
  };

  const absoluteUrl = getAbsoluteUrl(file);

  // Generiere ein größeres Preview-Bild für Bilder
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowFullPreview(true);
  };

  // Kleiner Helfer, um ein Icon basierend auf dem Dateityp auszuwählen
  const FileTypeIcon = () => {
    if (isPdf) {
      return (
        <div className="h-12 w-full bg-red-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500">
            <path d="M7 18H17V16H7V18Z" fill="currentColor" />
            <path d="M17 14H7V12H17V14Z" fill="currentColor" />
            <path d="M7 10H11V8H7V10Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z" fill="currentColor" />
          </svg>
        </div>
      );
    } else if (isDoc) {
      return (
        <div className="h-12 w-full bg-blue-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    } else if (isExcel) {
      return (
        <div className="h-12 w-full bg-green-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-600">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 13H9V17H8V13Z" fill="currentColor"/>
            <path d="M11 13H12V17H11V13Z" fill="currentColor"/>
            <path d="M14 13H15V17H14V13Z" fill="currentColor"/>
          </svg>
        </div>
      );
    } else if (isZip) {
      return (
        <div className="h-12 w-full bg-yellow-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-yellow-600">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 13V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 13V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 13H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 17H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    } else if (isVideo) {
      return (
        <div className="h-12 w-full bg-purple-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-purple-600">
            <path d="M19.82 5H4.18C3.07989 5 2.08183 5.41458 1.35052 6.15224C0.619206 6.88991 0.21 7.89913 0.21 8.95V15.05C0.21 16.1009 0.619206 17.1101 1.35052 17.8478C2.08183 18.5854 3.07989 19 4.18 19H19.82C20.9201 19 21.9182 18.5854 22.6495 17.8478C23.3808 17.1101 23.79 16.1009 23.79 15.05V8.95C23.79 7.89913 23.3808 6.88991 22.6495 6.15224C21.9182 5.41458 20.9201 5 19.82 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 15L15 12L9 9V15Z" fill="currentColor"/>
          </svg>
        </div>
      );
    } else if (isAudio) {
      return (
        <div className="h-12 w-full bg-indigo-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-600">
            <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" fill="currentColor"/>
            <path d="M16.24 7.76C16.7979 8.31724 17.2404 8.97897 17.5424 9.70736C17.8445 10.4357 18.0004 11.2142 18.0004 12C18.0004 12.7858 17.8445 13.5643 17.5424 14.2926C17.2404 15.021 16.7979 15.6828 16.24 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.76 16.24C7.20214 15.6828 6.75959 15.021 6.45755 14.2926C6.15551 13.5643 5.99959 12.7858 5.99959 12C5.99959 11.2142 6.15551 10.4357 6.45755 9.70736C6.75959 8.97897 7.20214 8.31724 7.76 7.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.93 19.07C3.05529 17.1947 2.00214 14.6516 2.00214 12C2.00214 9.34836 3.05529 6.80528 4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    } else {
      return (
        <div className="text-muted-foreground mb-1">
          <Upload className="w-5 h-5 mx-auto" />
        </div>
      );
    }
  };

  // Bild-Thumbnails
  if (isImage) {
    return (
      <>
        <div 
          className="relative w-20 h-20 border rounded overflow-hidden group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleImageClick}
        >
          <img src={file} alt={fileName} className="w-full h-full object-cover" />
          <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-white text-xs text-center px-1">
              <ImageIcon className="w-5 h-5 mx-auto mb-1" />
              <span className="line-clamp-1">{fileName.length > 10 ? fileName.substring(0, 7) + '...' : fileName}</span>
            </div>
          </div>
        </div>

        {/* Image Viewer Modal */}
        {showFullPreview && (
          <Dialog open={showFullPreview} onOpenChange={setShowFullPreview}>
            <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
              <div className="relative bg-black/80 rounded-lg p-2 max-h-[90vh] flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFullPreview(false)}
                  className="absolute top-2 right-2 bg-black/40 text-white hover:bg-black/60 z-10"
                >
                  <X className="h-4 w-4" />
                </Button>
                <img 
                  src={absoluteUrl} 
                  alt={fileName} 
                  className="max-h-[85vh] max-w-full object-contain rounded-md"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // PDF und andere Dateitypen
  return (
    <a 
      href={absoluteUrl} 
      target="_blank" 
      rel="noopener noreferrer" 
      onClick={(e) => {
        e.preventDefault();
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
      }}
      className="relative group block border rounded w-20 h-20 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <FileTypeIcon />

        <div className="p-1 text-[10px] text-center truncate w-full font-medium text-slate-700">
          {fileName.length > 10 ? fileName.substring(0, 7) + '...' : fileName}
        </div>
      </div>

      {/* Hover-Overlay */}
      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-white text-xs text-center px-1">
          <span className="line-clamp-2">{fileName}</span>
        </div>
      </div>
    </a>
  );
}

// Hilfsfunktion zur Bereinigung von HTML-Tags in Links und Bild-Pfad-Korrektur
function cleanHtml(htmlContent: string): string {
  if (!htmlContent) return '';

  let cleanedHtml = htmlContent;

  // Fix Code-Block Styling
  cleanedHtml = cleanedHtml.replace(/<pre>/g, '<pre style="margin: 0 !important; padding: 0 !important; background: transparent !important;">');
  cleanedHtml = cleanedHtml.replace(/<code>/g, '<code style="margin: 0 !important; padding: 0 !important; background: transparent !important;">');

  // HTML-Tags in Links bereinigen - Link-Inhalte extrahieren und saubere Links erstellen
  cleanedHtml = cleanedHtml.replace(
    /<a\s+href="([^"]+)"[^>]*>(&lt;a href="[^"]+"[^>]*&gt;|<[^>]+>)?([^<]*)(<\/a>|&lt;\/a&gt;)?<\/a>/g, 
    (match, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" 
                style="color: #3b82f6 !important; text-decoration: underline !important; 
                background: transparent !important; font-family: inherit !important; 
                font-size: inherit !important;">${url}</a>`;
    }
  );

  // Standard-Link-Fix für einfache Links
  cleanedHtml = cleanedHtml.replace(
    /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g, 
    (match, url, text) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" 
                style="color: #3b82f6 !important; text-decoration: underline !important; 
                background: transparent !important; font-family: inherit !important; 
                font-size: inherit !important;">${text}</a>`;
    }
  );

  // HTML-kodierte Tags in normalen Text umwandeln
  cleanedHtml = cleanedHtml.replace(/&lt;a href="([^"]+)"[^&]*&gt;([^&]*)&lt;\/a&gt;/g, 
    (match, url, text) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" 
                style="color: #3b82f6 !important; text-decoration: underline !important; 
                background: transparent !important;">${text || url}</a>`;
    }
  );

  // Bilder mit relativen Pfaden korrigieren und klickbar machen
  cleanedHtml = cleanedHtml.replace(
    /<img\s+([^>]*)src="(uploads\/[^"]+)"([^>]*)>/g, 
    '<img $1src="/$2"$3 style="max-width: 250px !important; height: auto !important; cursor: pointer !important; border-radius: 4px !important; display: block !important;">'
  );

  cleanedHtml = cleanedHtml.replace(
    /<img\s+([^>]*)src="(\/uploads\/[^"]+)"([^>]*)>/g, 
    '<img $1src="$2"$3 style="max-width: 250px !important; height: auto !important; cursor: pointer !important; border-radius: 4px !important; display: block !important;">'
  );

  // Alle verbleibenden Bilder generell in ihrer Größe beschränken
  cleanedHtml = cleanedHtml.replace(
    /<img\s+([^>]*)>/g, 
    (match, attributes) => {
      // Nur ersetzen, wenn noch kein style mit max-width vorhanden ist
      if (!attributes.includes('max-width')) {
        return `<img ${attributes} style="max-width: 250px !important; height: auto !important; cursor: pointer !important; border-radius: 4px !important; display: block !important;">`;
      }
      return match;
    }
  );

  // Selbständige href-Pfade korrigieren
  cleanedHtml = cleanedHtml.replace(/href="uploads\//g, 'href="/uploads/');
  cleanedHtml = cleanedHtml.replace(/href="\/uploads\//g, 'href="/uploads/');

  // Direkte Öffnung für PDF-Links hinzufügen
  cleanedHtml = cleanedHtml.replace(
    /<a([^>]*)href="([^"]*\.pdf)"([^>]*)>/g,
    (match, before, pdfUrl, after) => {
      // Stelle sicher, dass die URL absolut ist
      let fullPdfUrl = pdfUrl;
      if (fullPdfUrl.startsWith('/')) {
        fullPdfUrl = window.location.origin + fullPdfUrl;
      } else if (!fullPdfUrl.startsWith('http')) {
        fullPdfUrl = window.location.origin + '/' + fullPdfUrl;
      }

      return `<a${before}href="${pdfUrl}"${after} onclick="event.preventDefault(); window.open('${fullPdfUrl}', '_blank', 'noopener,noreferrer');">`;
    }
  );

  return cleanedHtml;
}

// Bild-Viewer Modal Komponente
function ImageViewerModal({ 
  isOpen, 
  onClose, 
  imageSrc 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  imageSrc: string;
}) {
  // Füge einen Event-Handler hinzu, um das Bild bei Escape-Taste zu schließen
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none">
        <div className="relative bg-black/80 rounded-lg p-2 max-h-[90vh] flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/40 text-white hover:bg-black/60 z-10"
          >
            <X className="h-4 w-4" />
          </Button>
          <img 
            src={imageSrc} 
            alt="Vergrößerte Ansicht" 
            className="max-h-[85vh] max-w-full object-contain rounded-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RichTextContent({ content }: { content: string }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Verarbeite den Inhalt, aber benutze eine spezielle Version für die Image-Klick-Handler
  const processedContent = useMemo(() => {
    if (!content) return '';

    // Beginne mit der normalen HTML-Bereinigung
    let cleanedHtml = cleanHtml(content);

    // Ersetze alle onclick-Handler durch einen speziellen data-attribute, den wir später abfangen können
    cleanedHtml = cleanedHtml.replace(
      /onclick="window\.open\('([^']+)', '_blank'\)"/g,
      'data-lightbox-src="$1"'
    );

    return cleanedHtml;
  }, [content]);

  // Event-Handler für Klicks auf Bilder im gereinigten HTML
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Prüfe, ob auf ein Bild geklickt wurde
    if (target.tagName === 'IMG') {
      // Wenn das Bild einen Lightbox-src-Attribute hat, öffne es im Modal
      const lightboxSrc = target.getAttribute('data-lightbox-src');
      if (lightboxSrc) {
        e.preventDefault();
        setSelectedImage(lightboxSrc);
      } else if (target.getAttribute('src')) {
        // Falls kein Lightbox-Attribut gefunden wurde, verwende die normale src
        e.preventDefault();
        setSelectedImage(target.getAttribute('src'));
      }
    }
  };

  return (
    <>
      <div 
        className="prose prose-sm max-w-none [&_pre]:m-0 [&_pre]:p-0 [&_code]:m-0 [&_code]:p-0 [&_code]:bg-transparent [&_a]:text-blue-500 [&_a]:underline [&_img]:max-w-[250px] [&_img]:cursor-pointer [&_img]:rounded-md hover:[&_img]:opacity-90" 
        dangerouslySetInnerHTML={{ __html: processedContent }} 
        onClick={handleContentClick}
      />

      {selectedImage && (
        <ImageViewerModal 
          isOpen={!!selectedImage} 
          onClose={() => setSelectedImage(null)} 
          imageSrc={selectedImage}
        />
      )}
    </>
  );
}