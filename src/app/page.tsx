'use client';

import { useState } from 'react';
import AudioRecorder from '@/components/audio/AudioRecorder';
import SoapNoteGenerator from '@/components/soap/SoapNoteGenerator';

export default function Home() {
  const [transcript, setTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptData, setTranscriptData] = useState<any>(null);
  
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Asha Health - AI Medical Scribe</h1>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col space-y-8">
            {/* AudioRecorder with transcript callback */}
            <div className="bg-white shadow rounded-lg">
              <AudioRecorder 
                onTranscriptReady={(text) => setTranscript(text)}
                onTranscriptionStatusChange={(status) => setIsTranscribing(status)}
                onTranscriptDataReady={(data) => setTranscriptData(data)}
              />
            </div>
            
            {/* SOAP Note Generator */}
            {transcript && (
              <div className="bg-white shadow rounded-lg">
                <SoapNoteGenerator 
                  transcript={transcript} 
                  isTranscribing={isTranscribing} 
                  transcriptData={transcriptData}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
