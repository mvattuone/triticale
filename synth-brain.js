import Databender from "https://cdn.jsdelivr.net/npm/databender@2.0.0-alpha.2/index.js";
import Pizzicato from "https://cdn.jsdelivr.net/npm/pizzicato@0.6.4/+esm";
import { chunk } from 'helpers/chunk.js';
import { random } from 'helpers/random.js';
import { hannWindow } from 'helpers/hannWindow.js';
import { ensureBoxSizing } from 'helpers/boxSizing.js';
import { loadWorkletModule } from "./helpers/loadWorkletModule.js";

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
          randomValues: 0,
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
        audioCtx: this.audioCtx,
      },
    );
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.activeSources = new Set();
    this.isPlaying = false;
    this.playTimers = [];
    this.processedAudioSelection = null;
    this.processedAudioSelectionPromise = null;
    this.processedAudioDirty = false;
    this.processedAudioRenderToken = 0;
    this.notifyGrainCounts();
    this.isLatched = false;
    this.ribbonEngaged = false;
    this.imageRenderToken = 0;
    this.imageRenderInFlight = false;
    this.pendingImageRender = null;
    this.currentImageRender = null;
    this.lastRequestedImageSegment = null;
    this.pendingDetuneImageRefresh = false;
    this.lastFaviconUpdate = 0;
    this.faviconUpdateInterval = 250;
    this.imageRenderCacheVersion = 0;
    this.imageRenderCache = new Map();
    this.setAttribute('data-playing', 'false');
    this.granularNode = null;
    this.loadGranularModulePromise = null;
    this.lastGranularBuffer = null;
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("image-cleared", this.handleImageCleared);
    this.addEventListener("update-sample", this.updateAudioSelection);
    this.addEventListener("latch-changed", this.handleLatchChanged);
    this.addEventListener("update-config", this.handleUpdateConfig);
    this.addEventListener("audio-cleared", this.handleAudioCleared);
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("image-cleared", this.handleImageCleared);
    this.removeEventListener("update-sample", this.updateAudioSelection);
    this.removeEventListener("latch-changed", this.handleLatchChanged);
    this.removeEventListener("update-config", this.handleUpdateConfig);
    this.removeEventListener("audio-cleared", this.handleAudioCleared);
  }

  handleLatchChanged = (event) => {
    const { active } = event.detail ?? {};
    const nextLatched = Boolean(active);
    this.isLatched = nextLatched;

    if (!this.isLatched && !this.ribbonEngaged) {
      this.stopSynth();
    }
  };

  beginRibbonInteraction() {
    this.ribbonEngaged = true;
    if (!this.isPlaying) {
      this.playSynth();
    }
  }

  endRibbonInteraction() {
    this.ribbonEngaged = false;
    if (!this.isLatched) {
      this.stopSynth();
    }
  }


  bitcrusherFactory = async (payload) => {
    const { context, config } = payload;
    await loadWorkletModule(context, 'effects/bitcrusher.js');
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
    const biquadConfig = (config && config.biquad) || this.config?.effects?.biquad;

    if (!biquadConfig?.active) {
      return null;
    }

    let waveArray = null;

    if (biquadConfig.randomValues > 0) {
      waveArray = new Float32Array(biquadConfig.randomValues);
      for (let index = 0; index < biquadConfig.randomValues; index += 1) {
        waveArray[index] = random(0.0001, biquadConfig.biquadFrequency);
      }
    }

    const biquadFilter = context.createBiquadFilter();
    biquadFilter.type = biquadConfig.type;

    if (biquadConfig.randomValues > 0 && waveArray) {
      biquadFilter.frequency.cancelScheduledValues(0);
      biquadFilter.frequency.setValueCurveAtTime(waveArray, 0, source.buffer.duration);
      biquadFilter.detune.setValueCurveAtTime(waveArray, 0, source.buffer.duration);
    } else if (biquadConfig.enablePartial) {
      biquadFilter.frequency.cancelScheduledValues(0);
      biquadFilter.frequency.setTargetAtTime(
        biquadConfig.biquadFrequency,
        biquadConfig.areaOfEffect,
        biquadConfig.areaOfEffect,
      );
    } else {
      biquadFilter.frequency.cancelScheduledValues(0);
      biquadFilter.frequency.value = biquadConfig.biquadFrequency;
    }

    biquadFilter.Q.value = biquadConfig.quality;
    biquadFilter.detune.cancelScheduledValues(0);
    biquadFilter.detune.value = biquadConfig.detune;

    return biquadFilter;
  }

  detune({ config, source, duration }) {
    const detuneConfig = (config && config.detune) || this.config?.effects?.detune;
    if (!detuneConfig || !source?.detune) {
      return null;
    }

    const context = source.context || this.audioCtx;
    const now = context?.currentTime ?? 0;
    if (typeof source.detune.cancelScheduledValues === 'function') {
      source.detune.cancelScheduledValues(now);
    }

    if (detuneConfig.randomize) {
      const points = Math.max(1, Math.round(detuneConfig.randomValues || 1));
      const waveArray = new Float32Array(points);
      for (let i = 0; i < points; i += 1) {
        waveArray[i] = random(0.0001, 400);
      }
      const curveDuration = Math.max(
        0.001,
        duration ?? source.buffer?.duration ?? 0.5,
      );
      source.detune.setValueCurveAtTime(waveArray, now, curveDuration);
    } else if (detuneConfig.enablePartial) {
      const timeConstant = Math.max(0.001, detuneConfig.areaOfEffect || 0.5);
      source.detune.setTargetAtTime(detuneConfig.value, now, timeConstant);
    } else {
      source.detune.setValueAtTime(detuneConfig.value, now);
    }
      
    return null;
  }

  applyDetuneToActiveSources() {
    // Playback is now handled inside the granular AudioWorklet, so detune changes
    // are applied automatically to future grains when scheduling.
  }

  async ensureGranularEngine() {
    if (this.granularNode) {
      return this.granularNode;
    }
    if (!this.loadGranularModulePromise) {
      this.loadGranularModulePromise = loadWorkletModule(this.audioCtx, 'effects/granular-processor.js');
    }
    await this.loadGranularModulePromise;
    this.granularNode = new AudioWorkletNode(this.audioCtx, 'granular-processor', {
      numberOfOutputs: 1,
      outputChannelCount: [this.audioCtx.destination.channelCount || 2],
    });
    this.granularNode.connect(this.audioCtx.destination);
    return this.granularNode;
  }

  async syncGrainBufferToWorklet(buffer) {
    if (!buffer) {
      return;
    }
    const node = await this.ensureGranularEngine();
    if (!node) {
      return;
    }
    if (this.lastGranularBuffer === buffer) {
      return;
    }
    const channels = [];
    const transfers = [];
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel);
      const copy = new Float32Array(source.length);
      copy.set(source);
      channels.push(copy);
      transfers.push(copy.buffer);
    }
    node.port.postMessage({
      type: 'load-buffer',
      payload: {
        channels,
        length: buffer.length,
        sampleRate: buffer.sampleRate,
      },
    }, transfers);
    this.lastGranularBuffer = buffer;
  }

  scheduleGrainOnWorklet(grain, playbackRate) {
    if (!this.granularNode || !grain) {
      return;
    }
    this.granularNode.port.postMessage({
      type: 'schedule-grain',
      payload: {
        startSample: grain.startSample,
        length: grain.length,
        playbackRate,
        windowModifier: this.config.window,
      },
    });
  }

  getDetunePlaybackRate() {
    const detuneConfig = this.config?.effects?.detune;
    if (!detuneConfig?.active) {
      return 1;
    }
    const baseValue = Number(detuneConfig.value) || 0;
    let cents = baseValue;

    if (detuneConfig.randomize) {
      const spread = Math.max(0, Number(detuneConfig.randomValues) || 0);
      const min = cents - spread;
      const max = cents + spread;
      cents = Math.random() * (max - min) + min;
    } else if (detuneConfig.enablePartial) {
      const amount = Math.max(0, Math.min(1, Number(detuneConfig.areaOfEffect) || 0.5));
      cents = cents * amount;
    }

    return Math.pow(2, cents / 1200);
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
      this.invalidateImageRenderState();
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
      const shouldReprocessAudio = effectKey !== 'detune';
      if (shouldReprocessAudio) {
        this.invalidateProcessedAudio({ cancelRender: true });
        this.startProcessedAudioRenderIfNeeded();
      }
      const lastSegment = this.lastRequestedImageSegment
        ? { ...this.lastRequestedImageSegment }
        : null;
      let shouldInvalidateImage = true;
      if (effectKey === 'detune') {
        this.applyDetuneToActiveSources();
        const isActive = this.isPlaying || this.ribbonEngaged || this.isLatched;
        if (!isActive) {
          shouldInvalidateImage = false;
          this.pendingDetuneImageRefresh = true;
        }
      }
      if (shouldInvalidateImage) {
        this.invalidateImageRenderState();
        const segmentToRender = this.lastRequestedImageSegment
          ? { ...this.lastRequestedImageSegment }
          : lastSegment;
        if (segmentToRender) {
          this.renderImageSegment(segmentToRender.segmentIndex, segmentToRender.segmentCount);
        } else if (this.imageGrains.length > 0) {
          this.renderStandaloneImage();
        }
        this.pendingDetuneImageRefresh = false;
      }
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

  applyAudioSelectionBuffer(buffer) {
    if (!buffer || typeof buffer.getChannelData !== "function") {
      return;
    }

    this.audioSelection = buffer;
    this.audioGrains = this.createGrains(this.audioSelection, 'audio');
    this.invalidateProcessedAudio({ clearReady: true, cancelRender: true });
    this.processedAudioDirty = this.areEffectsActive();
    this.syncGrainBufferToWorklet(this.audioSelection).catch((error) => {
      console.error('Failed to sync audio selection to granular engine', error);
    });
    this.startProcessedAudioRenderIfNeeded();
    this.notifyGrainCounts();
  }

  handleAudioUploaded(event) {
    const { buffer } = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: { buffer },
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-waveform").dispatchEvent(updateAudioEvent);

    this.applyAudioSelectionBuffer(buffer);
  }

  handleAudioCleared() {
    this.stopSynth();
    this.audioSelection = null;
    this.audioGrains = [];
    this.audioNumberOfGrains = 0;
    this.audioSamplesPerGrain = 0;
    this.invalidateProcessedAudio({ clearReady: true, cancelRender: true });
    this.lastGranularBuffer = null;
    if (this.granularNode) {
      this.granularNode.port.postMessage({ type: 'clear-buffer' });
    }
    this.notifyGrainCounts();
  }

  invalidateProcessedAudio({ clearReady = false, cancelRender = false } = {}) {
    this.processedAudioDirty = true;
    if (cancelRender) {
      this.processedAudioRenderToken += 1;
    }
    if (clearReady) {
      this.processedAudioSelection = null;
      this.lastGranularBuffer = null;
    }
  }

  startProcessedAudioRenderIfNeeded() {
    if (!this.audioSelection) {
      return;
    }

    if (!this.areEffectsActive()) {
      this.processedAudioDirty = false;
      this.processedAudioSelection = null;
      return;
    }

    if (!this.processedAudioDirty && this.processedAudioSelection) {
      return;
    }

    if (this.processedAudioSelectionPromise) {
      return;
    }

    const renderToken = ++this.processedAudioRenderToken;
    const startTime = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();

    this.processedAudioSelectionPromise = this.databender
      .render(this.audioSelection)
      .then((buffer) => {
        const endTime = (typeof performance !== 'undefined' && typeof performance.now === 'function')
          ? performance.now()
          : Date.now();
        const durationMs = Math.max(0, endTime - startTime);
        if (renderToken !== this.processedAudioRenderToken) {
          this.processedAudioDirty = true;
          return null;
        }
        console.info(`[triticale] processed audio render ${renderToken} finished in ${durationMs.toFixed(1)}ms`);
        this.processedAudioSelection = buffer;
        this.processedAudioDirty = false;
        this.syncGrainBufferToWorklet(buffer).catch((error) => {
          console.error('Failed to sync processed buffer to granular engine', error);
        });
        return buffer;
      })
      .catch((error) => {
        console.error('Failed to render processed audio selection', error);
        if (renderToken === this.processedAudioRenderToken) {
          this.processedAudioSelection = null;
          this.processedAudioDirty = true;
        }
        throw error;
      })
      .finally(() => {
        this.processedAudioSelectionPromise = null;
        if (this.processedAudioDirty) {
          this.startProcessedAudioRenderIfNeeded();
        }
      });
  }

  areEffectsActive() {
    if (!this.config?.effects) {
      return false;
    }
    return Object.values(this.config.effects).some((effect) => effect?.active);
  }

  getPlaybackBuffer() {
    if (!this.audioSelection) {
      return null;
    }

    if (!this.areEffectsActive()) {
      return this.audioSelection;
    }

    this.startProcessedAudioRenderIfNeeded();
    return this.processedAudioSelection || this.audioSelection;
  }

  applyImageBuffer(buffer) {
    if (!buffer) {
      return;
    }

    this.imageBuffer = buffer;
    this.invalidateImageRenderState();
    this.imageGrains = this.createGrains(this.imageBuffer, 'image');
    this.notifyGrainCounts();
  }

  handleImageUploaded(event) {
    const { image } = event.detail;

    this.databender.convert(image).then((buffer) => {
      this.applyImageBuffer(buffer);
    });
  }

  handleImageCleared() {
    this.imageBuffer = null;
    this.imageGrains = [];
    this.imageNumberOfGrains = 0;
    this.imageSamplesPerGrain = 0;
    this.invalidateImageRenderState();
    if (this.databender) {
      this.databender.imageData = null;
    }
    this.notifyGrainCounts();
  }

  resetImageRenderQueue() {
    this.pendingImageRender = null;
    this.currentImageRender = null;
    this.imageRenderInFlight = false;
    this.lastRequestedImageSegment = null;
    this.imageRenderToken = 0;
  }

  invalidateImageRenderState() {
    this.resetImageRenderQueue();
    this.imageRenderCacheVersion = (this.imageRenderCacheVersion + 1) % Number.MAX_SAFE_INTEGER;
    this.imageRenderCache = new Map();
  }

  getCachedImageRender(cacheKey) {
    if (!cacheKey) {
      return null;
    }
    if (!this.isDetuneNeutral()) {
      return null;
    }
    const entry = this.imageRenderCache.get(cacheKey);
    if (!entry || entry.version !== this.imageRenderCacheVersion) {
      return null;
    }
    return entry.buffer || null;
  }

  setCachedImageRender(cacheKey, buffer) {
    if (!cacheKey || !buffer) {
      return;
    }
    if (!this.isDetuneNeutral()) {
      return;
    }
    this.imageRenderCache.set(cacheKey, {
      version: this.imageRenderCacheVersion,
      buffer,
    });
  }

  isDetuneNeutral() {
    const detune = this.config?.effects?.detune;
    if (!detune) {
      return true;
    }
    if (detune.randomize) {
      return false;
    }
    const value = Number(detune.value) || 0;
    if (detune.enablePartial) {
      return value === 0;
    }
    return value === 0;
  }

  createGrains(sample, sampleType = 'audio') {
    const mode = sampleType === 'image' ? 'image' : 'audio';
    const totalDurationSeconds = sample.duration;
    const totalDurationMs = totalDurationSeconds * 1000;
    const grainDurationMs = this.getGrainDurationMs(totalDurationMs, mode);
    this.numberOfGrains = Math.max(1, Math.floor(totalDurationMs / grainDurationMs));

    this.samplesPerGrain = Math.max(1, Math.floor(sample.length / this.numberOfGrains));
    if (mode === 'image') {
      this.invalidateImageRenderState();
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
    if (!buffer || typeof buffer.getChannelData !== "function") {
      return;
    }

    const bufferLength = buffer.length || 0;
    if (!Number.isFinite(bufferLength) || bufferLength <= 0) {
      return;
    }

    const rawStart = Number(selection.start ?? 0);
    const rawEnd = Number(selection.end ?? bufferLength);
    const startSample = Math.min(Math.max(Math.min(rawStart, rawEnd), 0), Math.max(bufferLength - 1, 0));
    let endSample = Math.min(Math.max(Math.max(rawStart, rawEnd), 0), bufferLength);

    if (endSample <= startSample) {
      endSample = Math.min(bufferLength, startSample + 1);
    }

    const frameCount = Math.max(1, endSample - startSample);
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
        const sourceIndex = startSample + i;
        newData[i] = sourceIndex < originalData.length ? originalData[sourceIndex] : 0;
      }
    }

    this.audioGrains = this.createGrains(this.audioSelection, 'audio');
    this.invalidateProcessedAudio({ clearReady: true });
    this.syncGrainBufferToWorklet(this.audioSelection).catch((error) => {
      console.error('Failed to sync updated audio selection to granular engine', error);
    });
    this.startProcessedAudioRenderIfNeeded();
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
    const nextRequest = {
      segmentIndex,
      segmentCount: Math.max(1, segmentCount),
    };
    this.pendingImageRender = { ...nextRequest };
    this.lastRequestedImageSegment = { ...nextRequest };
    if (!this.imageRenderInFlight) {
      this.processNextImageRender();
    }
  }

  processNextImageRender() {
    if (!this.pendingImageRender) {
      this.imageRenderInFlight = false;
      return;
    }

    const request = this.pendingImageRender;
    this.pendingImageRender = null;
    const { segmentIndex, segmentCount } = request;

    if (!this.imageGrains.length) {
      this.imageRenderInFlight = false;
      return;
    }

    const display = document.querySelector("synth-display");
    const canvas = display?.shadowRoot?.querySelector("canvas");
    if (!canvas) {
      this.imageRenderInFlight = false;
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      this.imageRenderInFlight = false;
      return;
    }

    const imageIndex = this.mapSegmentToImageIndex(segmentIndex, segmentCount);
    const clampedIndex = Math.max(0, Math.min(imageIndex, this.imageGrains.length - 1));
    const grainBuffer = this.imageGrains[clampedIndex];
    if (!grainBuffer) {
      this.imageRenderInFlight = false;
      if (this.pendingImageRender) {
        this.processNextImageRender();
      }
      return;
    }

    const grainsCount = Math.max(1, this.imageNumberOfGrains || this.imageGrains.length);
    const cacheKey = `${clampedIndex}`;
    const canUseCache = this.isDetuneNeutral();
    const cachedBuffer = canUseCache ? this.getCachedImageRender(cacheKey) : null;

    this.imageRenderInFlight = true;

    if (cachedBuffer) {
      this.drawProcessedImageBuffer({
        buffer: cachedBuffer,
        context,
        canvas,
        grainsCount,
        segmentIndex,
        segmentCount,
      });
      this.currentImageRender = null;
      this.imageRenderInFlight = false;
      if (this.pendingImageRender) {
        this.processNextImageRender();
      }
      return;
    }

    const requestId = ++this.imageRenderToken;
    this.currentImageRender = {
      requestId,
      segmentIndex,
      segmentCount,
      cacheKey,
    };

    Promise.resolve(this.databender.render(grainBuffer))
      .then((buffer) => {
        if (!this.currentImageRender || this.currentImageRender.requestId !== requestId) {
          return;
        }
        this.applyBitcrusherVisuals(buffer);
        if (canUseCache) {
          this.setCachedImageRender(cacheKey, buffer);
        }
        const latest = this.lastRequestedImageSegment;
        const isLatestRequest = latest
          && latest.segmentIndex === segmentIndex
          && latest.segmentCount === segmentCount;
        if (isLatestRequest) {
          this.drawProcessedImageBuffer({
            buffer,
            context,
            canvas,
            grainsCount,
            segmentIndex,
            segmentCount,
          });
        }
      })
      .catch((error) => {
        console.error('Failed to render image grain', error);
      })
      .finally(() => {
        if (!this.currentImageRender || this.currentImageRender.requestId !== requestId) {
          return;
        }
        this.currentImageRender = null;
        this.imageRenderInFlight = false;
        if (this.pendingImageRender) {
          this.processNextImageRender();
        }
      });
  }

  drawProcessedImageBuffer({ buffer, context, canvas, grainsCount, segmentIndex, segmentCount }) {
    if (!buffer || !context || !canvas) {
      return;
    }
    const imageData = this.databender?.imageData;
    if (!imageData || !imageData.width || !imageData.height) {
      return;
    }
    const { width: targetWidth, height: targetHeight } = canvas;
    const sourceWidth = imageData.width;
    const sourceHeight = imageData.height;
    const sliceHeight = grainsCount > 0 ? sourceHeight / grainsCount : sourceHeight;

    context.clearRect(0, 0, targetWidth, targetHeight);
    this.databender.draw(
      buffer,
      context,
      0,
      0,
      0,
      0,
      sourceWidth,
      sliceHeight,
      targetWidth,
      targetHeight,
    );

    this.updateFaviconFromCanvas(canvas);
    this.dispatchRibbonImageDraw(segmentIndex, segmentCount);
  }

  updateFaviconFromCanvas(canvas) {
    if (!canvas) {
      return;
    }
    if (this.ribbonEngaged) {
      return;
    }
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    if (now - this.lastFaviconUpdate < this.faviconUpdateInterval) {
      return;
    }
    const link = document.querySelector('link[rel="icon"]');
    if (!link) {
      return;
    }
    if (typeof canvas.toDataURL !== 'function') {
      return;
    }
    try {
      link.setAttribute('href', canvas.toDataURL('image/png'));
      this.lastFaviconUpdate = now;
    } catch (error) {
      console.error('Failed to update favicon', error);
    }
  }

  dispatchRibbonImageDraw(segmentIndex, segmentCount) {
    const drawGrainEvent = new CustomEvent('draw-grain', {
      detail: {
        grainIndex: segmentIndex,
        segmentCount,
        grains: this.imageGrains,
      },
      bubbles: true,
      composed: true,
    });
    document.querySelector('synth-ribbon')?.dispatchEvent(drawGrainEvent);
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
      const playbackBuffer = this.getPlaybackBuffer();
      if (!playbackBuffer) {
        return;
      }

      await this.syncGrainBufferToWorklet(playbackBuffer);
      const playbackRate = this.getDetunePlaybackRate();
      this.scheduleGrainOnWorklet(grain, playbackRate);

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
      this.notifyPlaybackState(false);
      return;
    }

    this.notifyPlaybackState(true);

    if (this.pendingDetuneImageRefresh) {
      this.pendingDetuneImageRefresh = false;
      this.invalidateImageRenderState();
      const segmentToRender = this.lastRequestedImageSegment
        ? { ...this.lastRequestedImageSegment }
        : null;
      if (segmentToRender) {
        this.renderImageSegment(segmentToRender.segmentIndex, segmentToRender.segmentCount);
      } else if (this.imageGrains.length > 0) {
        this.renderStandaloneImage();
      }
    }

    if (hasAudioGrains) {
      scheduleGrain(this.audioGrainCallback.bind(this));
    } else if (hasImageGrains) {
      scheduleGrain(this.renderStandaloneImage.bind(this));
    }
  }

  stopSynth() {
    this.activeSources = new Set();
    if (this.granularNode) {
      this.granularNode.port.postMessage({ type: 'clear-grains' });
    }

    this.clearPlayTimers();
    this.isPlaying = false;
    this.ribbonEngaged = false;
    this.notifyPlaybackState(false);
    this.grainYieldCounter = 0;

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

  notifyPlaybackState(isPlaying) {
    this.setAttribute('data-playing', isPlaying ? 'true' : 'false');
    const event = new CustomEvent('playback-state-changed', {
      detail: { playing: Boolean(isPlaying) },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

customElements.define("synth-brain", SynthBrain);
