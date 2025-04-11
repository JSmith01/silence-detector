class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.pcmData = [];
        this.isRecording = false;
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'start') {
                this.isRecording = true;
                this.pcmData = [];
            } else if (event.data.type === 'stop') {
                this.isRecording = false;
                // Send all collected PCM data back to the main thread
                this.port.postMessage({
                    type: 'pcm-data',
                    data: this.pcmData
                });
            }
        };
    }

    process(inputs, outputs) {
        if (!this.isRecording) return true;

        const input = inputs[0];
        if (input.length === 0) return true;

        const channel = input[0];
        const pcm16 = new Int16Array(channel.length);
        
        // Convert Float32Array to Int16Array
        for (let i = 0; i < channel.length; i++) {
            const s = Math.max(-1, Math.min(1, channel[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        this.pcmData.push(pcm16);
        return true;
    }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor); 