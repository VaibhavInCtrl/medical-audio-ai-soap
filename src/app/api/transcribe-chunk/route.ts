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
      return NextResponse.json({ 
        error: 'Invalid or missing audio file',
        details: 'The request must contain an audio file in the "audio" field' 
      }, { status: 400 });
    }

    const fileSize = audioFile.size;
    console.log(`Processing chunk ${chunkId}: ${(fileSize / 1024).toFixed(2)} KB`);
    
    // Validate file size
    if (fileSize === 0) {
      return NextResponse.json({ 
        error: 'Empty audio file',
        details: 'The uploaded audio file has zero bytes'
      }, { status: 400 });
    }
    
    // Minimum valid file size (4KB)
    const minValidSize = 4 * 1024;
    if (fileSize < minValidSize) {
      return NextResponse.json({ 
        error: 'Audio file too small',
        details: `The audio file (${fileSize} bytes) is below minimum valid size (${minValidSize} bytes)`
      }, { status: 400 });
    }

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
      
      // Parse and format the error for better client-side handling
      let errorMessage = error.message || 'Unknown error during transcription';
      let errorCode = 'TRANSCRIPTION_FAILED';
      let statusCode = 500;
      
      // Extract more specific error information
      if (errorMessage.includes('Invalid data received')) {
        errorCode = 'INVALID_AUDIO_DATA';
        errorMessage = 'The audio data was invalid or corrupted. Please check the audio format and try again.';
        statusCode = 400;
      } else if (errorMessage.includes('too small')) {
        errorCode = 'AUDIO_TOO_SMALL';
        statusCode = 400;
      } else if (errorMessage.includes('Bad Request')) {
        errorCode = 'BAD_REQUEST';
        statusCode = 400;
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        code: errorCode,
        chunkId,
        details: error.toString(),
        bufferSize: buffer.length
      }, { status: statusCode });
    }
  } catch (err: any) {
    console.error('Transcription chunk processing error:', err);
    return NextResponse.json({ 
      error: err.message || 'Transcription chunk failed',
      details: err.toString()
    }, { status: 500 });
  }
} 