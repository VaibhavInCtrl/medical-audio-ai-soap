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
    // Check if the buffer is valid
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer: Buffer is empty or undefined');
    }
    
    // Minimum valid audio size (4KB)
    const minValidSize = 4 * 1024;
    if (audioBuffer.length < minValidSize) {
      throw new Error(`Audio buffer too small (${audioBuffer.length} bytes). Minimum valid size is ${minValidSize} bytes.`);
    }
    
    console.log(`Sending ${audioBuffer.length} bytes to Deepgram with options:`, options);
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      options
    );

    if (error) {
      // Parse error details for more specific information
      let errorMessage = error.message || 'Unknown error during transcription';
      
      try {
        // If the error is a JSON string, parse it for more details
        if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
          const errorData = JSON.parse(errorMessage);
          if (errorData.err_msg) {
            errorMessage = `Deepgram API error: ${errorData.err_code || 'Error'} - ${errorData.err_msg}`;
            
            // Add specific handling for common error types
            if (errorData.err_msg.includes('Invalid data')) {
              errorMessage += '. The audio data may be corrupted, incomplete, or in an unsupported format.';
            }
          }
        }
      } catch (parseErr) {
        // If JSON parsing fails, use the original error message
        console.warn('Could not parse error details:', parseErr);
      }
      
      throw new Error(errorMessage);
    }

    return result;
  } catch (err: any) {
    console.error('Deepgram transcription error:', err);
    
    // Improve error information for client debugging
    const enhancedError = new Error(
      err.message || 'Unknown error during transcription'
    );
    
    // Add additional context if available
    if (err.stack) {
      enhancedError.stack = err.stack;
    }
    
    // Add buffer info for debugging
    if (audioBuffer) {
      (enhancedError as any).bufferLength = audioBuffer.length;
    }
    
    throw enhancedError;
  }
} 