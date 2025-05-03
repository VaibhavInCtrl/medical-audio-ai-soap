import { GoogleGenerativeAI } from '@google/generative-ai';

// Get the Gemini API key from environment variables
// In Next.js, environment variables from .env.local are automatically loaded into process.env
const apiKey = "AIzaSyAuISTfoAiMrBm0Nqpy8jFiMStB9Ug-gBw";

// Initialize the Gemini API client if API key is available
// Note: This will only work in server-side code
export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Gemini service for API operations
 */
export class GeminiService {
  /**
   * Check if the Gemini API client is configured
   * @param silent If true, return false instead of throwing error
   * @returns True if client is valid, false if not (when silent=true)
   * @throws Error if API key is not set (when silent=false)
   */
  static validateClient(silent: boolean = false): boolean {
    if (!apiKey || !genAI) {
      if (silent) return false;
      throw new Error('GEMINI_API_KEY is not set in environment variables. Make sure it is defined in .env.local and note that Gemini features only work in server-side code.');
    }
    return true;
  }

  /**
   * Get a generative model instance
   * 
   * @param model Model name to use (defaults to "gemini-1.5-pro")
   * @returns The generative model instance
   */
  static getModel(model: string = "gemini-1.5-pro") {
    this.validateClient();
    return genAI!.getGenerativeModel({ model });
  }

  /**
   * Initialize a Gemini client with the given API key
   * Useful for testing or non-environment based configurations
   * 
   * @param key The API key to use
   * @returns The initialized GoogleGenerativeAI instance
   */
  static initializeClient(key: string): GoogleGenerativeAI {
    if (!key) {
      throw new Error('Cannot initialize Gemini client with empty API key');
    }
    return new GoogleGenerativeAI(key);
  }
}

/**
 * Gemini Embedding service for generating text embeddings
 */
export class GeminiEmbedding {
  /**
   * Default embedding model
   */
  private static readonly DEFAULT_MODEL = 'embedding-001';

  /**
   * Generate embeddings for the given text using Gemini
   * 
   * @param text Text to generate embeddings for
   * @param model Optional model to use (defaults to embedding-001)
   * @param customClient Optional custom Gemini client (useful for testing)
   * @returns Array of embedding values
   */
  static async createEmbedding(
    text: string,
    model: string = this.DEFAULT_MODEL,
    customClient?: GoogleGenerativeAI
  ): Promise<number[]> {
    // Use provided client or validate the global one
    const client = customClient || (GeminiService.validateClient(), genAI!);

    try {
      // Truncate text if it's too long (Gemini has token limits)
      // Current limit is around 3072 tokens for text-embedding-001
      const truncatedText = text.slice(0, 8000);

      // Get the embedding model
      const embeddingModel = client.getGenerativeModel({ model });
      
      // Generate the embedding
      const result = await embeddingModel.embedContent(truncatedText);
      const embedding = result.embedding.values;
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding with Gemini:', error);
      throw new Error('Failed to generate embedding with Gemini');
    }
  }
} 