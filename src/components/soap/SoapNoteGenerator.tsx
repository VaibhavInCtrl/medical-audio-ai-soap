

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as diff from 'diff';
import SoapEmbeddingProcessor from './SoapEmbeddingProcessor';
import SoapNoteWithHover from './SoapNoteWithHover';

// Move this component outside the main component to prevent re-creation on render
const DiffViewer = ({ original, modified }: { original: string; modified: string }) => {
  // Function to extract plain text from HTML content with preserved structure but reduced empty lines
  const getPlainTextFromHtml = (html: string): string => {
    // Create a temporary DOM element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Process the HTML to preserve structure
    let result = '';
    let lastAddedLineBreak = false;
    
    // Helper function to process nodes recursively
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Only add non-empty text nodes
        const text = node.textContent?.trim();
        if (text) {
          // If we just added a line break, don't add leading spaces
          if (lastAddedLineBreak) {
            result += node.textContent?.trimStart();
          } else {
            result += node.textContent;
          }
          lastAddedLineBreak = false;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        
        // Add line breaks only for major block elements to reduce empty lines
        const isBlockElement = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'table', 'pre'].includes(tagName);
        
        // Add line break before block elements, but only if we haven't just added one
        if (isBlockElement && result && !result.endsWith('\n')) {
          result += '\n';
          lastAddedLineBreak = true;
        }
        
        // Process children
        Array.from(node.childNodes).forEach(processNode);
        
        // Add line break after block elements
        if (isBlockElement && !result.endsWith('\n')) {
          result += '\n';
          lastAddedLineBreak = true;
        }
        
        // Add line break after <br> tags
        if (tagName === 'br') {
          result += '\n';
          lastAddedLineBreak = true;
        }
      }
    };
    
    Array.from(tempDiv.childNodes).forEach(processNode);
    
    // Clean up the text:
    // 1. Collapse multiple consecutive spaces to single space
    // 2. Remove consecutive line breaks (more than 2)
    // 3. Trim leading/trailing whitespace
    let cleaned = result
      .replace(/[ \t]+/g, ' ')        // Collapse spaces and tabs
      .replace(/\n{3,}/g, '\n\n')     // No more than double line breaks
      .trim();                         // Remove leading/trailing whitespace
    
    return cleaned;
  };
  
  // Convert HTML to plain text for comparison
  const originalText = getPlainTextFromHtml(original);
  const modifiedText = getPlainTextFromHtml(modified);
  
  // Generate line-by-line diff
  const diffResult = diff.diffLines(originalText, modifiedText, {
    newlineIsToken: true,
    ignoreWhitespace: false
  });
  
  // Process the diff to create line-by-line display
  const processedDiff = diffResult.flatMap((part) => {
    const lines = part.value.split('\n');
    // Remove the last empty element if it's from a trailing newline
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    return lines.map(line => ({
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      value: line
    }));
  });
  
  // Filter consecutive empty lines but keep meaningful paragraph breaks
  const filteredDiff = processedDiff.filter((line, index, array) => {
    // Keep meaningful empty lines (paragraph breaks) but remove consecutive empty lines
    if (line.value.trim() === '') {
      // Keep an empty line only if it's not preceded by another empty line
      if (index > 0 && array[index-1].value.trim() === '') {
        return false; // Skip consecutive empty lines
      }
    }
    return true;
  });
  
  return (
    <div className="bg-gray-50 border rounded-md overflow-hidden">
      <div className="flex justify-between items-center p-2 border-b bg-gray-100">
        <div className="text-xs text-gray-600 font-semibold">
          Text content changes
        </div>
      </div>
      
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm font-mono border-collapse">
          <tbody>
            {filteredDiff.length > 0 ? (
              filteredDiff.map((line, index) => (
                <tr 
                  key={index} 
                  className={
                    line.type === 'added'
                      ? 'bg-green-50'
                      : line.type === 'removed'
                        ? 'bg-red-50'
                        : 'bg-white'
                  }
                >
                  <td className="w-10 text-right select-none text-gray-500 px-2 py-0 border-r border-gray-200">
                    {line.type !== 'added' && (index + 1)}
                  </td>
                  <td className="w-10 text-right select-none text-gray-500 px-2 py-0 border-r border-gray-200">
                    {line.type !== 'removed' && (index + 1)}
                  </td>
                  <td className="w-5 select-none px-1 py-0 border-r border-gray-200 text-center">
                    {line.type === 'added' && <span className="text-green-600">+</span>}
                    {line.type === 'removed' && <span className="text-red-600">-</span>}
                  </td>
                  <td 
                    className={`px-3 py-0.5 whitespace-pre-wrap 
                      ${line.type === 'added' 
                        ? 'bg-green-100 text-green-800' 
                        : line.type === 'removed' 
                          ? 'bg-red-100 text-red-800' 
                          : 'text-gray-800'
                      }`
                    }
                  >
                    {line.value || ' '}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  No differences detected in content
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Menu bar component for Editing
const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('bold') ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Bold"
      >
        Bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('italic') ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Italic"
      >
        Italic
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('bulletList') ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Bullet List"
      >
        • List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-2 py-1 rounded text-sm ${editor.isActive('orderedList') ? 'bg-gray-200' : 'bg-white border border-gray-300'}`}
        title="Numbered List"
      >
        1. List
      </button>
    </div>
  );
};

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
    <span className="ml-2 text-amber-600">Transcribing audio...</span>
  </div>
);


interface SoapNoteGeneratorProps {
  transcript: string;
  isTranscribing: boolean;
  transcriptData?: any; // Add this prop to receive the full Deepgram response
}

// Update the component to require explicit user action for SOAP generation
const SoapNoteGenerator = ({ transcript, isTranscribing, transcriptData }: SoapNoteGeneratorProps) => {
  const [soapNoteHtml, setSoapNoteHtml] = useState<string | null>(null);
  const [originalSoapNoteHtml, setOriginalSoapNoteHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Add state for embedding processing status
  const [embeddingProcessed, setEmbeddingProcessed] = useState(false);
  // Store the original generation prompt
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);

  // Use useClientEffect to ensure client-only execution
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Clean HTML content by removing any code block markers
  const cleanHtmlContent = (content: string): string => {
    if (!content) return '';
    
    // Remove code block markers if they exist
    let cleaned = content;
    cleaned = cleaned.replace(/^```(html|markdown)?\n?/m, '');
    cleaned = cleaned.replace(/```\s*$/m, '');
    
    return cleaned;
  };
  
  // Calculate if current content has been modified from original
  const hasEdits = originalSoapNoteHtml && soapNoteHtml && originalSoapNoteHtml !== soapNoteHtml;
  
  // TipTap editor setup - only create editor on client side
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: 'Edit your SOAP note here...',
        }),
      ],
      content: soapNoteHtml ? cleanHtmlContent(soapNoteHtml) : '',
      onUpdate: ({ editor }) => {
        // Update the HTML content when edited
        setSoapNoteHtml(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none',
        },
      },
    },
    [isMounted] // Only initialize editor after component is mounted
  );

  // Update editor content when soapNoteHtml changes
  useEffect(() => {
    if (soapNoteHtml && editor && isMounted) {
      const cleanedContent = cleanHtmlContent(soapNoteHtml);
      editor.commands.setContent(cleanedContent);
    }
  }, [soapNoteHtml, editor, isMounted]);

  const generateSoapNote = async (format: 'markdown' | 'html' = 'html') => {
    if (!transcript || isGenerating) return;
    
    if (!transcript || transcript.trim() === '') {
      setError('No transcript available to generate SOAP note');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Format speaker-wise conversation if transcriptData is available
      let formattedTranscript = transcript;
      let speakerData = null;
      
      if (transcriptData && transcriptData.results && transcriptData.results.channels) {
        // Get paragraphs data if available
        const paragraphs = transcriptData.results.channels[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
        
        // Get diarization data if available
        const words = transcriptData.results.channels[0]?.alternatives?.[0]?.words || [];
        const hasDiarization = words.length > 0 && 'speaker' in words[0];
        
        // Format conversation in a structured way
        if ((paragraphs.length > 0) || (hasDiarization && words.length > 0)) {
          // If we have paragraphs with diarization
          if (paragraphs.length > 0) {
            formattedTranscript = paragraphs.map((paragraph: any, index: number) => {
              // Get first word to determine speaker
              const firstWordIndex = paragraph.sentences[0]?.start || 0;
              const speakerWords = words.filter((word: any) => 
                word.start >= firstWordIndex && 
                word.end <= paragraph.end
              );
              
              const speaker = speakerWords.length > 0 ? speakerWords[0].speaker : null;
              
              // Create the paragraph text
              const paragraphText = paragraph.sentences.map((sentence: any) => sentence.text).join(' ');
              
              return speaker !== null 
                ? `Speaker ${speaker}: ${paragraphText}`
                : paragraphText;
            }).join('\n\n');
          }
          // If we only have diarization but no paragraphs, group by speaker
          else if (hasDiarization && words.length > 0) {
            // Group words by speaker
            const wordsBySpeaker: Record<number, any[]> = {};
            words.forEach((word: any) => {
              const speaker = word.speaker;
              if (!wordsBySpeaker[speaker]) {
                wordsBySpeaker[speaker] = [];
              }
              wordsBySpeaker[speaker].push(word);
            });
            
            // Create formatted transcript with speaker labels
            formattedTranscript = Object.entries(wordsBySpeaker).map(([speaker, speakerWords]) => {
              const speakerText = speakerWords.map(word => word.punctuated_word || word.word).join(' ');
              return `Speaker ${speaker}: ${speakerText}`;
            }).join('\n\n');
          }
          
          // Also create a structured speaker data object for the API
          speakerData = {
            hasDiarization,
            speakerCount: hasDiarization ? new Set(words.map((w: any) => w.speaker)).size : 0
          };
        }
      }
      
      // Create a request body with transcript and format
      const requestBody: any = {
        transcription: formattedTranscript,
        patientInfo: transcriptData?.patient_info || 'Patient from Asha Health App',
        format
      };
      
      // Add speaker data if available
      if (speakerData) {
        requestBody.speakerData = speakerData;
      } else if (transcriptData?.speakers && transcriptData.speakers.length > 0) {
        requestBody.speakerData = {
          hasDiarization: true,
          speakerCount: transcriptData.speakers.length
        };
      }

      // Store the prompt for verification purposes later
      const formatInstructions = format === 'html' 
        ? `Output in clean HTML format with appropriate tags for sections`
        : `Format in Markdown for readability`;
      
      // Store a simplified version of the prompt for verification
      setOriginalPrompt(
        `Generate a SOAP note from this transcript with ${speakerData?.speakerCount || transcriptData?.speakers?.length || 0} speakers. 
Format into Subjective, Objective, Assessment, and Plan sections. ${formatInstructions}`
      );
      
      // Make the API request
      const response = await fetch('/api/generate-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate SOAP note');
      }
      
      const data = await response.json();
      const cleanedHtml = cleanHtmlContent(data.soapNote);
      setSoapNoteHtml(cleanedHtml);
      setOriginalSoapNoteHtml(cleanedHtml); // Store the original version
      setShowDiff(false); // Hide diff view when generating new content
      setIsGenerating(false);
    } catch (err: any) {
      console.error('SOAP note generation error:', err);
      setError(err.message || 'Failed to generate SOAP note');
      setIsGenerating(false);
    }
  };

  // Function to download content as PDF using jsPDF
  const downloadAsPDF = async () => {
    if (!contentRef.current) {
      setError('Content not available for PDF generation');
      return;
    }

    setIsDownloading(true);
    setError(null);
    
    try {
      // Create a temporary container for PDF rendering
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '-9999px';
      printContainer.style.left = '-9999px';
      printContainer.style.width = '210mm'; // A4 width
      printContainer.style.padding = '10mm';
      printContainer.style.backgroundColor = 'white';
      printContainer.style.color = 'black';
      printContainer.style.fontFamily = 'Arial, sans-serif';
      printContainer.style.fontSize = '12pt';
      printContainer.style.lineHeight = '1.5';
      
      // Copy content for printing
      printContainer.innerHTML = `
        <div style="max-width: 190mm;">
          <h1 style="font-size: 18pt; margin-bottom: 15px;">SOAP Note</h1>
          ${soapNoteHtml || ''}
        </div>
      `;
      
      document.body.appendChild(printContainer);
      
      // Use html2canvas to capture the content
      const canvas = await html2canvas(printContainer, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      // Remove the temporary container
      document.body.removeChild(printContainer);
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      
      // A4 dimensions: 210 x 297 mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Calculate dimensions to fit the image properly on the page
      const imgWidth = 210 - 20; // A4 width - margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      
      // Download the PDF
      pdf.save('SOAP_Note.pdf');
      
      setIsDownloading(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      
      // Fallback to HTML download
      try {
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>SOAP Note</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                font-size: 12pt;
                line-height: 1.5;
                margin: 30px;
              }
              h1 {
                font-size: 18pt;
                margin-bottom: 15px;
              }
              h2 {
                font-size: 14pt;
                margin-top: 20px;
                margin-bottom: 10px;
              }
              ul, ol {
                margin-left: 20px;
              }
            </style>
          </head>
          <body>
            <h1>SOAP Note</h1>
            ${soapNoteHtml || ''}
          </body>
          </html>
        `;
        
        const element = document.createElement('a');
        const file = new Blob([htmlContent], {type: 'text/html'});
        element.href = URL.createObjectURL(file);
        element.download = 'SOAP_Note.html';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
        
        setError('PDF generation failed. Downloaded as HTML instead.');
      } catch (htmlErr) {
        setError('Failed to generate any downloadable format.');
      } finally {
        setIsDownloading(false);
      }
    }
  };

  // Function to toggle diff view
  const toggleDiffView = () => {
    setShowDiff(prev => !prev);
  };

  // Embedding processing handler
  const handleEmbeddingProcessComplete = (success: boolean, error?: string, feedback?: string) => {
    setEmbeddingProcessed(success);
    if (!success && error) {
      console.error('Embedding processing failed:', error);
      // Optionally show a message to the user
    }
    
    if (feedback) {
      console.log('Verification feedback:', feedback);
    }
  };

  // Handle SOAP correction from verification
  const handleSoapCorrection = (correctedSoapNote: string, feedback: string) => {
    if (correctedSoapNote && correctedSoapNote !== soapNoteHtml) {
      console.log('Updating SOAP note with AI-corrected version based on verification feedback');
      
      // Update the SOAP note with the corrected version
      const cleanedHtml = cleanHtmlContent(correctedSoapNote);
      setSoapNoteHtml(cleanedHtml);
      
      // Update editor content if available
      if (editor) {
        editor.commands.setContent(cleanedHtml);
      }
      
      // Optionally show notification to user
      setError('SOAP note was automatically improved based on AI verification feedback.');
      
      // Update original for diff viewing if needed
      if (!originalSoapNoteHtml) {
        setOriginalSoapNoteHtml(cleanedHtml);
      }
    }
  };

  // If not mounted yet, render a minimal placeholder to prevent hydration errors
  if (!isMounted) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">SOAP Note Generator</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">SOAP Note Generator</h2>
          <Button
            onClick={() => generateSoapNote()}
            disabled={isGenerating || !transcript}
            className={`px-6 py-2 rounded-md ${
              isGenerating || !transcript
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </div>
            ) : (
              'Generate SOAP Note'
            )}
          </Button>
        </div>

        {isTranscribing && (
          <div className="py-4 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
            {error}
          </div>
        )}
        
        {soapNoteHtml && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg">SOAP Note</h3>
              {hasEdits && (
                <Button 
                  onClick={toggleDiffView}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                >
                  {showDiff ? 'Hide Changes' : 'Show Changes'}
                </Button>
              )}
            </div>
            
            {showDiff && originalSoapNoteHtml && soapNoteHtml && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h4 className="font-medium text-sm mb-2 text-gray-700">Changes from original version:</h4>
                <DiffViewer original={originalSoapNoteHtml} modified={soapNoteHtml} />
              </div>
            )}
            
            <div className="p-4">
              <div className="border border-gray-200 rounded mb-4 min-h-[300px] tiptap-editor">
                <MenuBar editor={editor} />
                <EditorContent editor={editor} className="min-h-[300px] p-4" ref={contentRef} />
              </div>
              
              {/* Add hover view option */}
              {transcript && soapNoteHtml && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-sm mb-2 text-gray-700">Transcript Reference View:</h4>
                  <div className="p-3 border border-gray-200 rounded bg-gray-50">
                    <p className="text-xs text-black-500 mb-2">
                      Hover over text to see relevant parts of the transcript.
                    </p>
                    <SoapNoteWithHover 
                      soapNoteHtml={soapNoteHtml} 
                      transcript={transcript} 
                      className="bg-white p-3 border border-gray-200 rounded"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <Button
                onClick={() => {
                  // Reset to original SOAP note from the backend
                  if (editor && originalSoapNoteHtml) {
                    editor.commands.setContent(originalSoapNoteHtml);
                    setSoapNoteHtml(originalSoapNoteHtml);
                    setShowDiff(false);
                  } else {
                    generateSoapNote();
                  }
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
              >
                Reset
              </Button>
              <Button
                onClick={() => {
                  // Copy SOAP note to clipboard as plain text
                  const plainText = editor ? editor.getText() : '';
                  navigator.clipboard.writeText(plainText);
                  alert('SOAP note copied to clipboard!');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Copy to Clipboard
              </Button>
              <Button
                onClick={downloadAsPDF}
                disabled={isDownloading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
              >
                {isDownloading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Downloading...
                  </div>
                ) : (
                  'Download'
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Add embedding processor component (invisible) */}
        {soapNoteHtml && transcript && (
          <SoapEmbeddingProcessor
            transcript={transcript}
            soapNoteHtml={soapNoteHtml}
            sessionId={transcriptData?.session_id}
            originalPrompt={originalPrompt || undefined}
            onProcessComplete={handleEmbeddingProcessComplete}
            onSoapCorrection={handleSoapCorrection}
            // Only process embeddings when the SOAP note is first generated or reset
            // This prevents reprocessing when small edits are made
            disabled={hasEdits === true}
          />
        )}
      </div>
    </div>
  );
};

export default SoapNoteGenerator; 