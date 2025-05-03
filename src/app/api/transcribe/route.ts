import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/core/deepgram';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: 'Invalid or missing audio file' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const result = await transcribeAudio(buffer);
      return NextResponse.json(result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('Transcription request error:', err);
    return NextResponse.json({ error: err.message || 'Transcription failed' }, { status: 500 });
  }
}
