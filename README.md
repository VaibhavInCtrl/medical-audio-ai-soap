# Asha Health - AI Medical Scribe

This application provides an AI-powered medical scribe that can transcribe doctor-patient conversations and generate SOAP notes.

## Core Features

1. **Audio Recording**: Capture conversations using the device's microphone
2. **Real-time Transcription**: Convert speech to text using Deepgram's advanced speech-to-text API
3. **SOAP Note Generation**: Automatically organize transcribed text into structured SOAP format

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, HeadlessUI
- **Backend**: Next.js API Routes
- **APIs**: Deepgram for speech-to-text

## Setup Instructions

1. **Clone the repository**

```bash
git clone <repository-url>
cd asha-health
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory with the following content:

```
DEEPGRAM_API_KEY=your_deepgram_api_key
```

You can get a Deepgram API key by signing up at [Deepgram's website](https://deepgram.com).

4. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

- `src/app/page.tsx`: Main application page
- `src/components/AudioRecorder.tsx`: Component for recording audio and getting transcription
- `src/components/SoapNoteGenerator.tsx`: Component for generating SOAP notes from transcript
- `src/app/api/transcribe/route.ts`: API route for Deepgram transcription

## Future Enhancements

1. Live streaming transcription for real-time feedback
2. Integration with Electronic Health Record (EHR) systems
3. Enhanced SOAP note generation with medical terminology recognition
4. Patient data extraction (medications, allergies, etc.)
5. Multi-language support
# medical-audio-ai-soap
