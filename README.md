# Audio Stream Checker

A simple web application for recording and visualizing audio from your microphone.

## Features

- Record audio from your microphone
- Real-time audio waveform visualization
- Audio playback after recording
- Simple and intuitive interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

1. Click the "Start Recording" button to begin recording audio from your microphone
2. The waveform will be displayed in real-time using the Web Audio API
3. Click "Stop Recording" to end the recording
4. The recorded audio will be available for playback with a built-in audio player

## Technologies Used

- Vite - Fast build tool and development server
- Web Audio API - Audio processing and visualization
- Canvas API - Real-time waveform rendering

## Browser Support

This application requires a modern browser with support for:
- Web Audio API
- MediaRecorder API
- getUserMedia API
- Canvas API
- ES6 modules 