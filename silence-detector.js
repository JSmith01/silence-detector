class SilenceDetectorNode extends AudioWorkletProcessor {
    _silent = true;

    _active = true;

    static get parameterDescriptors() {
        return [
            {
                name: 'threshold',
                // the first two bits from ADC (16 bit) could be random noise even for muted audio
                defaultValue: 3 / 32768,
                minValue: 0,
                maxValue: 1,
            },
        ];
    }

    constructor() {
        super();
        this.port.onmessage = e => {
            this._silent = true;
            if (e.data === 'dispose') {
                this._active = false;
            }
        };
    }

    notify(nonSilentInput) {
        this.port.postMessage(nonSilentInput);
    }

    process(inputs, outputs, parameters) {
        if (!this._active) return false;

        if (!this._silent) return true;

        const threshold = parameters.threshold[0];

        const input = inputs[0];
        const channel = input[0];
        
        let nonSilentInput;
        for (let i = 0; i < channel.length; i++) {
            if (Math.abs(channel[i]) > threshold) {
                nonSilentInput = channel;

                break;
            }
        }

        if (nonSilentInput) {
            this._silent = false;
            this.notify(nonSilentInput);
        }

        return true;
    }
}

registerProcessor('silence-detector', SilenceDetectorNode);
