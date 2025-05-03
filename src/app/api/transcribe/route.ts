import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/core/deepgram';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const options = formData.get('options');

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ 
        error: 'Invalid or missing audio file',
        details: 'The request must contain an audio file in the "audio" field'
      }, { status: 400 });
    }

    console.log(`Processing full audio transcription: ${(audioFile.size / 1024 / 1024).toFixed(2)} MB`);

    // Parse transcription options if provided
    let transcriptionOptions;
    if (options && typeof options === 'string') {
      try {
        transcriptionOptions = JSON.parse(options);
        console.log('Using custom transcription options for full audio');
      } catch (e) {
        console.error('Error parsing options for full audio:', e);
        // If parsing fails, use default options
        transcriptionOptions = undefined;
      }
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      console.log(`Starting full transcription of ${buffer.length} bytes`);
      const startTime = Date.now();
      
      const result = await transcribeAudio(buffer, transcriptionOptions);
      
      const duration = Date.now() - startTime;
      console.log(`Full audio transcribed successfully in ${duration}ms`);
      
      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Full audio transcription error:', error);
      
      // Parse and format the error for better client-side handling
      let errorMessage = error.message || 'Unknown error during full transcription';
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
        details: error.toString(),
        bufferSize: buffer.length
      }, { status: statusCode });
    }
  } catch (err: any) {
    console.error('Full transcription request error:', err);
    return NextResponse.json({ 
      error: err.message || 'Full transcription failed',
      details: err.toString()
    }, { status: 500 });
  }
}
