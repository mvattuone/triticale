class Bitcrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits',     defaultValue: 8,   minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'normfreq', defaultValue: 0.1, minValue: 0.0001, maxValue: 1, automationRate: 'a-rate' }
    ];
  }

  constructor() {
    super();
    this._phaser = 0;
    this._last   = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inCh  = input[0];           // mono in
    const outCh = output[0];          // mono out

    let phaser = this._phaser;
    let last   = this._last;

    const bitsArr = parameters.bits;
    const nfArr   = parameters.normfreq;

    for (let i = 0; i < outCh.length; i++) {
      const bits = bitsArr.length > 1 ? bitsArr[i] : bitsArr[0];
      const nf   = nfArr.length   > 1 ? nfArr[i]   : nfArr[0];
      const step = Math.pow(0.5, bits);

      phaser += nf;
      if (phaser >= 1.0) {
        phaser -= 1.0;
        last = step * Math.floor(inCh[i] / step + 0.5);
      }
      outCh[i] = last;
    }

    this._phaser = phaser;
    this._last = last;
    return true;
  }
}

registerProcessor('bitcrusher', Bitcrusher);
