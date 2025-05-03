import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, storeEmbeddings } from '@/services/ai/embeddingService';
import { verifyAIOutput, correctAIOutput } from '@/services/ai/verifyAIOutput';
import { GeminiService } from '@/core/gemini';

export async function POST(request: NextRequest) {
  try {
    // Get the data from the request
    const data = await request.json();
    const { transcript, soapNote, userId, sessionId, originalPrompt } = data;

    if (!transcript || !soapNote) {
      return NextResponse.json({ 
        error: 'Missing required data. Both transcript and SOAP note are required.' 
      }, { status: 400 });
    }

    // First, verify that the SOAP note is in the correct format
    const format = soapNote.includes('<') && soapNote.includes('>') ? 'html' : 'soap';
    
    // If originalPrompt is provided, use it for verification
    let verificationResult;
    let correctedSoapNote = soapNote;
    let wasCorrection = false;

    if (originalPrompt) {
      verificationResult = await verifyAIOutput(originalPrompt, soapNote, format);
      
      // If the verification fails, attempt to regenerate with feedback
      if (!verificationResult.isValid) {
        console.log('SOAP note verification failed, attempting correction with feedback...');
        
        try {
          // Use the correction function to fix issues based on verification feedback
          correctedSoapNote = await correctAIOutput(
            originalPrompt, 
            soapNote, 
            verificationResult.feedback, 
            format
          );
          
          // Re-verify the corrected output
          const reVerificationResult = await verifyAIOutput(originalPrompt, correctedSoapNote, format);
          
          // Update verification result with re-verification
          verificationResult = reVerificationResult;
          wasCorrection = true;
          
          // If the corrected version still fails verification, try one more approach:
          // Generate a completely new SOAP note with the feedback incorporated
          if (!reVerificationResult.isValid) {
            console.log('Correction attempt still failed verification, regenerating completely...');
            
            // Get the Gemini model
            const model = GeminiService.getModel("gemini-1.5-pro");
            
            // Create an improved prompt that incorporates the feedback
            const regenerationPrompt = `
You are a highly skilled medical documentation assistant working with healthcare providers.
Generate a comprehensive and well-structured SOAP note based on the following doctor-patient conversation transcript.

PREVIOUS ATTEMPT FAILED VERIFICATION WITH THIS FEEDBACK:
${verificationResult.feedback}

INSTRUCTIONS:
1. Format the note into clear Subjective, Objective, Assessment, and Plan sections.
2. Extract all patient complaints, symptoms, and history for the Subjective section.
3. Identify all measurements, test results, and clinical observations for the Objective section.
4. Formulate a clear assessment that summarizes the patient's condition and potential diagnoses.
5. Detail the treatment plan including medications, therapies, referrals, and follow-up instructions.
6. Use professional medical language and terminology appropriate for medical documentation.
7. Be concise while ensuring all clinically relevant information is included.
8. Format medication prescriptions properly with name, dosage, frequency, and duration.
9. Include any patient education discussed in the Plan section.
10. Maintain factual accuracy - only include information explicitly mentioned in the transcript.
11. Format your response in ${format === 'html' ? 'clean HTML' : 'Markdown'} for easy readability.

ORIGINAL PROMPT:
${originalPrompt}

TRANSCRIPT:
${transcript}

Please generate a complete SOAP note based on this conversation, addressing all the issues mentioned in the feedback.
`;
            
            // Generate a brand new SOAP note
            const regeneratedResult = await model.generateContent(regenerationPrompt);
            const regeneratedNote = regeneratedResult.response.text();
            
            // Clean the response to remove any code block markers
            const cleanedRegeneration = regeneratedNote
              .replace(/^```(html|markdown)?\n?/m, '')
              .replace(/```\s*$/m, '');
            
            // Final verification of the regenerated content
            const finalVerification = await verifyAIOutput(originalPrompt, cleanedRegeneration, format);
            verificationResult = finalVerification;
            
            if (finalVerification.isValid) {
              correctedSoapNote = cleanedRegeneration;
              wasCorrection = true;
            }
          }
        } catch (correctionError) {
          console.error('Error during SOAP note correction:', correctionError);
          // Continue with original verification result and soap note
        }
      }
      
      // If we still don't have a valid SOAP note after all attempts, return an error
      if (!verificationResult.isValid) {
        return NextResponse.json({
          error: 'SOAP note validation failed even after correction attempts',
          feedback: verificationResult.feedback,
          verified: false
        }, { status: 400 });
      }
    }

    // If we get here, we have a valid SOAP note (original or corrected)
    // Generate embeddings for the transcript and valid SOAP note
    const embeddings = await generateEmbeddings({
      transcript,
      soapNote: correctedSoapNote,
      userId,
      sessionId
    });

    // Store the embeddings in the vector database
    const embeddingId = await storeEmbeddings(embeddings);

    // Return success response with embedding IDs and corrected note if applicable
    return NextResponse.json({
      success: true,
      embeddingId,
      verified: verificationResult ? true : 'skipped',
      wasCorrection,
      correctedSoapNote: wasCorrection ? correctedSoapNote : undefined,
      feedback: verificationResult?.feedback
    });
  } catch (error: any) {
    console.error('Embedding generation error:', error);
    
    return NextResponse.json({
      error: 'Failed to generate or store embeddings',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 