import Databender from "databender";
import Pizzicato from "pizzicato";
import { chunk } from 'helpers/chunk.js';
import { hannWindow } from 'helpers/hannWindow.js';
import { ensureBoxSizing } from 'helpers/boxSizing.js';

function random(x, y) {
 return x+(y-x+1)*crypto.getRandomValues(new Uint32Array(1))[0]/2**32|0
};

const loadBitcrusherModule = (() => {
  const loadedOn = new WeakSet();
  return async (context) => {
    if (!context?.audioWorklet || loadedOn.has(context)) {
      return;
    }
    await context.audioWorklet.addModule(new URL('effects/bitcrusher.js', import.meta.url));
    loadedOn.add(context);
  };
})();

export default class SynthBrain extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.audioGrains = [];
    this.imageGrains = [];
    this.config = {
      effectsChainMode: 'series',
      effects: {
        delay: {
          active: false,
          feedback: 0.6,
          time: 0.4,
          mix: 0.5,
        },
        bitcrusher: {
          active: false,
          bits: 8,
          bufferSize: 4096,
          normfreq: 0.1,
        },
        detune: {
          active: true,
          value: 0,
          randomize: false,
          randomValues: 4,
          enablePartial: false,
          areaOfEffect: 0.5,
        },
        biquad: {
          active: false,
          areaOfEffect: 1,
          biquadFrequency: 8500,
          detune: 0,
          enablePartial: false,
          quality: 1,
          randomValues: 2,
          randomize: false,
          type: "lowpass",
        },
      },
      grainIndex: 1,
      grainDuration: 200,
      density: 1,
      window: 1,
      spray: 1,
      random: 0,
    };
    this.databender = new Databender(
      {
        config: this.config.effects,
        effectsChain: [
          this.usePizzicatoEffect(Pizzicato.Effects.Delay, () => this.getEffectOptions("delay")),
          async (payload) => this.bitcrusherFactory(payload),
          (payload) => this.detune(payload),
          (payload) => this.biquadFilter(payload),
        ],
      },
      this.audioCtx,
    );
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.bufferSource;
    this.activeSources = new Set();
    this.isPlaying = false;
    this.playTimers = [];
    this.processedAudioSelection = null;
    this.processedAudioSelectionPromise = null;
    this.notifyGrainCounts();
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("image-cleared", this.handleImageCleared);
    this.addEventListener("update-sample", this.updateAudioSelection);
    this.addEventListener("play-synth", this.playSynth);
    this.addEventListener("stop-synth", this.stopSynth);
    this.addEventListener("update-config", this.handleUpdateConfig);
    this.addEventListener("audio-cleared", this.handleAudioCleared);
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("image-cleared", this.handleImageCleared);
    this.removeEventListener("update-sample", this.updateAudioSelection);
    this.removeEventListener("play-synth", this.playSynth);
    this.removeEventListener("stop-synth", this.stopSynth);
    this.removeEventListener("update-config", this.handleupdateConfig);
    this.removeEventListener("audio-cleared", this.handleAudioCleared);
  }


  bitcrusherFactory = async (payload) => {
    const { context, config } = payload;
    await loadBitcrusherModule(context);
    return this.bitcrusher({ context, config }); // your existing constructor
  };

  handleUpdateConfig(e) {
    const { name, value } = e.detail;

    return this.updateConfig(name, value);
  }

  bitcrusher({ context, config }) {
    const options = (config && config.bitcrusher)
      ? config.bitcrusher
      : this.getEffectOptions('bitcrusher');
    if (!options?.active) {
      return null;
    }

    const rawBits = Number(options.bits);
    const normalizedBits = Number.isFinite(rawBits) ? rawBits : 8;
    const bitsValue = Math.max(1, Math.min(16, Math.round(normalizedBits)));

    const rawNormfreq = Number(options.normfreq);
    const normalizedNormfreq = Number.isFinite(rawNormfreq) ? rawNormfreq : 0.1;
    const normfreqValue = Math.max(0.0001, Math.min(1, normalizedNormfreq));

    const node = new AudioWorkletNode(context, 'bitcrusher', {
      parameterData: {
        bits: bitsValue,
        normfreq: normfreqValue,
      },
    });

    const bitsParam = node.parameters?.get('bits');
    const normfreqParam = node.parameters?.get('normfreq');
    const currentTime = typeof context.currentTime === 'number' ? context.currentTime : 0;

    if (bitsParam) {
      bitsParam.setValueAtTime(bitsValue, currentTime);
    }

    if (normfreqParam) {
      normfreqParam.setValueAtTime(normfreqValue, currentTime);
    }

    return { input: node, output: node };
  }


  applyBitcrusherVisuals(buffer) {
    const effectConfig = this.config?.effects?.bitcrusher;
    if (!effectConfig?.active) {
      return;
    }

    const channelData = buffer?.getChannelData?.(0);
    if (!channelData) {
      return;
    }

    const bits = Math.max(1, Math.min(16, Math.round(Number(effectConfig.bits) || 8)));
    const normfreq = Math.max(0.0001, Math.min(1, Number(effectConfig.normfreq) || 0.1));
    const step = Math.pow(0.5, bits);
    let phaser = 0;
    let lastNormalized = 0;

    for (let index = 0; index < channelData.length; index++) {
      const normalizedSample = Math.max(0, Math.min(1, channelData[index] / 255));
      phaser += normfreq;
      if (phaser >= 1.0) {
        phaser -= 1.0;
        lastNormalized = step * Math.floor(normalizedSample / step + 0.5);
      }
      channelData[index] = Math.max(0, Math.min(255, lastNormalized * 255));
    }
  }



  biquadFilter({ config, context, source }) {
     if (config.biquad.randomize) {
    var waveArray = new Float32Array(config.biquad.randomValues);
    for (let i=0;i<config.biquad.randomValues;i++) {
      waveArray[i] = random(0.0001, config.biquad.biquadFrequency); 
    }
  }
  var biquadFilter = context.createBiquadFilter();
  biquadFilter.type = config.biquad.type;
  if (config.biquad.randomize) {
    biquadFilter.frequency.cancelScheduledValues(0);
    biquadFilter.frequency.setValueCurveAtTime(waveArray, 0, source.buffer.duration);
    biquadFilter.detune.setValueCurveAtTime(waveArray, 0, source.buffer.duration);
  } else if (config.biquad.enablePartial) {
    biquadFilter.frequency.cancelScheduledValues(0);
    biquadFilter.frequency.setTargetAtTime(config.biquad.biquadFrequency, config.biquad.areaOfEffect, config.biquad.areaOfEffect);
  } else {
    biquadFilter.frequency.cancelScheduledValues(0);
    biquadFilter.frequency.value = config.biquad.biquadFrequency;
  };
  biquadFilter.Q.value = config.biquad.quality;
  biquadFilter.detune.cancelScheduledValues(0);
  biquadFilter.detune.value = config.biquad.detune;
  return biquadFilter;
  }

  detune({ config, source, }) {
    if (config.detune.randomize) {
      var waveArray = new Float32Array(config.detune.randomValues);
      for (let i=0;i<config.detune.randomValues;i++) {
        waveArray[i] = random(0.0001, 400); 
      }

      source.detune.setValueCurveAtTime(waveArray, 0, source.buffer.duration);
    } else if (config.detune.enablePartial) {
      source.detune.setTargetAtTime(config.detune.value, config.detune.areaOfEffect, config.detune.areaOfEffect);
    } else {
      source.detune.value = config.detune.value;
    };
      
    return null;
  }

  updateConfig(name, value) { 
    const [rootKey] = name.split(".");

    if (!Object.keys(this.config).includes(rootKey)) {
      console.warn(`${name} is not a valid config parameter`);
      return;
    }

    let nextValue = value;

    if (name === 'effectsChainMode') {
      nextValue = value === 'parallel' ? 'parallel' : 'series';
    }

    if (name === 'grainDuration') {
      if (typeof nextValue !== 'number') {
        nextValue = parseFloat(nextValue);
      }

      if (!Number.isFinite(nextValue)) {
        nextValue = this.config.grainDuration;
      }

      nextValue = Math.max(1, Math.min(nextValue, 1000));
    }

    if (name === 'grainIndex') {
      if (typeof nextValue !== 'number') {
        nextValue = parseFloat(nextValue);
      }

      if (!Number.isFinite(nextValue)) {
        nextValue = this.config.grainIndex;
      }

      nextValue = Math.max(1, Math.round(nextValue + 1));
    }

    if (name.includes(".")) {
      const segments = name.split(".");
      if (segments.length === 2) {
        const [groupKey, valueKey] = segments;
        const groupConfig = this.config[groupKey] ?? {};
        this.config = {
          ...this.config,
          [groupKey]: {
            ...groupConfig,
            [valueKey]: nextValue,
          },
        };
      } else {
        const [groupKey, effectKey, valueKey] = segments;
        const groupConfig = this.config[groupKey] ?? {};
        const effectConfig = (groupConfig && effectKey) ? groupConfig[effectKey] : undefined;
        this.config = {
          ...this.config,
          [groupKey]: {
            ...groupConfig,
            [effectKey]: {
              ...(effectConfig ?? {}),
              [valueKey]: nextValue,
            },
          },
        };
      }
    } else {
      this.config = { ...this.config, [name]: nextValue };
    }

    if (name === 'grainDuration') {
      if (this.imageBuffer) {
        this.imageGrains = this.createGrains(this.imageBuffer, 'image');
      }

      if (this.audioSelection) {
        this.audioGrains = this.createGrains(this.audioSelection, 'audio');
      }

      this.notifyGrainCounts();
    }

    if (name.startsWith('effects.')) {
      const [, effectKey, valueKey] = name.split(".");
      if (typeof this.databender?.updateConfig === 'function') {
        this.databender.updateConfig(effectKey, valueKey, nextValue);
      }
      this.invalidateProcessedAudio();
    }

    if (name === 'grainIndex' && this.isPlaying) {
      if (this.audioGrains.length > 0) {
        this.audioGrainCallback();
      } else if (this.imageGrains.length > 0) {
        this.renderStandaloneImage();
      }
    }

    const configUpdatedEvent = new CustomEvent("config-updated", {
      detail: { name, value: this.getConfigValue(name) },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(configUpdatedEvent);
  }

  getConfigValue(path) {
    if (!path.includes('.')) {
      return this.config[path];
    }
    return path.split('.').reduce((accumulator, key) => {
      if (accumulator && typeof accumulator === 'object') {
        return accumulator[key];
      }
      return undefined;
    }, this.config);
  }


  usePizzicatoEffect(EffectCtor, optionsOrFactory = {}) {
    const getOptions =
      typeof optionsOrFactory === 'function' ? optionsOrFactory : () => optionsOrFactory;

    return ({ context }) => {
      const previousContext = Pizzicato.context;
      const resolved = getOptions() ?? {};
      const { active, ...effectOptions } = resolved;

      try {
        if (active === false) {
          const bypass = context.createGain();
          return { input: bypass, output: bypass };
        }

        Pizzicato.context = context;
        const effect = new EffectCtor(effectOptions);
        return { input: effect.inputNode, output: effect.outputNode };
      } finally {
        Pizzicato.context = previousContext;
      }
    };
  }

  getEffectOptions(effectKey) {
    const effectConfig = this.config?.effects?.[effectKey];
    if (!effectConfig) {
      return {};
    }

    return { ...effectConfig };
  }

  handleAudioUploaded(event) {
    const { buffer } = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: { buffer },
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-waveform").dispatchEvent(updateAudioEvent);

    this.audioSelection = buffer;
    this.audioGrains = this.createGrains(this.audioSelection, 'audio');
    this.invalidateProcessedAudio();
    this.notifyGrainCounts();
  }

  handleAudioCleared() {
    this.stopSynth();
    this.audioSelection = null;
    this.audioGrains = [];
    this.audioNumberOfGrains = 0;
    this.audioSamplesPerGrain = 0;
    this.invalidateProcessedAudio();
    this.notifyGrainCounts();
  }

  invalidateProcessedAudio() {
    this.processedAudioSelection = null;
    this.processedAudioSelectionPromise = null;
  }

  areEffectsActive() {
    if (!this.config?.effects) {
      return false;
    }
    return Object.values(this.config.effects).some((effect) => effect?.active);
  }

  async getPlaybackBuffer() {
    if (!this.audioSelection) {
      return null;
    }

    if (!this.areEffectsActive()) {
      return this.audioSelection;
    }

    if (this.processedAudioSelection) {
      return this.processedAudioSelection;
    }

    if (!this.processedAudioSelectionPromise) {
      this.processedAudioSelectionPromise = this.databender
        .render(this.audioSelection)
        .then((buffer) => {
          this.processedAudioSelection = buffer;
          return buffer;
        })
        .catch((error) => {
          console.error('Failed to render processed audio selection', error);
          this.processedAudioSelection = null;
          throw error;
        })
        .finally(() => {
          this.processedAudioSelectionPromise = null;
        });
    }

    return this.processedAudioSelectionPromise;
  }

  handleImageUploaded(event) {
    const { image } = event.detail;

    this.databender.convert(image).then((buffer) => {
      this.imageBuffer = buffer;
      this.imageGrains = this.createGrains(this.imageBuffer, 'image');
      this.notifyGrainCounts();
    });
  }

  handleImageCleared() {
    this.imageBuffer = null;
    this.imageGrains = [];
    this.imageNumberOfGrains = 0;
    this.imageSamplesPerGrain = 0;
    this.notifyGrainCounts();
  }

  createGrains(sample, sampleType = 'audio') {
    const mode = sampleType === 'image' ? 'image' : 'audio';
    const totalDurationSeconds = sample.duration;
    const totalDurationMs = totalDurationSeconds * 1000;
    const grainDurationMs = this.getGrainDurationMs(totalDurationMs, mode);
    this.numberOfGrains = Math.max(1, Math.floor(totalDurationMs / grainDurationMs));

    this.samplesPerGrain = Math.max(1, Math.floor(sample.length / this.numberOfGrains));
    if (mode === 'image') {
      this.imageNumberOfGrains = this.numberOfGrains;
      this.imageSamplesPerGrain = this.samplesPerGrain;
    } else {
      this.audioNumberOfGrains = this.numberOfGrains;
      this.audioSamplesPerGrain = this.samplesPerGrain;
    }
    if (mode === 'image') {
      const grains = [];
      const channelData = sample.getChannelData(0);
      for (const chunkSlice of chunk(channelData, this.samplesPerGrain)) {
        const grainBuffer = this.audioCtx.createBuffer(
          1,
          chunkSlice.length,
          this.audioCtx.sampleRate,
        );
        const grainBufferData = grainBuffer.getChannelData(0);

        for (let i = 0; i < chunkSlice.length; i++) {
          grainBufferData[i] = chunkSlice[i];
        }

        grains.push(grainBuffer);
      }

      this.imageNumberOfGrains = grains.length;
      return grains;
    }

    const grains = [];
    const sampleRate = sample.sampleRate || this.audioCtx.sampleRate;
    for (let index = 0; index < this.numberOfGrains; index++) {
      const startSample = index * this.samplesPerGrain;
      if (startSample >= sample.length) {
        break;
      }
      const endSample = index === this.numberOfGrains - 1
        ? sample.length
        : Math.min(sample.length, startSample + this.samplesPerGrain);

      const length = Math.max(1, endSample - startSample);
      grains.push({
        index,
        startSample,
        endSample,
        length,
        offset: startSample / sampleRate,
        duration: length / sampleRate,
      });
    }

    this.audioNumberOfGrains = grains.length;
    return grains;
  }

  updateAudioSelection(e) {
    const { selection, buffer } = e.detail;
    const frameCount =
      selection.end > selection.start
        ? selection.end - selection.start
        : selection.start - selection.end;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    this.audioSelection = this.audioCtx.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate,
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = this.audioSelection.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        newData[i] = originalData[i + selection.start];
      }
    }

    this.audioGrains = this.createGrains(this.audioSelection, 'audio');
    this.invalidateProcessedAudio();
    this.notifyGrainCounts();
  }

  createWindowCurve(length) {
    const size = Math.max(2, length);
    return hannWindow(size, this.config.window);
  }

  getGrainDurationMs(totalDurationMs, mode = 'audio') {
    if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
      return 1;
    }

    const dialValue = Math.max(1, Math.min(this.config.grainDuration, 1000));

    if (mode === 'image') {
      const ratio = dialValue / 1000;
      const duration = Math.round(totalDurationMs * ratio);
      return Math.max(1, duration);
    }

    const duration = Math.min(dialValue, Math.round(totalDurationMs));
    return Math.max(1, duration);
  }

  getMaxGrainIndex() {
    const audioCount = Array.isArray(this.audioGrains) ? this.audioGrains.length : 0;
    const imageCount = Array.isArray(this.imageGrains) ? this.imageGrains.length : 0;
    if (audioCount > 0) {
      return audioCount;
    }
    return Math.max(imageCount, 1);
  }

  notifyGrainCounts() {
    const audio = Array.isArray(this.audioGrains) ? this.audioGrains.length : 0;
    const image = Array.isArray(this.imageGrains) ? this.imageGrains.length : 0;
    const total = audio > 0 ? audio : Math.max(image, 1);
    const grainCountEvent = new CustomEvent('grain-count-changed', {
      detail: { audio, image, total },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(grainCountEvent);

    if (this.config.grainIndex > total) {
      this.updateConfig('grainIndex', total);
    }
  }

  computeSegmentIndex(segments) {
    const total = Math.max(1, segments);
    let index = Math.max(0, Math.min(this.config.grainIndex - 1, total - 1));
    const randomChance = this.config.random || 0;
    if (randomChance > 0 && Math.random() < randomChance) {
      const spray = Math.max(1, Math.round(this.config.spray || 1));
      let minSegment = index - (spray - 1);
      let maxSegment = index + (spray - 1);
      minSegment = Math.max(0, minSegment);
      maxSegment = Math.min(total - 1, maxSegment);
      index = Math.floor(Math.random() * (maxSegment - minSegment + 1)) + minSegment;
    }
    return index;
  }

  mapSegmentToImageIndex(segmentIndex, segmentCount) {
    const imageCount = this.imageGrains.length;
    if (imageCount === 0) {
      return 0;
    }
    if (segmentCount <= 1 || imageCount === segmentCount) {
      return Math.max(0, Math.min(segmentIndex, imageCount - 1));
    }
    const ratio = imageCount / segmentCount;
    const mapped = Math.floor(segmentIndex * ratio);
    return Math.max(0, Math.min(imageCount - 1, mapped));
  }

  renderImageSegment(segmentIndex, segmentCount) {
    if (!this.imageGrains.length) {
      return;
    }
    const display = document.querySelector("synth-display");
    const canvas = display?.shadowRoot?.querySelector("canvas");
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const imageIndex = this.mapSegmentToImageIndex(segmentIndex, segmentCount);
    const clampedIndex = Math.max(0, Math.min(imageIndex, this.imageGrains.length - 1));
    const grainBuffer = this.imageGrains[clampedIndex];

    const grainsCount = Math.max(1, this.imageNumberOfGrains || this.imageGrains.length);

    this.databender
      .render(grainBuffer)
      .then((buffer) => {
        this.applyBitcrusherVisuals(buffer);
        context.clearRect(0, 0, canvas.width, canvas.height);
        this.databender.draw(
          buffer,
          context,
          0,
          0,
          0,
          0,
          this.databender.imageData.width,
          this.databender.imageData.height / grainsCount,
          canvas.width,
          canvas.height,
        );

        document.querySelector('link[rel="icon"]').setAttribute('href', canvas.toDataURL('image/png'));
      });
  }

  renderStandaloneImage() {
    if (!this.imageGrains.length) {
      return;
    }
    const segments = Math.max(1, this.imageGrains.length);
    const segmentIndex = this.computeSegmentIndex(segments);
    this.renderImageSegment(segmentIndex, segments);
  }


  async audioGrainCallback() {
    if (!this.audioGrains.length) {
      return;
    }

    const totalSegments = Math.max(1, this.audioGrains.length);
    const segmentIndex = this.computeSegmentIndex(totalSegments);
    const audioIndex = Math.max(0, Math.min(segmentIndex, this.audioGrains.length - 1));
    const grain = this.audioGrains[audioIndex];
    if (!grain) {
      return;
    }

    try {
      const playbackBuffer = await this.getPlaybackBuffer();
      if (!playbackBuffer) {
        return;
      }

      const now = this.audioCtx.currentTime;
      const duration = Math.max(grain.duration, 1 / this.audioCtx.sampleRate);

      const remainingDuration = playbackBuffer.duration - grain.offset;
      const clampedDuration = Math.min(duration, Math.max(0, remainingDuration));
      if (clampedDuration <= 0) {
        return;
      }

      this.bufferSource = this.audioCtx.createBufferSource();
      this.bufferSource.buffer = playbackBuffer;
      this.bufferSource.loop = false;

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(0, now);

      const windowCurve = this.createWindowCurve(grain.length);
      if (windowCurve && windowCurve.length > 0) {
        gainNode.gain.setValueCurveAtTime(windowCurve, now, clampedDuration);
      } else {
        gainNode.gain.setValueAtTime(1, now);
      }

      this.bufferSource.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      const activePair = { source: this.bufferSource, gain: gainNode };
      this.activeSources.add(activePair);

      this.bufferSource.onended = () => {
        const clearGrainEvent = new Event('clear-grain', {
          bubbles: true,
          composed: true,
        });
        document.querySelector('synth-waveform').dispatchEvent(clearGrainEvent);
        try {
          gainNode.disconnect();
        } catch (disconnectError) {
          console.error('Failed to disconnect grain gain node', disconnectError);
        }
        this.activeSources.delete(activePair);
        if (this.bufferSource === activePair.source) {
          this.bufferSource = null;
        }
      };

      this.bufferSource.start(now, grain.offset, clampedDuration);

      const drawGrainEvent = new CustomEvent('draw-grain', {
        detail: {
          grainIndex: segmentIndex,
          segmentCount: totalSegments,
          grains: this.audioGrains,
        },
        bubbles: true,
        composed: true,
      });
      document.querySelector('synth-waveform').dispatchEvent(drawGrainEvent);
      document.querySelector('synth-ribbon').dispatchEvent(drawGrainEvent);

      this.renderImageSegment(segmentIndex, totalSegments);
    } catch (error) {
      console.error('Failed to play audio grain', error);
    }
  }

  playSynth() {
    if (this.isPlaying) {
      return;
    }
    this.isPlaying = true;

    this.clearPlayTimers();

    const scheduleGrain = (callback) => {
      const timerRef = { id: null };
      const run = () => {
        if (!this.isPlaying) {
          return;
        }
        Promise.resolve(callback()).catch((error) => {
          console.error('Scheduled grain callback failed', error);
        });
        const interval = 1000 / this.config.density;
        timerRef.id = setTimeout(run, interval);
      };

      const initialInterval = 1000 / this.config.density;
      timerRef.id = setTimeout(run, initialInterval);
      this.playTimers.push(timerRef);
    };

    const hasImageGrains = this.imageGrains.length > 0;
    const hasAudioGrains = this.audioGrains.length > 0;

    if (!hasImageGrains && !hasAudioGrains) {
      this.isPlaying = false;
      return;
    }

    if (hasAudioGrains) {
      scheduleGrain(this.audioGrainCallback.bind(this));
    } else if (hasImageGrains) {
      scheduleGrain(this.renderStandaloneImage.bind(this));
    }
  }

  stopSynth() {
    if (this.activeSources && this.activeSources.size) {
      this.activeSources.forEach(({ source, gain }) => {
        try {
          source.stop();
        } catch (stopError) {
          console.error('Failed to stop grain source', stopError);
        }
        try {
          gain.disconnect();
        } catch (disconnectError) {
          console.error('Failed to disconnect grain gain node', disconnectError);
        }
      });
      this.activeSources.clear();
    }
    if (this.bufferSource) {
      this.bufferSource = null;
    }

    this.clearPlayTimers();
    this.isPlaying = false;

    if (this.image) {
      const updateImageEvent = new CustomEvent("update-image", {
        detail: this.image,
        bubbles: true,
        composed: true,
      });
      this.querySelector("synth-display").dispatchEvent(updateImageEvent);
    }
  }

  clearPlayTimers() {
    if (!this.playTimers) {
      this.playTimers = [];
      return;
    }
    this.playTimers.forEach((timerRef) => {
      if (timerRef && timerRef.id) {
        clearTimeout(timerRef.id);
      }
    });
    this.playTimers = [];
  }
}

customElements.define("synth-brain", SynthBrain);
