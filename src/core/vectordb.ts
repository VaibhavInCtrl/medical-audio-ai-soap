/**
 * Vector database client for storing and retrieving embeddings
 * This is a placeholder implementation that can be replaced with an actual
 * vector database client like Pinecone, Weaviate, Qdrant, etc.
 */

// In-memory storage for development/testing purposes
const inMemoryVectorStore: Record<string, {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}> = {};

/**
 * Store a vector in the vector database
 * 
 * @param vector Embedding vector to store
 * @param metadata Additional metadata to store with the vector
 * @param collectionName Optional collection/namespace to store the vector in
 * @returns ID of the stored vector
 */
export async function storeVector(
  vector: number[],
  metadata: Record<string, any>,
  collectionName: string = 'default'
): Promise<string> {
  // Generate a unique ID for the vector
  const id = `vec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Store the vector in the in-memory store
  // In a real implementation, this would be a call to a vector database API
  inMemoryVectorStore[id] = {
    id,
    vector,
    metadata: {
      ...metadata,
      collectionName,
      timestamp: new Date().toISOString(),
    }
  };
  
  console.log(`Stored vector ${id} in collection ${collectionName}`);
  
  return id;
}

/**
 * Retrieve similar vectors from the vector database
 * 
 * @param queryVector Vector to find similar vectors for
 * @param limit Maximum number of results to return
 * @param collectionName Optional collection/namespace to search in
 * @returns Array of similar vectors with their similarity scores and metadata
 */
export async function findSimilarVectors(
  queryVector: number[],
  limit: number = 10,
  collectionName: string = 'default'
): Promise<Array<{
  id: string;
  score: number;
  vector: number[];
  metadata: Record<string, any>;
}>> {
  // Get all vectors from the specified collection
  const vectors = Object.values(inMemoryVectorStore).filter(
    entry => entry.metadata.collectionName === collectionName
  );
  
  // Calculate cosine similarity between the query vector and all vectors in the collection
  const results = vectors.map(entry => {
    const similarity = calculateCosineSimilarity(queryVector, entry.vector);
    
    return {
      id: entry.id,
      score: similarity,
      vector: entry.vector,
      metadata: entry.metadata
    };
  });
  
  // Sort by similarity score (highest first) and limit the results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param vector1 First vector
 * @param vector2 Second vector
 * @returns Cosine similarity score between 0 and 1
 */
function calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vector dimensions do not match');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
  }
  
  // Calculate magnitudes
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Calculate cosine similarity
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0; // Avoid division by zero
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Delete a vector from the vector database
 * 
 * @param id ID of the vector to delete
 * @returns Boolean indicating success
 */
export async function deleteVector(id: string): Promise<boolean> {
  if (inMemoryVectorStore[id]) {
    delete inMemoryVectorStore[id];
    return true;
  }
  
  return false;
}

/**
 * Get all vectors from the vector database in a specific collection
 * 
 * @param collectionName Name of the collection to get vectors from
 * @returns Array of vectors and their metadata
 */
export async function getAllVectors(collectionName: string = 'default'): Promise<Array<{
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}>> {
  return Object.values(inMemoryVectorStore).filter(
    entry => entry.metadata.collectionName === collectionName
  );
} 