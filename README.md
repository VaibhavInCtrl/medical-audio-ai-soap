# Asha Health - AI Medical Scribe

This application provides an AI-powered medical scribe that can transcribe doctor-patient conversations and generate SOAP notes.

## Core Features

1. **Audio Recording**: Capture conversations using the device's microphone
1. **Audio Upload**: Capture conversations using recorded audio clippings
2. **SOAP Note Generation**: Automatically organize transcribed text into structured SOAP format

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, HeadlessUI
- **Backend**: Next.js API Routes
- **APIs**: Deepgram for speech-to-text

## Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/VaibhavInCtrl/medical-audio-ai-soap
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