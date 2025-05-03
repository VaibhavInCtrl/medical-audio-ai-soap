import { GeminiEmbedding } from '@/core/gemini';

interface MatchResult {
  soapLine: string;
  matchedTranscriptSegments: {
    text: string;
    score: number;
    speaker?: string;
  }[];
}

// Enhanced cache with timestamp to expire entries after 1 hour
interface CacheEntry {
  results: MatchResult[];
  timestamp: number;
}

// Improved cache with expiration
const matchCache: Record<string, CacheEntry> = {};

// Cache expiration time: 1 hour
const CACHE_EXPIRATION_MS = 60 * 60 * 1000;

// Generate a more robust cache key for the given inputs
function getCacheKey(soapNoteHtml: string, transcript: string): string {
  // Use content length and first/last characters to create a more robust key
  const soapLength = soapNoteHtml.length;
  const transcriptLength = transcript.length;
  const soapStart = soapNoteHtml.slice(0, 20);
  const soapEnd = soapNoteHtml.slice(-20);
  const transcriptStart = transcript.slice(0, 20);
  const transcriptEnd = transcript.slice(-20);
  
  return `${soapStart}:${soapEnd}:${soapLength}:${transcriptStart}:${transcriptEnd}:${transcriptLength}`;
}

// Processing queue to prevent concurrent API calls for the same inputs
const processingQueue: Record<string, Promise<MatchResult[]>> = {};

/**
 * Match each line of the SOAP note with its most relevant transcript segments
 * using semantic similarity via embeddings
 * 
 * @param soapNoteHtml The SOAP note HTML content
 * @param transcript The complete transcript
 * @param topMatches Number of transcript segments to match per SOAP line
 * @returns Array of matches between SOAP lines and transcript segments
 */
export async function matchSoapToTranscript(
  soapNoteHtml: string,
  transcript: string,
  topMatches: number = 3
): Promise<MatchResult[]> {
  try {
    // Skip processing if inputs are empty
    if (!soapNoteHtml || !transcript) {
      console.log('Empty inputs, skipping matching process');
      return [];
    }
    
    // Generate cache key
    const cacheKey = getCacheKey(soapNoteHtml, transcript);
    
    // Check if already processing this exact request
    if (processingQueue[cacheKey] !== undefined) {
      console.log('Request already in processing queue, reusing promise');
      return processingQueue[cacheKey];
    }
    
    // Check cache first with expiration validation
    if (matchCache[cacheKey]) {
      const cacheEntry = matchCache[cacheKey];
      const now = Date.now();
      
      // Return cached results if not expired
      if (now - cacheEntry.timestamp < CACHE_EXPIRATION_MS) {
        console.log('Using cached matching results');
        return cacheEntry.results;
      } else {
        console.log('Cache expired, reprocessing');
        // Remove expired cache entry
        delete matchCache[cacheKey];
      }
    }
    
    // Create processing promise and add to queue
    const processingPromise = (async () => {
      console.log('Starting SOAP to transcript matching process');
      
      // Clean and split the SOAP note into lines
      const soapLines = extractLinesFromSoap(soapNoteHtml);
      
      // Split transcript into meaningful segments (by speaker turns or sentences)
      const transcriptSegments = extractSegmentsFromTranscript(transcript);
      
      // Skip processing if no content is available
      if (soapLines.length === 0 || transcriptSegments.length === 0) {
        return [];
      }
      
      console.log(`Processing ${soapLines.length} SOAP lines against ${transcriptSegments.length} transcript segments`);
      
      // De-duplicate transcript segments to reduce API calls
      const uniqueSegments: { [key: string]: {text: string, speaker?: string, indices: number[]} } = {};
      transcriptSegments.forEach((segment, index) => {
        const key = segment.text.trim();
        if (!uniqueSegments[key]) {
          uniqueSegments[key] = {
            text: segment.text,
            speaker: segment.speaker,
            indices: [index]
          };
        } else {
          uniqueSegments[key].indices.push(index);
        }
      });
      
      // Convert back to array of unique segments
      const dedupedSegments = Object.values(uniqueSegments);
      console.log(`Reduced to ${dedupedSegments.length} unique transcript segments`);
      
      // To reduce API calls, batch process the segments
      console.log('Generating transcript segment embeddings...');
      const segmentEmbeddingResults = await Promise.all(
        dedupedSegments.map(segment => 
          GeminiEmbedding.createEmbedding(segment.text)
            .then(embedding => ({ embedding, segment }))
            .catch(error => {
              console.error(`Error generating embedding for segment: ${error}`);
              return null;
            })
        )
      );
      
      // Filter out any failed embeddings
      const segmentEmbeddingsWithData = segmentEmbeddingResults.filter(result => result !== null) as Array<{
        embedding: number[],
        segment: {text: string, speaker?: string, indices: number[]}
      }>;
      
      // For each line in the SOAP note, find the most similar transcript segments
      const matches: MatchResult[] = [];
      
      // De-duplicate SOAP lines to avoid redundant processing
      const uniqueSoapLines: { [key: string]: string } = {};
      soapLines.forEach(line => {
        if (line.trim().length >= 5) {
          uniqueSoapLines[line.trim()] = line;
        }
      });
      
      const uniqueSoapLinesArray = Object.values(uniqueSoapLines);
      console.log(`Reduced to ${uniqueSoapLinesArray.length} unique SOAP lines`);
      
      // Batch process SOAP lines to reduce API calls (max 10 at a time)
      const batchSize = 10;
      for (let i = 0; i < uniqueSoapLinesArray.length; i += batchSize) {
        const batch = uniqueSoapLinesArray.slice(i, i + batchSize);
        console.log(`Processing SOAP lines batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueSoapLinesArray.length/batchSize)}`);
        
        // Generate embeddings for each SOAP line in the batch
        const batchEmbeddingResults = await Promise.all(
          batch.map(line => 
            GeminiEmbedding.createEmbedding(line)
              .then(embedding => ({ embedding, line }))
              .catch(error => {
                console.error(`Error generating embedding for line: ${error}`);
                return null;
              })
          )
        );
        
        // Filter out any failed embeddings
        const batchEmbeddingsWithData = batchEmbeddingResults.filter(result => result !== null) as Array<{
          embedding: number[],
          line: string
        }>;
        
        // Process each line in the batch
        batchEmbeddingsWithData.forEach(({ embedding: lineEmbedding, line: soapLine }) => {
          // Calculate similarity scores with all transcript segments
          const similarities = segmentEmbeddingsWithData.map(({ embedding: segmentEmbedding, segment }) => {
            const score = calculateCosineSimilarity(lineEmbedding, segmentEmbedding);
            
            return {
              segment,
              score
            };
          });
          
          // Sort by similarity score (descending) and take top matches
          const topSegmentMatches = similarities
            .sort((a, b) => b.score - a.score)
            .slice(0, topMatches);
          
          // Map back to original transcript segments format
          const topSegments = topSegmentMatches.map(match => ({
            text: match.segment.text,
            score: match.score,
            speaker: match.segment.speaker
          }));
          
          matches.push({
            soapLine,
            matchedTranscriptSegments: topSegments
          });
        });
      }
      
      console.log('SOAP to transcript matching complete');
      
      // Cache the results with timestamp
      matchCache[cacheKey] = {
        results: matches,
        timestamp: Date.now()
      };
      
      // Remove from processing queue
      delete processingQueue[cacheKey];
      
      return matches;
    })();
    
    // Add to processing queue
    processingQueue[cacheKey] = processingPromise;
    
    return processingPromise;
  } catch (error) {
    console.error('Error matching SOAP note to transcript:', error);
    throw new Error('Failed to match SOAP note to transcript');
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * 
 * @param embeddingA First embedding vector
 * @param embeddingB Second embedding vector
 * @returns Similarity score (0-1)
 */
function calculateCosineSimilarity(embeddingA: number[], embeddingB: number[]): number {
  // Calculate dot product
  const dotProduct = embeddingA.reduce((sum, a, i) => sum + a * embeddingB[i], 0);
  
  // Calculate magnitudes
  const magnitudeA = Math.sqrt(embeddingA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(embeddingB.reduce((sum, b) => sum + b * b, 0));
  
  // Calculate cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Extract meaningful lines from SOAP note HTML
 * 
 * @param soapHtml SOAP note HTML content
 * @returns Array of meaningful text lines
 */
function extractLinesFromSoap(soapHtml: string): string[] {
  // Remove HTML tags
  const plainText = soapHtml.replace(/<[^>]*>/g, ' ');
  
  // Split by line breaks and clean
  let lines = plainText.split(/\n|\r\n|\r/).map(line => line.trim());
  
  // Remove empty lines and very short lines (likely just formatting)
  lines = lines.filter(line => line.length > 0);
  
  // If there are too few lines (HTML might use <p> or <div> without \n),
  // split by periods followed by space to get sentences
  if (lines.length < 5) {
    lines = plainText.split(/\.\s+/).map(line => line.trim() + '.');
  }
  
  return lines;
}

/**
 * Extract meaningful segments from transcript
 * 
 * @param transcript Complete transcript text
 * @returns Array of transcript segments with speaker information
 */
function extractSegmentsFromTranscript(transcript: string): Array<{text: string, speaker?: string}> {
  const segments: Array<{text: string, speaker?: string}> = [];
  
  // Check if transcript has speaker labels (e.g., "Speaker 1: ...")
  const speakerPattern = /^(Speaker\s+\d+|Doctor|Patient|Provider|Nurse|Dr\.\s+[A-Za-z]+):\s*(.+)$/i;
  
  // Split transcript by line breaks
  const lines = transcript.split(/\n|\r\n|\r/).map(line => line.trim());
  
  for (const line of lines) {
    if (line.length === 0) continue;
    
    // Check if line has speaker format
    const speakerMatch = line.match(speakerPattern);
    
    if (speakerMatch) {
      // Line has speaker format
      segments.push({
        text: speakerMatch[2],
        speaker: speakerMatch[1]
      });
    } else {
      // No speaker format, check if it's a continuation or new thought
      if (segments.length > 0 && line.length < 100) {
        // Likely a continuation of previous speaker
        const lastSegment = segments[segments.length - 1];
        lastSegment.text += ' ' + line;
      } else {
        // New segment without speaker info
        segments.push({ text: line });
      }
    }
  }
  
  // If very few segments detected, try splitting by sentences
  if (segments.length < 3) {
    const sentences = transcript.split(/\.\s+/).map(s => s.trim() + '.');
    return sentences.map(text => ({ text }));
  }
  
  return segments;
} 