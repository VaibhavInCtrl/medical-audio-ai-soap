/**
 * Audio Processing Service
 * Provides utilities for handling audio data, including segmentation and chunking.
 */

/**
 * Splits audio bytes into chunks of a specified duration
 * 
 * @param audioBuffer The complete audio buffer to split
 * @param sampleRate The sample rate of the audio (e.g., 44100 Hz)
 * @param channels Number of audio channels (1 for mono, 2 for stereo)
 * @param bytesPerSample Number of bytes per sample (2 for 16-bit PCM)
 * @param chunkDurationMs The desired duration of each chunk in milliseconds (default: 60000ms = 1 minute)
 * @returns Array of audio byte chunks
 */
export function splitAudioIntoChunks(
  audioBuffer: ArrayBuffer,
  sampleRate: number,
  channels: number,
  bytesPerSample: number,
  chunkDurationMs: number = 60000
): ArrayBuffer[] {
  // Calculate the number of bytes for 1 minute of audio
  // Formula: (sample rate * channels * bytes per sample * duration in seconds) / 1000
  const bytesPerChunk = Math.floor((sampleRate * channels * bytesPerSample * chunkDurationMs) / 1000);
  
  // Create the full audio byte array
  const audioBytes = new Uint8Array(audioBuffer);
  const totalBytes = audioBytes.length;
  
  // Calculate how many chunks we'll have
  const chunkCount = Math.ceil(totalBytes / bytesPerChunk);
  const chunks: ArrayBuffer[] = [];
  
  console.log(`Splitting ${totalBytes} bytes of audio into ${chunkCount} chunks of ~${bytesPerChunk} bytes each`);
  
  // Split the audio into chunks
  for (let i = 0; i < chunkCount; i++) {
    const start = i * bytesPerChunk;
    const end = Math.min(start + bytesPerChunk, totalBytes);
    const chunkBytes = audioBytes.slice(start, end);
    chunks.push(chunkBytes.buffer);
  }
  
  return chunks;
}

/**
 * Splits an audio blob into 1-minute chunks
 * 
 * @param audioBlob The audio blob to process
 * @param mimeType The MIME type of the audio (e.g., 'audio/wav', 'audio/mp3')
 * @returns Promise resolving to array of audio chunk blobs
 */
export async function splitAudioBlobIntoMinuteChunks(
  audioBlob: Blob,
  mimeType: string = 'audio/wav'
): Promise<Blob[]> {
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Common audio formats info
    // This is a simplification - in a real app you might want to analyze the audio format
    const defaultSampleRate = 44100; // 44.1 kHz (standard for most audio)
    const defaultChannels = 2;       // Stereo
    const defaultBytesPerSample = 2; // 16-bit PCM
    
    // Split into ArrayBuffer chunks
    const bufferChunks = splitAudioIntoChunks(
      arrayBuffer,
      defaultSampleRate,
      defaultChannels,
      defaultBytesPerSample,
      60000 // 1 minute in milliseconds
    );
    
    // Convert ArrayBuffers back to Blobs with the original MIME type
    const blobChunks = bufferChunks.map(buffer => new Blob([buffer], { type: mimeType }));
    
    console.log(`Split audio blob (${audioBlob.size} bytes) into ${blobChunks.length} chunks`);
    return blobChunks;
  } catch (error) {
    console.error('Error splitting audio blob:', error);
    throw error;
  }
}

/**
 * Processes audio blob for streaming transcription, returning 1-minute chunks
 * 
 * @param audioBlob The audio blob to process
 * @param options Additional processing options
 * @returns Promise resolving to array of audio chunk blobs
 */
export async function processAudioBlobForStreaming(
  audioBlob: Blob,
  options: {
    mimeType?: string;
    chunkDurationMs?: number;
  } = {}
): Promise<Blob[]> {
  const { 
    mimeType = audioBlob.type || 'audio/wav',
    chunkDurationMs = 60000 // 1 minute
  } = options;
  
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Determine audio properties (this is simplified - real implementation
    // would need to analyze the audio format from the blob header)
    const sampleRate = 44100; // 44.1 kHz is standard for most audio
    const channels = 2;       // Stereo is common
    const bytesPerSample = 2; // 16-bit PCM is standard
    
    // Split into ArrayBuffer chunks
    const bufferChunks = splitAudioIntoChunks(
      arrayBuffer,
      sampleRate,
      channels,
      bytesPerSample,
      chunkDurationMs
    );
    
    // Convert ArrayBuffers back to Blobs with the original MIME type
    const blobChunks = bufferChunks.map(buffer => new Blob([buffer], { type: mimeType }));
    
    console.log(`Processed audio blob into ${blobChunks.length} chunks for streaming`);
    return blobChunks;
  } catch (error) {
    console.error('Error processing audio blob for streaming:', error);
    throw error;
  }
}

/**
 * Concatenates multiple audio blobs into a single blob
 * 
 * @param blobs Array of audio blobs to concatenate
 * @param mimeType The MIME type of the resulting blob
 * @returns A single concatenated audio blob
 */
export function concatenateAudioBlobs(blobs: Blob[], mimeType: string = 'audio/wav'): Blob {
  // Create array with all blob parts
  const parts: BlobPart[] = blobs.slice();
  
  // Create a new blob by concatenating all parts
  return new Blob(parts, { type: mimeType });
}

/**
 * Gets a signed URL for a blob that can be used for direct browser playback
 * 
 * @param blob The audio blob
 * @returns URL that can be used in audio elements
 */
export function getAudioBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revokes a previously created blob URL to free memory
 * 
 * @param url The URL created by getAudioBlobUrl
 */
export function revokeAudioBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Creates an audio element for a blob with optional auto-play
 * 
 * @param blob The audio blob
 * @param autoPlay Whether the audio should play automatically
 * @returns HTMLAudioElement ready for use
 */
export function createAudioElementFromBlob(blob: Blob, autoPlay: boolean = false): HTMLAudioElement {
  const url = getAudioBlobUrl(blob);
  const audio = new Audio(url);
  
  // Set up cleanup when audio is done
  audio.addEventListener('ended', () => {
    revokeAudioBlobUrl(url);
  });
  
  if (autoPlay) {
    audio.play().catch(err => console.error('Error auto-playing audio:', err));
  }
  
  return audio;
}

/**
 * Gets audio properties from a Web Audio AudioBuffer
 * 
 * @param audioBuffer Web Audio API AudioBuffer
 * @returns Object containing properties needed for chunking
 */
export function getAudioProperties(audioBuffer: AudioBuffer): {
  sampleRate: number;
  channels: number;
  bytesPerSample: number;
  durationMs: number;
} {
  return {
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    bytesPerSample: 2, // Assuming 16-bit PCM
    durationMs: audioBuffer.duration * 1000
  };
}

/**
 * Extracts PCM data from an AudioBuffer for processing
 * 
 * @param audioBuffer Web Audio API AudioBuffer
 * @returns ArrayBuffer containing the PCM audio data
 */
export function getPCMFromAudioBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2; // 16-bit PCM
  
  // Create buffer for interleaved audio data
  const result = new Int16Array(length * numChannels);
  
  // Get audio data from each channel and interleave
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    let offset = channel;
    
    for (let i = 0; i < length; i++) {
      // Convert Float32 to Int16
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      result[offset] = sample < 0 
        ? sample * 0x8000 
        : sample * 0x7FFF;
      offset += numChannels;
    }
  }
  
  return result.buffer;
}

/**
 * Transcription result from Deepgram for a single chunk
 */
interface ChunkTranscriptionResult {
  index: number;
  result: any; // Deepgram result object
  error?: Error;
}

/**
 * Combined transcription results with metadata
 */
export interface CombinedTranscriptionResult {
  text: string;
  fullResults: any[];
  wordTimings: any[];
  duration: number;
  chunkCount: number;
  failed: number;
}

/**
 * Process audio blob in parallel chunks using Deepgram transcription
 * 
 * @param audioBlob The complete audio blob to transcribe
 * @param chunkDurationMs Duration of each chunk in milliseconds
 * @param concurrentRequests Maximum number of concurrent API requests
 * @param transcribeFunction Function to call Deepgram API
 * @returns Combined transcription results
 */
export async function transcribeAudioInParallel(
  audioBlob: Blob,
  chunkDurationMs: number = 60000,
  concurrentRequests: number = 5,
  transcribeFunction: (blobOrBuffer: Blob | Buffer, options?: any, chunkId?: string) => Promise<any>
): Promise<CombinedTranscriptionResult> {
  // Split audio into chunks
  const chunks = await processAudioBlobForStreaming(audioBlob, { chunkDurationMs });
  console.log(`Split audio into ${chunks.length} chunks for parallel transcription`);
  
  // Create a function to process a single chunk
  async function processChunk(chunk: Blob, index: number): Promise<ChunkTranscriptionResult> {
    try {
      console.log(`Starting transcription of chunk ${index + 1}/${chunks.length}`);
      
      // Pass the chunk index to the transcription function
      const result = await transcribeFunction(chunk, undefined, `${index + 1}/${chunks.length}`);
      
      console.log(`Successfully transcribed chunk ${index + 1}/${chunks.length}`);
      return { index, result };
    } catch (error) {
      console.error(`Error transcribing chunk ${index + 1}/${chunks.length}:`, error);
      return { 
        index, 
        result: { transcript: '', words: [] }, 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  }
  
  // Process chunks in batches to limit concurrent requests
  const results: ChunkTranscriptionResult[] = [];
  let failedChunks = 0;
  
  for (let i = 0; i < chunks.length; i += concurrentRequests) {
    const batch = chunks.slice(i, i + concurrentRequests);
    const batchPromises = batch.map((chunk, batchIndex) => 
      processChunk(chunk, i + batchIndex)
    );
    
    console.log(`Processing batch of ${batch.length} chunks (${i+1}-${Math.min(i + concurrentRequests, chunks.length)} of ${chunks.length})`);
    const batchResults = await Promise.all(batchPromises);
    
    // Count failed chunks
    failedChunks += batchResults.filter(r => r.error).length;
    
    // Add batch results to overall results
    results.push(...batchResults);
  }
  
  // Sort results by original chunk index to maintain order
  results.sort((a, b) => a.index - b.index);
  
  // Combine the transcription texts
  const combinedText = results
    .map(r => {
      if (r.error) return '';
      // Extract transcript text from Deepgram result structure
      if (r.result?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        return r.result.results.channels[0].alternatives[0].transcript;
      }
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract word timings with adjusted timestamps
  const wordTimings = results.flatMap((r, chunkIndex) => {
    if (r.error) return [];
    
    const words = r.result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const chunkOffset = chunkIndex * chunkDurationMs / 1000; // Convert ms to seconds
    
    return words.map((word: any) => ({
      ...word,
      // Adjust start and end times to account for chunk position
      start: word.start + chunkOffset,
      end: word.end + chunkOffset
    }));
  });
  
  return {
    text: combinedText,
    fullResults: results.map(r => r.result),
    wordTimings,
    duration: (chunks.length * chunkDurationMs) / 1000, // Approximate duration in seconds
    chunkCount: chunks.length,
    failed: failedChunks
  };
}

/**
 * Sends a chunk to the server-side API endpoint for transcription
 * 
 * @param chunk Audio chunk as a Blob
 * @param options Deepgram transcription options
 * @param chunkId Optional identifier for the chunk
 * @returns Promise resolving to transcription result
 */
async function apiTranscribeChunk(chunk: Blob, options?: any, chunkId?: string): Promise<any> {
  // Create a FormData object to send the audio chunk
  const formData = new FormData();
  formData.append('audio', chunk);
  
  // Include options if provided
  if (options) {
    formData.append('options', JSON.stringify(options));
  }
  
  // Include chunk ID for tracking
  if (chunkId) {
    formData.append('chunkId', chunkId);
  }
  
  // Send the request to the API endpoint
  const response = await fetch('/api/transcribe-chunk', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription API error: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

/**
 * Convenience function to transcribe an audio blob using Deepgram in parallel chunks
 * 
 * @param audioBlob The audio blob to transcribe
 * @param chunkDurationMs Duration of each chunk in milliseconds (default: 60000ms = 1 minute)
 * @param concurrentRequests Maximum number of concurrent API requests (default: 3)
 * @param options Deepgram transcription options
 * @returns Combined transcription results
 */
export async function deepgramTranscribeParallel(
  audioBlob: Blob,
  chunkDurationMs: number = 60000,
  concurrentRequests: number = 3,
  options: any = undefined
): Promise<CombinedTranscriptionResult> {
  // Create a wrapper function that calls the API endpoint
  const transcribeWithOptions = async (blobOrBuffer: Blob | Buffer, opts?: any, chunkId?: string) => {
    // If input is already a Blob, use it directly
    if (blobOrBuffer instanceof Blob) {
      return apiTranscribeChunk(blobOrBuffer, options, chunkId);
    }
    
    // If input is a Buffer, convert to Blob
    const blob = new Blob([blobOrBuffer], { type: audioBlob.type || 'audio/wav' });
    return apiTranscribeChunk(blob, options, chunkId);
  };
  
  return transcribeAudioInParallel(
    audioBlob,
    chunkDurationMs,
    concurrentRequests,
    transcribeWithOptions
  );
}

/**
 * Transcribes audio in parallel using fixed-size chunks
 * 
 * @param audioBlob The audio blob to transcribe
 * @param chunkSizeBytes Size of each chunk in bytes (default: 1MB)
 * @param concurrentRequests Maximum number of concurrent API requests (default: 5)
 * @param options Deepgram transcription options
 * @returns Combined transcription results
 */
export async function transcribeAudioWithFixedSizeChunks(
  audioBlob: Blob,
  chunkSizeBytes: number = 1024 * 1024, // 1MB default chunk size
  concurrentRequests: number = 5, // Increased from 3 to 5
  options: any = undefined
): Promise<CombinedTranscriptionResult> {
  // Split audio into fixed-size chunks
  const chunks = await splitAudioBlobIntoFixedSizeChunks(audioBlob, chunkSizeBytes);
  
  // Create a wrapper function that calls the API endpoint
  const transcribeWithOptions = async (blobOrBuffer: Blob | Buffer, opts?: any, chunkId?: string) => {
    // If input is already a Blob, use it directly
    if (blobOrBuffer instanceof Blob) {
      return apiTranscribeChunk(blobOrBuffer, options, chunkId);
    }
    
    // If input is a Buffer, convert to Blob
    const blob = new Blob([blobOrBuffer], { type: audioBlob.type || 'audio/webm' });
    return apiTranscribeChunk(blob, options, chunkId);
  };
  
  // Process chunks with the transcribe function
  const results: ChunkTranscriptionResult[] = [];
  let failedChunks = 0;
  
  // Process chunks in batches to limit concurrent requests
  for (let i = 0; i < chunks.length; i += concurrentRequests) {
    const batch = chunks.slice(i, i + concurrentRequests);
    const batchPromises = batch.map((chunk, batchIndex) => {
      const index = i + batchIndex;
      
      // Skip extremely small chunks that are likely to fail
      if (chunk.size < 4 * 1024) {
        console.warn(`Skipping chunk ${index + 1}/${chunks.length} because it's too small (${chunk.size} bytes)`);
        return Promise.resolve({
          index,
          result: null,
          error: new Error(`Chunk too small (${chunk.size} bytes)`)
        });
      }
      
      return processChunk(chunk, index, chunks.length, transcribeWithOptions);
    });
    
    console.log(`Processing batch of ${batch.length} fixed-size chunks (${i+1}-${Math.min(i + concurrentRequests, chunks.length)} of ${chunks.length})`);
    const batchResults = await Promise.all(batchPromises);
    
    // Count failed chunks
    failedChunks += batchResults.filter(r => r.error).length;
    
    // Add batch results to overall results
    results.push(...batchResults);
  }
  
  // Sort results by original chunk index to maintain order
  results.sort((a, b) => a.index - b.index);
  
  // Calculate approximate duration based on audio file size and bitrate
  // Assuming 128kbps audio, which is ~16KB per second
  const estimatedDurationSeconds = audioBlob.size / (16 * 1024);
  
  // Combine the transcription texts in order
  const combinedText = results
    .map(r => {
      if (r.error) return '';
      // Extract transcript text from Deepgram result structure
      if (r.result?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        return r.result.results.channels[0].alternatives[0].transcript;
      }
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Calculate precise chunk durations based on chunk size and audio bitrate
  const chunkDurations: number[] = chunks.map(chunk => {
    // Each MB is approximately 8 seconds of audio at 128kbps
    return (chunk.size / (128 * 1024 / 8));
  });
  
  // Calculate chunk start times based on cumulative durations
  const chunkStartTimes: number[] = [];
  let cumulativeTime = 0;
  
  chunkDurations.forEach(duration => {
    chunkStartTimes.push(cumulativeTime);
    cumulativeTime += duration;
  });
  
  // Extract word timings with timestamps adjusted based on precise chunk positions
  const wordTimings = results.flatMap((r, chunkIndex) => {
    if (r.error) return [];
    
    const words = r.result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    
    // Use the calculated start time for this chunk
    const chunkOffset = chunkStartTimes[chunkIndex];
    
    return words.map((word: any) => ({
      ...word,
      // Adjust start and end times to account for chunk position
      start: word.start + chunkOffset,
      end: word.end + chunkOffset
    }));
  });
  
  if (failedChunks > 0) {
    console.warn(`${failedChunks} out of ${chunks.length} chunks failed transcription`);
    
    if (failedChunks === chunks.length) {
      throw new Error(`All ${chunks.length} chunks failed transcription. Check audio format and quality.`);
    }
  }
  
  return {
    text: combinedText,
    fullResults: results.map(r => r.result),
    wordTimings,
    duration: cumulativeTime, // Use the total calculated duration
    chunkCount: chunks.length,
    failed: failedChunks
  };
}

/**
 * Helper function to process a single chunk
 */
async function processChunk(
  chunk: Blob, 
  index: number, 
  totalChunks: number,
  transcribeFunction: (blobOrBuffer: Blob | Buffer, options?: any, chunkId?: string) => Promise<any>
): Promise<ChunkTranscriptionResult> {
  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastError = null;
  
  while (attempt <= MAX_RETRIES) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${MAX_RETRIES} for chunk ${index + 1}/${totalChunks}`);
      }
      
      console.log(`Starting transcription of fixed-size chunk ${index + 1}/${totalChunks} (${(chunk.size / (1024 * 1024)).toFixed(2)}MB)`);
      
      // Short delay before retries to allow for potential temporary issues to resolve
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
      const chunkId = `chunk-${index + 1}-of-${totalChunks}-attempt-${attempt + 1}`;
      const startTime = Date.now();
      
      // If chunk is too small, we might need to pad it or skip it
      if (chunk.size < 4 * 1024) {
        console.warn(`Chunk ${index + 1}/${totalChunks} is very small (${chunk.size} bytes), might cause transcription issues`);
      }
      
      const result = await transcribeFunction(chunk, undefined, chunkId);
      
      const processingTime = Date.now() - startTime;
      console.log(`Chunk ${index + 1}/${totalChunks} transcribed successfully in ${processingTime}ms`);
      
      return { index, result };
    } catch (error: any) {
      lastError = error;
      console.error(`Chunk ${index + 1}/${totalChunks} transcription failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error.message || error);
      
      // Check if this is a retryable error
      const errorMsg = error.message || '';
      const isRetryable = 
        errorMsg.includes('Invalid data received') || 
        errorMsg.includes('network') || 
        errorMsg.includes('timeout') || 
        errorMsg.includes('500') ||
        errorMsg.includes('503');
        
      if (!isRetryable) {
        console.log(`Non-retryable error for chunk ${index + 1}/${totalChunks}, giving up`);
        break;
      }
      
      attempt++;
    }
  }
  
  // All retries failed, return error result
  console.error(`All transcription attempts failed for chunk ${index + 1}/${totalChunks}`);
  return { 
    index, 
    result: null, 
    error: lastError || new Error(`Failed to transcribe chunk ${index + 1}/${totalChunks} after ${MAX_RETRIES + 1} attempts`)
  };
}

/**
 * Directly sends the entire audio blob to the server for transcription
 * Used as a fallback when chunk-based transcription fails
 * 
 * @param audioBlob The complete audio blob to transcribe
 * @param options Deepgram transcription options
 * @returns Promise resolving to transcription result
 */
async function transcribeFullAudio(audioBlob: Blob, options?: any): Promise<any> {
  console.log(`Falling back to full audio transcription for ${(audioBlob.size / (1024 * 1024)).toFixed(2)}MB audio`);
  
  // Create a FormData object to send the audio
  const formData = new FormData();
  formData.append('audio', audioBlob);
  
  // Include options if provided
  if (options) {
    formData.append('options', JSON.stringify(options));
  }
  
  // Send the request to the full transcription API endpoint
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Full transcription API error: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

/**
 * Transcribes audio using the Deepgram API with format matching the traditional API response
 * This function is specifically designed to work with the existing AudioRecorder component
 * 
 * @param audioBlob Audio data as a Blob
 * @param options Optional parameters for transcription
 * @returns Transcription data in the expected format for the AudioRecorder component
 */
export async function transcribeForAudioRecorder(
  audioBlob: Blob,
  options: {
    chunkDurationMs?: number;
    concurrentRequests?: number;
    deepgramOptions?: any;
    chunkSizeBytes?: number;
    useChunking?: boolean;
  } = {}
): Promise<any> {
  const {
    chunkDurationMs = 60000,
    concurrentRequests = 5,
    deepgramOptions,
    chunkSizeBytes = 1024 * 1024, // 1MB default chunk size
    useChunking = true // By default, use chunking for large files
  } = options;

  // If chunking is disabled or audio is small enough (< 5MB), use direct transcription
  if (!useChunking || audioBlob.size < 5 * 1024 * 1024) {
    try {
      console.log(`Using direct transcription for ${(audioBlob.size / (1024 * 1024)).toFixed(2)}MB audio`);
      const result = await transcribeFullAudio(audioBlob, deepgramOptions);
      return result;
    } catch (error) {
      console.error('Direct transcription failed:', error);
      // If direct transcription was explicitly requested (useChunking=false), don't fall back
      if (!useChunking) {
        throw error;
      }
      // Otherwise continue to chunked transcription as fallback
      console.log('Falling back to chunked transcription');
    }
  }

  console.log(`Transcribing audio (${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB) with parallel processing using ${concurrentRequests} concurrent requests`);
  
  try {
    // Try chunked transcription first
    const parallelResult = await transcribeAudioWithFixedSizeChunks(
      audioBlob,
      chunkSizeBytes,
      concurrentRequests,
      deepgramOptions
    );
    
    if (parallelResult.failed > 0) {
      console.warn(`Warning: ${parallelResult.failed} of ${parallelResult.chunkCount} chunks failed transcription`);
      
      // If more than 25% of chunks failed, try the full transcription as fallback
      if (parallelResult.failed / parallelResult.chunkCount > 0.25) {
        console.log(`High failure rate (${parallelResult.failed}/${parallelResult.chunkCount}), attempting full audio transcription fallback`);
        
        try {
          const fallbackResult = await transcribeFullAudio(audioBlob, deepgramOptions);
          return fallbackResult;
        } catch (fallbackError) {
          console.error('Full audio transcription fallback also failed:', fallbackError);
          // Continue with partial results from chunk transcription
          console.log('Using partial results from chunk transcription');
        }
      }
    }
    
    // Restructure the results to match the format expected by AudioRecorder
    const formattedResult = formatDeepgramResult(parallelResult);
    
    return formattedResult;
  } catch (error) {
    console.error('Error in parallel transcription:', error);
    
    // Try the full audio transcription as fallback
    try {
      console.log('Chunk transcription failed completely, attempting full audio transcription fallback');
      const fallbackResult = await transcribeFullAudio(audioBlob, deepgramOptions);
      return fallbackResult;
    } catch (fallbackError) {
      console.error('Full audio transcription fallback also failed:', fallbackError);
      // Re-throw the original error if fallback also fails
      throw error;
    }
  }
}

/**
 * Formats the parallel transcription results to match the standard Deepgram response format
 * expected by the AudioRecorder component
 * 
 * @param parallelResult Results from parallel transcription
 * @returns Formatted results matching standard Deepgram response
 */
function formatDeepgramResult(parallelResult: CombinedTranscriptionResult): any {
  // Basic structure that matches Deepgram's response format
  const formattedResult = {
    metadata: {
      transaction_key: `parallel_transcription_${Date.now()}`,
      request_id: `request_${Date.now()}`,
      sha256: "",
      created: new Date().toISOString(),
      duration: parallelResult.duration,
      channels: 1,
      models: ["nova-2"],
      model_info: { name: "nova-2" }
    },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: parallelResult.text,
              confidence: 0.95,
              words: parallelResult.wordTimings,
              paragraphs: {
                paragraphs: extractParagraphsFromWords(parallelResult.wordTimings)
              }
            }
          ]
        }
      ]
    }
  };
  
  return formattedResult;
}

/**
 * Extracts paragraph structures from word timings based on pauses and speakers
 * 
 * @param words Array of word objects with timing and speaker information
 * @returns Array of paragraph structures compatible with Deepgram format
 */
function extractParagraphsFromWords(words: any[]): any[] {
  if (!words || words.length === 0) {
    return [];
  }
  
  const paragraphs: any[] = [];
  let currentParagraph: any = {
    start: words[0].start,
    end: words[0].end,
    sentences: [],
    speaker: words[0].speaker,
    current_sentence: {
      text: words[0].word,
      start: words[0].start,
      end: words[0].end
    }
  };
  
  // Iterate through words to build sentences and paragraphs
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const previousWord = words[i-1];
    const timeDiff = word.start - previousWord.end;
    const speakerChanged = word.speaker !== undefined && 
                           previousWord.speaker !== undefined && 
                           word.speaker !== previousWord.speaker;
    
    // If significant pause or speaker change, finish current sentence and maybe paragraph
    if (timeDiff > 0.7 || speakerChanged) {
      // Finish the current sentence
      currentParagraph.sentences.push(currentParagraph.current_sentence);
      
      // Start a new paragraph if speaker changed or very long pause (> 2 seconds)
      if (speakerChanged || timeDiff > 2.0) {
        // Finish current paragraph
        currentParagraph.end = previousWord.end;
        paragraphs.push(currentParagraph);
        
        // Start new paragraph
        currentParagraph = {
          start: word.start,
          end: word.end,
          sentences: [],
          speaker: word.speaker,
          current_sentence: {
            text: word.word,
            start: word.start,
            end: word.end
          }
        };
      } else {
        // Just start a new sentence in the same paragraph
        currentParagraph.current_sentence = {
          text: word.word,
          start: word.start,
          end: word.end
        };
      }
    } else {
      // Add to current sentence
      currentParagraph.current_sentence.text += ` ${word.word}`;
      currentParagraph.current_sentence.end = word.end;
      currentParagraph.end = word.end;
    }
  }
  
  // Add the final sentence and paragraph
  if (currentParagraph.current_sentence) {
    currentParagraph.sentences.push(currentParagraph.current_sentence);
    delete currentParagraph.current_sentence;
    paragraphs.push(currentParagraph);
  }
  
  return paragraphs;
}

/**
 * Splits an audio blob into fixed-size chunks of approximately 1MB each
 * 
 * @param audioBlob The audio blob to split
 * @returns Promise resolving to array of audio chunk blobs
 */
export async function splitAudioBlobIntoFixedSizeChunks(
  audioBlob: Blob,
  chunkSizeBytes: number = 1024 * 1024 // 1MB default chunk size
): Promise<Blob[]> {
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);
    const totalBytes = audioBytes.length;
    
    // Use a slightly smaller chunk size for the last chunk to avoid potential issues
    // This prevents creating very small final chunks that might be invalid
    const chunkCount = Math.ceil(totalBytes / chunkSizeBytes);
    const chunks: Blob[] = [];
    
    // Ensure we have a minimum valid chunk size (at least 4KB)
    const minValidChunkSize = 4 * 1024;
    
    console.log(`Splitting ${(totalBytes / (1024 * 1024)).toFixed(2)}MB audio into ${chunkCount} chunks of ~${(chunkSizeBytes / (1024 * 1024)).toFixed(2)}MB each`);
    
    // Split the audio into chunks
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSizeBytes;
      const end = Math.min(start + chunkSizeBytes, totalBytes);
      
      // Skip chunks that are too small to be valid audio
      if (end - start < minValidChunkSize && i < chunkCount - 1) {
        console.warn(`Skipping chunk ${i+1}/${chunkCount} because it's too small (${end-start} bytes)`);
        continue;
      }
      
      const chunkBytes = audioBytes.slice(start, end);
      chunks.push(new Blob([chunkBytes], { type: audioBlob.type || 'audio/webm' }));
    }
    
    // Validate last chunk size, if it's too small, merge with previous chunk
    const lastChunkIndex = chunks.length - 1;
    if (lastChunkIndex > 0 && chunks[lastChunkIndex].size < minValidChunkSize) {
      console.log(`Last chunk is too small (${chunks[lastChunkIndex].size} bytes), merging with previous chunk`);
      
      // Get the last two chunks
      const secondLastChunk = await chunks[lastChunkIndex - 1].arrayBuffer();
      const lastChunk = await chunks[lastChunkIndex].arrayBuffer();
      
      // Merge them
      const mergedArray = new Uint8Array(secondLastChunk.byteLength + lastChunk.byteLength);
      mergedArray.set(new Uint8Array(secondLastChunk), 0);
      mergedArray.set(new Uint8Array(lastChunk), secondLastChunk.byteLength);
      
      // Replace the second last chunk with the merged one and remove the last chunk
      chunks[lastChunkIndex - 1] = new Blob([mergedArray], { type: audioBlob.type || 'audio/webm' });
      chunks.pop();
    }
    
    return chunks;
  } catch (error) {
    console.error('Error splitting audio blob into fixed-size chunks:', error);
    throw error;
  }
}
