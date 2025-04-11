class SilenceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.threshold = 0.0001;
        this.silenceStartTime = null;
        this.isProcessing = true;
        this.port.onmessage = (event) => {
            if (event.data.type === 'set-threshold') {
                this.threshold = event.data.threshold;
            } else if (event.data.type === 'stop') {
                this.isProcessing = false;
            }
        };
    }

    process(inputs, outputs) {
        if (!this.isProcessing) return true;

        const input = inputs[0];
        if (input.length === 0) return true;

        const channel = input[0];
        let sum = 0;
        let rms = 0;

        for (let i = 0; i < channel.length; i++) {
            sum += channel[i] * channel[i];
        }

        rms = Math.sqrt(sum / channel.length);
        const isSilent = rms < this.threshold;

        this.port.postMessage({
            type: 'audio-level',
            level: rms,
            isSilent: isSilent
        });

        if (isSilent) {
            if (this.silenceStartTime === null) {
                this.silenceStartTime = currentTime;
            }
            const silenceDuration = currentTime - this.silenceStartTime;
            if (silenceDuration >= 1.0) {
                this.port.postMessage({
                    type: 'silence-detected',
                    duration: silenceDuration,
                    level: rms
                });
            }
        } else {
            this.silenceStartTime = null;
        }

        return true;
    }
}

registerProcessor('silence-processor', SilenceProcessor); 