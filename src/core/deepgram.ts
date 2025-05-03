import { createClient } from '@deepgram/sdk';

// Ensure the Deepgram API key is available
const deepgramApiKey = "c45e5ec5357b7c25b6177b810df219b73beae06b";
if (!deepgramApiKey) {
  throw new Error('Deepgram API key is not defined in environment variables.');
}

// Initialize Deepgram client
const deepgram = createClient(deepgramApiKey);

// Default transcription options
const defaultOptions = {
  model: 'nova-2',
  language: 'en-US',
  detect_language: true,
  punctuate: true,
  smart_format: true,
  diarize: true,
  utterances: true,
};

/**
 * Transcribe an audio buffer using Deepgram
 * @param audioBuffer - Buffer containing audio data
 * @param options - Optional transcription options
 * @returns Transcription results
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options = defaultOptions
) {
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      options
    );

    if (error) {
      throw new Error(error.message || 'Unknown error during transcription');
    }

    return result;
  } catch (err: any) {
    console.error('Deepgram transcription error:', err);
    throw err;
  }
} 