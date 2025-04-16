let audioContext;
let analyser;
let canvas;
let canvasCtx;
let animationId;
let silenceDetector;
let pcmCaptureProcessor;
let currentAudioBlob = null;
let mediaStream;

// WebAssembly module and functions
let wasmModule = null;
let initTwiddleFactors = null;
let calculateFrequencyBins = null;

// Load and initialize WebAssembly module
async function initializeWasmModule() {
    try {
        const response = await fetch('fft.wasm');
        const wasmBytes = await response.arrayBuffer();
        
        // Create required imports for WASI and environment
        const importObject = {
            env: {
                memory: new WebAssembly.Memory({ initial: 10, maximum: 100 }),
                wasm_simd128: () => {}, // stub for SIMD feature
            },
            wasi_snapshot_preview1: {
                proc_exit: (code) => {
                    if (code !== 0) {
                        throw new Error(`WASM exit with code ${code}`);
                    }
                },
                fd_write: () => 0,
                fd_close: () => 0,
                fd_seek: () => 0,
                fd_read: () => 0
            }
        };
        
        const result = await WebAssembly.instantiate(wasmBytes, importObject);
        wasmModule = result.instance;
        
        // Get function references
        initTwiddleFactors = wasmModule.exports.init_twiddle_factors;
        calculateFrequencyBins = wasmModule.exports.calculate_frequency_bins;
        
        // Initialize the twiddle factors
        initTwiddleFactors();
        console.log('WebAssembly FFT module initialized successfully');
    } catch (error) {
        console.error('Failed to initialize WebAssembly module:', error);
    }
}

// Initialize WebAssembly module when the page loads
initializeWasmModule().catch(console.error);

function min(array) {
    let m = array[0];
    for (let i = 1; i < array.length; i++) {
        if (array[i] < m) m = array[i];
    }

    return m;
}

function max(array) {
    let m = array[0];
    for (let i = 1; i < array.length; i++) {
        if (array[i] > m) m = array[i];
    }

    return m;
}

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const waveform = document.getElementById('waveform');

// Create download button container
const downloadContainer = document.createElement('div');
downloadContainer.style.margin = '10px 0';
downloadContainer.style.display = 'none';
waveform.parentNode.insertBefore(downloadContainer, waveform);

// Initialize canvas for visualization
canvas = document.createElement('canvas');
canvas.width = waveform.clientWidth;
canvas.height = waveform.clientHeight;
waveform.appendChild(canvas);
canvasCtx = canvas.getContext('2d');

// Precalculate FFT coefficients for 128-point FFT
const FFT_SIZE = 128;
const fftCoefficients = new Float32Array(FFT_SIZE * FFT_SIZE * 2); // [cos, sin] pairs

// Calculate coefficients once
for (let k = 0; k < FFT_SIZE; k++) {
    for (let n = 0; n < FFT_SIZE; n++) {
        const angle = (2 * Math.PI * k * n) / FFT_SIZE;
        const index = (k * FFT_SIZE + n) * 2;
        fftCoefficients[index] = Math.cos(angle);     // cos coefficient
        fftCoefficients[index + 1] = Math.sin(angle); // sin coefficient
    }
}

// Function to create WAV header
function createWavHeader(audioData) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');                      // RIFF identifier
    view.setUint32(4, 36 + audioData.byteLength, true); // File length
    writeString(view, 8, 'WAVE');                      // WAVE identifier
    writeString(view, 12, 'fmt ');                     // fmt chunk
    view.setUint32(16, 16, true);                      // Length of format chunk
    view.setUint16(20, 1, true);                       // Format type (1 = PCM)
    view.setUint16(22, 1, true);                       // Number of channels
    view.setUint32(24, 48000, true);                   // Sample rate
    view.setUint32(28, 48000 * 2, true);               // Byte rate (sampleRate * bytesPerSample * channels)
    view.setUint16(32, 2, true);                       // Block align (bytesPerSample * channels)
    view.setUint16(34, 16, true);                      // Bits per sample
    writeString(view, 36, 'data');                     // data chunk identifier
    view.setUint32(40, audioData.byteLength, true);    // data chunk length
    
    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function createDownloadButton(blob) {
    downloadContainer.innerHTML = '';
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Recording';
    downloadBtn.style.padding = '10px 20px';
    downloadBtn.style.fontSize = '16px';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.style.background = '#2196F3';
    downloadBtn.style.color = 'white';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '4px';
    
    downloadBtn.addEventListener('click', () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    });
    
    downloadContainer.appendChild(downloadBtn);
    downloadContainer.style.display = 'block';
}

function drawWaveform() {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = '#f0f0f0';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#4CAF50';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    animationId = requestAnimationFrame(drawWaveform);
}

// Function to calculate how similar the audio data is to white noise
function calculateWhiteNoiseSimilarity(audioData) {
    const sampleRate = 48000; // From WAV header
    
    // If WebAssembly module is not loaded, fall back to JS implementation
    if (!wasmModule) {
        // Perform FFT using precalculated coefficients
        const fftData = new Float32Array(FFT_SIZE);
        for (let k = 0; k < FFT_SIZE; k++) {
            let real = 0;
            let imag = 0;
            for (let n = 0; n < FFT_SIZE; n++) {
                const coeffIndex = (k * FFT_SIZE + n) * 2;
                const cosCoeff = fftCoefficients[coeffIndex];
                const sinCoeff = fftCoefficients[coeffIndex + 1];
                real += audioData[n] * cosCoeff;
                imag -= audioData[n] * sinCoeff;
            }
            fftData[k] = Math.sqrt(real * real + imag * imag);
        }
        
        let sum = 0;
        let sumSquares = 0;
        const frequencies = [];
        for (let i = 0; i < FFT_SIZE / 2; i++) {
            const magnitude = fftData[i];
            const frequency = i * (sampleRate / FFT_SIZE);
            frequencies.push({ frequency, magnitude });
            sum += magnitude;
            sumSquares += magnitude * magnitude;
        }
        frequencies.sort((a, b) => b.magnitude - a.magnitude);
        const topFrequencies = frequencies.slice(0, 5);
        const mean = sum / (FFT_SIZE / 2);
        const variance = (sumSquares / (FFT_SIZE / 2)) - (mean * mean);
        const stdDev = Math.sqrt(variance);
        const flatness = 1 / (1 + stdDev);
        
        return {
            similarity: flatness,
            topFrequencies: topFrequencies
        };
    }
    
    // Prepare input and output buffers
    const inputBuffer = new Float32Array(FFT_SIZE);
    const outputBins = new Float32Array(FFT_SIZE / 2);
    
    // Copy audio data to input buffer
    for (let i = 0; i < Math.min(audioData.length, FFT_SIZE); i++) {
        inputBuffer[i] = audioData[i];
    }
    
    // Get memory addresses for WebAssembly
    const inputPtr = wasmModule.exports.__heap_base;
    const outputPtr = inputPtr + FFT_SIZE * 4;
    
    // Copy input data to WebAssembly memory
    new Float32Array(wasmModule.exports.memory.buffer, inputPtr, FFT_SIZE).set(inputBuffer);
    
    // Calculate frequency bins using WebAssembly
    calculateFrequencyBins(inputPtr, outputPtr);
    
    // Read results back
    const fftData = new Float32Array(wasmModule.exports.memory.buffer, outputPtr, FFT_SIZE / 2);
    
    let sum = 0;
    let sumSquares = 0;
    const frequencies = [];
    for (let i = 0; i < FFT_SIZE / 2; i++) {
        const magnitude = fftData[i];
        const frequency = i * (sampleRate / FFT_SIZE);
        frequencies.push({ frequency, magnitude });
        sum += magnitude;
        sumSquares += magnitude * magnitude;
    }
    frequencies.sort((a, b) => b.magnitude - a.magnitude);
    const topFrequencies = frequencies.slice(0, 5);
    const mean = sum / (FFT_SIZE / 2);
    const variance = (sumSquares / (FFT_SIZE / 2)) - (mean * mean);
    const stdDev = Math.sqrt(variance);
    const flatness = 1 / (1 + stdDev);
    
    return {
        similarity: flatness,
        topFrequencies: topFrequencies
    };
}

// Start recording
startBtn.addEventListener('click', async () => {
    try {
        const noiseSuppression = document.getElementById('noiseSuppression').checked;
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: noiseSuppression,
                autoGainControl: false
            } 
        });
        
        // Set up audio context and analyser
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load and initialize the AudioWorklets
        await Promise.all([
            audioContext.audioWorklet.addModule('silence-detector.js'),
            audioContext.audioWorklet.addModule('pcm-capture-processor.js')
        ]);
        
        // Create analyser for visualization
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Create processors
        silenceDetector = new AudioWorkletNode(audioContext, 'silence-detector');
        pcmCaptureProcessor = new AudioWorkletNode(audioContext, 'pcm-capture-processor');
        
        // Set up message handler for silence detection
        silenceDetector.port.onmessage = (event) => {
            const snapshot = event.data;
            console.debug('Silence detector message:', snapshot);
            silenceDetector.port.postMessage('ok');
            if (snapshot) {
                const result = calculateWhiteNoiseSimilarity(snapshot);
                console.debug('Result:', result);
                // Format top frequencies for display
                const frequenciesText = result.topFrequencies
                    .map(f => `${(f.frequency/1000).toFixed(1)}kHz (${f.magnitude.toFixed(2)})`)
                    .join(', ');
                if (result.similarity < 0.997 && result.topFrequencies.some(v => v.magnitude > 0.0025 && v.frequency > 0)) {
                    console.error(result);
                }
                
                // When we receive non-silent input, update the status with white noise similarity and frequency info
                statusDiv.textContent = `Status: Audio detected (White noise similarity: ${(result.similarity * 100).toFixed(1)}%, Top frequencies: ${frequenciesText})`;
                statusDiv.style.color = '#000000';
            } else {
                statusDiv.textContent = 'Status: Silence detected';
                statusDiv.style.color = '#ff0000';
            }
        };
        
        // Set up message handler for PCM data
        pcmCaptureProcessor.port.onmessage = (event) => {
            if (event.data.type === 'pcm-data') {
                const pcmData = event.data.data;
                console.log('Received PCM data:', pcmData.length, 'chunks');
                const alldata = pcmData.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []);
                console.log(min(alldata), max(alldata), alldata);
                
                // Combine all PCM chunks into a single Int16Array
                const totalLength = pcmData.reduce((acc, chunk) => acc + chunk.length, 0);
                console.log('Total samples:', totalLength);
                
                const combinedPcm = new Int16Array(totalLength);
                let offset = 0;
                for (const chunk of pcmData) {
                    combinedPcm.set(chunk, offset);
                    offset += chunk.length;
                }
                
                // Create WAV file
                const wavHeader = createWavHeader(combinedPcm.buffer);
                const wavBlob = new Blob([wavHeader, combinedPcm.buffer], { type: 'audio/wav' });
                
                currentAudioBlob = wavBlob;
                const audioUrl = URL.createObjectURL(wavBlob);
                
                // Create audio element for playback
                const audio = new Audio(audioUrl);
                audio.controls = true;
                waveform.appendChild(audio);
                
                // Create download button
                createDownloadButton(wavBlob);
                
                // Clear the message handler after processing the data
                pcmCaptureProcessor.port.onmessage = null;
            }
        };
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        // Connect the audio processing chain
        source.connect(analyser);
        source.connect(pcmCaptureProcessor);
        source.connect(silenceDetector);
        
        // Start PCM capture
        pcmCaptureProcessor.port.postMessage({ type: 'start' });
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusDiv.textContent = 'Status: Recording...';
        statusDiv.style.color = '#000000';
        downloadContainer.style.display = 'none';
        
        // Start visualization
        drawWaveform();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusDiv.textContent = 'Error: Could not access microphone';
    }
});

// Stop recording
stopBtn.addEventListener('click', () => {
    if (audioContext) {
        // Stop PCM capture
        pcmCaptureProcessor.port.postMessage({ type: 'stop' });
        silenceDetector.port.postMessage('dispose');
        
        // Disconnect all nodes
        analyser.disconnect();
        silenceDetector.disconnect();
        pcmCaptureProcessor.disconnect();
        
        // Stop all tracks in the media stream
        mediaStream.getTracks().forEach(track => track.stop());
        
        // Stop visualization
        cancelAnimationFrame(animationId);
        
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusDiv.textContent = 'Status: Recording stopped';
        statusDiv.style.color = '#000000';
        
        // Clear the silence detector message handler immediately
        silenceDetector.port.onmessage = null;
        
        // Keep the PCM capture processor message handler until we receive the data
        // It will be cleared after we receive the PCM data in the message handler
    }
});
