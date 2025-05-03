import { GeminiEmbedding, GeminiService } from '@/core/gemini';
import { storeVector } from '@/core/vectordb';

interface EmbeddingInput {
  transcript: string;
  soapNote: string;
  userId?: string;
  sessionId?: string;
}

export interface EmbeddingResult {
  transcriptEmbedding: number[];
  soapNoteEmbedding: number[];
  combinedEmbedding?: number[];
  metadata: {
    userId?: string;
    sessionId?: string;
    timestamp: string;
    transcriptLength: number;
    soapNoteLength: number;
  };
}

/**
 * Generates text embeddings for transcript and SOAP note content
 * 
 * @param input Object containing transcript and SOAP note content
 * @returns Promise resolving to embeddings for transcript, SOAP note, and combined content
 */
export async function generateEmbeddings({
  transcript,
  soapNote,
  userId,
  sessionId
}: EmbeddingInput): Promise<EmbeddingResult> {
  try {
    // Clean text content by removing HTML tags and normalizing whitespace
    const cleanTranscript = cleanTextContent(transcript);
    const cleanSoapNote = cleanTextContent(soapNote);

    // Generate embeddings for transcript and SOAP note separately
    const [transcriptEmbedding, soapNoteEmbedding] = await Promise.all([
      GeminiEmbedding.createEmbedding(cleanTranscript),
      GeminiEmbedding.createEmbedding(cleanSoapNote)
    ]);

    // Create a combined embedding by averaging the two vectors (simplified approach)
    // More sophisticated approaches could weight them differently or use other methods
    const combinedEmbedding = combineEmbeddings(transcriptEmbedding, soapNoteEmbedding);

    return {
      transcriptEmbedding,
      soapNoteEmbedding,
      combinedEmbedding,
      metadata: {
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
        transcriptLength: cleanTranscript.length,
        soapNoteLength: cleanSoapNote.length
      }
    };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate embeddings');
  }
}

/**
 * Combines two embedding vectors by averaging them
 * 
 * @param embedding1 First embedding vector
 * @param embedding2 Second embedding vector
 * @returns Combined embedding vector
 */
function combineEmbeddings(embedding1: number[], embedding2: number[]): number[] {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding dimensions do not match');
  }

  return embedding1.map((value, index) => (value + embedding2[index]) / 2);
}

/**
 * Cleans text content by removing HTML tags and normalizing whitespace
 * 
 * @param text Text content to clean
 * @returns Cleaned text
 */
function cleanTextContent(text: string): string {
  // Remove HTML tags
  const noHtml = text.replace(/<[^>]*>/g, ' ');
  
  // Normalize whitespace (collapse multiple spaces, newlines, etc. to single space)
  const normalized = noHtml.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Stores embeddings in a vector database
 * 
 * @param result Embedding result to store
 * @returns Success indicator or database ID
 */
export async function storeEmbeddings(result: EmbeddingResult): Promise<string> {
  const { transcriptEmbedding, soapNoteEmbedding, combinedEmbedding, metadata } = result;
  
  try {
    // Store each embedding type in its own collection
    const [transcriptId, soapNoteId, combinedId] = await Promise.all([
      // Store transcript embedding
      storeVector(
        transcriptEmbedding,
        {
          type: 'transcript',
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          length: metadata.transcriptLength,
          timestamp: metadata.timestamp,
          model: 'gemini-embedding-001'
        },
        'transcripts'
      ),
      
      // Store SOAP note embedding
      storeVector(
        soapNoteEmbedding,
        {
          type: 'soap_note',
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          length: metadata.soapNoteLength,
          timestamp: metadata.timestamp,
          model: 'gemini-embedding-001'
        },
        'soap_notes'
      ),
      
      // Store combined embedding if available
      combinedEmbedding
        ? storeVector(
            combinedEmbedding,
            {
              type: 'combined',
              userId: metadata.userId,
              sessionId: metadata.sessionId,
              transcriptLength: metadata.transcriptLength,
              soapNoteLength: metadata.soapNoteLength,
              timestamp: metadata.timestamp,
              model: 'gemini-embedding-001'
            },
            'combined'
          )
        : Promise.resolve('')
    ]);
    
    console.log(`Stored embeddings: transcript=${transcriptId}, soap=${soapNoteId}, combined=${combinedId}`);
    
    // Return the combined ID as the main reference
    return combinedId || transcriptId;
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw new Error('Failed to store embeddings');
  }
} 