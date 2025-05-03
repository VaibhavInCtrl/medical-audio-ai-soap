import { GeminiEmbedding, GeminiService } from '@/core/gemini';
import { findSimilarVectors } from '@/core/vectordb';

interface SearchResult {
  id: string;
  score: number;
  metadata: {
    userId?: string;
    sessionId?: string;
    timestamp: string;
    type: string;
    [key: string]: any;
  };
}

/**
 * Search for similar sessions based on a text query
 * 
 * @param query User's text query
 * @param limit Maximum number of results to return
 * @param collectionName Collection to search in (transcripts, soap_notes, or combined)
 * @returns Promise resolving to search results
 */
export async function searchSimilarSessions(
  query: string,
  limit: number = 5,
  collectionName: string = 'combined'
): Promise<SearchResult[]> {
  try {
    // Generate an embedding for the search query
    const queryEmbedding = await GeminiEmbedding.createEmbedding(query);
    
    // Search for similar vectors in the specified collection
    const similarVectors = await findSimilarVectors(queryEmbedding, limit, collectionName);
    
    // Map to a cleaner result format and ensure metadata has the required fields
    return similarVectors.map(result => ({
      id: result.id,
      score: result.score,
      metadata: {
        ...result.metadata,
        // Ensure required fields exist
        timestamp: result.metadata.timestamp || new Date().toISOString(),
        type: result.metadata.type || 'unknown'
      }
    }));
  } catch (error) {
    console.error('Error searching for similar sessions:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to search for similar sessions');
  }
}

/**
 * Find sessions related to a specific session ID
 * 
 * @param sessionId ID of the session to find related sessions for
 * @param limit Maximum number of results to return
 * @param minScore Minimum similarity score threshold (0-1)
 * @returns Promise resolving to related sessions
 */
export async function findRelatedSessions(
  sessionId: string,
  limit: number = 3,
  minScore: number = 0.7
): Promise<SearchResult[]> {
  try {
    // Search in the combined collection
    const allResults = await findSimilarVectors([], limit + 1, 'combined');
    
    // Filter out the session itself and enforce minimum score
    const filteredResults = allResults
      .filter(result => 
        result.metadata.sessionId !== sessionId && 
        result.score >= minScore
      )
      .slice(0, limit);
    
    // Map to a cleaner result format and ensure metadata has the required fields
    return filteredResults.map(result => ({
      id: result.id,
      score: result.score,
      metadata: {
        ...result.metadata,
        // Ensure required fields exist
        timestamp: result.metadata.timestamp || new Date().toISOString(),
        type: result.metadata.type || 'combined'
      }
    }));
  } catch (error) {
    console.error('Error finding related sessions:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to find related sessions');
  }
}

/**
 * Get semantic search results for SOAP notes based on a medical keyword or concept
 * 
 * @param medicalConcept Medical keyword or concept to search for
 * @param limit Maximum number of results to return
 * @returns Promise resolving to search results
 */
export async function searchMedicalConcepts(
  medicalConcept: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    // Generate an embedding for the medical concept
    const conceptEmbedding = await GeminiEmbedding.createEmbedding(medicalConcept);
    
    // Search in the SOAP notes collection specifically
    const similarVectors = await findSimilarVectors(conceptEmbedding, limit, 'soap_notes');
    
    // Map to a cleaner result format and ensure metadata has the required fields
    return similarVectors.map(result => ({
      id: result.id,
      score: result.score,
      metadata: {
        ...result.metadata,
        // Ensure required fields exist
        timestamp: result.metadata.timestamp || new Date().toISOString(),
        type: result.metadata.type || 'soap_note'
      }
    }));
  } catch (error) {
    console.error('Error searching for medical concepts:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to search for medical concepts');
  }
} 