import { GeminiService } from '@/core/gemini';

interface VerificationResult {
  isValid: boolean;
  feedback: string;
  correctedOutput?: string;
}

/**
 * Verifies if the AI-generated output meets the expected format and quality requirements
 * 
 * @param prompt The original prompt used to generate the output
 * @param output The AI-generated output to verify
 * @param format The expected format (e.g., 'soap', 'html', 'json')
 * @returns Verification result with validation status and feedback
 */
export async function verifyAIOutput(
  prompt: string,
  output: string,
  format: string = 'soap'
): Promise<VerificationResult> {
  try {
    // Get the Gemini model for verification
    const model = GeminiService.getModel("gemini-1.5-pro");
    
    // Create a verification prompt based on the format
    let verificationPrompt = '';
    
    if (format === 'soap') {
      verificationPrompt = `
You are a medical documentation expert tasked with critically evaluating an AI-generated SOAP note.

ORIGINAL PROMPT:
${prompt}

AI-GENERATED OUTPUT:
${output}

VERIFICATION TASK:
Carefully analyze the AI-generated SOAP note above and verify:

1. Structure: Does it follow proper SOAP (Subjective, Objective, Assessment, Plan) format?
2. Content: Does it include all clinically relevant information from the original prompt?
3. Accuracy: Is the medical information accurate and consistent with the prompt?
4. Completeness: Are all sections properly populated with appropriate content?
5. Format: Is the formatting clean and professional for medical documentation?

CRITICAL INSTRUCTION: Respond with JSON format ONLY - no explanations, no text before or after the JSON.
Your response must start with "{" and end with "}" and contain valid JSON.

Response format:
{
  "isValid": true or false (boolean, not string),
  "feedback": "Detailed explanation of what's correct or incorrect",
  "missingSections": ["List any missing SOAP sections"],
  "formatIssues": ["List any formatting issues"],
  "contentIssues": ["List any content accuracy or completeness issues"],
  "suggestions": ["List specific suggestions for improvement"]
}
`;
    } else if (format === 'html') {
      verificationPrompt = `
You are a web content validator tasked with evaluating if the AI-generated HTML output is valid.

ORIGINAL PROMPT:
${prompt}

AI-GENERATED OUTPUT:
${output}

VERIFICATION TASK:
Carefully analyze the AI-generated HTML above and verify:

1. Structure: Is it properly structured HTML content?
2. Validity: Does it contain well-formed HTML tags?
3. Content: Does it include the content requested in the original prompt?
4. Format: Is it properly formatted for web display?

CRITICAL INSTRUCTION: Respond with JSON format ONLY - no explanations, no text before or after the JSON.
Your response must start with "{" and end with "}" and contain valid JSON.

Response format:
{
  "isValid": true or false (boolean, not string),
  "feedback": "Detailed explanation of what's correct or incorrect",
  "structureIssues": ["List any HTML structure issues"],
  "contentIssues": ["List any content completeness issues"],
  "suggestions": ["List specific suggestions for improvement"]
}
`;
    } else {
      // Generic verification for other formats
      verificationPrompt = `
You are a content validator tasked with evaluating if the AI-generated output meets the expected format and quality.

ORIGINAL PROMPT:
${prompt}

AI-GENERATED OUTPUT:
${output}

EXPECTED FORMAT:
${format}

VERIFICATION TASK:
Carefully analyze the AI-generated output above and verify:

1. Format: Does it match the expected ${format} format?
2. Content: Does it include the content requested in the original prompt?
3. Quality: Is it well-structured and professionally presented?

CRITICAL INSTRUCTION: Respond with JSON format ONLY - no explanations, no text before or after the JSON.
Your response must start with "{" and end with "}" and contain valid JSON.

Response format:
{
  "isValid": true or false (boolean, not string),
  "feedback": "Detailed explanation of what's correct or incorrect",
  "formatIssues": ["List any format issues"],
  "contentIssues": ["List any content issues"],
  "suggestions": ["List specific suggestions for improvement"]
}
`;
    }

    // Generate verification analysis
    const verificationResult = await model.generateContent(verificationPrompt);
    const verificationText = verificationResult.response.text();
    
    // Parse the verification response
    try {
      // Try to extract JSON from the response by looking for JSON-like patterns
      let jsonText = verificationText;
      
      // Remove any leading or trailing non-JSON text
      // Look for the first '{' and the last '}'
      const firstBrace = verificationText.indexOf('{');
      const lastBrace = verificationText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = verificationText.substring(firstBrace, lastBrace + 1);
      }
      
      // Attempt to parse the extracted JSON
      let verificationData;
      try {
        verificationData = JSON.parse(jsonText);
      } catch (initialParseError) {
        // If that failed, try more aggressive JSON extraction/repair
        console.log('Initial JSON parse failed, attempting repair...');
        
        // Try to repair common JSON issues
        const repairedJson = repairJson(jsonText);
        verificationData = JSON.parse(repairedJson);
      }
      
      // Validate the required fields exist
      if (typeof verificationData.isValid !== 'boolean') {
        throw new Error('Missing required "isValid" field in verification response');
      }
      
      // Ensure feedback exists
      const feedback = verificationData.feedback || 
        (verificationData.isValid 
          ? "The SOAP note meets all required quality standards." 
          : "The SOAP note has quality issues that need to be addressed.");
      
      // Return the validation result
      return {
        isValid: verificationData.isValid,
        feedback: feedback,
        // Additional data can be used later for correction if needed
      };
    } catch (parseError) {
      console.error('Error parsing verification response:', parseError);
      console.log('Raw verification response:', verificationText);
      
      // Try to make a basic determination based on content analysis
      const textLowerCase = verificationText.toLowerCase();
      // Check if the response suggests validity
      const seemsValid = 
        textLowerCase.includes('valid') && 
        !textLowerCase.includes('invalid') && 
        !textLowerCase.includes('not valid') &&
        !textLowerCase.includes('issues') &&
        !textLowerCase.includes('problems') &&
        !textLowerCase.includes('missing');
      
      return {
        isValid: seemsValid,
        feedback: "Failed to parse verification response. Based on text analysis, the SOAP note " + 
          (seemsValid ? "appears to be valid." : "may have quality issues that need to be addressed.")
      };
    }
  } catch (error) {
    console.error('Error verifying AI output:', error);
    return {
      isValid: false,
      feedback: error instanceof Error ? error.message : "Unknown error during verification"
    };
  }
}

/**
 * Helper function to repair common JSON syntax issues
 * 
 * @param jsonText The potentially broken JSON text
 * @returns Repaired JSON text that might be parseable
 */
function repairJson(jsonText: string): string {
  let text = jsonText;
  
  // Replace single quotes with double quotes
  text = text.replace(/'/g, '"');
  
  // Fix trailing commas in arrays and objects
  text = text.replace(/,\s*]/g, ']');
  text = text.replace(/,\s*}/g, '}');
  
  // Fix missing quotes around keys
  text = text.replace(/(\w+):/g, '"$1":');
  
  // Fix incorrect True/False to true/false
  text = text.replace(/:\s*True/g, ': true');
  text = text.replace(/:\s*False/g, ': false');
  
  // Fix newlines and special characters in string values
  text = text.replace(/:\s*"([^"]*)(?:\n)([^"]*)"/g, ': "$1\\n$2"');
  
  return text;
}

/**
 * Corrects the AI-generated output based on verification feedback
 * 
 * @param prompt The original prompt used to generate the output
 * @param output The AI-generated output to correct
 * @param feedback Feedback from the verification process
 * @param format The expected format (e.g., 'soap', 'html', 'json')
 * @returns Corrected AI output
 */
export async function correctAIOutput(
  prompt: string,
  output: string,
  feedback: string,
  format: string = 'soap'
): Promise<string> {
  try {
    // Get the Gemini model for correction
    const model = GeminiService.getModel("gemini-1.5-pro");
    
    // Create a correction prompt
    const correctionPrompt = `
You are a medical documentation improvement specialist tasked with correcting an AI-generated ${format} document.

ORIGINAL PROMPT:
${prompt}

ORIGINAL AI OUTPUT:
${output}

VERIFICATION FEEDBACK:
${feedback}

CORRECTION TASK:
Please correct the AI-generated output based on the verification feedback. Produce a new version that:
1. Maintains all accurate information from the original output
2. Follows proper ${format === 'soap' ? 'SOAP (Subjective, Objective, Assessment, Plan)' : format} format
3. Addresses all issues mentioned in the verification feedback
4. Improves completeness, accuracy, and professional formatting
5. Outputs ONLY the corrected content with no additional explanations or comments

Your response should be ONLY the corrected ${format} content, ready for direct use.
`;

    // Generate the corrected output
    const correctionResult = await model.generateContent(correctionPrompt);
    const correctedOutput = correctionResult.response.text();
    
    return correctedOutput;
  } catch (error) {
    console.error('Error correcting AI output:', error);
    throw new Error('Failed to correct AI output');
  }
} 