'use client';

import { useState, useEffect, useRef } from 'react';

interface SoapEmbeddingProcessorProps {
  transcript: string;
  soapNoteHtml: string | null;
  userId?: string;
  sessionId?: string;
  originalPrompt?: string;
  onProcessComplete?: (success: boolean, error?: string, feedback?: string) => void;
  onSoapCorrection?: (correctedSoapNote: string, feedback: string) => void;
  disabled?: boolean;
}

/**
 * Component that processes SOAP notes and transcripts to create and store embeddings
 * This is a background service component with no UI elements
 */
const SoapEmbeddingProcessor: React.FC<SoapEmbeddingProcessorProps> = ({
  transcript,
  soapNoteHtml,
  userId,
  sessionId,
  originalPrompt,
  onProcessComplete,
  onSoapCorrection,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const processingRef = useRef(false);
  const lastProcessedData = useRef<{
    transcript: string;
    soapNote: string;
  } | null>(null);

  // Process embeddings when transcript and SOAP note are both available and have changed
  useEffect(() => {
    // Don't process if disabled via props or if already processed successfully
    if (disabled || processed) {
      return;
    }

    // Guard against concurrent processing attempts
    if (processingRef.current) {
      return;
    }

    // Check if content is the same as previously processed
    if (
      lastProcessedData.current &&
      lastProcessedData.current.transcript === transcript &&
      lastProcessedData.current.soapNote === soapNoteHtml
    ) {
      console.log('Content already processed, skipping embedding generation');
      return;
    }

    // Check for required data
    if (!transcript || !soapNoteHtml) {
      return;
    }

    const processData = async () => {
      // Set processing flags
      setIsProcessing(true);
      processingRef.current = true;
      
      console.log('Starting embedding generation with verification for SOAP note and transcript');
      
      try {
        // Add a 5-second delay before processing embeddings
        console.log('Waiting 5 seconds before generating embeddings...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Use the new API endpoint that includes verification
        const response = await fetch('/api/generate-embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript,
            soapNote: soapNoteHtml,
            userId,
            sessionId,
            originalPrompt,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to process embeddings');
        }
        
        // Check if the API returned a corrected SOAP note
        if (result.wasCorrection && result.correctedSoapNote && onSoapCorrection) {
          console.log('SOAP note was corrected based on verification feedback');
          onSoapCorrection(result.correctedSoapNote, result.feedback || '');
        }
        
        // Update last processed data to prevent reprocessing the same content
        lastProcessedData.current = {
          transcript,
          soapNote: soapNoteHtml
        };
        
        // Mark as processed successfully
        setProcessed(true);
        
        // Call the completion callback with success and any feedback
        onProcessComplete?.(true, undefined, result.feedback);
        
        console.log('Successfully processed embeddings', 
          result.verified === true ? 'with verification' : 
          result.verified === 'skipped' ? 'verification skipped' : '',
          result.wasCorrection ? '(SOAP note was corrected)' : '');
      } catch (error) {
        console.error('Failed to process embeddings:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onProcessComplete?.(false, errorMessage);
      } finally {
        setIsProcessing(false);
        processingRef.current = false;
      }
    };

    processData();
  }, [transcript, soapNoteHtml, userId, sessionId, originalPrompt, onProcessComplete, onSoapCorrection, disabled, processed]);

  // Reset processed state if inputs change
  useEffect(() => {
    if (
      processed && 
      lastProcessedData.current && 
      (lastProcessedData.current.transcript !== transcript || 
       lastProcessedData.current.soapNote !== soapNoteHtml)
    ) {
      console.log('Inputs changed, resetting processed state');
      setProcessed(false);
    }
  }, [transcript, soapNoteHtml, processed]);

  // This component doesn't render anything visible
  return null;
};

export default SoapEmbeddingProcessor; 