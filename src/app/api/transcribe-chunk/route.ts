import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/core/deepgram';

export async function POST(request: NextRequest) {
  try {
    // Get the audio chunk from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const options = formData.get('options');
    const chunkId = formData.get('chunkId') || 'unknown';

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: 'Invalid or missing audio file' }, { status: 400 });
    }

    console.log(`Processing chunk ${chunkId}: ${(audioFile.size / 1024).toFixed(2)} KB`);

    let transcriptionOptions;
    if (options && typeof options === 'string') {
      try {
        transcriptionOptions = JSON.parse(options);
        console.log(`Using custom transcription options for chunk ${chunkId}`);
      } catch (e) {
        console.error(`Error parsing options for chunk ${chunkId}:`, e);
        // If parsing fails, use default options
        transcriptionOptions = undefined;
      }
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      // Transcribe the audio chunk using Deepgram
      console.log(`Sending chunk ${chunkId} to Deepgram (${buffer.length} bytes)`);
      const startTime = Date.now();
      
      const result = await transcribeAudio(buffer, transcriptionOptions);
      
      const duration = Date.now() - startTime;
      console.log(`Chunk ${chunkId} transcribed successfully in ${duration}ms`);
      
      return NextResponse.json(result);
    } catch (error: any) {
      console.error(`Transcription error for chunk ${chunkId}:`, error);
      return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Transcription chunk processing error:', err);
    return NextResponse.json({ error: err.message || 'Transcription chunk failed' }, { status: 500 });
  }
} 