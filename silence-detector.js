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

        let nonSilentInput;
        ext: for (let channelN = 0; channelN < inputs[0].length; channelN++) {
            for (let i = 0; i < inputs[0][channelN].length; i++) {
                if (Math.abs(inputs[0][channelN][i]) > threshold) {
                    nonSilentInput = inputs[0][channelN];

                    break ext;
                }
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
