'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { matchSoapToTranscript } from '@/services/ai/matchingService';

interface SoapNoteWithHoverProps {
  soapNoteHtml: string;
  transcript: string;
  className?: string;
}

interface HoverPopupProps {
  matches: {
    text: string;
    score: number;
    speaker?: string;
  }[];
  position: { x: number; y: number };
}

/**
 * Component that displays a SOAP note with hover functionality
 * that shows transcript segments related to each hovered line
 */
const SoapNoteWithHover: React.FC<SoapNoteWithHoverProps> = ({
  soapNoteHtml,
  transcript,
  className = ''
}) => {
  const [processedContent, setProcessedContent] = useState<string>(soapNoteHtml);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [hoverContent, setHoverContent] = useState<{
    matches: {
      text: string;
      score: number;
      speaker?: string;
    }[];
    position: { x: number; y: number };
  } | null>(null);
  
  // Use refs to track if processing was completed for the current content
  const processedSoapRef = useRef<string>('');
  const processedTranscriptRef = useRef<string>('');

  // Process the SOAP note to add hover functionality
  useEffect(() => {
    // Skip if already processing or if inputs haven't changed
    if (
      isProcessing || 
      !soapNoteHtml || 
      !transcript || 
      (processedSoapRef.current === soapNoteHtml && processedTranscriptRef.current === transcript)
    ) {
      return;
    }
      
    const addHoverFunctionality = async () => {
      setIsProcessing(true);
      
      try {
        console.log('Processing SOAP note for hover functionality');
        // Store current inputs to prevent duplicate processing
        processedSoapRef.current = soapNoteHtml;
        processedTranscriptRef.current = transcript;
        
        // Get matches between SOAP lines and transcript segments
        const matches = await matchSoapToTranscript(soapNoteHtml, transcript);
        
        // Create a DOM parser to modify the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(soapNoteHtml, 'text/html');
        
        // Map to store processed text and their matching transcript segments
        const processedTextMap: Record<string, any[]> = {};
        
        // Process all matches
        matches.forEach(match => {
          processedTextMap[match.soapLine] = match.matchedTranscriptSegments;
        });
        
        // Function to wrap text nodes with span elements for hover
        const wrapTextNodes = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
            const text = node.textContent.trim();
            
            // Check if this text matches any of our SOAP lines
            for (const [soapLine, transcriptMatches] of Object.entries(processedTextMap)) {
              if (text.includes(soapLine)) {
                // Create a wrapper span with data attributes for hover
                const span = document.createElement('span');
                span.textContent = node.textContent;
                span.className = 'soap-hover-target';
                span.dataset.matches = JSON.stringify(transcriptMatches);
                
                // Replace the text node with our span
                if (node.parentNode) {
                  node.parentNode.replaceChild(span, node);
                  return;
                }
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recursively process child nodes
            Array.from(node.childNodes).forEach(wrapTextNodes);
          }
        };
        
        // Process all nodes in the document body
        Array.from(doc.body.childNodes).forEach(wrapTextNodes);
        
        // Set the processed HTML
        setProcessedContent(doc.body.innerHTML);
        console.log('SOAP note processing completed');
      } catch (error) {
        console.error('Error processing SOAP note for hover:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    
    addHoverFunctionality();
  }, [soapNoteHtml, transcript, isProcessing]);

  // Handle mouse events for hover functionality
  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (target.classList.contains('soap-hover-target')) {
      const matchesData = target.dataset.matches;
      
      if (matchesData) {
        try {
          const matches = JSON.parse(matchesData);
          
          setHoverContent({
            matches,
            position: {
              x: e.clientX,
              y: e.clientY
            }
          });
          
          setIsHovering(true);
        } catch (error) {
          console.error('Error parsing hover data:', error);
        }
      }
    }
  }, []);

  const handleMouseOut = useCallback(() => {
    setIsHovering(false);
  }, []);

  // Render the hover popup
  const renderHoverPopup = () => {
    if (!isHovering || !hoverContent) return null;
    
    const { matches, position } = hoverContent;
    
    return (
      <div 
        className="soap-hover-popup" 
        style={{
          position: 'fixed',
          top: `${position.y + 20}px`,
          left: `${position.x + 10}px`,
          zIndex: 1000,
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '6px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
          maxWidth: '400px',
          maxHeight: '300px',
          overflow: 'auto',
          border: '1px solid #e2e8f0'
        }}
      >
        <h4 className="soap-hover-title" style={{ 
          margin: '0 0 10px 0', 
          fontSize: '14px', 
          fontWeight: 'bold', 
          color: '#2563eb',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px'
        }}>
          Referenced from transcript:
        </h4>
        <ul className="soap-hover-matches" style={{ margin: 0, padding: '0 0 0 16px' }}>
          {matches.map((match, index) => {
            // Use different speaker colors to distinguish roles
            const speakerColor = match.speaker ? 
              match.speaker.toLowerCase().includes('patient') ? '#10b981' : 
              match.speaker.toLowerCase().includes('doctor') || match.speaker.toLowerCase().includes('dr') ? '#3b82f6' :
              '#6366f1' : '#6b7280';
            
            // High-confidence matches appear more prominent
            const confidenceLevel = match.score > 0.8 ? 'high' : match.score > 0.6 ? 'medium' : 'low';
            const confidenceColor = 
              confidenceLevel === 'high' ? '#059669' : 
              confidenceLevel === 'medium' ? '#9333ea' : 
              '#f59e0b';
            
            return (
              <li key={index} style={{ 
                marginBottom: '10px', 
                fontSize: '13px',
                padding: '6px',
                backgroundColor: `rgba(${confidenceLevel === 'high' ? '240, 253, 244' : 
                                         confidenceLevel === 'medium' ? '243, 232, 255' : 
                                         '255, 247, 237'})`,
                borderRadius: '4px',
                borderLeft: `3px solid ${confidenceColor}`
              }}>
                {match.speaker && (
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: speakerColor,
                    display: 'block',
                    marginBottom: '3px'
                  }}>
                    {match.speaker}
                  </span>
                )}
                <span style={{ color: '#1f2937' }}>{match.text}</span>
                <div style={{ 
                  fontSize: '11px', 
                  color: confidenceColor, 
                  marginTop: '4px',
                  fontWeight: '500'
                }}>
                  Match confidence: {Math.round(match.score * 100)}%
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div 
      className={`soap-note-container ${className}`}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {isProcessing ? (
        <div className="soap-loading">Processing SOAP note...</div>
      ) : (
        <div
          className="soap-content"
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />
      )}
      {renderHoverPopup()}

      <style jsx>{`
        .soap-note-container {
          position: relative;
          line-height: 1.6;
          color: #111827;
        }
        
        :global(.soap-hover-target) {
          border-bottom: 1px dotted #6366f1;
          cursor: help;
          transition: all 0.2s ease;
          position: relative;
        }
        
        :global(.soap-hover-target:hover) {
          background-color: rgba(99, 102, 241, 0.1);
          border-bottom: 1px solid #6366f1;
        }
        
        :global(.soap-hover-target:after) {
          content: "";
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 100%;
          height: 3px;
          background-color: rgba(99, 102, 241, 0);
          transition: background-color 0.2s;
        }
        
        :global(.soap-hover-target:hover:after) {
          background-color: rgba(99, 102, 241, 0.2);
        }
      `}</style>
    </div>
  );
};

export default SoapNoteWithHover; 