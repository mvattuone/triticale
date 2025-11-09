class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channelData = [];
    this.bufferLength = 0;
    this.windowModifier = 1;
    this.activeGrains = [];
    this.windowCache = new Map();
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    if (!message || !message.type) {
      return;
    }
    const { type, payload } = message;
    switch (type) {
      case 'load-buffer':
        this.loadBuffer(payload);
        break;
      case 'schedule-grain':
        this.scheduleGrain(payload);
        break;
      case 'set-window-modifier':
        this.updateWindowModifier(payload);
        break;
      case 'clear-grains':
        this.activeGrains.length = 0;
        break;
      case 'clear-buffer':
        this.channelData = [];
        this.bufferLength = 0;
        this.activeGrains.length = 0;
        break;
      default:
        break;
    }
  }

  loadBuffer(payload) {
    const channels = payload?.channels || [];
    this.channelData = channels.map((channel) => new Float32Array(channel));
    this.bufferLength = payload?.length || (this.channelData[0]?.length ?? 0);
    this.bufferSampleRate = payload?.sampleRate || sampleRate;
  }

  updateWindowModifier(payload) {
    const nextValue = Number(payload?.value);
    if (Number.isFinite(nextValue)) {
      this.windowModifier = Math.max(0.001, nextValue);
      this.windowCache.clear();
    }
  }

  scheduleGrain(payload) {
    if (!this.channelData.length || !payload) {
      return;
    }
    const startSample = Math.max(0, Math.min(this.bufferLength - 1, Math.floor(payload.startSample || 0)));
    const maxLength = this.bufferLength - startSample;
    const length = Math.max(1, Math.min(maxLength, Math.floor(payload.length || 1)));
    const playbackRate = Number.isFinite(payload.playbackRate)
      ? Math.max(0.25, Math.min(4, payload.playbackRate))
      : 1;
    const modifier = Number.isFinite(payload.windowModifier) ? Math.max(0.001, payload.windowModifier) : this.windowModifier;
    const window = this.getWindow(length, modifier);

    this.activeGrains.push({
      start: startSample,
      cursor: 0,
      length,
      playbackRate,
      window,
      windowIndex: 0,
    });
  }

  getWindow(length, modifier) {
    const key = `${length}|${modifier}`;
    if (this.windowCache.has(key)) {
      return this.windowCache.get(key);
    }
    const window = new Float32Array(length);
    const denominator = Math.max(1, (length - 1) * modifier);
    for (let i = 0; i < length; i += 1) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denominator));
    }
    this.windowCache.set(key, window);
    return window;
  }

  process(_, outputs) {
    const output = outputs[0];
    if (!output || !output.length) {
      return true;
    }

    const channelCount = output.length;
    const blockSize = output[0].length;
    for (let channel = 0; channel < channelCount; channel += 1) {
      output[channel].fill(0);
    }

    if (!this.activeGrains.length || !this.channelData.length) {
      return true;
    }

    const grains = this.activeGrains;
    for (let sampleIndex = 0; sampleIndex < blockSize; sampleIndex += 1) {
      for (let grainIndex = grains.length - 1; grainIndex >= 0; grainIndex -= 1) {
        const grain = grains[grainIndex];
        if (grain.windowIndex >= grain.window.length || grain.cursor >= grain.length) {
          grains.splice(grainIndex, 1);
          continue;
        }

        const absolutePosition = grain.start + grain.cursor;
        const baseIndex = Math.floor(absolutePosition);
        const nextIndex = Math.min(this.bufferLength - 1, baseIndex + 1);
        const interpolation = absolutePosition - baseIndex;
        const envelope = grain.window[grain.windowIndex] || 0;

        for (let channel = 0; channel < channelCount; channel += 1) {
          const sourceChannel = this.channelData[channel] || this.channelData[0];
          if (!sourceChannel) {
            continue;
          }
          const base = sourceChannel[baseIndex] || 0;
          const next = sourceChannel[nextIndex] || 0;
          const sampleValue = base + (next - base) * interpolation;
          output[channel][sampleIndex] += sampleValue * envelope;
        }

        grain.cursor += grain.playbackRate;
        grain.windowIndex += 1;
      }

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][sampleIndex] = Math.max(-1, Math.min(1, output[channel][sampleIndex]));
      }
    }

    for (let i = grains.length - 1; i >= 0; i -= 1) {
      const grain = grains[i];
      if (grain.windowIndex >= grain.window.length || grain.cursor >= grain.length) {
        grains.splice(i, 1);
      }
    }

    return true;
  }
}

registerProcessor('granular-processor', GranularProcessor);
