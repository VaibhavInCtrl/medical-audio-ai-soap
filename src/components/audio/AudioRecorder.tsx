'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { transcribeForAudioRecorder } from '@/services/audio/processAudio';

type RecordingState = 'inactive' | 'recording' | 'paused' | 'processing' | 'generating';

interface AudioRecorderProps {
  onTranscriptReady?: (text: string) => void;
  onTranscriptionStatusChange?: (isTranscribing: boolean) => void;
  onSoapNotesReady?: (soapNotes: string) => void;
  onTranscriptDataReady?: (data: any) => void;
}

// ConversationView component to display transcribed content with speaker information
const ConversationView = ({ transcriptData }: { transcriptData: any }) => {
  if (!transcriptData || !transcriptData.results || !transcriptData.results.channels) {
    return (
      <div className="p-4 text-gray-600">
        No conversation data available.
      </div>
    );
  }

  // Get paragraphs data if available
  const paragraphs = transcriptData.results.channels[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
  
  // Get diarization data if available
  const words = transcriptData.results.channels[0]?.alternatives?.[0]?.words || [];
  const hasDiarization = words.length > 0 && 'speaker' in words[0];
  
  // If no paragraphs or words with speaker info, display the plain transcript
  if ((paragraphs.length === 0) && (!hasDiarization || words.length === 0)) {
    const transcript = transcriptData.results.channels[0]?.alternatives?.[0]?.transcript || '';
    return (
      <div className="p-4 whitespace-pre-line">
        {transcript}
      </div>
    );
  }

  // If we have paragraphs with diarization, format them nicely
  if (paragraphs.length > 0) {
    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph: any, index: number) => {
          // Get first word to determine speaker
          const firstWordIndex = paragraph.sentences[0]?.start || 0;
          const speakerWords = words.filter((word: any) => 
            word.start >= firstWordIndex && 
            word.end <= paragraph.end
          );
          
          const speaker = speakerWords.length > 0 ? speakerWords[0].speaker : null;
          
          // Create the paragraph text
          const paragraphText = paragraph.sentences.map((sentence: any) => sentence.text).join(' ');
          
          return (
            <div key={index} className="border-b border-gray-200 pb-2 last:border-0">
              {speaker !== null && (
                <div className="text-sm font-semibold text-blue-600 mb-1">
                  Speaker {speaker}:
                </div>
              )}
              <div className="text-gray-800">
                {paragraphText}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  
  // If we only have diarization but no paragraphs, group by speaker
  if (hasDiarization && words.length > 0) {
    // Group words by speaker
    const wordsBySpeaker: Record<number, any[]> = {};
    words.forEach((word: any) => {
      const speaker = word.speaker;
      if (!wordsBySpeaker[speaker]) {
        wordsBySpeaker[speaker] = [];
      }
      wordsBySpeaker[speaker].push(word);
    });
    
    // Convert to array of speaker groups
    const speakerGroups = Object.entries(wordsBySpeaker).map(([speaker, speakerWords]) => {
      return {
        speaker: parseInt(speaker),
        text: speakerWords.map((word: any) => word.punctuated_word || word.word).join(' ')
      };
    });
    
    return (
      <div className="space-y-4">
        {speakerGroups.map((group, index) => (
          <div key={index} className="border-b border-gray-200 pb-2 last:border-0">
            <div className="text-sm font-semibold text-blue-600 mb-1">
              Speaker {group.speaker}:
            </div>
            <div className="text-gray-800">
              {group.text}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Fallback to plain transcript
  const transcript = transcriptData.results.channels[0]?.alternatives?.[0]?.transcript || '';
  return (
    <div className="p-4 whitespace-pre-line">
      {transcript}
    </div>
  );
};

// Hook for audio recording functionality
const useAudioRecording = (
  onAudioReady: (blob: Blob) => Promise<void>,
  onError: (message: string) => void
) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  
  const startRecording = async () => {
    try {
      // Reset previous recording data
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder with appropriate mime type
      const mimeType = 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // Use a consistent bitrate
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          // Create a single blob from all collected chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          
          // Process the audio through callback
          await onAudioReady(audioBlob);
        } catch (err) {
          console.error('Error finalizing recording:', err);
          onError('Error finalizing audio. Please try again.');
        }
      };
      
      // Start recording with 1-second chunks for dataavailable events
      mediaRecorder.start(1000);
      return true;
      
    } catch (err) {
      console.error('Error starting recording:', err);
      onError('Could not access microphone. Please ensure microphone permissions are granted.');
      return false;
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        return true;
      } catch (err) {
        console.error('Error stopping recording:', err);
        onError('Error processing audio. Please try again.');
        return false;
      }
    }
    return false;
  };
  
  return {
    startRecording,
    stopRecording,
    recordingStartTimeRef
  };
};

// Hook for audio upload functionality
const useAudioUpload = (
  onAudioReady: (blob: Blob, fileName: string) => Promise<void>,
  onError: (message: string) => void
) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return false;
    }
    
    // Check file type
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.wav') && !file.name.endsWith('.mp3')) {
      onError('Invalid file type. Please upload an audio file (WAV, MP3, MP4, M4A, or WebM).');
      return false;
    }
    
    try {
      console.log(`Processing audio file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      
      // Process the audio through callback
      await onAudioReady(file, file.name);
      return true;
    } catch (error) {
      console.error('Error processing uploaded file:', error);
      onError('Failed to process the uploaded audio file.');
      return false;
    }
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return {
    handleFileUpload,
    triggerFileInput,
    resetFileInput,
    fileInputRef
  };
};

export default function AudioRecorder({ 
  onTranscriptReady,
  onTranscriptionStatusChange,
  onSoapNotesReady,
  onTranscriptDataReady
}: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('inactive');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingProgress, setRecordingProgress] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [soapNotes, setSoapNotes] = useState<string>('');
  const [transcriptData, setTranscriptData] = useState<any>(null);
  
  // Initialize recording functionality
  const { 
    startRecording, 
    stopRecording,
    recordingStartTimeRef
  } = useAudioRecording(
    async (blob) => await handleAudioReady(blob),
    (errorMessage) => {
      setError(errorMessage);
      setRecordingState('inactive');
    }
  );
  
  // Call the onTranscriptReady callback when transcript changes
  useEffect(() => {
    if (transcript && onTranscriptReady) {
      onTranscriptReady(transcript);
    }
  }, [transcript, onTranscriptReady]);

  // Call the onSoapNotesReady callback when SOAP notes are generated
  useEffect(() => {
    if (soapNotes && onSoapNotesReady) {
      onSoapNotesReady(soapNotes);
    }
  }, [soapNotes, onSoapNotesReady]);

  // Update recording progress timer
  useEffect(() => {
    let progressTimer: NodeJS.Timeout | null = null;
    
    if (recordingState === 'recording') {
      progressTimer = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        setRecordingProgress(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    } else {
      setRecordingProgress('');
    }
    
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [recordingState]);
  
  // Update transcription status when recording state changes
  useEffect(() => {
    if (onTranscriptionStatusChange) {
      const isTranscribing = 
        recordingState === 'processing' || 
        recordingState === 'generating';
        
      onTranscriptionStatusChange(isTranscribing);
    }
  }, [recordingState, onTranscriptionStatusChange]);
  
  const transcribeFullAudio = async (audioBlob: Blob) => {
    try {
      setProcessingProgress('Transcribing audio...');
      onTranscriptionStatusChange?.(true);
      
      const fileSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`Processing ${fileSizeMB.toFixed(2)}MB audio file`);
      
      // Adjust chunk size and concurrency based on file size
      let chunkSize = 1024 * 1024; // Default: 1MB chunks
      let concurrentRequests = 5; // Default: 5 concurrent requests
      
      if (fileSizeMB < 5) {
        // For smaller files (< 5MB), use direct transcription with no chunking
        console.log(`File size (${fileSizeMB.toFixed(2)}MB) is small, using direct transcription`);
        
        // Use our parallel transcription function with useChunking=false
        const data = await transcribeForAudioRecorder(audioBlob, {
          useChunking: false, // Disable chunking for small files
          deepgramOptions: {
            model: 'nova-2',
            language: 'en-US',
            detect_language: true,
            punctuate: true,
            smart_format: true,
            diarize: true,
            utterances: true
          }
        });
        
        // Store the full Deepgram-formatted response
        setTranscriptData(data);
        
        // Send the full data to the parent component if callback exists
        if (onTranscriptDataReady) {
          onTranscriptDataReady(data);
        }
        
        // Extract transcript from the formatted response structure
        const transcriptText = data.results?.channels[0]?.alternatives[0]?.transcript || '';
        
        if (transcriptText.trim()) {
          setTranscript(transcriptText.trim());
          setProcessingProgress('Generating SOAP notes...');
          
          // Generate SOAP notes after successful transcription
          return transcriptText.trim();
        } else {
          throw new Error('No transcript was generated');
        }
      }
      
      // For larger files, optimize chunk size and concurrency
      if (fileSizeMB < 10) {
        // For medium files (5-10MB), use smaller chunks and fewer concurrent requests
        chunkSize = 512 * 1024; // 512KB chunks
        concurrentRequests = 3;
      } else if (fileSizeMB > 10) {
        // For large files (> 10MB), use larger chunks and more concurrent requests
        chunkSize = 1.5 * 1024 * 1024; // 1.5MB chunks
        concurrentRequests = 7; // Higher concurrency
      }
      
      console.log(`Using ${(chunkSize / (1024 * 1024)).toFixed(1)}MB chunks with ${concurrentRequests} concurrent requests for ${fileSizeMB.toFixed(2)}MB audio file`);
      
      // Use our parallel transcription function with fixed-size chunks
      const data = await transcribeForAudioRecorder(audioBlob, {
        // Pass the optimal concurrency
        concurrentRequests: concurrentRequests,
        // Pass the chunk size in bytes
        chunkSizeBytes: chunkSize,
        // Use the default Deepgram options
        deepgramOptions: {
          model: 'nova-2',
          language: 'en-US',
          detect_language: true,
          punctuate: true,
          smart_format: true,
          diarize: true,
          utterances: true
        }
      });
      
      // Store the full Deepgram-formatted response
      setTranscriptData(data);
      
      // Send the full data to the parent component if callback exists
      if (onTranscriptDataReady) {
        onTranscriptDataReady(data);
      }
      
      // Extract transcript from the formatted response structure
      const transcriptText = data.results?.channels[0]?.alternatives[0]?.transcript || '';
      
      if (transcriptText.trim()) {
        setTranscript(transcriptText.trim());
        setProcessingProgress('Generating SOAP notes...');
        
        // Generate SOAP notes after successful transcription
        return transcriptText.trim();
      } else {
        throw new Error('No transcript was generated');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Failed to transcribe audio');
      return null;
    }
  };
  
  const generateSoapNotes = async (transcriptText: string) => {
    try {
      setRecordingState('generating');
      setProcessingProgress('Generating SOAP notes from transcript...');
      
      // Send transcript to SOAP notes generation API
      const response = await fetch('/api/generate-soap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate SOAP notes: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Set the generated SOAP notes
      setSoapNotes(data.soapNotes || '');
      return data.soapNotes;
    } catch (err: any) {
      console.error('SOAP notes generation error:', err);
      setError(err.message || 'Failed to generate SOAP notes');
      return null;
    } finally {
      setProcessingProgress('');
      setRecordingState('inactive');
    }
  };
  
  // Common handler for processing audio (used by both recording and upload)
  const handleAudioReady = async (blob: Blob, fileName?: string) => {
    setAudioBlob(blob);
    const audioUrl = URL.createObjectURL(blob);
    setAudioURL(audioUrl);
    
    if (fileName) {
      setUploadedFileName(fileName);
    }
    
    setRecordingState('processing');
    
    // Transcribe the full audio
    const transcriptText = await transcribeFullAudio(blob);
    
    // Generate SOAP notes if transcription was successful
    if (transcriptText) {
      await generateSoapNotes(transcriptText);
    } else {
      setProcessingProgress('');
      setRecordingState('inactive');
    }
  };
  
  // Initialize upload functionality
  const { 
    handleFileUpload,
    triggerFileInput,
    resetFileInput,
    fileInputRef
  } = useAudioUpload(
    async (blob, fileName) => {
      setTranscript('');
      setSoapNotes('');
      setProcessingProgress('Transcribing audio file...');
      await handleAudioReady(blob, fileName);
    },
    (errorMessage) => {
      setError(errorMessage);
    }
  );
  
  // Reset error when state changes
  useEffect(() => {
    setError(null);
  }, [recordingState]);
  
  const handleStartRecording = async () => {
    // Reset state before starting new recording
    setAudioBlob(null);
    setAudioURL(null);
    setTranscript('');
    setUploadedFileName('');
    setSoapNotes('');
    
    // Start recording
    const success = await startRecording();
    if (success) {
      setRecordingState('recording');
    }
  };
  
  const handleStopRecording = async () => {
    if (recordingState === 'recording') {
      setRecordingState('processing');
      stopRecording();
    }
  };
  
  const resetRecording = () => {
    // Reset state
    setAudioBlob(null);
    setAudioURL(null);
    setTranscript('');
    setUploadedFileName('');
    setProcessingProgress('');
    setSoapNotes('');
    
    // Reset file input
    resetFileInput();
    
    setRecordingState('inactive');
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="flex flex-col items-center space-y-6">
        <h2 className="text-2xl font-bold">Audio Recorder</h2>
        
        {error && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
            {error}
          </div>
        )}
        
        {recordingState === 'inactive' && !audioURL ? (
          <div className="w-full flex flex-col sm:flex-row justify-center gap-4 items-center">
            <Button 
              onClick={handleStartRecording}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md w-full sm:w-auto"
            >
              Start Recording
            </Button>
            
            <div className="text-sm text-gray-500 my-2 sm:my-0">or</div>
            
            <Button 
              onClick={triggerFileInput}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md w-full sm:w-auto"
            >
              Upload Audio
            </Button>
            
            <input 
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleFileUpload}
            />
          </div>
        ) : recordingState === 'recording' ? (
          <div className="w-full flex justify-center gap-4 items-center">
            <div className="text-sm text-gray-600 font-mono flex items-center">
              <span>{recordingProgress}</span>
            </div>
            <Button 
              onClick={handleStopRecording}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md"
            >
              Stop Recording
            </Button>
          </div>
        ) : recordingState === 'processing' || recordingState === 'generating' ? (
          <div className="w-full flex flex-col items-center gap-2">
            <Button 
              disabled
              className="bg-gray-400 text-white px-6 py-2 rounded-md"
            >
              <span className="flex items-center">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                {recordingState === 'generating' ? 'Generating SOAP Notes...' : 'Processing...'}
              </span>
            </Button>
            {processingProgress && (
              <div className="text-sm text-gray-700 font-medium">
                {processingProgress}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-center gap-4">
            {transcript && (
              <Button 
                onClick={resetRecording}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md"
              >
                New Recording
              </Button>
            )}
          </div>
        )}
        
        {uploadedFileName && (
          <div className="w-full">
            <p className="text-sm text-gray-600 mt-2">
              Uploaded file: <span className="font-medium">{uploadedFileName}</span>
            </p>
          </div>
        )}
        
        {audioURL && (
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-2">Audio</h3>
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
        
        {transcript && recordingState === 'inactive' && (
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-2">Transcript</h3>
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-md shadow-sm text-gray-800 font-medium leading-relaxed">
              {transcriptData ? (
                <ConversationView transcriptData={transcriptData} />
              ) : (
                <div className="whitespace-pre-line">{transcript}</div>
              )}
            </div>
          </div>
        )}
        
        {soapNotes && recordingState === 'inactive' && (
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-2">SOAP Notes</h3>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md shadow-sm text-gray-800 font-medium leading-relaxed whitespace-pre-line">
              {soapNotes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 