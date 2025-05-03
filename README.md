## Features

- **Advanced Audio Recording**: Record high-quality audio directly in the browser
- **Audio File Upload**: Support for various audio formats (WAV, MP3, MP4, WebM)
- **Parallel Audio Processing**: Efficient chunked processing for faster transcription
- **Speaker Diarization**: Automatically identify different speakers in the conversation
- **Medical SOAP Note Generation**: AI-powered generation of structured medical notes
- **Transcript Verification**: Quality checks to ensure accurate transcription
- **Text Embeddings**: Vector embeddings for efficient text similarity search
- **Interactive Hover Insights**: Contextual information displayed on hover for medical terms

## Quick Setup

For a quick setup, use our automated setup scripts:

### On macOS/Linux
```bash
# Make the script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

### On Windows
```
# Run the setup script
setup.bat
```

The script will automatically:
1. Check for prerequisites (Node.js, npm, git)
2. Install dependencies
3. Configure environment variables 
4. Build the project
5. Start the development server

## Manual Setup

If you prefer a manual setup:

1. **Prerequisites**
   - Node.js (v18.0.0 or higher)
   - npm (usually comes with Node.js)
   - git

2. **Installation**
   ```bash
   # Clone the repository (if you haven't already)
   git clone https://github.com/your-username/asha-health.git
   cd asha-health

   # Install dependencies
   npm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file in the project root with:
   ```
   # Deepgram API Key
   DEEPGRAM_API_KEY=your_deepgram_api_key

   # Gemini API Key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Development**
   ```bash
   # Start the development server
   npm run dev
   ```

5. **Production Build**
   ```bash
   # Create a production build
   npm run build

   # Start the production server
   npm start
   ```

## Usage

1. Open the application in your browser (default: http://localhost:3000)
2. Record audio using the "Start Recording" button or upload an audio file
3. Wait for the transcription to process (larger files may take longer)
4. Review the transcript with speaker diarization
5. View the generated SOAP notes

## Architecture

The application uses:
- Next.js for the frontend and API routes
- Deepgram API for audio transcription
- Gemini API for SOAP note generation
- Custom audio processing service for efficient parallel chunk processing
- Server-side proxy endpoints to handle API calls securely