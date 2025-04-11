# Audio Stream Checker

A web application for recording, analyzing, and visualizing audio from your microphone with advanced audio processing capabilities.

## Features

- Record audio from your microphone
- Real-time audio waveform visualization
- Audio playback after recording
- Silence detection with configurable threshold
- White noise similarity analysis
- Frequency spectrum analysis (top 5 frequencies)
- Configurable noise suppression
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
3. The application will analyze the audio in real-time, showing:
   - White noise similarity percentage
   - Top 5 frequencies with their magnitudes
   - Silence detection status
4. Click "Stop Recording" to end the recording
5. The recorded audio will be available for playback with a built-in audio player
6. Download the recording as a WAV file

## Audio Analysis Features

- **Silence Detection**: Uses AudioWorkletNode for efficient silence detection
- **White Noise Analysis**: Calculates how similar the audio is to white noise based on spectral flatness
- **Frequency Analysis**: Identifies the top 5 frequency components in the audio
- **Noise Suppression**: Optional noise suppression using browser's built-in capabilities

## Technologies Used

- Vite - Fast build tool and development server
- Web Audio API - Audio processing and visualization
- AudioWorkletNode - Efficient audio processing in a separate thread
- Canvas API - Real-time waveform rendering
- Fast Fourier Transform (FFT) - Frequency analysis

## Browser Support

This application requires a modern browser with support for:
- Web Audio API
- AudioWorkletNode
- getUserMedia API
- Canvas API
- ES6 modules 