import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/core/gemini';
import { verifyAIOutput, correctAIOutput } from '@/services/ai/verifyAIOutput';

export async function POST(request: NextRequest) {
  try {
    // Check if Gemini client is properly configured - with a friendly error message
    if (!GeminiService.validateClient(true)) {
      return NextResponse.json({ 
        error: 'Gemini API key not found. Please add GEMINI_API_KEY to your environment variables (.env.local)' 
      }, { status: 500 });
    }

    // Get the data from the request
    const data = await request.json();
    const { transcription, patientInfo, format = 'markdown', speakerData } = data;

    if (!transcription) {
      return NextResponse.json({ error: 'No transcription provided' }, { status: 400 });
    }

    // Create a prompt for SOAP note generation
    const formatInstructions = format === 'html' 
      ? `
11. Output your response in clean HTML format suitable for direct display in a web application.
12. Use appropriate HTML tags (<h1>, <h2>, <p>, <ul>, <li>, etc.) for proper formatting.
13. Use HTML structure to ensure clear visual hierarchy.
14. Make sure the HTML is well-formed and valid.
15. Add appropriate classes for sections (e.g., class="subjective", class="objective", etc.).
16. DO NOT include the full HTML document structure (no <!DOCTYPE>, <html>, <body> tags).
17. Only include the content that should be displayed.
18. DO NOT wrap your response in code block markers or fences like \`\`\`html or \`\`\`.`
      : `
11. Format your response in Markdown for easy readability.
12. Use Markdown headings, lists, and other formatting as appropriate.
13. DO NOT wrap your response in code block markers like \`\`\` or \`\`\`markdown.`;

    // Add context about the conversation structure if speakerData is provided
    let conversationContext = '';
    if (speakerData && speakerData.hasDiarization) {
      conversationContext = `
CONVERSATION STRUCTURE:
The transcript includes speaker identification with ${speakerData.speakerCount} distinct speakers.
The transcript is formatted with "Speaker X:" prefixes to identify who is speaking.
Speaker 0 is typically the healthcare provider, and other speakers are typically patients or family members.
Use this speaker structure to better understand the conversation flow and the roles of each participant.
`;
    }

    const prompt = `
You are a highly skilled medical documentation assistant working with healthcare providers.
Generate a comprehensive and well-structured SOAP note based on the following doctor-patient conversation transcript.

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
${formatInstructions}

PATIENT BACKGROUND:
${patientInfo || 'No additional patient information provided.'}
${conversationContext}
TRANSCRIPT:
${transcription}

Please generate a complete SOAP note based on this conversation.
IMPORTANT: Do not include any code block formatting markers like \`\`\` or \`\`\`html in your response.
`;

    // Set up the model using our service
    const model = GeminiService.getModel("gemini-1.5-pro");
    
    // Generate the initial SOAP note
    const result = await model.generateContent(prompt);
    const response = result.response;
    let initialText = response.text();
    
    // Clean the response to remove any code block markers
    initialText = initialText.replace(/^```(html|markdown)?\n?/m, ''); // Remove opening code fence
    initialText = initialText.replace(/```\s*$/m, ''); // Remove closing code fence

    // Verify the generated SOAP note
    const formatType = format === 'html' ? 'html' : 'soap';
    const verification = await verifyAIOutput(prompt, initialText, formatType);
    
    // If the output is valid, return it directly
    if (verification.isValid) {
      console.log('SOAP note verification passed');
      return NextResponse.json({ 
        soapNote: initialText,
        verificationStatus: 'passed'
      });
    }
    
    // If the output has issues, generate a corrected version
    console.log('SOAP note verification failed, generating corrected version');
    const correctedText = await correctAIOutput(prompt, initialText, verification.feedback, formatType);
    
    // Return the corrected output with verification status
    return NextResponse.json({ 
      soapNote: correctedText,
      verificationStatus: 'corrected',
      verificationFeedback: verification.feedback
    });
  } catch (error) {
    console.error('SOAP generation error:', error);
    
    // Provide a more helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to generate SOAP note', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
} 