import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Button } from "./button";
import { Upload, Image as ImageIcon, Link, Bold, Italic, List, ListOrdered, X } from "lucide-react";
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
        codeBlock: {
          HTMLAttributes: {
            class: 'my-custom-code-block',
            style: 'margin: 0 !important; padding: 0 !important; background: transparent;'
          }
        },
        code: {
          HTMLAttributes: {
            class: 'my-custom-code',
            style: 'margin: 0 !important; padding: 0 !important; background: transparent;'
          }
        }
      }),
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
      if (editor.isActive('link')) {
        // Wenn bereits ein Link aktiv ist, aktualisiere ihn
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        editor.chain().focus().extendMarkRange('link').createLink({ href: url }).run();
      } else if (editor.view.state.selection.empty) {
        // Wenn kein Text ausgewählt ist, füge den Link als Text ein
        editor.chain().focus().insertContent(`<a href="${url}" target="_blank">${url}</a>`).run();
      } else {
        // Wenn Text ausgewählt ist, wandle ihn in einen Link um
        editor.chain().focus().extendMarkRange('link').createLink({ href: url }).run();
      }
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

function AttachmentThumbnail({ file }: { file: string }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isPdf = /\.pdf$/i.test(file);
  const fileName = file.split('/').pop() || 'Datei';
  
  if (isImage) {
    return (
      <a href={file} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative w-20 h-20 border rounded overflow-hidden group">
          <img src={file} alt={fileName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
        </div>
      </a>
    );
  }
  
  if (isPdf) {
    // Stelle sicher, dass die URL absolut ist
    let pdfUrl = file;
    
    // Überprüfe ob die URL relativ oder absolut ist
    if (pdfUrl.startsWith('/')) {
      // Absolute URL mit Origin
      pdfUrl = window.location.origin + pdfUrl;
    } else if (!pdfUrl.startsWith('http')) {
      // Relative URL ohne führenden Slash
      pdfUrl = window.location.origin + '/' + pdfUrl;
    }
    
    return (
      <a 
        href={pdfUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        onClick={(e) => {
          e.preventDefault();
          // Öffne das PDF in einem neuen Fenster mit spezifischen Optionen
          window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        }}
        className="block border rounded overflow-hidden w-20 h-20 flex flex-col items-center justify-center hover:bg-muted/20 transition-colors"
      >
        <div className="h-12 w-full bg-red-50 flex items-center justify-center border-b">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500">
            <path d="M7 18H17V16H7V18Z" fill="currentColor" />
            <path d="M17 14H7V12H17V14Z" fill="currentColor" />
            <path d="M7 10H11V8H7V10Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z" fill="currentColor" />
          </svg>
        </div>
        <div className="p-1 text-xs text-center truncate w-full font-medium text-slate-700">
          {fileName.length > 12 ? fileName.substring(0, 9) + '...' : fileName}
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
