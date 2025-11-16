var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// helpers/boxSizing.js
var supportsConstructableSheets = typeof CSSStyleSheet !== "undefined";
var boxSizingSheet = supportsConstructableSheets ? (() => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`* { box-sizing: border-box; }`);
  return sheet;
})() : null;
function ensureBoxSizing(shadowRoot) {
  if (!shadowRoot) {
    return;
  }
  if (boxSizingSheet && "adoptedStyleSheets" in shadowRoot) {
    const sheets = shadowRoot.adoptedStyleSheets || [];
    if (!sheets.includes(boxSizingSheet)) {
      shadowRoot.adoptedStyleSheets = [boxSizingSheet, ...sheets];
    }
    return;
  }
  if (!shadowRoot.querySelector("style[data-box-sizing]") && typeof document !== "undefined") {
    const style = document.createElement("style");
    style.setAttribute("data-box-sizing", "true");
    style.textContent = "* { box-sizing: border-box; }";
    shadowRoot.insertBefore(style, shadowRoot.firstChild);
  }
}

// dnd-wrapper.js
var DndWrapper = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
                ::slotted(.dropping) {
                  background-color: #efefef;
                }

          
            </style>
            <slot></slot>
        `;
    ensureBoxSizing(this.shadowRoot);
    this.dropzone = this.shadowRoot.querySelector("slot").assignedElements()[0];
    this.dropzone.ondragover = this.handleDragOver.bind(this);
    this.dropzone.ondragleave = this.handleDragLeave.bind(this);
    this.dropzone.ondrop = this.handleDrop.bind(this);
  }
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    this.dropzone.classList.add("dropping");
  }
  handleDragLeave(e) {
    e.preventDefault();
    this.dropzone.classList.remove("dropping");
  }
  handleDrop(e) {
    e.preventDefault();
    this.dropzone.classList.remove("dropping");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.dropzone.dispatchEvent(
        new CustomEvent("drop-success", {
          detail: { file: files[0] },
          bubbles: true,
          composed: true
        })
      );
    }
  }
};
customElements.define("dnd-wrapper", DndWrapper);

// synth-brain.js
import Databender from "https://cdn.jsdelivr.net/npm/databender@2.0.0-alpha.2/index.js";
import Pizzicato from "https://cdn.jsdelivr.net/npm/pizzicato@0.6.4/+esm";

// helpers/chunk.js
function* chunk(arr, chunkSize) {
  if (chunkSize <= 0) return;
  for (let i = 0; i < arr.length; i += chunkSize) {
    yield arr.slice(i, i + chunkSize);
  }
}

// helpers/random.js
function random(x, y) {
  return Math.floor(x + (y - x + 1) * crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
}

// helpers/hannWindow.js
function hannWindow(length, modifier) {
  let window2 = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    window2[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (modifier * (length - 1))));
  }
  return window2;
}

// helpers/setPublicPath.js
var PUBLIC_PATH_KEY = "__triticalePublicPath__";
function setPublicPath(url) {
  globalThis[PUBLIC_PATH_KEY] = url;
}

// helpers/makeAbsoluteUrl.js
function makeAbsoluteUrl(path) {
  if (!path) {
    return path;
  }
  try {
    return new URL(path).href;
  } catch (error) {
  }
  const base = globalThis[PUBLIC_PATH_KEY] || typeof document !== "undefined" && document.baseURI || typeof window !== "undefined" && window.location?.href || null;
  if (!base) {
    return path;
  }
  try {
    return new URL(path, base).href;
  } catch (error) {
    return path;
  }
}

// helpers/loadWorkletModule.js
var loadWorkletModule = /* @__PURE__ */ (() => {
  const cache = /* @__PURE__ */ new WeakMap();
  return async (context, relativePath) => {
    if (!context?.audioWorklet) return;
    const url = makeAbsoluteUrl(relativePath);
    let loaded = cache.get(context);
    if (!loaded) {
      loaded = /* @__PURE__ */ new Set();
      cache.set(context, loaded);
    }
    if (loaded.has(url)) return;
    await context.audioWorklet.addModule(url);
    loaded.add(url);
  };
})();

// synth-brain.js
var SynthBrain = class extends HTMLElement {
  constructor() {
    super();
    __publicField(this, "handleLatchChanged", (event) => {
      const { active } = event.detail ?? {};
      const nextLatched = Boolean(active);
      this.isLatched = nextLatched;
      if (!this.isLatched && !this.ribbonEngaged) {
        this.stopSynth();
      }
    });
    __publicField(this, "bitcrusherFactory", async (payload) => {
      const { context, config } = payload;
      await loadWorkletModule(context, "effects/bitcrusher.js");
      return this.bitcrusher({ context, config });
    });
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.audioGrains = [];
    this.imageGrains = [];
    this.config = {
      effectsChainMode: "series",
      effects: {
        delay: {
          active: false,
          feedback: 0.6,
          time: 0.4,
          mix: 0.5
        },
        bitcrusher: {
          active: false,
          bits: 8,
          bufferSize: 4096,
          normfreq: 0.1
        },
        detune: {
          active: true,
          value: 0,
          randomize: false,
          randomValues: 4,
          enablePartial: false,
          areaOfEffect: 0.5
        },
        biquad: {
          active: false,
          areaOfEffect: 1,
          biquadFrequency: 8500,
          detune: 0,
          enablePartial: false,
          quality: 1,
          randomValues: 0,
          type: "lowpass"
        }
      },
      grainIndex: 1,
      grainDuration: 200,
      density: 1,
      window: 1,
      spray: 1,
      random: 0
    };
    this.databender = new Databender(
      {
        config: this.config.effects,
        effectsChain: [
          this.usePizzicatoEffect(Pizzicato.Effects.Delay, () => this.getEffectOptions("delay")),
          async (payload) => this.bitcrusherFactory(payload),
          (payload) => this.detune(payload),
          (payload) => this.biquadFilter(payload)
        ],
        audioCtx: this.audioCtx
      }
    );
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.bufferSource;
    this.activeSources = /* @__PURE__ */ new Set();
    this.isPlaying = false;
    this.playTimers = [];
    this.processedAudioSelection = null;
    this.processedAudioSelectionPromise = null;
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
    this.imageRenderCache = /* @__PURE__ */ new Map();
    this.setAttribute("data-playing", "false");
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
  handleUpdateConfig(e) {
    const { name, value } = e.detail;
    return this.updateConfig(name, value);
  }
  bitcrusher({ context, config }) {
    const options = config && config.bitcrusher ? config.bitcrusher : this.getEffectOptions("bitcrusher");
    if (!options?.active) {
      return null;
    }
    const rawBits = Number(options.bits);
    const normalizedBits = Number.isFinite(rawBits) ? rawBits : 8;
    const bitsValue = Math.max(1, Math.min(16, Math.round(normalizedBits)));
    const rawNormfreq = Number(options.normfreq);
    const normalizedNormfreq = Number.isFinite(rawNormfreq) ? rawNormfreq : 0.1;
    const normfreqValue = Math.max(1e-4, Math.min(1, normalizedNormfreq));
    const node = new AudioWorkletNode(context, "bitcrusher", {
      parameterData: {
        bits: bitsValue,
        normfreq: normfreqValue
      }
    });
    const bitsParam = node.parameters?.get("bits");
    const normfreqParam = node.parameters?.get("normfreq");
    const currentTime = typeof context.currentTime === "number" ? context.currentTime : 0;
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
    const normfreq = Math.max(1e-4, Math.min(1, Number(effectConfig.normfreq) || 0.1));
    const step = Math.pow(0.5, bits);
    let phaser = 0;
    let lastNormalized = 0;
    for (let index = 0; index < channelData.length; index++) {
      const normalizedSample = Math.max(0, Math.min(1, channelData[index] / 255));
      phaser += normfreq;
      if (phaser >= 1) {
        phaser -= 1;
        lastNormalized = step * Math.floor(normalizedSample / step + 0.5);
      }
      channelData[index] = Math.max(0, Math.min(255, lastNormalized * 255));
    }
  }
  biquadFilter({ config, context, source }) {
    const biquadConfig = config && config.biquad || this.config?.effects?.biquad;
    if (!biquadConfig?.active) {
      return null;
    }
    let waveArray = null;
    if (biquadConfig.randomValues > 0) {
      waveArray = new Float32Array(biquadConfig.randomValues);
      for (let index = 0; index < biquadConfig.randomValues; index += 1) {
        waveArray[index] = random(1e-4, biquadConfig.biquadFrequency);
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
        biquadConfig.areaOfEffect
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
    const detuneConfig = config && config.detune || this.config?.effects?.detune;
    if (!detuneConfig || !source?.detune) {
      return null;
    }
    const context = source.context || this.audioCtx;
    const now = context?.currentTime ?? 0;
    if (typeof source.detune.cancelScheduledValues === "function") {
      source.detune.cancelScheduledValues(now);
    }
    if (detuneConfig.randomize) {
      const points = Math.max(1, Math.round(detuneConfig.randomValues || 1));
      const waveArray = new Float32Array(points);
      for (let i = 0; i < points; i += 1) {
        waveArray[i] = random(1e-4, 400);
      }
      const curveDuration = Math.max(
        1e-3,
        duration ?? source.buffer?.duration ?? 0.5
      );
      source.detune.setValueCurveAtTime(waveArray, now, curveDuration);
    } else if (detuneConfig.enablePartial) {
      const timeConstant = Math.max(1e-3, detuneConfig.areaOfEffect || 0.5);
      source.detune.setTargetAtTime(detuneConfig.value, now, timeConstant);
    } else {
      source.detune.setValueAtTime(detuneConfig.value, now);
    }
    return null;
  }
  applyDetuneToActiveSources() {
    if (!this.activeSources || this.activeSources.size === 0) {
      this.loadGranularModulePromise = loadWorkletModule(this.audioCtx, "effects/granular-processor.js");
      return;
    }
    this.activeSources.forEach(({ source }) => {
      if (!source) {
        return;
      }
      this.detune({ config: this.config.effects, source, duration: source.buffer?.duration });
    });
  }
  updateConfig(name, value) {
    const [rootKey] = name.split(".");
    if (!Object.keys(this.config).includes(rootKey)) {
      console.warn(`${name} is not a valid config parameter`);
      return;
    }
    let nextValue = value;
    if (name === "effectsChainMode") {
      nextValue = value === "parallel" ? "parallel" : "series";
    }
    if (name === "grainDuration") {
      if (typeof nextValue !== "number") {
        nextValue = parseFloat(nextValue);
      }
      if (!Number.isFinite(nextValue)) {
        nextValue = this.config.grainDuration;
      }
      nextValue = Math.max(1, Math.min(nextValue, 1e3));
    }
    if (name === "grainIndex") {
      if (typeof nextValue !== "number") {
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
            [valueKey]: nextValue
          }
        };
      } else {
        const [groupKey, effectKey, valueKey] = segments;
        const groupConfig = this.config[groupKey] ?? {};
        const effectConfig = groupConfig && effectKey ? groupConfig[effectKey] : void 0;
        this.config = {
          ...this.config,
          [groupKey]: {
            ...groupConfig,
            [effectKey]: {
              ...effectConfig ?? {},
              [valueKey]: nextValue
            }
          }
        };
      }
    } else {
      this.config = { ...this.config, [name]: nextValue };
    }
    if (name === "grainDuration") {
      this.invalidateImageRenderState();
      if (this.imageBuffer) {
        this.imageGrains = this.createGrains(this.imageBuffer, "image");
      }
      if (this.audioSelection) {
        this.audioGrains = this.createGrains(this.audioSelection, "audio");
      }
      this.notifyGrainCounts();
    }
    if (name.startsWith("effects.")) {
      const [, effectKey, valueKey] = name.split(".");
      if (typeof this.databender?.updateConfig === "function") {
        this.databender.updateConfig(effectKey, valueKey, nextValue);
      }
      const lastSegment = this.lastRequestedImageSegment ? { ...this.lastRequestedImageSegment } : null;
      let shouldInvalidateImage = true;
      if (effectKey === "detune") {
        this.applyDetuneToActiveSources();
        const isActive = this.isPlaying || this.ribbonEngaged || this.isLatched;
        if (!isActive) {
          shouldInvalidateImage = false;
          this.pendingDetuneImageRefresh = true;
        }
      } else {
        this.invalidateProcessedAudio();
      }
      if (shouldInvalidateImage) {
        this.invalidateImageRenderState();
        const segmentToRender = this.lastRequestedImageSegment ? { ...this.lastRequestedImageSegment } : lastSegment;
        if (segmentToRender) {
          this.renderImageSegment(segmentToRender.segmentIndex, segmentToRender.segmentCount);
        } else if (this.imageGrains.length > 0) {
          this.renderStandaloneImage();
        }
        this.pendingDetuneImageRefresh = false;
      }
    }
    if (name === "grainIndex" && this.isPlaying) {
      if (this.audioGrains.length > 0) {
        this.audioGrainCallback();
      } else if (this.imageGrains.length > 0) {
        this.renderStandaloneImage();
      }
    }
    const configUpdatedEvent = new CustomEvent("config-updated", {
      detail: { name, value: this.getConfigValue(name) },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(configUpdatedEvent);
  }
  getConfigValue(path) {
    if (!path.includes(".")) {
      return this.config[path];
    }
    return path.split(".").reduce((accumulator, key) => {
      if (accumulator && typeof accumulator === "object") {
        return accumulator[key];
      }
      return void 0;
    }, this.config);
  }
  usePizzicatoEffect(EffectCtor, optionsOrFactory = {}) {
    const getOptions = typeof optionsOrFactory === "function" ? optionsOrFactory : () => optionsOrFactory;
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
    this.audioGrains = this.createGrains(this.audioSelection, "audio");
    this.invalidateProcessedAudio();
    this.notifyGrainCounts();
  }
  handleAudioUploaded(event) {
    const { buffer } = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: { buffer },
      bubbles: true,
      composed: true
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
      this.processedAudioSelectionPromise = this.databender.render(this.audioSelection).then((buffer) => {
        this.processedAudioSelection = buffer;
        return buffer;
      }).catch((error) => {
        console.error("Failed to render processed audio selection", error);
        this.processedAudioSelection = null;
        throw error;
      }).finally(() => {
        this.processedAudioSelectionPromise = null;
      });
    }
    return this.processedAudioSelectionPromise;
  }
  applyImageBuffer(buffer) {
    if (!buffer) {
      return;
    }
    this.imageBuffer = buffer;
    this.invalidateImageRenderState();
    this.imageGrains = this.createGrains(this.imageBuffer, "image");
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
    this.imageRenderCache = /* @__PURE__ */ new Map();
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
      buffer
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
  createGrains(sample, sampleType = "audio") {
    const mode = sampleType === "image" ? "image" : "audio";
    const totalDurationSeconds = sample.duration;
    const totalDurationMs = totalDurationSeconds * 1e3;
    const grainDurationMs = this.getGrainDurationMs(totalDurationMs, mode);
    this.numberOfGrains = Math.max(1, Math.floor(totalDurationMs / grainDurationMs));
    this.samplesPerGrain = Math.max(1, Math.floor(sample.length / this.numberOfGrains));
    if (mode === "image") {
      this.invalidateImageRenderState();
      this.imageNumberOfGrains = this.numberOfGrains;
      this.imageSamplesPerGrain = this.samplesPerGrain;
    } else {
      this.audioNumberOfGrains = this.numberOfGrains;
      this.audioSamplesPerGrain = this.samplesPerGrain;
    }
    if (mode === "image") {
      const grains2 = [];
      const channelData = sample.getChannelData(0);
      for (const chunkSlice of chunk(channelData, this.samplesPerGrain)) {
        const grainBuffer = this.audioCtx.createBuffer(
          1,
          chunkSlice.length,
          this.audioCtx.sampleRate
        );
        const grainBufferData = grainBuffer.getChannelData(0);
        for (let i = 0; i < chunkSlice.length; i++) {
          grainBufferData[i] = chunkSlice[i];
        }
        grains2.push(grainBuffer);
      }
      this.imageNumberOfGrains = grains2.length;
      return grains2;
    }
    const grains = [];
    const sampleRate = sample.sampleRate || this.audioCtx.sampleRate;
    for (let index = 0; index < this.numberOfGrains; index++) {
      const startSample = index * this.samplesPerGrain;
      if (startSample >= sample.length) {
        break;
      }
      const endSample = index === this.numberOfGrains - 1 ? sample.length : Math.min(sample.length, startSample + this.samplesPerGrain);
      const length = Math.max(1, endSample - startSample);
      grains.push({
        index,
        startSample,
        endSample,
        length,
        offset: startSample / sampleRate,
        duration: length / sampleRate
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
      sampleRate
    );
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = this.audioSelection.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        const sourceIndex = startSample + i;
        newData[i] = sourceIndex < originalData.length ? originalData[sourceIndex] : 0;
      }
    }
    this.audioGrains = this.createGrains(this.audioSelection, "audio");
    this.invalidateProcessedAudio();
    this.notifyGrainCounts();
  }
  createWindowCurve(length) {
    const size = Math.max(2, length);
    return hannWindow(size, this.config.window);
  }
  getGrainDurationMs(totalDurationMs, mode = "audio") {
    if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
      return 1;
    }
    const dialValue = Math.max(1, Math.min(this.config.grainDuration, 1e3));
    if (mode === "image") {
      const ratio = dialValue / 1e3;
      const duration2 = Math.round(totalDurationMs * ratio);
      return Math.max(1, duration2);
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
    const grainCountEvent = new CustomEvent("grain-count-changed", {
      detail: { audio, image, total },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(grainCountEvent);
    if (this.config.grainIndex > total) {
      this.updateConfig("grainIndex", total);
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
      segmentCount: Math.max(1, segmentCount)
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
        segmentCount
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
      cacheKey
    };
    Promise.resolve(this.databender.render(grainBuffer)).then((buffer) => {
      if (!this.currentImageRender || this.currentImageRender.requestId !== requestId) {
        return;
      }
      this.applyBitcrusherVisuals(buffer);
      if (canUseCache) {
        this.setCachedImageRender(cacheKey, buffer);
      }
      const latest = this.lastRequestedImageSegment;
      const isLatestRequest = latest && latest.segmentIndex === segmentIndex && latest.segmentCount === segmentCount;
      if (isLatestRequest) {
        this.drawProcessedImageBuffer({
          buffer,
          context,
          canvas,
          grainsCount,
          segmentIndex,
          segmentCount
        });
      }
    }).catch((error) => {
      console.error("Failed to render image grain", error);
    }).finally(() => {
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
      targetHeight
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
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    if (now - this.lastFaviconUpdate < this.faviconUpdateInterval) {
      return;
    }
    const link = document.querySelector('link[rel="icon"]');
    if (!link) {
      return;
    }
    if (typeof canvas.toDataURL !== "function") {
      return;
    }
    try {
      link.setAttribute("href", canvas.toDataURL("image/png"));
      this.lastFaviconUpdate = now;
    } catch (error) {
      console.error("Failed to update favicon", error);
    }
  }
  dispatchRibbonImageDraw(segmentIndex, segmentCount) {
    const drawGrainEvent = new CustomEvent("draw-grain", {
      detail: {
        grainIndex: segmentIndex,
        segmentCount,
        grains: this.imageGrains
      },
      bubbles: true,
      composed: true
    });
    document.querySelector("synth-ribbon")?.dispatchEvent(drawGrainEvent);
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
      this.detune({ config: this.config.effects, source: this.bufferSource, duration: clampedDuration });
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
        const clearGrainEvent = new Event("clear-grain", {
          bubbles: true,
          composed: true
        });
        document.querySelector("synth-waveform").dispatchEvent(clearGrainEvent);
        try {
          gainNode.disconnect();
        } catch (disconnectError) {
          console.error("Failed to disconnect grain gain node", disconnectError);
        }
        try {
          activePair.source.onended = null;
          activePair.source.buffer = null;
        } catch (releaseError) {
          console.error("Failed to release finished grain buffer", releaseError);
        }
        this.activeSources.delete(activePair);
        if (this.bufferSource === activePair.source) {
          this.bufferSource = null;
        }
      };
      this.bufferSource.start(now, grain.offset, clampedDuration);
      const drawGrainEvent = new CustomEvent("draw-grain", {
        detail: {
          grainIndex: segmentIndex,
          segmentCount: totalSegments,
          grains: this.audioGrains
        },
        bubbles: true,
        composed: true
      });
      document.querySelector("synth-waveform").dispatchEvent(drawGrainEvent);
      document.querySelector("synth-ribbon").dispatchEvent(drawGrainEvent);
      this.renderImageSegment(segmentIndex, totalSegments);
    } catch (error) {
      console.error("Failed to play audio grain", error);
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
          console.error("Scheduled grain callback failed", error);
        });
        const interval = 1e3 / this.config.density;
        timerRef.id = setTimeout(run, interval);
      };
      const initialInterval = 1e3 / this.config.density;
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
      const segmentToRender = this.lastRequestedImageSegment ? { ...this.lastRequestedImageSegment } : null;
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
    if (this.activeSources && this.activeSources.size) {
      this.activeSources.forEach(({ source, gain }) => {
        try {
          source.stop();
        } catch (stopError) {
          console.error("Failed to stop grain source", stopError);
        }
        try {
          gain.disconnect();
        } catch (disconnectError) {
          console.error("Failed to disconnect grain gain node", disconnectError);
        }
        try {
          source.onended = null;
          source.buffer = null;
        } catch (releaseError) {
          console.error("Failed to release grain source buffer", releaseError);
        }
      });
      this.activeSources.clear();
    }
    if (this.bufferSource) {
      this.bufferSource = null;
    }
    this.clearPlayTimers();
    this.isPlaying = false;
    this.ribbonEngaged = false;
    this.notifyPlaybackState(false);
    if (this.image) {
      const updateImageEvent = new CustomEvent("update-image", {
        detail: this.image,
        bubbles: true,
        composed: true
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
    this.setAttribute("data-playing", isPlaying ? "true" : "false");
    const event = new CustomEvent("playback-state-changed", {
      detail: { playing: Boolean(isPlaying) },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
};
customElements.define("synth-brain", SynthBrain);

// synth-display.js
var SynthDisplay = class extends HTMLElement {
  constructor() {
    super();
    __publicField(this, "handleImageUploaded", (event) => {
      const { file } = event.detail;
      if (!file.type.startsWith("image/")) {
        alert("File type not supported. Please upload an image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event2) => {
        this.loadImageFromSource(event2.target.result, {
          emitUploadEvent: true,
          updateFavicon: true
        });
      };
      reader.readAsDataURL(file);
    });
    __publicField(this, "handleUpdateImage", (event) => {
      const { detail } = event;
      if (detail instanceof HTMLImageElement) {
        this.drawImage(detail);
      }
    });
    __publicField(this, "handleRandomImageClick", () => {
      if (!this.randomImageButton) {
        return;
      }
      const button = this.randomImageButton;
      button.disabled = true;
      button.textContent = "Loading image...";
      this.setImageControlsDisabled(true);
      const { width, height } = this.canvas.getBoundingClientRect();
      const imageWidth = Math.max(1, Math.round(width || this.canvas.width || this.clientWidth || 800));
      const imageHeight = Math.max(1, Math.round(height || this.canvas.height || this.clientHeight || 450));
      const randomImageUrl = `https://picsum.photos/${imageWidth}/${imageHeight}?random=${Date.now()}`;
      this.loadImageFromSource(randomImageUrl, {
        emitUploadEvent: true,
        updateFavicon: true,
        onError: () => {
          button.disabled = false;
          button.textContent = this.randomImageButtonLabel;
          this.setImageControlsDisabled(false);
          alert("Could not load a random image. Please try again.");
        }
      });
    });
    __publicField(this, "handleResetImageClick", () => {
      this.setImageControlsDisabled(true);
      this.handleRandomImageClick();
    });
    __publicField(this, "handleRemoveImageClick", () => {
      this.clearImage();
      const imageClearedEvent = new CustomEvent("image-cleared", {
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(imageClearedEvent);
    });
    __publicField(this, "handleFullscreenClick", async () => {
      if (!this.displayContainer) {
        return;
      }
      if (this.isDisplayInFullscreen()) {
        this.exitFullscreen();
        return;
      }
      try {
        await this.enterFullscreen(this.displayContainer);
      } catch (error) {
        console.error("Failed to enter fullscreen", error);
      }
    });
    __publicField(this, "handleFullscreenChange", () => {
      if (!this.fullscreenButton) {
        return;
      }
      const isActive = this.isDisplayInFullscreen();
      this.fullscreenButton.classList.toggle("active", isActive);
      this.fullscreenButton.setAttribute(
        "aria-label",
        isActive ? "Exit full screen view" : "Enter full screen view"
      );
    });
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                .bezel {
                  border-radius: 30px;
                  padding: 48px;
                  background:
                    radial-gradient(circle at 18% 20%, rgba(90, 100, 115, 0.45), transparent 55%),
                    radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.6), transparent 60%),
                    linear-gradient(145deg, #2f3540, #12161d);
                  box-shadow:
                    inset 10px 14px 18px rgba(0, 0, 0, 0.7),
                    inset -8px -10px 16px rgba(45, 50, 60, 0.85),
                    0 18px 40px rgba(0, 0, 0, 0.55);
                  height: 100%;
                }

                .display {
                  position: relative;
                  height: 100%;
                  width: 100%;
                  border-radius: 12px;
                  overflow: hidden;
                  background: #040608;
                  box-shadow:
                    inset 0 1px 1px rgba(255, 255, 255, 0.08),
                    inset 0 -1px 2px rgba(0, 0, 0, 0.55);
                }

                .random-trigger {
                  position: absolute;
                  inset: 1rem auto auto 1rem;
                  z-index: 4;
                  padding: 0.4rem 0.65rem;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #efefef, #bcbcbc);
                  cursor: pointer;
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.12em;
                  box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                    0 2px 6px rgba(0, 0, 0, 0.35);
                }

                .control-buttons {
                  position: absolute;
                  inset: 1rem 1rem auto auto;
                  z-index: 4;
                  display: flex;
                  gap: 0.5rem;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.2s ease;
                }

                .display.has-image:hover .control-buttons {
                  opacity: 1;
                  pointer-events: auto;
                }

                .control-buttons button {
                  width: 32px;
                  height: 32px;
                  padding: 0;
                  border-radius: 50%;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #efefef, #bcbcbc);
                  cursor: pointer;
                  font-size: 13px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  line-height: 1;
                }

                .control-buttons .icon-refresh {
                  width: 16px;
                  height: 16px;
                  display: inline-block;
                }

                .control-buttons .icon-refresh svg {
                  display: block;
                  width: 100%;
                  height: 100%;
                  fill: none;
                  stroke: #1a1d24;
                  stroke-width: 1.8;
                  stroke-linecap: round;
                  stroke-linejoin: round;
                }

                .control-buttons .icon-refresh svg path {
                  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
                }

                .fullscreen-button {
                  position: absolute;
                  inset: auto 1rem 1rem auto;
                  width: 44px;
                  height: 44px;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #efefef, #bcbcbc);
                  box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                    0 2px 6px rgba(0, 0, 0, 0.35);
                  display: none;
                  align-items: center;
                  justify-content: center;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.2s ease;
                  z-index: 4;
                  cursor: pointer;
                }

                .display.has-image .fullscreen-button {
                  display: flex;
                  opacity: 1;
                  pointer-events: auto;
                }


                .fullscreen-button .icon-fullscreen {
                  width: 22px;
                  height: 22px;
                  display: inline-block;
                }

                .fullscreen-button .icon-fullscreen svg {
                  display: block;
                  width: 100%;
                  height: 100%;
                  fill: none;
                  stroke: #1a1d24;
                  stroke-width: 1.6;
                  stroke-linecap: round;
                  stroke-linejoin: round;
                }

                .fullscreen-button .icon-fullscreen rect {
                  stroke-dasharray: 5;
                }

                .control-buttons .remove {
                  font-weight: 600;
                  letter-spacing: 0.08em;
                }

                canvas {
                  display: block;
                  height: 100%;
                  width: 100%;
                  image-rendering: pixelated;
                }

                .display-canvas {
                  border-radius: 14px;
                  transform: perspective(1200px) rotateX(4deg) scaleY(0.995);
                  box-shadow:
                    inset 0 0 40px rgba(0, 0, 0, 0.35);
                }

                .crt-overlay {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                }

                .overlay-curvature {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                  border-radius: 14px;
                  background:
                    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08), transparent 46%),
                    radial-gradient(circle at 70% 22%, rgba(255, 255, 255, 0.05), transparent 48%),
                    radial-gradient(circle at 50% 125%, rgba(0, 0, 0, 0.45), transparent 60%);
                  mix-blend-mode: screen;
                  opacity: 0.55;
                  filter: blur(0.2px);
                }

                .vignette {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                  border-radius: 14px;
                  background: radial-gradient(circle at center, transparent 60%, rgba(0, 0, 0, 0.65));
                  mix-blend-mode: multiply;
                }

                p {
                  position: absolute;
                  transform: translate(-50%, -50%);
                  left: 50%;
                  top: 50%;
                  margin: 0;
                  color: rgba(255, 255, 255, 0.8);
                  text-transform: uppercase;
                  letter-spacing: 0.18em;
                  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
                  font-size: 13px;
                }


            </style>
                <div class="bezel">
                  <dnd-wrapper>
                  <div class="display">
                    <button class="random-trigger" type="button">Random image</button>
                    <div class="control-buttons">
                      <button class="refresh" type="button" aria-label="Load new random image">
                        <span class="icon-refresh" aria-hidden="true">
                          <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M21 4v6h-6" />
                            <path d="M3 20v-6h6" />
                            <path d="M4.5 9a7 7 0 0 1 11.5-3L21 10" />
                            <path d="M19.5 15a7 7 0 0 1-11.5 3L3 14" />
                          </svg>
                        </span>
                      </button>
                      <button class="remove" type="button" aria-label="Remove image">X</button>
                    </div>
                    <button class="fullscreen-button" type="button" aria-label="Enter full screen view">
                      <span class="icon-fullscreen" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                          <rect x="5" y="5" width="14" height="14" rx="1.5" ry="1.5" />
                        </svg>
                      </span>
                    </button>
                    <canvas class="display-canvas"></canvas>
                    <canvas class="crt-overlay"></canvas>
                    <div class="overlay-curvature"></div>
                    <div class="vignette"></div>
                    <p>Drop image here</p>
                  </div>
                  </dnd-wrapper>
              </div>
        `;
    ensureBoxSizing(this.shadowRoot);
    this.displayContainer = this.shadowRoot.querySelector(".display");
    this.canvas = this.shadowRoot.querySelector(".display-canvas");
    this.context = this.canvas.getContext("2d");
    this.overlayCanvas = this.shadowRoot.querySelector(".crt-overlay");
    this.overlayContext = this.overlayCanvas.getContext("2d");
    this.dropMessage = this.shadowRoot.querySelector("p");
    this.randomImageButton = this.shadowRoot.querySelector(".random-trigger");
    this.imageControlButtons = this.shadowRoot.querySelector(".control-buttons");
    this.resetImageButton = this.shadowRoot.querySelector(".control-buttons .refresh");
    this.removeImageButton = this.shadowRoot.querySelector(".control-buttons .remove");
    this.fullscreenButton = this.shadowRoot.querySelector(".fullscreen-button");
    this.randomImageButtonLabel = this.randomImageButton?.textContent || "Random image";
    this.image = null;
    this.animationFrameId = null;
    this.scanlineSource = this.createScanlineCanvas();
    this.noiseCanvas = null;
    this.noiseContext = null;
    this.noiseImageData = null;
  }
  connectedCallback() {
    this.addEventListener("drop-success", this.handleImageUploaded, true);
    this.addEventListener("update-image", this.handleUpdateImage, true);
    if (this.randomImageButton) {
      this.randomImageButton.addEventListener("click", this.handleRandomImageClick);
      this.randomImageButtonLabel = this.randomImageButton.textContent;
    }
    if (this.resetImageButton) {
      this.resetImageButton.addEventListener("click", this.handleResetImageClick);
    }
    if (this.removeImageButton) {
      this.removeImageButton.addEventListener("click", this.handleRemoveImageClick);
    }
    if (this.fullscreenButton) {
      this.fullscreenButton.addEventListener("click", this.handleFullscreenClick);
      this.fullscreenButton.disabled = true;
    }
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
  }
  disconnectedCallback() {
    this.removeEventListener("drop-success", this.handleImageUploaded, true);
    this.removeEventListener("update-image", this.handleUpdateImage, true);
    if (this.randomImageButton) {
      this.randomImageButton.removeEventListener("click", this.handleRandomImageClick);
    }
    if (this.resetImageButton) {
      this.resetImageButton.removeEventListener("click", this.handleResetImageClick);
    }
    if (this.removeImageButton) {
      this.removeImageButton.removeEventListener("click", this.handleRemoveImageClick);
    }
    if (this.fullscreenButton) {
      this.fullscreenButton.removeEventListener("click", this.handleFullscreenClick);
    }
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    this.stopCRTLoop();
  }
  loadImageFromSource(src, { emitUploadEvent = false, updateFavicon = false, onError } = {}) {
    const { width, height } = this.canvas.getBoundingClientRect();
    const imageWidth = Math.max(1, Math.round(width || this.canvas.width || this.clientWidth || 800));
    const imageHeight = Math.max(1, Math.round(height || this.canvas.height || this.clientHeight || 450));
    const image = new Image(imageWidth, imageHeight);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      this.handleImageReady(image, { emitUploadEvent, updateFavicon });
    };
    image.onerror = () => {
      if (typeof onError === "function") {
        onError();
      }
    };
    image.src = src;
  }
  handleImageReady(image, { emitUploadEvent = false, updateFavicon = false } = {}) {
    if (emitUploadEvent) {
      const imageUploadedEvent = new CustomEvent("image-uploaded", {
        detail: { image },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(imageUploadedEvent);
    }
    if (updateFavicon) {
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.setAttribute("href", image.src);
      }
    }
    this.drawImage(image);
    if (this.randomImageButton) {
      this.randomImageButton.disabled = false;
      this.randomImageButton.textContent = this.randomImageButtonLabel;
    }
    this.setImageControlsDisabled(false);
  }
  hideRandomImageButton() {
    if (this.randomImageButton) {
      this.randomImageButton.style.display = "none";
    }
  }
  showRandomImageButton() {
    if (this.randomImageButton) {
      this.randomImageButton.style.display = "block";
      this.randomImageButton.disabled = false;
      this.randomImageButton.textContent = this.randomImageButtonLabel;
    }
  }
  setImageControlsDisabled(disabled) {
    if (this.resetImageButton) {
      this.resetImageButton.disabled = disabled;
    }
    if (this.removeImageButton) {
      this.removeImageButton.disabled = disabled;
    }
    if (this.fullscreenButton) {
      this.fullscreenButton.disabled = disabled || !this.image;
    }
  }
  clearImage() {
    if (this.isDisplayInFullscreen()) {
      this.exitFullscreen();
    }
    this.stopCRTLoop();
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.width = this.canvas.width;
      this.canvas.height = this.canvas.height;
    }
    if (this.overlayContext && this.overlayCanvas) {
      this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
      this.overlayCanvas.width = this.overlayCanvas.width;
      this.overlayCanvas.height = this.overlayCanvas.height;
    }
    this.image = null;
    this.noiseCanvas = null;
    this.noiseContext = null;
    this.noiseImageData = null;
    this.displayContainer?.classList.remove("has-image");
    this.showRandomImageButton();
    this.setImageControlsDisabled(false);
    this.showDropMessage();
    this.updateFullscreenAvailability();
  }
  showDropMessage() {
    if (this.dropMessage) {
      this.dropMessage.style.display = "";
    }
  }
  drawImage(image) {
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.image = image;
    this.context.imageSmoothingEnabled = false;
    this.context.imageSmoothingQuality = "low";
    if (this.dropMessage) {
      this.dropMessage.style.display = "none";
    }
    this.displayContainer?.classList.add("has-image");
    this.hideRandomImageButton();
    this.syncOverlaySize();
    this.startCRTLoop();
    this.context.drawImage(image, 0, 0);
    this.updateFullscreenAvailability();
  }
  updateFullscreenAvailability() {
    if (this.fullscreenButton) {
      const hasImage = Boolean(this.image);
      this.fullscreenButton.disabled = !hasImage;
    }
  }
  isDisplayInFullscreen() {
    const fullscreenElement = document.fullscreenElement;
    if (!fullscreenElement) {
      return false;
    }
    return fullscreenElement === this.displayContainer || fullscreenElement === this;
  }
  enterFullscreen(element) {
    if (!element) {
      return Promise.resolve();
    }
    return element.requestFullscreen();
  }
  exitFullscreen() {
    document.exitFullscreen();
  }
  startCRTLoop() {
    this.stopCRTLoop();
    const renderFrame = (time) => {
      if (!this.overlayContext) {
        this.animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }
      const { width, height } = this.canvas;
      if (!width || !height) {
        this.animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }
      this.syncOverlaySize();
      this.overlayContext.clearRect(0, 0, width, height);
      const flickerAmount = 0.02 + Math.random() * 0.04;
      this.overlayContext.fillStyle = `rgba(0, 0, 0, ${flickerAmount})`;
      this.overlayContext.fillRect(0, 0, width, height);
      this.drawRGBBleed(time);
      this.drawScanlines(width, height);
      this.drawNoise(width, height);
      this.drawVignette(width, height);
      this.animationFrameId = requestAnimationFrame(renderFrame);
    };
    this.animationFrameId = requestAnimationFrame(renderFrame);
  }
  stopCRTLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }
  syncOverlaySize() {
    if (!this.overlayCanvas) {
      return;
    }
    if (this.overlayCanvas.width !== this.canvas.width || this.overlayCanvas.height !== this.canvas.height) {
      this.overlayCanvas.width = this.canvas.width;
      this.overlayCanvas.height = this.canvas.height;
    }
  }
  drawRGBBleed(time = 0) {
    if (!this.overlayContext) {
      return;
    }
    const { width, height } = this.canvas;
    const shift = Math.sin(time * 6e-3) * 1.5;
    this.overlayContext.save();
    this.overlayContext.globalCompositeOperation = "screen";
    this.overlayContext.globalAlpha = 0.18;
    this.overlayContext.filter = `drop-shadow(${shift}px 0 0 rgba(255, 0, 120, 0.9))`;
    this.overlayContext.drawImage(this.canvas, 0, 0, width, height);
    this.overlayContext.filter = `drop-shadow(${-shift}px 0 0 rgba(0, 220, 255, 0.85))`;
    this.overlayContext.drawImage(this.canvas, 0, 0, width, height);
    this.overlayContext.restore();
    this.overlayContext.filter = "none";
    this.overlayContext.globalCompositeOperation = "source-over";
  }
  createScanlineCanvas() {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = 1;
    scanCanvas.height = 2;
    const scanContext = scanCanvas.getContext("2d");
    scanContext.fillStyle = "rgba(0, 0, 0, 0.25)";
    scanContext.fillRect(0, 0, 1, 1);
    scanContext.fillStyle = "rgba(0, 0, 0, 0)";
    scanContext.fillRect(0, 1, 1, 1);
    return scanCanvas;
  }
  drawScanlines(width, height) {
    if (!this.overlayContext) {
      return;
    }
    if (!this.scanlineSource) {
      return;
    }
    const pattern = this.overlayContext.createPattern(this.scanlineSource, "repeat");
    if (!pattern) {
      return;
    }
    this.overlayContext.save();
    this.overlayContext.globalAlpha = 0.35;
    this.overlayContext.fillStyle = pattern;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
  ensureNoiseResources() {
    if (!this.noiseCanvas) {
      this.noiseCanvas = document.createElement("canvas");
      this.noiseCanvas.width = 128;
      this.noiseCanvas.height = 128;
      this.noiseContext = this.noiseCanvas.getContext("2d");
      this.noiseImageData = this.noiseContext.createImageData(
        this.noiseCanvas.width,
        this.noiseCanvas.height
      );
    }
  }
  drawNoise(width, height) {
    if (!this.overlayContext) {
      return;
    }
    this.ensureNoiseResources();
    if (!this.noiseCanvas || !this.noiseContext || !this.noiseImageData) {
      return;
    }
    const data = this.noiseImageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const shade = Math.random() * 255;
      data[i] = shade;
      data[i + 1] = shade;
      data[i + 2] = shade;
      data[i + 3] = 40 + Math.random() * 40;
    }
    this.noiseContext.putImageData(this.noiseImageData, 0, 0);
    const pattern = this.overlayContext.createPattern(this.noiseCanvas, "repeat");
    if (!pattern) {
      return;
    }
    this.overlayContext.save();
    this.overlayContext.globalAlpha = 0.1;
    this.overlayContext.fillStyle = pattern;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
  drawVignette(width, height) {
    if (!this.overlayContext) {
      return;
    }
    const gradient = this.overlayContext.createRadialGradient(
      width / 2,
      height / 2,
      Math.max(width, height) * 0.1,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    this.overlayContext.save();
    this.overlayContext.fillStyle = gradient;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
};
customElements.define("synth-display", SynthDisplay);

// synth-select.js
var SynthSelect = class extends HTMLElement {
  constructor() {
    super();
    const rawName = this.getAttribute("name") || "";
    const rawLabel = this.getAttribute("label") || "";
    const ariaLabelAttr = this.getAttribute("aria-label");
    const optionsAttr = this.getAttribute("options") || "[]";
    const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    let options;
    try {
      const parsed = JSON.parse(optionsAttr);
      options = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse synth-select options", error);
      options = [];
    }
    const normalizedOptions = options.map((option) => {
      const optionValue = Object.prototype.hasOwnProperty.call(option, "value") ? option.value : option?.label;
      return {
        value: optionValue != null ? String(optionValue) : "",
        label: option?.label != null ? String(option.label) : String(optionValue ?? "")
      };
    });
    const synthBrain = document.querySelector("synth-brain");
    const config = synthBrain?.config ?? {};
    const resolveConfigValue = (name) => {
      if (!name) {
        return void 0;
      }
      if (!name.includes(".")) {
        return config?.[name];
      }
      return name.split(".").reduce((cursor, segment) => cursor && Object.prototype.hasOwnProperty.call(cursor, segment) ? cursor[segment] : void 0, config);
    };
    const configValue = resolveConfigValue(rawName);
    const initialValue = configValue != null ? String(configValue) : normalizedOptions?.[0]?.value ?? "";
    const selectId = `${rawName || "synth-select"}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = escapeHtml(rawName);
    const safeLabel = escapeHtml(rawLabel);
    const fallbackAriaLabel = escapeHtml(ariaLabelAttr || rawLabel || rawName || "Select option");
    const optionsMarkup = normalizedOptions.map(({ label, value }) => {
      const safeValue = escapeHtml(value);
      const safeOptionLabel = escapeHtml(label);
      const isSelected = value === initialValue;
      const selectedAttr = isSelected ? " selected" : "";
      return `<option value="${safeValue}"${selectedAttr}>${safeOptionLabel}</option>`;
    }).join("");
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          flex-direction: column;
          color: inherit;
          font-size: 0.75rem;
          gap: 6px;
          min-width: 0;
        }

        .field {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .field-label {
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(240, 244, 243, 0.78);
          font-size: 0.68rem;
          line-height: 1;
        }

        .select-shell {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-width: 140px;
          border-radius: 8px;
          padding: 6px 36px 6px 12px;
          background: linear-gradient(145deg, rgba(50, 54, 58, 0.92), rgba(22, 24, 27, 0.92));
          border: 1px solid rgba(0, 0, 0, 0.65);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 6px 16px rgba(0, 0, 0, 0.35);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        :host(:focus-within) .select-shell {
          border-color: rgba(102, 220, 255, 0.85);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 0 0 3px rgba(102, 220, 255, 0.18),
            0 6px 16px rgba(0, 0, 0, 0.35);
        }

        select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          flex: 1 1 auto;
          width: 100%;
          background: transparent;
          border: none;
          color: #f1f4f3;
          font: 500 0.9rem/1.2 "IBM Plex Sans", "Segoe UI", sans-serif;
          letter-spacing: 0.01em;
          padding: 0;
          cursor: pointer;
          min-width: 0;
        }

        select:focus {
          outline: none;
        }

        select::-ms-expand {
          display: none;
        }

        option {
          background-color: #111417;
          color: #f1f4f3;
        }

        .select-shell::after {
          content: "";
          position: absolute;
          right: 12px;
          top: 50%;
          width: 10px;
          height: 10px;
          transform: translateY(-50%) rotate(45deg);
          border-right: 2px solid rgba(243, 206, 122, 0.9);
          border-bottom: 2px solid rgba(243, 206, 122, 0.9);
          pointer-events: none;
          box-shadow: 0 0 4px rgba(243, 206, 122, 0.3);
        }

        .select-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }

        .select-shell:hover {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 6px 16px rgba(0, 0, 0, 0.45);
        }
      </style>
      <div class="field">
        ${safeLabel ? `<label class="field-label" for="${selectId}">${safeLabel}</label>` : ""}
        <div class="select-shell">
          <select id="${selectId}" name="${safeName}" aria-label="${fallbackAriaLabel}">
            ${optionsMarkup}
          </select>
        </div>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.selectElement = this.shadowRoot.querySelector("select");
    if (this.selectElement && normalizedOptions.some((option) => option.value === initialValue)) {
      this.selectElement.value = initialValue;
    }
    this.handleOnChange = this.handleOnChange.bind(this);
  }
  handleOnChange(event) {
    const { name, value } = event.target;
    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value },
      bubbles: true,
      composed: true
    });
    document.querySelector("synth-brain")?.dispatchEvent(updateConfigEvent);
  }
  connectedCallback() {
    this.selectElement?.addEventListener("change", this.handleOnChange);
  }
  disconnectedCallback() {
    this.selectElement?.removeEventListener("change", this.handleOnChange);
  }
};
customElements.define("synth-select", SynthSelect);

// synth-dial.js
var SynthDial = class extends HTMLElement {
  constructor() {
    super();
    const inputName = this.getAttribute("name");
    const min = parseFloat(this.getAttribute("min") || "0");
    const max = parseFloat(this.getAttribute("max") || "100");
    const label = this.getAttribute("label") || "";
    const stepAttr = this.getAttribute("step");
    const step = parseFloat(stepAttr || "1");
    const stepPrecision = stepAttr && stepAttr.includes(".") ? stepAttr.split(".")[1].length : 0;
    const config = document.querySelector("synth-brain")?.config;
    let value;
    if (config && inputName.includes(".")) {
      const [groupKey, effectKey, valueKey] = inputName.split(".");
      value = config[groupKey][effectKey][valueKey] || min;
    } else if (config) {
      value = config[inputName] || min;
    } else {
      value = parseFloat(this.getAttribute("value") || min);
    }
    value = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(value)) {
      value = min;
    }
    const formatAttr = this.getAttribute("format");
    this.percentMode = formatAttr && formatAttr.toLowerCase() === "percent";
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          align-items: center;
          display: inline-flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .dial-container {
          position: relative;
          width: 60px;
          height: 60px;
          cursor: pointer;
          user-select: none;
        }
        
        .dial-background {
          width: 100%;
          height: 100%;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
          border-radius: 50%;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.5),
            inset -2px -2px 4px rgba(60, 60, 60, 0.3),
            2px 2px 6px rgba(0, 0, 0, 0.3);
          position: relative;
        }
        
        .dial-ticks {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
        }
        
        .tick {
          position: absolute;
          width: 2px;
          height: 6px;
          background: rgba(255, 255, 255, 0.3);
          left: 50%;
          top: 4px;
          transform-origin: 50% 26px;
          margin-left: -1px;
        }
        
        .tick.major {
          height: 8px;
          width: 2px;
          background: rgba(255, 255, 255, 0.5);
        }
        
        .dial-indicator {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          transition: transform 0.1s ease-out;
        }
        
        .indicator-line {
          position: absolute;
          width: 3px;
          height: 20px;
          background: white;
          left: 50%;
          top: 8px;
          margin-left: -1.5px;
          border-radius: 2px;
          box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
        }
        
        .dial-center {
          position: absolute;
          width: 40px;
          height: 40px;
          background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.4),
            inset 1px 1px 2px rgba(80, 80, 80, 0.3);
        }

        output {
          display: grid;
          place-items: center;
          font-family: monospace;
          font-size: 10px;
          color: #fff;
          min-width: 40px;
          height: 100%;
        }
        
        input {
          display: none;
        }

        label {
          font-family: sans-serif;
          font-size: 11px;
          color: #ccc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      </style>
      
      <div class="dial-container">
        <div class="dial-background">
          <div class="dial-ticks"></div>
          <div class="dial-indicator">
            <div class="indicator-line"></div>
          </div>
        <div class="dial-center">
          <output for=${inputName}>${value}</output>
        </div>
        </div>
      </div>
      <input name=${inputName} type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
      <label>${label}</label>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.startAngle = -140;
    this.endAngle = 140;
    this.rotationRangeRadians = (this.endAngle - this.startAngle) * (Math.PI / 180);
    const dragAttr = this.getAttribute("drag-sensitivity");
    const parsedDrag = dragAttr !== null ? parseFloat(dragAttr) : NaN;
    this.dragSensitivity = Number.isFinite(parsedDrag) && parsedDrag > 0 ? parsedDrag : 1.2;
    this.min = min;
    this.max = max;
    this.step = step;
    this.stepPrecision = stepPrecision;
    this.displayMode = this.percentMode ? "number" : formatAttr ? formatAttr.toLowerCase() : "number";
    this.value = value;
    this.continuousValue = value;
    this.inputName = inputName;
    this.dialContainer = this.shadowRoot.querySelector(".dial-container");
    this.dialIndicator = this.shadowRoot.querySelector(".dial-indicator");
    this.valueOutput = this.shadowRoot.querySelector("output");
    this.ticksContainer = this.shadowRoot.querySelector(".dial-ticks");
    this.isDragging = false;
    this.startY = 0;
    this.startValue = 0;
    if (this.percentMode) {
      this.valueOutput.setAttribute("inputmode", "decimal");
      this.valueOutput.setAttribute("pattern", "[0-9]*\\.?[0-9]*");
      this.valueOutput.setAttribute("placeholder", "0.0");
    }
    this.createTicks();
    this.updateRotation();
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleConfigUpdated = this.handleConfigUpdated.bind(this);
  }
  createTicks() {
    const totalTicks = 21;
    const angleRange = this.endAngle - this.startAngle;
    for (let i = 0; i < totalTicks; i++) {
      const tick = document.createElement("div");
      const angle = this.startAngle + angleRange * i / (totalTicks - 1);
      const isMajor = i % 5 === 0;
      tick.className = isMajor ? "tick major" : "tick";
      tick.style.transform = `rotate(${angle}deg)`;
      this.ticksContainer.appendChild(tick);
    }
  }
  valueToAngle(value) {
    const normalized = (value - this.min) / (this.max - this.min);
    return this.startAngle + normalized * (this.endAngle - this.startAngle);
  }
  updateRotation() {
    const angle = this.valueToAngle(this.value);
    this.dialIndicator.style.transform = `rotate(${angle}deg)`;
    this.valueOutput.value = this.formatValue(this.value);
  }
  formatValue(value) {
    if (this.displayMode === "percent") {
      const numeric = Number(value) * 100;
      if (Number.isNaN(numeric)) {
        return "0%";
      }
      const rounded = Number.isInteger(numeric) ? String(Math.round(numeric)) : Number(numeric.toFixed(2)).toString().replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
      return `${rounded}%`;
    }
    const decimals = Math.max(this.stepPrecision, value % 1 === 0 ? 0 : 2);
    return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }
  handleConfigUpdated(event) {
    const { name, value } = event.detail;
    if (name !== this.inputName) {
      return;
    }
    const numericValue = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return;
    }
    this.commitValueChange(numericValue, false);
  }
  commitValueChange(rawValue, emit = true) {
    let numericValue;
    if (this.percentMode) {
      if (typeof rawValue === "number") {
        numericValue = rawValue;
      } else {
        const cleaned = String(rawValue).trim().replace(/%/g, "");
        numericValue = parseFloat(cleaned);
        if (Number.isNaN(numericValue)) {
          if (this.valueInput) {
            this.valueInput.value = this.formatValue(this.value);
          }
          return;
        }
      }
    } else {
      numericValue = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);
    }
    if (Number.isNaN(numericValue)) {
      if (this.valueInput) {
        this.valueInput.value = this.formatValue(this.value);
      }
      return;
    }
    numericValue = Math.max(this.min, Math.min(this.max, numericValue));
    this.continuousValue = numericValue;
    let quantizedValue = numericValue;
    if (this.step > 0) {
      quantizedValue = Math.round((numericValue - this.min) / this.step) * this.step + this.min;
    }
    const precision = Math.max(this.stepPrecision, 4);
    quantizedValue = parseFloat(quantizedValue.toFixed(precision));
    quantizedValue = Math.max(this.min, Math.min(this.max, quantizedValue));
    if (quantizedValue === this.value) {
      this.updateRotation();
      return;
    }
    this.value = quantizedValue;
    this.updateRotation();
    if (emit) {
      this.dispatchChangeEvent();
    }
  }
  handleMouseDown(e) {
    e.preventDefault();
    this.isDragging = true;
    const rect = this.dialContainer.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.previousAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);
    this.continuousValue = this.value;
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);
  }
  handleMouseMove(e) {
    if (!this.isDragging) return;
    const currentAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);
    let angleDelta = currentAngle - this.previousAngle;
    if (angleDelta > Math.PI) {
      angleDelta -= 2 * Math.PI;
    } else if (angleDelta < -Math.PI) {
      angleDelta += 2 * Math.PI;
    }
    this.previousAngle = currentAngle;
    const range = this.max - this.min;
    const fullRotation = this.rotationRangeRadians * this.dragSensitivity;
    const valueChange = angleDelta / fullRotation * range;
    const baseValue = typeof this.continuousValue === "number" ? this.continuousValue : this.value;
    const newValue = baseValue + valueChange;
    this.commitValueChange(newValue, true);
  }
  handleMouseUp() {
    this.isDragging = false;
    this.continuousValue = this.value;
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
  }
  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.isDragging = true;
    const rect = this.dialContainer.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.previousAngle = Math.atan2(touch.clientY - this.centerY, touch.clientX - this.centerX);
    this.continuousValue = this.value;
    document.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    document.addEventListener("touchend", this.handleTouchEnd);
  }
  handleTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const currentAngle = Math.atan2(touch.clientY - this.centerY, touch.clientX - this.centerX);
    let angleDelta = currentAngle - this.previousAngle;
    if (angleDelta > Math.PI) {
      angleDelta -= 2 * Math.PI;
    } else if (angleDelta < -Math.PI) {
      angleDelta += 2 * Math.PI;
    }
    this.previousAngle = currentAngle;
    const range = this.max - this.min;
    const fullRotation = this.rotationRangeRadians * this.dragSensitivity;
    const valueChange = angleDelta / fullRotation * range;
    const baseValue = typeof this.continuousValue === "number" ? this.continuousValue : this.value;
    const newValue = baseValue + valueChange;
    this.commitValueChange(newValue, true);
  }
  handleTouchEnd() {
    this.isDragging = false;
    this.continuousValue = this.value;
    document.removeEventListener("touchmove", this.handleTouchMove);
    document.removeEventListener("touchend", this.handleTouchEnd);
  }
  dispatchChangeEvent() {
    const synthBrain = this.synthBrain || document.querySelector("synth-brain");
    if (synthBrain) {
      const updateConfigEvent = new CustomEvent("update-config", {
        detail: { name: this.inputName, value: this.value },
        bubbles: true,
        composed: true
      });
      synthBrain.dispatchEvent(updateConfigEvent);
    }
    const changeEvent = new CustomEvent("change", {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(changeEvent);
  }
  connectedCallback() {
    this.dialContainer.addEventListener("mousedown", this.handleMouseDown);
    this.dialContainer.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    this.synthBrain = this.closest("synth-brain");
    if (this.synthBrain) {
      this.synthBrain.addEventListener("config-updated", this.handleConfigUpdated);
    }
  }
  disconnectedCallback() {
    this.dialContainer.removeEventListener("mousedown", this.handleMouseDown);
    this.dialContainer.removeEventListener("touchstart", this.handleTouchStart);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("touchmove", this.handleTouchMove);
    document.removeEventListener("touchend", this.handleTouchEnd);
    if (this.synthBrain) {
      this.synthBrain.removeEventListener("config-updated", this.handleConfigUpdated);
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "max") {
      this.max = parseFloat(newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("max", newValue);
      }
      this.updateRotation();
    } else if (name === "min") {
      this.min = parseFloat(newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("min", newValue);
      }
      this.updateRotation();
    } else if (name === "value") {
      this.value = parseFloat(newValue);
      this.updateRotation();
    }
  }
};
__publicField(SynthDial, "observedAttributes", ["min", "max", "value"]);
customElements.define("synth-dial", SynthDial);

// synth-switch.js
var SynthSwitch = class extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }
  constructor() {
    super();
    this.inputName = this.getAttribute("name") || "";
    this.labelText = this.getAttribute("label");
    this.ariaLabel = this.getAttribute("aria-label") || this.labelText || this.inputName || "Toggle";
    const synthBrain = document.querySelector("synth-brain");
    const config = synthBrain?.config ?? {};
    let checked = false;
    if (this.inputName) {
      const path = this.inputName.split(".");
      let cursor = config;
      for (const segment of path) {
        if (cursor && Object.prototype.hasOwnProperty.call(cursor, segment)) {
          cursor = cursor[segment];
        } else {
          cursor = void 0;
          break;
        }
      }
      checked = Boolean(cursor);
    }
    this.attachShadow({ mode: "open" });
    const safeAriaLabel = this.ariaLabel.replace(/"/g, "&quot;");
    const labelMarkup = this.labelText ? `<span class="switch-text">${this.labelText}</span>` : "";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-size: 0.75rem;
          color: inherit;
        }

        .switch-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          user-select: none;
        }

        .switch-wrapper.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .switch-text {
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.7rem;
        }

        .switch {
          position: relative;
          display: inline-flex;
          width: var(--switch-width, 46px);
          height: var(--switch-height, 24px);
        }

        input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: inherit;
        }

        .switch-visual {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: var(--switch-height, 24px);
          background: var(--switch-track-off, rgba(255, 255, 255, 0.16));
          transition: background 0.2s ease, box-shadow 0.2s ease;
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(0, 0, 0, 0.35);
        }

        .switch-thumb {
          position: absolute;
          top: var(--switch-padding, 2px);
          left: var(--switch-padding, 2px);
          width: calc(var(--switch-height, 24px) - var(--switch-padding, 2px) * 2);
          height: calc(var(--switch-height, 24px) - var(--switch-padding, 2px) * 2);
          border-radius: 50%;
          background: var(--switch-thumb, #f7faf8);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
          transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        input:checked + .switch-visual {
          background: var(--switch-track-on, #3ad2a3);
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(0, 0, 0, 0.25);
        }

        input:checked + .switch-visual .switch-thumb {
          transform: translateX(calc(var(--switch-width, 46px) - var(--switch-height, 24px)));
        }

        input:focus-visible + .switch-visual {
          outline: 2px solid rgba(58, 210, 163, 0.85);
          outline-offset: 3px;
        }

        input:disabled + .switch-visual {
          background: var(--switch-track-disabled, rgba(255, 255, 255, 0.08));
        }

        input:disabled + .switch-visual .switch-thumb {
          background: var(--switch-thumb-disabled, rgba(255, 255, 255, 0.5));
          box-shadow: none;
        }
      </style>
      <div class="switch-wrapper">
        ${labelMarkup}
        <label class="switch">
          <input type="checkbox" name="${this.inputName}" aria-label="${safeAriaLabel}">
          <span class="switch-visual">
            <span class="switch-thumb"></span>
          </span>
        </label>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.wrapper = this.shadowRoot.querySelector(".switch-wrapper");
    this.inputElement = this.shadowRoot.querySelector('input[type="checkbox"]');
    this.inputElement.checked = checked;
    this.handleOnChange = this.handleOnChange.bind(this);
    this.syncDisabled();
  }
  handleOnChange(event) {
    const { name, checked } = event.target;
    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: checked },
      bubbles: true,
      composed: true
    });
    document.querySelector("synth-brain")?.dispatchEvent(updateConfigEvent);
  }
  connectedCallback() {
    this.inputElement.addEventListener("change", this.handleOnChange);
  }
  disconnectedCallback() {
    this.inputElement.removeEventListener("change", this.handleOnChange);
  }
  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.syncDisabled();
    }
  }
  syncDisabled() {
    const isDisabled = this.hasAttribute("disabled");
    if (isDisabled) {
      this.inputElement.setAttribute("disabled", "");
    } else {
      this.inputElement.removeAttribute("disabled");
    }
    if (this.wrapper) {
      this.wrapper.classList.toggle("disabled", isDisabled);
    }
  }
};
customElements.define("synth-switch", SynthSwitch);

// synth-waveform.js
var SynthWaveform = class extends HTMLElement {
  constructor() {
    super();
    __publicField(this, "handleRandomAudioClick", async () => {
      if (!this.randomAudioButton) {
        return;
      }
      const button = this.randomAudioButton;
      button.disabled = true;
      button.textContent = "Loading audio...";
      this.setAudioControlsDisabled(true);
      try {
        const buffer = await this.loadRandomAudioBuffer();
        this.handleAudioReady(buffer, { source: "random" });
      } catch (error) {
        console.error("Random audio generation failed:", error);
        alert("Could not load random audio. Please try again or upload a file.");
        button.disabled = false;
        button.textContent = this.randomAudioButtonLabel;
        this.setAudioControlsDisabled(false);
      }
    });
    __publicField(this, "handleResetAudioClick", () => {
      this.setAudioControlsDisabled(true);
      this.handleRandomAudioClick();
    });
    __publicField(this, "handleRemoveAudioClick", () => {
      this.clearAudio();
      const audioClearedEvent = new CustomEvent("audio-cleared", {
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(audioClearedEvent);
    });
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                :host {
                  display: flex;
                  flex-direction: column;
                  position: relative;
                  min-height: 0;
                }

                .bezel {
                  height: 100%;
                  border-radius: 22px;
                  padding: 24px;
                  background:
                    radial-gradient(circle at 20% 18%, rgba(95, 110, 125, 0.35), transparent 55%),
                    radial-gradient(circle at 78% 82%, rgba(0, 0, 0, 0.6), transparent 58%),
                    linear-gradient(145deg, #282f3a, #10151d);
                  box-shadow:
                    inset 8px 12px 16px rgba(0, 0, 0, 0.7),
                    inset -7px -9px 14px rgba(40, 45, 55, 0.85),
                    0 16px 36px rgba(0, 0, 0, 0.5);
                }

                .display.waveform {
                  position: relative;
                  height: 100%;
                  width: 100%;
                  border-radius: 14px;
                  overflow: hidden;
                  background: linear-gradient(180deg, #031611, #010807);
                  box-shadow:
                    inset 0 1px 1px rgba(255, 255, 255, 0.06),
                    inset 0 -1px 2px rgba(0, 0, 0, 0.55);
                }

                .random-trigger {
                  position: absolute;
                  inset: 0.75rem auto auto 0.75rem;
                  z-index: 4;
                  padding: 0.35rem 0.65rem;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #f0f5ef, #cdd8cf);
                  cursor: pointer;
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 0.12em;
                  box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                    0 2px 6px rgba(0, 0, 0, 0.35);
                }

                .control-buttons {
                  position: absolute;
                  inset: 0.75rem 0.75rem auto auto;
                  z-index: 4;
                  display: flex;
                  gap: 0.45rem;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.2s ease;
                }

                .waveform.has-audio:hover .control-buttons {
                  opacity: 1;
                  pointer-events: auto;
                }

                .control-buttons button {
                  width: 32px;
                  height: 32px;
                  padding: 0;
                  border-radius: 50%;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #f0f5ef, #cdd8cf);
                  cursor: pointer;
                  font-size: 12px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  line-height: 1;
                }

                .control-buttons .icon-refresh {
                  width: 16px;
                  height: 16px;
                  display: inline-block;
                }

                .control-buttons .icon-refresh svg {
                  display: block;
                  width: 100%;
                  height: 100%;
                  fill: none;
                  stroke: #132b24;
                  stroke-width: 1.6;
                  stroke-linecap: round;
                  stroke-linejoin: round;
                }

                .control-buttons .icon-refresh svg path {
                  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
                }

                .control-buttons .remove {
                  font-weight: 600;
                  letter-spacing: 0.08em;
                }

                .osc-grid {
                  position: absolute;
                  inset: 0;
                  background:
                    repeating-linear-gradient(
                      to right,
                      rgba(79, 255, 173, 0.12) 0px,
                      rgba(79, 255, 173, 0.12) 1px,
                      transparent 1px,
                      transparent 40px
                    ),
                    repeating-linear-gradient(
                      to bottom,
                      rgba(79, 255, 173, 0.12) 0px,
                      rgba(79, 255, 173, 0.12) 1px,
                      transparent 1px,
                      transparent 32px
                    );
                  opacity: 0.4;
                  pointer-events: none;
                }

                canvas {
                  display: block;
                  height: 100%;
                  width: 100%;
                  image-rendering: pixelated;
                }

                .waveform-canvas {
                  border-radius: 14px;
                  transform: perspective(1100px) rotateX(5deg) scaleY(0.992);
                }

                .crt-overlay {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                }

                .overlay-curvature {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                  border-radius: 14px;
                  background:
                    radial-gradient(circle at 28% 18%, rgba(120, 255, 180, 0.12), transparent 45%),
                    radial-gradient(circle at 78% 22%, rgba(120, 255, 180, 0.08), transparent 48%),
                    radial-gradient(circle at 50% 130%, rgba(0, 0, 0, 0.5), transparent 65%);
                  mix-blend-mode: screen;
                  opacity: 0.55;
                  filter: blur(0.25px);
                }

                .vignette {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                  border-radius: 14px;
                  background: radial-gradient(circle at center, transparent 62%, rgba(0, 0, 0, 0.65));
                  mix-blend-mode: multiply;
                }

                p {
                  position: absolute;
                  transform: translate(-50%, -50%);
                  left: 50%;
                  top: 50%;
                  margin: 0;
                  color: rgba(150, 255, 204, 0.75);
                  text-transform: uppercase;
                  letter-spacing: 0.18em;
                  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
                  font-size: 12px;
                }
            </style>
              <div class="bezel">
                <dnd-wrapper>
                <div class="display waveform">
                  <button class="random-trigger" type="button">Random audio</button>
                  <div class="control-buttons">
                    <button class="refresh" type="button" aria-label="Load new random audio">
                      <span class="icon-refresh" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                          <path d="M21 4v6h-6" />
                          <path d="M3 20v-6h6" />
                          <path d="M4.5 9a7 7 0 0 1 11.5-3L21 10" />
                          <path d="M19.5 15a7 7 0 0 1-11.5 3L3 14" />
                        </svg>
                      </span>
                    </button>
                    <button class="remove" type="button" aria-label="Remove audio">X</button>
                  </div>
                  <div class="osc-grid"></div>
                  <canvas class="waveform-canvas"></canvas>
                  <canvas class="crt-overlay"></canvas>
                  <div class="overlay-curvature"></div>
                  <div class="vignette"></div>
                  <p>Drop audio here</p>
                </div>
            </dnd-wrapper>
            </div>
        `;
    ensureBoxSizing(this.shadowRoot);
    this.waveformContainer = this.shadowRoot.querySelector(".display.waveform");
    this.canvas = this.shadowRoot.querySelector(".waveform-canvas");
    this.context = this.canvas.getContext("2d");
    this.overlayCanvas = this.shadowRoot.querySelector(".crt-overlay");
    this.overlayContext = this.overlayCanvas.getContext("2d");
    this.dropMessage = this.shadowRoot.querySelector("p");
    this.scanlineSource = this.createScanlineCanvas();
    this.noiseCanvas = null;
    this.noiseContext = null;
    this.noiseImageData = null;
    this.animationFrameId = null;
    this.resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) {
        return;
      }
      const { width, height } = entries[0].contentRect;
      this.setCanvasSize(width, height);
    });
    this.selection = { start: null, end: null };
    this.selectionToPixels = { start: null, end: null };
    this.selectionWidth = this.canvas.width;
    this.selectionX = 0;
    this.samplesPerPixel = 1;
    this.audioCtx = this.closest("synth-brain").audioCtx;
    this.randomAudioButton = this.shadowRoot.querySelector(".random-trigger");
    this.audioControlButtons = this.shadowRoot.querySelector(".control-buttons");
    this.resetAudioButton = this.shadowRoot.querySelector(".control-buttons .refresh");
    this.removeAudioButton = this.shadowRoot.querySelector(".control-buttons .remove");
    this.randomAudioButtonLabel = this.randomAudioButton?.textContent || "Random audio";
    this.gitHubAudioProviders = [
      {
        cacheKey: "mdn-webaudio-examples",
        owner: "mdn",
        repo: "webaudio-examples",
        branch: "main",
        filterRegex: /\.(mp3|wav|ogg)$/i
      },
      {
        cacheKey: "googlechromelabs-web-audio-samples",
        owner: "GoogleChromeLabs",
        repo: "web-audio-samples",
        branch: "main",
        filterRegex: /\.(mp3|wav|ogg)$/i,
        pathRegex: /^src\/demos\/mld-drum-sampler\/samples\//i
      }
    ];
    this.gitHubAudioCache = /* @__PURE__ */ new Map();
    this.gitHubAudioPromises = /* @__PURE__ */ new Map();
    const builtInFallbackSources = [
      "https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3",
      "https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-basics/outfoxing.mp3",
      "https://raw.githubusercontent.com/mdn/webaudio-examples/main/voice-change-o-matic/audio/concert-crowd.mp3",
      "https://raw.githubusercontent.com/mdn/webaudio-examples/main/step-sequencer/dtmf.mp3",
      "https://raw.githubusercontent.com/GoogleChromeLabs/web-audio-samples/main/src/demos/mld-drum-sampler/samples/drum-fx-01.mp3",
      "https://raw.githubusercontent.com/GoogleChromeLabs/web-audio-samples/main/src/demos/mld-drum-sampler/samples/drum-oh-02.mp3",
      makeAbsoluteUrl("example.mp3")
    ];
    this.archiveProviders = [
      {
        label: "Radio Aporee Maps",
        query: "collection:radio-aporee-maps AND format:MP3",
        manualFallback: [
          "https://archive.org/download/aporee_69834_81312/202507302277310N12113125E.mp3",
          "https://archive.org/download/aporee_69841_81320/2509280023.mp3",
          "https://archive.org/download/aporee_11664_13718/SBGNouMurcielagos.mp3"
        ],
        count: 100,
        cursor: null,
        itemsBuffer: [],
        cooldownUntil: 0,
        totalItems: null,
        mp3Cache: /* @__PURE__ */ new Map()
      },
      {
        label: "Kentuckiana Sounds",
        query: "collection:kentuckianasounds AND format:MP3",
        manualFallback: [],
        count: 100,
        cursor: null,
        itemsBuffer: [],
        cooldownUntil: 0,
        totalItems: null,
        mp3Cache: /* @__PURE__ */ new Map()
      },
      {
        label: "Global Field Recordings",
        query: 'collection:opensource_audio AND subject:"field recording" AND format:MP3',
        manualFallback: [],
        count: 100,
        cursor: null,
        itemsBuffer: [],
        cooldownUntil: 0,
        totalItems: null,
        mp3Cache: /* @__PURE__ */ new Map()
      },
      {
        label: "Birdsong & Wildlife",
        query: 'collection:opensource_audio AND subject:"bird" AND format:MP3',
        manualFallback: [],
        count: 100,
        cursor: null,
        itemsBuffer: [],
        cooldownUntil: 0,
        totalItems: null,
        mp3Cache: /* @__PURE__ */ new Map()
      },
      {
        label: "Rain Soundscapes",
        query: 'collection:opensource_audio AND subject:"rain" AND format:MP3',
        manualFallback: [],
        count: 100,
        cursor: null,
        itemsBuffer: [],
        cooldownUntil: 0,
        totalItems: null,
        mp3Cache: /* @__PURE__ */ new Map()
      }
    ];
    this.remoteAudioSources = Array.from(
      /* @__PURE__ */ new Set([
        ...builtInFallbackSources,
        ...this.archiveProviders.flatMap((provider) => provider.manualFallback || [])
      ])
    );
    this.archiveSearchBaseUrl = "https://archive.org/advancedsearch.php";
    this.archiveSearchScrapeUrl = "https://archive.org/services/search/v1/scrape";
    this.archiveMetadataBaseUrl = "https://archive.org/metadata/";
    this.archiveDownloadBaseUrl = "https://archive.org/download/";
    this.addEventListeners();
  }
  connectedCallback() {
    this.addEventListener("drop-success", this.handleAudioUploaded);
    this.addEventListener("clear-grain", this.clearGrain);
    this.addEventListener("draw-grain", this.drawGrain);
    if (this.randomAudioButton) {
      this.randomAudioButton.addEventListener("click", this.handleRandomAudioClick);
    }
    if (this.resetAudioButton) {
      this.resetAudioButton.addEventListener("click", this.handleResetAudioClick);
    }
    if (this.removeAudioButton) {
      this.removeAudioButton.addEventListener("click", this.handleRemoveAudioClick);
    }
    if (this.waveformContainer) {
      this.resizeObserver.observe(this.waveformContainer);
      const rect = this.waveformContainer.getBoundingClientRect();
      if (rect.width && rect.height) {
        this.setCanvasSize(rect.width, rect.height);
      }
    }
    this.startCRTLoop();
  }
  disconnectedCallback() {
    this.removeEventListener("drop-success", this.handleAudioUploaded);
    this.removeEventListener("clear-grain", this.clearGrain);
    this.removeEventListener("draw-grain", this.drawGrain);
    if (this.randomAudioButton) {
      this.randomAudioButton.removeEventListener("click", this.handleRandomAudioClick);
    }
    if (this.resetAudioButton) {
      this.resetAudioButton.removeEventListener("click", this.handleResetAudioClick);
    }
    if (this.removeAudioButton) {
      this.removeAudioButton.removeEventListener("click", this.handleRemoveAudioClick);
    }
    this.resizeObserver.disconnect();
    this.stopCRTLoop();
  }
  pixelToSampleIndex(pixel) {
    return Math.round(pixel * this.samplesPerPixel);
  }
  addEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => {
      const x = e.offsetX;
      this.selectionToPixels.start = x;
      this.selection.start = this.pixelToSampleIndex(x);
      this.isSelecting = true;
    });
    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.isSelecting) return;
      const x = e.offsetX;
      this.selectionToPixels.end = x;
      this.selection.end = this.pixelToSampleIndex(x);
      this.drawWaveform();
      this.drawSelection();
    });
    this.canvas.addEventListener("mouseup", (e) => {
      if (!this.isSelecting) return;
      this.isSelecting = false;
      const x = e.offsetX;
      this.selectionToPixels.end = x;
      this.selection.end = this.pixelToSampleIndex(x);
      this.drawWaveform();
      this.drawSelection();
      this.updateSample();
    });
  }
  setCanvasSize(width, height) {
    const targetWidth = Math.max(1, Math.floor(width));
    const targetHeight = Math.max(1, Math.floor(height));
    if (!targetWidth || !targetHeight) {
      return;
    }
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.selectionWidth = targetWidth;
      this.syncOverlaySize();
      if (this.buffer) {
        this.samplesPerPixel = Math.max(
          1,
          Math.floor(this.channelData.length / this.canvas.width)
        );
        this.selectionToPixels.start = 0;
        this.selectionToPixels.end = this.canvas.width;
        this.selection.start = this.pixelToSampleIndex(this.selectionToPixels.start);
        this.selection.end = this.pixelToSampleIndex(this.selectionToPixels.end);
        this.drawWaveform();
        this.drawSelection();
      } else {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }
  syncOverlaySize() {
    if (!this.overlayCanvas) {
      return;
    }
    if (this.overlayCanvas.width !== this.canvas.width || this.overlayCanvas.height !== this.canvas.height) {
      this.overlayCanvas.width = this.canvas.width;
      this.overlayCanvas.height = this.canvas.height;
    }
  }
  startCRTLoop() {
    this.stopCRTLoop();
    const renderFrame = (time) => {
      if (!this.overlayContext) {
        this.animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }
      const { width, height } = this.canvas;
      if (!width || !height) {
        this.animationFrameId = requestAnimationFrame(renderFrame);
        return;
      }
      this.syncOverlaySize();
      this.overlayContext.clearRect(0, 0, width, height);
      const glow = 0.05 + Math.random() * 0.07;
      this.overlayContext.save();
      this.overlayContext.globalCompositeOperation = "lighter";
      this.overlayContext.fillStyle = `rgba(60, 255, 160, ${glow})`;
      this.overlayContext.fillRect(0, 0, width, height);
      this.overlayContext.restore();
      this.drawScanlines(width, height);
      this.drawNoise(width, height);
      this.drawSweep(time, width, height);
      this.animationFrameId = requestAnimationFrame(renderFrame);
    };
    this.animationFrameId = requestAnimationFrame(renderFrame);
  }
  stopCRTLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.overlayContext && this.overlayCanvas) {
      this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }
  createScanlineCanvas() {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = 1;
    scanCanvas.height = 3;
    const scanContext = scanCanvas.getContext("2d");
    scanContext.fillStyle = "rgba(0, 0, 0, 0.45)";
    scanContext.fillRect(0, 0, 1, 1);
    scanContext.fillStyle = "rgba(0, 0, 0, 0.05)";
    scanContext.fillRect(0, 1, 1, 1);
    scanContext.fillStyle = "rgba(0, 0, 0, 0.3)";
    scanContext.fillRect(0, 2, 1, 1);
    return scanCanvas;
  }
  drawScanlines(width, height) {
    if (!this.overlayContext) {
      return;
    }
    if (!this.scanlineSource) {
      return;
    }
    const pattern = this.overlayContext.createPattern(this.scanlineSource, "repeat");
    if (!pattern) {
      return;
    }
    this.overlayContext.save();
    this.overlayContext.globalAlpha = 0.28;
    this.overlayContext.fillStyle = pattern;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
  ensureNoiseResources() {
    if (!this.noiseCanvas) {
      this.noiseCanvas = document.createElement("canvas");
      this.noiseCanvas.width = 128;
      this.noiseCanvas.height = 128;
      this.noiseContext = this.noiseCanvas.getContext("2d");
      this.noiseImageData = this.noiseContext.createImageData(
        this.noiseCanvas.width,
        this.noiseCanvas.height
      );
    }
  }
  drawNoise(width, height) {
    if (!this.overlayContext) {
      return;
    }
    this.ensureNoiseResources();
    if (!this.noiseCanvas || !this.noiseContext || !this.noiseImageData) {
      return;
    }
    const data = this.noiseImageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const shade = Math.random() * 255;
      data[i] = shade * 0.35;
      data[i + 1] = shade * 0.9;
      data[i + 2] = shade * 0.6;
      data[i + 3] = 30 + Math.random() * 45;
    }
    this.noiseContext.putImageData(this.noiseImageData, 0, 0);
    const pattern = this.overlayContext.createPattern(this.noiseCanvas, "repeat");
    if (!pattern) {
      return;
    }
    this.overlayContext.save();
    this.overlayContext.globalAlpha = 0.08;
    this.overlayContext.fillStyle = pattern;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
  drawSweep(time, width, height) {
    if (!this.overlayContext) {
      return;
    }
    const sweepHeight = height * 0.25;
    const sweepCenter = time * 0.08 % (height + sweepHeight) - sweepHeight / 2;
    const gradient = this.overlayContext.createLinearGradient(
      0,
      sweepCenter - sweepHeight / 2,
      0,
      sweepCenter + sweepHeight / 2
    );
    gradient.addColorStop(0, "rgba(80, 255, 170, 0)");
    gradient.addColorStop(0.5, "rgba(120, 255, 200, 0.18)");
    gradient.addColorStop(1, "rgba(80, 255, 170, 0)");
    this.overlayContext.save();
    this.overlayContext.globalCompositeOperation = "screen";
    this.overlayContext.fillStyle = gradient;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
  updateSample() {
    const updateSampleEvent = new CustomEvent("update-sample", {
      detail: { selection: this.selection, buffer: this.buffer },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(updateSampleEvent);
  }
  drawSelection() {
    if (this.selectionToPixels.start !== null && this.selectionToPixels.end !== null) {
      this.context.fillStyle = "rgba(79, 255, 173, 0.2)";
      this.selectionX = Math.min(
        this.selectionToPixels.start,
        this.selectionToPixels.end
      ), this.selectionWidth = Math.abs(
        this.selectionToPixels.end - this.selectionToPixels.start
      );
      this.context.fillRect(
        Math.min(this.selectionToPixels.start, this.selectionToPixels.end),
        0,
        Math.abs(this.selectionToPixels.end - this.selectionToPixels.start),
        this.canvas.height
      );
    }
  }
  handleAudioUploaded(event) {
    const { file } = event.detail;
    if (!file.type.startsWith("audio/")) {
      alert("File type not supported. Please upload an audio file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = await this.decodeArrayBuffer(reader.result);
        this.handleAudioReady(buffer, { source: "upload" });
      } catch (error) {
        console.error("Error decoding audio file:", error);
      }
    };
    reader.readAsArrayBuffer(file);
  }
  async decodeArrayBuffer(arrayBuffer) {
    if (typeof this.audioCtx.decodeAudioData === "function") {
      if (this.audioCtx.decodeAudioData.length === 1) {
        return this.audioCtx.decodeAudioData(arrayBuffer);
      }
      return new Promise((resolve, reject) => {
        this.audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
      });
    }
    throw new Error("decodeAudioData is not available on this AudioContext");
  }
  async loadRandomAudioBuffer() {
    try {
      const buffer = await this.fetchRandomAudioFromRemote();
      if (buffer) {
        return buffer;
      }
    } catch (error) {
      console.warn("Fetching remote audio failed, falling back to generated audio.", error);
    }
    return this.generateProceduralAudio();
  }
  async fetchRandomAudioFromRemote() {
    if (typeof fetch !== "function") {
      return null;
    }
    const providerLookups = [];
    if (Array.isArray(this.archiveProviders) && this.archiveProviders.length) {
      for (const provider of this.archiveProviders) {
        if (!provider || this.shouldSkipArchiveProvider(provider)) {
          continue;
        }
        const label = provider.label || provider.query || "Archive";
        providerLookups.push({
          label,
          providerRef: provider,
          getUrl: () => this.getRandomArchiveMp3Url(provider)
        });
      }
    }
    if (Array.isArray(this.gitHubAudioProviders) && this.gitHubAudioProviders.length) {
      for (const config of this.gitHubAudioProviders) {
        if (!config) {
          continue;
        }
        const label = config.cacheKey || `${config.owner}/${config.repo}`;
        providerLookups.push({
          label,
          providerRef: config,
          getUrl: () => this.getRandomGitHubAudioUrl(config)
        });
      }
    }
    const remainingProviders = [...providerLookups];
    while (remainingProviders.length) {
      const index = Math.floor(Math.random() * remainingProviders.length);
      const providerInfo = remainingProviders.splice(index, 1)[0];
      if (!providerInfo || typeof providerInfo.getUrl !== "function") {
        continue;
      }
      const { label, getUrl, providerRef } = providerInfo;
      let url;
      try {
        url = await getUrl();
      } catch (error) {
        console.warn(`Remote audio provider lookup failed (${label}):`, error);
        continue;
      }
      if (!url) {
        continue;
      }
      try {
        return await this.fetchAudioBufferFromUrl(url);
      } catch (error) {
        console.warn(`Remote audio fetch failed for ${url} (${label}):`, error);
        if (providerRef && this.archiveProviders?.includes(providerRef)) {
          providerRef.cooldownUntil = Date.now() + 12e4;
        }
      }
    }
    return this.fetchFallbackRemoteAudio();
  }
  async fetchFallbackRemoteAudio() {
    if (!this.remoteAudioSources.length) {
      return null;
    }
    const remaining = [...this.remoteAudioSources];
    while (remaining.length) {
      const index = Math.floor(Math.random() * remaining.length);
      const [url] = remaining.splice(index, 1);
      try {
        return await this.fetchAudioBufferFromUrl(url);
      } catch (error) {
        console.warn(`Fallback audio fetch failed for ${url}:`, error);
      }
    }
    return null;
  }
  async fetchAudioBufferFromUrl(url) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return this.decodeArrayBuffer(arrayBuffer);
  }
  shouldSkipArchiveProvider(provider) {
    if (!provider) {
      return true;
    }
    const cooldownUntil = Number(provider.cooldownUntil || 0);
    if (cooldownUntil && cooldownUntil > Date.now()) {
      return true;
    }
    return false;
  }
  async getRandomArchiveMp3Url(provider) {
    if (!provider || !provider.query) {
      return null;
    }
    const label = provider.label || provider.query || "Archive";
    try {
      const identifier = await this.getArchiveIdentifier(provider);
      if (!identifier) {
        return null;
      }
      const mp3FileName = await this.getArchiveMp3FileName(identifier, provider);
      if (!mp3FileName) {
        return null;
      }
      return `${this.archiveDownloadBaseUrl}${encodeURIComponent(identifier)}/${encodeURIComponent(mp3FileName)}`;
    } catch (error) {
      provider.cooldownUntil = Date.now() + 6e4;
      console.warn(`Archive random audio lookup failed (${label}):`, error);
      return null;
    }
  }
  async getArchiveIdentifier(provider) {
    if (!provider) {
      return null;
    }
    if (!Array.isArray(provider.itemsBuffer) || !provider.itemsBuffer.length) {
      try {
        await this.populateArchiveItems(provider);
      } catch (error) {
        provider.cooldownUntil = Date.now() + 6e4;
        throw error;
      }
    }
    if (!Array.isArray(provider.itemsBuffer) || !provider.itemsBuffer.length) {
      return null;
    }
    const index = Math.floor(Math.random() * provider.itemsBuffer.length);
    const item = provider.itemsBuffer.splice(index, 1)[0];
    const identifier = item?.identifier;
    return typeof identifier === "string" && identifier.trim() ? identifier : null;
  }
  async populateArchiveItems(provider) {
    if (!provider || !provider.query) {
      return;
    }
    const count = Math.max(100, Number(provider.count) || 100);
    const params = new URLSearchParams({
      fields: "identifier",
      count: String(count),
      q: provider.query
    });
    if (provider.cursor) {
      params.set("cursor", provider.cursor);
    }
    const url = `${this.archiveSearchScrapeUrl}?${params.toString()}`;
    const data = await this.fetchArchiveJson(url);
    const items = Array.isArray(data?.items) ? data.items : [];
    provider.itemsBuffer = items.filter((item) => typeof item?.identifier === "string" && item.identifier.trim());
    provider.cursor = data?.cursor || null;
    provider.totalItems = typeof data?.total === "number" ? data.total : provider.totalItems;
    provider.cooldownUntil = 0;
    provider.hasLooped = !provider.cursor;
    if (!provider.itemsBuffer.length && provider.hasLooped) {
      delete provider.hasLooped;
      provider.cursor = null;
    }
  }
  async fetchArchiveJson(url) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`Archive request failed: ${response.status}`);
    }
    return response.json();
  }
  async getRandomGitHubAudioUrl(config) {
    if (!config) {
      return null;
    }
    try {
      const manifest = await this.getGitHubAudioManifest(config);
      if (!Array.isArray(manifest) || !manifest.length) {
        return null;
      }
      const index = Math.floor(Math.random() * manifest.length);
      return manifest[index] || null;
    } catch (error) {
      console.warn("GitHub audio manifest lookup failed:", error);
      return null;
    }
  }
  async getGitHubAudioManifest(config) {
    const {
      cacheKey,
      owner,
      repo,
      branch = "main",
      filterRegex = /\.(mp3|wav|ogg)$/i,
      pathRegex
    } = config || {};
    if (!owner || !repo) {
      return null;
    }
    if (cacheKey && this.gitHubAudioCache.has(cacheKey)) {
      return this.gitHubAudioCache.get(cacheKey);
    }
    if (cacheKey && this.gitHubAudioPromises.has(cacheKey)) {
      return this.gitHubAudioPromises.get(cacheKey);
    }
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const manifestPromise = (async () => {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) {
          throw new Error(`GitHub tree request failed: ${response.status}`);
        }
        const data = await response.json();
        const tree = Array.isArray(data?.tree) ? data.tree : [];
        const files = tree.filter((item) => {
          if (!item || item.type !== "blob" || typeof item.path !== "string") {
            return false;
          }
          if (filterRegex && !filterRegex.test(item.path)) {
            return false;
          }
          if (pathRegex && !pathRegex.test(item.path)) {
            return false;
          }
          return true;
        });
        const urls = files.map((item) => {
          const encodedPath = item.path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
        });
        if (cacheKey) {
          this.gitHubAudioCache.set(cacheKey, urls);
        }
        return urls;
      } finally {
        if (cacheKey) {
          this.gitHubAudioPromises.delete(cacheKey);
        }
      }
    })();
    if (cacheKey) {
      this.gitHubAudioPromises.set(cacheKey, manifestPromise);
    }
    return manifestPromise;
  }
  async getArchiveMp3FileName(identifier, provider) {
    if (!identifier) {
      return null;
    }
    const cache = provider?.mp3Cache;
    if (cache?.has(identifier)) {
      return cache.get(identifier);
    }
    const label = provider?.label || provider?.query || "Archive";
    try {
      const metadataUrl = `${this.archiveMetadataBaseUrl}${encodeURIComponent(identifier)}`;
      const metadata = await this.fetchArchiveJson(metadataUrl);
      const files = metadata?.files;
      if (!Array.isArray(files) || !files.length) {
        return null;
      }
      const mp3Entry = files.find((file) => {
        if (!file || typeof file.name !== "string") {
          return false;
        }
        if (String(file.private) === "true") {
          return false;
        }
        return file.name.toLowerCase().endsWith(".mp3");
      });
      const fileName = mp3Entry?.name || null;
      if (fileName && cache) {
        cache.set(identifier, fileName);
      }
      return fileName;
    } catch (error) {
      console.warn(`Archive metadata lookup failed (${label}, ${identifier}):`, error);
      return null;
    }
  }
  generateProceduralAudio() {
    const durationSeconds = 8;
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(durationSeconds * sampleRate));
    const buffer = this.audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    const notes = [
      196,
      // G3
      246.94,
      // B3
      293.66,
      // D4
      329.63,
      // E4
      392,
      // G4
      440
      // A4
    ];
    const noteDuration = 0.75;
    const lfoFrequency = 0.25;
    const harmonicRatio = 1.5;
    const noiseMix = 0.08;
    for (let i = 0; i < frameCount; i++) {
      const time = i / sampleRate;
      const noteIndex = Math.floor(time / noteDuration) % notes.length;
      const frequency = notes[noteIndex];
      const positionInNote = time % noteDuration;
      const envelope = Math.sin(Math.PI * positionInNote / noteDuration);
      const base = Math.sin(2 * Math.PI * frequency * time);
      const harmonic = Math.sin(2 * Math.PI * frequency * harmonicRatio * time) * 0.5;
      const lfo = 0.2 * Math.sin(2 * Math.PI * lfoFrequency * time);
      const noise = (Math.random() * 2 - 1) * noiseMix;
      const sample = (base + harmonic) * 0.6 + lfo + noise;
      data[i] = sample * Math.max(0, Math.min(1, envelope)) * 0.6;
    }
    this.applyGlobalEnvelope(data);
    return buffer;
  }
  applyGlobalEnvelope(channelData) {
    const length = channelData.length;
    const fadeLength = Math.floor(length * 0.02);
    for (let i = 0; i < fadeLength; i++) {
      const fadeInGain = i / fadeLength;
      channelData[i] *= fadeInGain;
      const fadeOutGain = (fadeLength - i) / fadeLength;
      channelData[length - 1 - i] *= fadeOutGain;
    }
  }
  handleAudioReady(buffer, { source } = {}) {
    this.loadAudio(buffer);
    this.hideDropMessage();
    if (source) {
      const audioLoadedEvent = new CustomEvent("audio-loaded", {
        detail: { source },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(audioLoadedEvent);
    }
    if (this.randomAudioButton) {
      this.randomAudioButton.disabled = false;
      this.randomAudioButton.textContent = this.randomAudioButtonLabel;
    }
    this.setAudioControlsDisabled(false);
    this.waveformContainer?.classList.add("has-audio");
    this.hideRandomAudioButton();
  }
  hideRandomAudioButton() {
    if (this.randomAudioButton) {
      this.randomAudioButton.style.display = "none";
    }
  }
  showRandomAudioButton() {
    if (this.randomAudioButton) {
      this.randomAudioButton.style.display = "block";
      this.randomAudioButton.disabled = false;
      this.randomAudioButton.textContent = this.randomAudioButtonLabel;
    }
  }
  setAudioControlsDisabled(disabled) {
    if (this.resetAudioButton) {
      this.resetAudioButton.disabled = disabled;
    }
    if (this.removeAudioButton) {
      this.removeAudioButton.disabled = disabled;
    }
  }
  clearAudio() {
    this.buffer = null;
    this.channelData = null;
    this.samplesPerPixel = 1;
    this.selection = { start: null, end: null };
    this.selectionToPixels = { start: null, end: null };
    this.selectionWidth = this.canvas.width;
    this.selectionX = 0;
    this.isSelecting = false;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.waveformContainer?.classList.remove("has-audio");
    this.showRandomAudioButton();
    this.setAudioControlsDisabled(false);
    this.showDropMessage();
  }
  hideDropMessage() {
    if (this.dropMessage) {
      this.dropMessage.style.display = "none";
    }
  }
  showDropMessage() {
    if (this.dropMessage) {
      this.dropMessage.style.display = "";
    }
  }
  drawWaveform() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.channelData) {
      return;
    }
    const midY = this.canvas.height / 2;
    const amplitude = this.canvas.height / 2 - 8;
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = "#4dffb5";
    ctx.lineWidth = Math.max(1, this.canvas.height * 35e-4);
    ctx.shadowColor = "rgba(79, 255, 173, 0.45)";
    ctx.shadowBlur = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    let moved = false;
    const total = this.channelData.length;
    for (let i = 0; i < total; i += this.samplesPerPixel) {
      const x = i / total * this.canvas.width;
      const sample = this.channelData[i];
      const y = midY - sample * amplitude;
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(79, 255, 173, 0.45)";
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(this.canvas.width, midY);
    ctx.stroke();
    ctx.restore();
  }
  drawGrain(e) {
    this.drawWaveform();
    if (this.selection.start || this.selection.end) {
      this.drawSelection();
    }
    const { grainIndex = 0, segmentCount, grains } = e.detail;
    const segments = segmentCount || (Array.isArray(grains) ? grains.length : 1);
    const safeSegments = Math.max(1, segments);
    const grainWidth = this.selectionWidth / safeSegments;
    const grainHeight = this.canvas.height;
    const x = this.selectionX + grainWidth * grainIndex;
    const y = 0;
    this.context.fillStyle = "rgba(255, 96, 128, 0.35)";
    this.context.fillRect(
      Math.floor(x),
      y,
      Math.max(1, Math.ceil(grainWidth)),
      grainHeight
    );
  }
  clearGrain() {
    this.drawWaveform();
    this.drawSelection();
  }
  loadAudio(buffer) {
    this.buffer = buffer;
    const channel = buffer.getChannelData(0);
    this.channelData = channel;
    this.samplesPerPixel = Math.max(
      1,
      Math.floor(this.channelData.length / this.canvas.width)
    );
    this.selectionToPixels.start = 0;
    this.selectionToPixels.end = this.canvas.width;
    this.selection.start = this.pixelToSampleIndex(this.selectionToPixels.start);
    this.selection.end = this.pixelToSampleIndex(this.selectionToPixels.end);
    this.drawWaveform();
    this.drawSelection();
    this.updateSample();
  }
};
customElements.define("synth-waveform", SynthWaveform);

// latch-button.js
var LatchButton = class extends HTMLElement {
  static get observedAttributes() {
    return ["active"];
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.latched = false;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          flex: 0 0 auto;
        }

        button {
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          padding: 10px 24px;
          border-radius: 0;
          border: 1px solid rgba(255, 122, 45, 0.35);
          background: rgba(32, 22, 14, 0.5);
          color: rgba(255, 214, 190, 0.92);
          cursor: pointer;
          transition:
            background 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            transform 0.12s ease;
          outline: none;
          min-width: 120px;
        }

        button:hover {
          background: rgba(46, 28, 16, 0.7);
          border-color: rgba(255, 122, 45, 0.55);
          box-shadow: 0 0 18px rgba(255, 122, 45, 0.35);
        }

        button:active {
          transform: translateY(1px);
        }

        button:focus-visible {
          border-color: rgba(255, 180, 120, 0.8);
          box-shadow: 0 0 0 3px rgba(255, 122, 45, 0.35);
        }

        button[data-active="true"] {
          background: rgba(64, 30, 12, 0.8);
          border-color: rgba(255, 122, 45, 0.75);
          box-shadow: 0 0 24px rgba(255, 122, 45, 0.5);
        }

        .label {
          pointer-events: none;
        }
      </style>
      <button type="button" aria-pressed="false" data-active="false">
        <span class="label">Latch</span>
      </button>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.button = this.shadowRoot.querySelector("button");
    this.handleClick = this.handleClick.bind(this);
  }
  connectedCallback() {
    this.button.addEventListener("click", this.handleClick);
    this.applyInitialState();
  }
  disconnectedCallback() {
    this.button.removeEventListener("click", this.handleClick);
  }
  attributeChangedCallback(name) {
    if (name === "active") {
      this.applyInitialState();
    }
  }
  applyInitialState() {
    const shouldLatch = this.hasAttribute("active") && this.getAttribute("active") !== "false";
    this.setLatched(shouldLatch, { emit: false });
  }
  handleClick() {
    this.setLatched(!this.latched, { emit: true });
  }
  setLatched(nextState, { emit } = { emit: false }) {
    const latched = Boolean(nextState);
    this.latched = latched;
    const dataValue = latched ? "true" : "false";
    if (this.button.dataset.active !== dataValue) {
      this.button.dataset.active = dataValue;
    }
    if (this.button.getAttribute("aria-pressed") !== dataValue) {
      this.button.setAttribute("aria-pressed", dataValue);
    }
    const hasActiveAttribute = this.hasAttribute("active");
    if (latched && !hasActiveAttribute) {
      this.setAttribute("active", "");
    } else if (!latched && hasActiveAttribute) {
      this.removeAttribute("active");
    }
    if (emit) {
      this.dispatchState();
    }
  }
  dispatchState() {
    const latchChangedEvent = new CustomEvent("latch-changed", {
      detail: { active: this.latched },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(latchChangedEvent);
  }
};
customElements.define("latch-button", LatchButton);

// synth-ribbon.js
var DEFAULT_SEGMENTS = 1;
var SynthRibbon = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
          color: #f5f8f6;
        }

        .container {
          justify-content: center;
          display: flex;
          height: 100%;
          flex-direction: column;
          gap: 8px;
        }

        .ribbon {
          position: relative;
          width: 100%;
          height: 100px;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(26, 34, 40, 0.95), rgba(14, 18, 22, 0.95));
          box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.55),
            0 6px 10px rgba(0, 0, 0, 0.35);
          overflow: hidden;
          cursor: pointer;
          touch-action: none;
        }

        .ribbon::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.3;
          background-image: repeating-linear-gradient(
            to right,
            rgba(96, 255, 184, 0.22) 0,
            rgba(96, 255, 184, 0.22) 2px,
            transparent 2px,
            transparent calc(100% / var(--segments, 1))
          );
        }

        .indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          width: calc(100% / var(--segments, 1));
          transform: translate3d(calc(var(--indicator-index, 0) * 100%), 0, 0);
          will-change: transform;
          background: linear-gradient(180deg, rgba(60, 255, 174, 0.95), rgba(42, 215, 247, 0.8));
          box-shadow:
            inset 0 0 10px rgba(15, 255, 200, 0.45),
            0 0 18px rgba(80, 255, 180, 0.55),
            0 0 34px rgba(80, 255, 180, 0.25);
          pointer-events: none;
          transition:
            transform 0.08s ease-out,
            width 0.08s ease-out;
        }

        :host([data-dragging="true"]) .indicator {
          transition: none;
        }

        :host([data-empty="true"]) .ribbon {
          cursor: default;
        }

        :host([data-empty="true"]) .ribbon::after,
        :host([data-empty="true"]) .indicator {
          opacity: 0;
          display: none;
        }

        :host([data-empty="true"]) .value {
          color: rgba(200, 255, 230, 0.45);
        }

        .info {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(200, 255, 230, 0.75);
        }

        .value {
          font-size: 11px;
          letter-spacing: 0.08em;
          color: rgba(200, 255, 230, 0.85);
        }
      </style>
      <div class="container">
        <div class="ribbon" role="slider" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1" aria-label="Grain Position">
          <div class="indicator"></div>
        </div>
        <div class="info">
          <span>Position</span>
          <span class="value">1 / 1</span>
        </div>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.ribbon = this.shadowRoot.querySelector(".ribbon");
    this.indicator = this.shadowRoot.querySelector(".indicator");
    this.valueDisplay = this.shadowRoot.querySelector(".value");
    this.segments = DEFAULT_SEGMENTS;
    this.currentIndex = 1;
    this.active = false;
    this.pointerId = null;
    this.synthBrain = null;
    this.hasGrains = false;
    this.suppressExternalUpdates = false;
    this.pendingExternalIndex = null;
    this.externalSyncHandle = null;
  }
  connectedCallback() {
    this.synthBrain = this.closest("synth-brain");
    const initialIndex = this.synthBrain && this.synthBrain.config ? Math.max(1, Math.round(this.synthBrain.config.grainIndex || 1)) : this.currentIndex;
    const hasAudio = this.synthBrain && Array.isArray(this.synthBrain.audioGrains) ? this.synthBrain.audioGrains.length > 0 : false;
    const initialSegments = hasAudio && this.synthBrain && typeof this.synthBrain.getMaxGrainIndex === "function" ? this.synthBrain.getMaxGrainIndex() : 0;
    this.currentIndex = initialIndex;
    this.updateSegments(initialSegments);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);
    this.addEventListener("draw-grain", this.handleDrawGrain);
    this.ribbon.addEventListener("pointerdown", this.boundPointerDown);
    this.ribbon.addEventListener("pointermove", this.boundPointerMove);
    this.ribbon.addEventListener("pointerup", this.boundPointerUp);
    this.ribbon.addEventListener("pointercancel", this.boundPointerLeave);
    this.ribbon.addEventListener("pointerleave", this.boundPointerLeave);
    if (this.synthBrain) {
      this.boundConfigUpdated = this.handleConfigUpdated.bind(this);
      this.boundGrainCountChanged = this.handleGrainCountChanged.bind(this);
      this.synthBrain.addEventListener("config-updated", this.boundConfigUpdated);
      this.synthBrain.addEventListener("grain-count-changed", this.boundGrainCountChanged);
    }
  }
  disconnectedCallback() {
    this.ribbon.removeEventListener("pointerdown", this.boundPointerDown);
    this.ribbon.removeEventListener("pointermove", this.boundPointerMove);
    this.ribbon.removeEventListener("pointerup", this.boundPointerUp);
    this.ribbon.removeEventListener("pointercancel", this.boundPointerLeave);
    this.ribbon.removeEventListener("pointerleave", this.boundPointerLeave);
    this.ribbon.removeEventListener("draw-grain", this.handleDrawGrain);
    if (this.synthBrain) {
      this.synthBrain.removeEventListener("config-updated", this.boundConfigUpdated);
      this.synthBrain.removeEventListener("grain-count-changed", this.boundGrainCountChanged);
    }
    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
      this.externalSyncHandle = null;
    }
  }
  handleDrawGrain(e) {
    if (!this.hasGrains) {
      return;
    }
    const { grainIndex = 0 } = e.detail;
    this.handleExternalIndex(grainIndex);
  }
  handlePointerDown(event) {
    event.preventDefault();
    if (!this.hasGrains) {
      return;
    }
    if (this.synthBrain && typeof this.synthBrain.beginRibbonInteraction === "function") {
      this.synthBrain.beginRibbonInteraction();
    }
    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
      this.externalSyncHandle = null;
    }
    this.ribbon.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    this.active = true;
    this.suppressExternalUpdates = true;
    this.pendingExternalIndex = null;
    this.setAttribute("data-dragging", "true");
    this.updateFromEvent(event);
  }
  handlePointerMove(event) {
    if (!this.active || event.pointerId !== this.pointerId || !this.hasGrains) {
      return;
    }
    this.updateFromEvent(event);
  }
  handlePointerUp(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.updateFromEvent(event, { final: true });
  }
  handlePointerLeave(event) {
    if (!this.active || event.pointerId !== this.pointerId) {
      return;
    }
    this.finishInteraction({ cancel: true });
  }
  updateFromEvent(event, options = {}) {
    if (!this.hasGrains) {
      return;
    }
    const rect = this.ribbon.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      this.finishInteraction({ cancel: true });
      return;
    }
    const segments = Math.max(DEFAULT_SEGMENTS, this.segments);
    const segmentWidth = rect.width / segments;
    const index = Math.min(
      segments - 1,
      Math.max(0, Math.floor(x / segmentWidth))
    );
    this.setIndex(index);
    if (options.final) {
      this.finishInteraction();
    }
  }
  finishInteraction({ cancel = false } = {}) {
    if (this.pointerId !== null) {
      try {
        this.ribbon.releasePointerCapture(this.pointerId);
      } catch (err) {
      }
    }
    this.pointerId = null;
    if (this.active && this.synthBrain && typeof this.synthBrain.endRibbonInteraction === "function") {
      this.synthBrain.endRibbonInteraction();
    }
    this.active = false;
    this.removeAttribute("data-dragging");
    this.scheduleExternalSync();
  }
  setIndex(index) {
    if (!this.hasGrains) {
      return;
    }
    const segments = Math.max(1, this.segments);
    const clamped = Math.max(1, Math.min(index, segments));
    this.currentIndex = clamped;
    this.updateIndicator(this.currentIndex - 1);
    this.updateValueDisplay();
    this.sendConfigUpdate(clamped);
  }
  updateSegments(segments) {
    const numericSegments = Number.isFinite(segments) ? segments : 0;
    this.hasGrains = numericSegments > 0;
    this.segments = this.hasGrains ? Math.max(1, Math.round(numericSegments)) : 0;
    const cssSegments = this.hasGrains ? this.segments : 1;
    this.ribbon.style.setProperty("--segments", cssSegments);
    this.toggleAttribute("data-empty", !this.hasGrains);
    if (this.hasGrains) {
      this.ribbon.setAttribute("aria-valuemax", String(this.segments));
      this.ribbon.setAttribute("aria-valuemin", "1");
      this.ribbon.removeAttribute("aria-disabled");
      this.currentIndex = Math.max(1, Math.min(this.currentIndex, this.segments));
      this.updateIndicator(this.currentIndex - 1);
    } else {
      this.ribbon.setAttribute("aria-valuemax", "0");
      this.ribbon.setAttribute("aria-valuemin", "0");
      this.ribbon.setAttribute("aria-disabled", "true");
      this.currentIndex = 1;
      this.updateIndicator(null);
    }
    this.updateValueDisplay();
  }
  updateIndicator(index) {
    if (!this.hasGrains || typeof index !== "number") {
      this.indicator.style.display = "none";
      this.ribbon.style.removeProperty("--indicator-index");
      this.ribbon.setAttribute("aria-valuenow", "0");
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, this.segments - 1));
    this.indicator.style.display = "";
    this.ribbon.style.setProperty("--indicator-index", clampedIndex);
    this.ribbon.setAttribute("aria-valuenow", String(clampedIndex + 1));
  }
  updateValueDisplay() {
    if (!this.hasGrains) {
      this.valueDisplay.textContent = "--";
      return;
    }
    this.valueDisplay.textContent = `${this.currentIndex} / ${this.segments}`;
  }
  sendConfigUpdate(index) {
    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name: "grainIndex", value: index },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(updateConfigEvent);
  }
  handleConfigUpdated(event) {
    const { name, value } = event.detail;
    if (name !== "grainIndex") {
      return;
    }
    if (!this.hasGrains) {
      this.updateIndicator(null);
      this.updateValueDisplay();
      return;
    }
    const numericValue = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return;
    }
    const clamped = Math.max(1, Math.min(Math.round(numericValue), this.segments));
    this.handleExternalIndex(clamped - 1);
  }
  handleGrainCountChanged(event) {
    const { audio, image, total } = event.detail || {};
    if (typeof audio === "number" && audio > 0) {
      this.updateSegments(audio);
      return;
    }
    if (typeof image === "number" && image > 0) {
      this.updateSegments(image);
      return;
    }
    if (typeof total === "number") {
      this.updateSegments(total);
      return;
    }
    this.updateSegments(0);
  }
  isPlaybackActive() {
    return Boolean(this.synthBrain && this.synthBrain.isPlaying);
  }
  handleExternalIndex(index) {
    if (!this.hasGrains || typeof index !== "number") {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(Math.round(index), this.segments - 1));
    if (this.suppressExternalUpdates) {
      this.pendingExternalIndex = clampedIndex;
      return;
    }
    this.applyExternalIndex(clampedIndex);
  }
  applyExternalIndex(clampedIndex) {
    this.pendingExternalIndex = null;
    this.updateIndicator(clampedIndex);
    this.currentIndex = clampedIndex + 1;
    this.updateValueDisplay();
  }
  scheduleExternalSync() {
    if (!this.hasGrains) {
      this.suppressExternalUpdates = false;
      this.pendingExternalIndex = null;
      return;
    }
    this.suppressExternalUpdates = true;
    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
    }
    this.externalSyncHandle = requestAnimationFrame(() => {
      this.externalSyncHandle = null;
      this.suppressExternalUpdates = false;
      if (typeof this.pendingExternalIndex === "number") {
        this.applyExternalIndex(this.pendingExternalIndex);
      }
    });
  }
};
customElements.define("synth-ribbon", SynthRibbon);

// synth-joystick.js
var clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};
var easeInOutSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
var SynthJoystick = class extends HTMLElement {
  static get observedAttributes() {
    return ["min", "max"];
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
:host {
  --joystick-width: 62px;             
  --track-width: 26px;                 
  --nub-width: 28px;                  
  --nub-height: 16px;
  --accent: #ff7a2d;                 
  --accent-strong: #ff5a00;
  --panel: #0b0d11;
  --panel-hi: #1c1f25;

  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  color: inherit;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  height: 100%;
}

/* ============ PANEL / BASE ============ */
.wrapper {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.joystick-base {
  position: relative;
  width: var(--joystick-width);
  flex: 1 1 auto;
  border-radius: 16px;
  background: radial-gradient(120% 90% at 40% 35%, var(--panel-hi), var(--panel) 60%);
  box-shadow:
    inset 0 10px 22px rgba(0,0,0,.85),
    inset 0 -18px 28px rgba(0,0,0,.9),
    0 18px 34px rgba(0,0,0,.55);
  cursor: grab;
  touch-action: none;
}

/* Subtle inset border */
.joystick-base::before {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.05),
    inset 0 0 0 2px rgba(0,0,0,.6);
  pointer-events: none;
}

/* Right-side tick marks (MIN\u2026MAX) */
.joystick-base::after {
  content: "";
  position: absolute;
  top: 10px; bottom: 10px; right: 12px; width: 18px;
  background:
    linear-gradient(#0000 22%, rgba(255,255,255,.12) 22% 24%, #0000 24%) 0 0/100% 12% repeat-y;
  pointer-events: none;
  mask:
    linear-gradient(transparent, white 10%, white 90%, transparent);
  opacity: .8;
}

/* Up / Down arrows at the left */
.joystick-base i {
  position: absolute; left: 12px; top: 50%;
  font-style: normal; color: rgba(255,255,255,.6);
  display: grid; place-items: center; gap: 4px;
  transform: translateY(-50%);
  pointer-events: none; user-select: none;
}

/* ============ HANDLE + TRACK ============ */
.joystick-handle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--track-width);
  height: calc(100% - 28px);
  display: grid;
  grid-template-rows: 1fr auto;       /* tall stem + nub */
  align-items: center;
  justify-items: center;
  transform: translate(-50%, -50%);
  transform-style: preserve-3d;
  transition: transform .1s ease-out;
  pointer-events: none;
}

.joystick-base.interacting .joystick-handle { transition: none; }

/* The recessed vertical slot with orange glow */
.joystick-handle .stem {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background:
    linear-gradient(90deg,
      #040507 0%,
      #12151b 24%,
      #191d24 50%,
      #12151b 76%,
      #040507 100%);
  box-shadow:
    inset 0 0 0 2px #000,
    inset 0 0 20px rgba(0,0,0,.9),
    0 6px 10px rgba(0,0,0,.45);
}

/* inner orange strip */
.joystick-handle .stem::before {
  content: "";
  position: absolute;
  inset: 3px;
  left: 50%;
  width: 7px;
  transform: translateX(-50%);
  border-radius: 10px;
  background:
    linear-gradient(180deg,
      rgba(255,120,40,.15) 0%,
      rgba(255,120,40,.55) 50%,
      rgba(255,120,40,.18) 100%);
  box-shadow:
    0 0 10px rgba(255,120,40,.55),
    inset 0 0 6px rgba(255,120,40,.6);
  filter: saturate(120%);
}

/* subtle rim highlights on slot edges */
.joystick-handle .stem::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background:
    linear-gradient(90deg,
      rgba(255,255,255,.09), transparent 30% 70%, rgba(255,255,255,.09));
  mix-blend-mode: screen;
  pointer-events: none;
}

/* The little horizontal nub that rides in the slot */
.joystick-handle .cap {
  position: absolute;
  left: -2px;
  /* vertically centered by the parent translateY in JS */
  width: var(--nub-width);
  height: var(--nub-height);
  border-radius: 8px;
  background: linear-gradient(#1f232b, #0c0f14);
  border: 1px solid rgba(0,0,0,.7);
  box-shadow:
    inset 0 1px 3px rgba(255,255,255,.08),
    inset 0 -3px 6px rgba(0,0,0,.7),
    0 3px 8px rgba(0,0,0,.6);
}

/* tiny top highlight to make it feel plastic */
.joystick-handle .cap::after {
  content: "";
  position: absolute;
  inset: 2px 6px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0));
}

/* Disabled & misc */
:host([data-disabled="true"]) .joystick-base {
  cursor: not-allowed; opacity: .45; filter: grayscale(.35);
}

.value-readout { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: var(--accent); }
.label { font-size: 11px; letter-spacing: .55px; text-transform: uppercase; color: rgba(255,214,190,.65); }
.actions { display: flex; gap: 10px; }
.random-button {
  font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  padding: 6px 18px; border-radius: 0;
  border: 1px solid rgba(255,122,45,.35);
  background: rgba(32,22,14,.5);
  color: rgba(255,214,190,.92); cursor: pointer;
  transition: background .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.random-button:hover   { background: rgba(46,28,16,.7); border-color: rgba(255,122,45,.55); box-shadow: 0 0 18px rgba(255,122,45,.35); }
.random-button[data-active="true"] { background: rgba(64,30,12,.8); border-color: rgba(255,122,45,.75); box-shadow: 0 0 24px rgba(255,122,45,.5); }
:host([data-disabled="true"]) .random-button { pointer-events: none; opacity: .35; box-shadow: none; }</style>
      <div class="actions">
        <button type="button" class="random-button" aria-pressed="false">Random</button>
      </div>
      <div class="wrapper">
        <div class="label"></div>
        <div class="joystick-base" role="slider" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-label="Pitch bend">
          <div class="joystick-handle">
            <div class="stem"></div>
            <div class="cap"></div>
          </div>
        </div>
        <div class="value-readout">0</div>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.baseElement = this.shadowRoot.querySelector(".joystick-base");
    this.capElement = this.shadowRoot.querySelector(".cap");
    this.valueElement = this.shadowRoot.querySelector(".value-readout");
    this.labelElement = this.shadowRoot.querySelector(".label");
    this.randomButton = this.shadowRoot.querySelector(".random-button");
    this.name = this.getAttribute("name") || "";
    this.randomName = this.getAttribute("random-name") || this.derivePath("randomize");
    this.activeName = this.getAttribute("active-name") || this.derivePath("active");
    this.labelText = this.getAttribute("label") || "Pitch Bend";
    this.min = parseFloat(this.getAttribute("min") ?? "-1");
    this.max = parseFloat(this.getAttribute("max") ?? "1");
    if (!Number.isFinite(this.min)) {
      this.min = -1;
    }
    if (!Number.isFinite(this.max)) {
      this.max = 1;
    }
    if (this.min > this.max) {
      [this.min, this.max] = [this.max, this.min];
    }
    this.maxAbs = Math.max(Math.abs(this.min), Math.abs(this.max)) || 1;
    this.currentValue = 0;
    this.visualValue = 0;
    this.lastEmittedValue = null;
    this.randomizeActive = false;
    this.isInteracting = false;
    this.pointerId = null;
    this.randomAnimationFrame = null;
    this.randomPhase = null;
    this.metrics = null;
    this.isSynthPlaying = false;
    this.pendingRandomStart = false;
  }
  connectedCallback() {
    this.labelElement.textContent = this.labelText;
    this.baseElement.setAttribute("aria-valuemin", `${Math.round(this.min)}`);
    this.baseElement.setAttribute("aria-valuemax", `${Math.round(this.max)}`);
    this.synthBrain = this.closest("synth-brain");
    const initialValue = this.readConfigValue(this.name);
    if (Number.isFinite(initialValue)) {
      this.setCurrentValue(initialValue, { emit: false, forceVisual: true });
    } else {
      this.render();
    }
    const initialRandomize = this.readConfigValue(this.randomName);
    if (typeof initialRandomize === "boolean") {
      this.updateRandomize(initialRandomize, { emit: false });
    }
    const activeState = this.readConfigValue(this.activeName);
    if (typeof activeState === "boolean") {
      this.updateDisabledState(!activeState);
    }
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.baseElement.addEventListener("pointerdown", this.boundPointerDown);
    this.baseElement.addEventListener("pointermove", this.boundPointerMove);
    this.baseElement.addEventListener("pointerup", this.boundPointerUp);
    this.baseElement.addEventListener("pointercancel", this.boundPointerCancel);
    this.baseElement.addEventListener("pointerleave", this.boundPointerCancel);
    this.boundConfigUpdated = this.handleConfigUpdated.bind(this);
    this.synthBrain?.addEventListener("config-updated", this.boundConfigUpdated);
    this.boundResizeObserver = new ResizeObserver(() => {
      this.metrics = null;
      this.render();
    });
    this.boundResizeObserver.observe(this.baseElement);
    this.boundRandomClick = this.handleRandomClick.bind(this);
    this.randomButton.addEventListener("click", this.boundRandomClick);
    this.isSynthPlaying = this.readSynthPlayingState();
    this.boundPlaybackChanged = this.handlePlaybackChanged.bind(this);
    this.synthBrain?.addEventListener("playback-state-changed", this.boundPlaybackChanged);
  }
  disconnectedCallback() {
    this.baseElement.removeEventListener("pointerdown", this.boundPointerDown);
    this.baseElement.removeEventListener("pointermove", this.boundPointerMove);
    this.baseElement.removeEventListener("pointerup", this.boundPointerUp);
    this.baseElement.removeEventListener("pointercancel", this.boundPointerCancel);
    this.baseElement.removeEventListener("pointerleave", this.boundPointerCancel);
    this.synthBrain?.removeEventListener("config-updated", this.boundConfigUpdated);
    if (this.boundResizeObserver) {
      this.boundResizeObserver.disconnect();
    }
    this.randomButton.removeEventListener("click", this.boundRandomClick);
    this.stopRandomMotion();
    this.synthBrain?.removeEventListener("playback-state-changed", this.boundPlaybackChanged);
  }
  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === "min" || name === "max") {
      const parsed = parseFloat(newValue);
      if (Number.isFinite(parsed)) {
        this[name] = parsed;
        if (this.min > this.max) {
          [this.min, this.max] = [this.max, this.min];
        }
        this.maxAbs = Math.max(Math.abs(this.min), Math.abs(this.max)) || 1;
        this.metrics = null;
        this.setCurrentValue(this.currentValue, { emit: false, forceVisual: true });
      }
    }
  }
  derivePath(targetSegment) {
    if (!this.name || !this.name.includes(".")) {
      return "";
    }
    const segments = this.name.split(".");
    segments[segments.length - 1] = targetSegment;
    return segments.join(".");
  }
  readConfigValue(path) {
    if (!path || !this.synthBrain?.config) {
      return void 0;
    }
    return path.split(".").reduce((acc, key) => acc && typeof acc === "object" ? acc[key] : void 0, this.synthBrain.config);
  }
  readSynthPlayingState() {
    return this.synthBrain?.getAttribute("data-playing") === "true";
  }
  emitConfigUpdate(name, value) {
    if (!name) {
      return;
    }
    const event = new CustomEvent("update-config", {
      detail: { name, value },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
  handlePointerDown(event) {
    if (this.isDisabled) {
      return;
    }
    event.preventDefault();
    this.isInteracting = true;
    this.pointerId = event.pointerId;
    this.baseElement.classList.add("interacting");
    this.baseElement.setPointerCapture(event.pointerId);
    if (this.randomizeActive) {
      this.updateRandomize(false, { emit: true });
    }
    this.updateFromPointer(event, { emit: true });
  }
  handlePointerMove(event) {
    if (!this.isInteracting || event.pointerId !== this.pointerId) {
      return;
    }
    event.preventDefault();
    this.updateFromPointer(event, { emit: true });
  }
  handlePointerUp(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.finishPointerInteraction();
  }
  handlePointerCancel(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.finishPointerInteraction();
  }
  finishPointerInteraction() {
    if (!this.isInteracting) {
      return;
    }
    const pointerId = this.pointerId;
    this.isInteracting = false;
    this.pointerId = null;
    this.baseElement.classList.remove("interacting");
    if (pointerId !== null && this.baseElement.releasePointerCapture) {
      try {
        this.baseElement.releasePointerCapture(pointerId);
      } catch (_error) {
      }
    }
    this.setCurrentValue(0, { emit: true });
  }
  updateFromPointer(event, { emit } = { emit: false }) {
    const metrics = this.ensureMetrics();
    if (!metrics) {
      return;
    }
    const relativeY = clamp((metrics.centerY - event.clientY) / metrics.rangeY, -1, 1);
    const value = relativeY * this.maxAbs;
    this.setCurrentValue(value, { emit, forceVisual: true });
  }
  ensureMetrics() {
    if (this.metrics) {
      return this.metrics;
    }
    const baseRect = this.baseElement.getBoundingClientRect();
    if (!baseRect.height) {
      return null;
    }
    const handleRect = this.capElement.getBoundingClientRect();
    const travelY = Math.max(0, (baseRect.height - handleRect.height) / 2);
    this.metrics = {
      travelY,
      centerY: baseRect.top + baseRect.height / 2,
      rangeY: travelY > 0 ? travelY : baseRect.height / 2
    };
    return this.metrics;
  }
  setCurrentValue(value, { emit = false, forceVisual = false } = {}) {
    const clamped = clamp(value, -this.maxAbs, this.maxAbs);
    this.currentValue = clamped;
    if (!this.randomizeActive || forceVisual) {
      this.visualValue = clamped;
      this.render();
    }
    if (emit) {
      if (this.lastEmittedValue === null || Math.abs(clamped - this.lastEmittedValue) >= 0.1) {
        this.emitConfigUpdate(this.name, clamped);
        this.lastEmittedValue = clamped;
      }
    }
    this.baseElement.setAttribute("aria-valuenow", `${Math.round(this.visualValue)}`);
  }
  render() {
    const metrics = this.ensureMetrics();
    const travel = metrics ? metrics.travelY : 0;
    const ratio = this.maxAbs ? clamp(this.visualValue / this.maxAbs, -1, 1) : 0;
    const translateY = travel * -ratio;
    const tilt = ratio * 16;
    this.capElement.style.transform = `translateY(${translateY}px) rotateX(${tilt}deg)`;
    this.valueElement.textContent = `${Math.round(this.visualValue)}`;
  }
  handleRandomClick() {
    if (this.isDisabled) {
      return;
    }
    this.updateRandomize(!this.randomizeActive, { emit: true });
  }
  handlePlaybackChanged(event) {
    const { playing } = event.detail || {};
    this.isSynthPlaying = Boolean(playing ?? this.readSynthPlayingState());
    if (this.isSynthPlaying) {
      if (this.randomizeActive) {
        this.startRandomMotion();
      }
    } else {
      if (this.randomizeActive) {
        this.stopRandomMotion();
        this.pendingRandomStart = true;
      }
    }
  }
  updateRandomize(state, { emit } = { emit: false }) {
    if (state === this.randomizeActive) {
      return;
    }
    this.randomizeActive = state;
    this.randomButton.dataset.active = state ? "true" : "false";
    this.randomButton.setAttribute("aria-pressed", state ? "true" : "false");
    if (state) {
      if (this.isSynthPlaying) {
        this.startRandomMotion();
      } else {
        this.pendingRandomStart = true;
      }
    } else {
      this.stopRandomMotion();
      this.setCurrentValue(0, { emit: true, forceVisual: true });
      this.lastEmittedValue = null;
      this.pendingRandomStart = false;
    }
    if (emit) {
      this.emitConfigUpdate(this.randomName, state);
    }
  }
  startRandomMotion() {
    if (!this.isSynthPlaying) {
      this.pendingRandomStart = true;
      return;
    }
    this.pendingRandomStart = false;
    this.stopRandomMotion();
    const scheduleNextPhase = (startValue = this.visualValue) => {
      const duration = 450 + Math.random() * 600;
      const target = (Math.random() * 2 - 1) * this.maxAbs;
      this.randomPhase = {
        start: performance.now(),
        duration,
        from: startValue,
        to: target
      };
    };
    const step = (timestamp) => {
      if (!this.randomizeActive) {
        return;
      }
      if (!this.isSynthPlaying) {
        this.stopRandomMotion();
        this.pendingRandomStart = true;
        return;
      }
      if (!this.randomPhase) {
        scheduleNextPhase();
      }
      const { start, duration, from, to } = this.randomPhase;
      const elapsed = timestamp - start;
      const progress = duration > 0 ? clamp(elapsed / duration, 0, 1) : 1;
      const eased = easeInOutSine(progress);
      const nextValue = from + (to - from) * eased;
      this.setCurrentValue(nextValue, { emit: true, forceVisual: true });
      if (progress >= 1) {
        scheduleNextPhase(nextValue);
      }
      this.randomAnimationFrame = requestAnimationFrame(step);
    };
    this.randomAnimationFrame = requestAnimationFrame(step);
  }
  stopRandomMotion() {
    if (this.randomAnimationFrame) {
      cancelAnimationFrame(this.randomAnimationFrame);
      this.randomAnimationFrame = null;
    }
    this.randomPhase = null;
  }
  updateDisabledState(isDisabled) {
    this.isDisabled = Boolean(isDisabled);
    this.toggleAttribute("data-disabled", this.isDisabled);
    if (this.isDisabled) {
      this.stopRandomMotion();
    }
  }
  handleConfigUpdated(event) {
    const { name, value } = event.detail || {};
    if (!name) {
      return;
    }
    if (name === this.name && Number.isFinite(value)) {
      this.setCurrentValue(value, { emit: false, forceVisual: !this.randomizeActive });
    }
    if (name === this.randomName) {
      this.updateRandomize(Boolean(value), { emit: false });
    }
    if (name === this.activeName) {
      this.updateDisabledState(!value);
    }
  }
};
customElements.define("synth-joystick", SynthJoystick);

// synth-segmented.js
var SynthSegmented = class extends HTMLElement {
  constructor() {
    super();
    this.controlName = this.getAttribute("name") || "";
    this.label = this.getAttribute("label") || "";
    const optionsAttr = this.getAttribute("options");
    this.options = this.parseOptions(optionsAttr);
    this.uniquePrefix = `segmented-${Math.random().toString(36).slice(2)}`;
    this.groupName = `${this.uniquePrefix}-group`;
    this.attachShadow({ mode: "open" });
    this.render();
    this.handleChange = this.handleChange.bind(this);
    this.handleConfigUpdated = this.handleConfigUpdated.bind(this);
    this.synthBrain = null;
  }
  connectedCallback() {
    this.segmented?.addEventListener("change", this.handleChange);
    this.synthBrain = this.closest("synth-brain") || (typeof document !== "undefined" ? document.querySelector("synth-brain") : null);
    this.synthBrain?.addEventListener("config-updated", this.handleConfigUpdated);
    this.syncFromConfig();
  }
  disconnectedCallback() {
    this.segmented?.removeEventListener("change", this.handleChange);
    this.synthBrain?.removeEventListener("config-updated", this.handleConfigUpdated);
    this.synthBrain = null;
  }
  parseOptions(rawOptions) {
    if (!rawOptions) {
      return [];
    }
    if (Array.isArray(rawOptions)) {
      return rawOptions;
    }
    try {
      const parsed = JSON.parse(rawOptions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse synth-segmented options", error);
      return [];
    }
  }
  render() {
    const makeOption = ({ value, label }, index) => {
      const safeValue = String(value ?? "");
      const optionId = `${this.uniquePrefix}-${index}`;
      const safeLabel = label ?? safeValue;
      return `
        <label class="option" for="${optionId}">
          <input type="radio" id="${optionId}" name="${this.groupName}" value="${safeValue}" />
          <span class="option-label">${safeLabel}</span>
        </label>
      `;
    };
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          color: inherit;
          font-size: 0.75rem;
        }

        .wrapper {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
        }

        .label {
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .segmented {
          display: inline-flex;
          border-radius: 999px;
          padding: 2px;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          gap: 2px;
        }

        .option {
          position: relative;
          display: inline-flex;
          border-radius: 999px;
          cursor: pointer;
          overflow: hidden;
        }

        .option input {
          position: absolute;
          opacity: 0;
          inset: 0;
          margin: 0;
          pointer-events: none;
        }

        .option-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 14px;
          border-radius: 999px;
          transition: background 0.2s ease, color 0.2s ease;
          min-width: 80px;
        }

        .option input:checked + .option-label {
          background: rgba(58, 210, 163, 0.24);
          color: #f7faf8;
        }

        .option input:focus-visible + .option-label {
          outline: 2px solid rgba(58, 210, 163, 0.85);
          outline-offset: 2px;
        }
      </style>
      <div class="wrapper">
        ${this.label ? `<span class="label">${this.label}</span>` : ""}
        <div class="segmented" role="radiogroup" aria-label="${this.label || this.controlName}">
          ${this.options.map(makeOption).join("")}
        </div>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);
    this.segmented = this.shadowRoot.querySelector(".segmented");
    this.inputs = Array.from(this.shadowRoot.querySelectorAll('input[type="radio"]'));
  }
  handleChange(event) {
    const input = event.target;
    if (!input || input.type !== "radio") {
      return;
    }
    const { value } = input;
    if (!value) {
      return;
    }
    this.dispatchUpdate(value);
  }
  handleConfigUpdated(event) {
    const { name, value } = event.detail || {};
    if (name !== this.controlName) {
      return;
    }
    this.setActiveValue(value);
  }
  dispatchUpdate(value) {
    if (!this.controlName) {
      return;
    }
    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name: this.controlName, value },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(updateConfigEvent);
  }
  syncFromConfig() {
    const synthBrain = this.synthBrain || this.closest("synth-brain");
    if (!synthBrain) {
      return;
    }
    const value = typeof synthBrain.getConfigValue === "function" ? synthBrain.getConfigValue(this.controlName) : synthBrain.config?.[this.controlName];
    this.setActiveValue(value);
  }
  getCurrentValue() {
    const active = this.inputs?.find((input) => input.checked);
    return active ? active.value : null;
  }
  setActiveValue(value) {
    if (!this.inputs?.length) {
      return;
    }
    const targetValue = value != null ? String(value) : null;
    let matched = false;
    this.inputs.forEach((input) => {
      const isMatch = input.value === targetValue;
      input.checked = isMatch;
      if (isMatch) {
        matched = true;
      }
    });
    if (!matched && this.inputs.length > 0) {
      this.inputs[0].checked = true;
    }
  }
};
if (!customElements.get("synth-segmented")) {
  customElements.define("synth-segmented", SynthSegmented);
}

// synth-section.js
var SynthSection = class extends HTMLElement {
  constructor() {
    super();
    const label = this.getAttribute("label") || "";
    this.attachShadow({ mode: "open" });
    this._headingSlot = this.shadowRoot.querySelector('slot[name="heading-action"]');
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        section {
          display: block;
        }

        .section-heading {
          align-items: center;
          display: flex;
          gap: var(--synth-section-heading-gap, 16px);
          justify-content: space-between;
        }

        .section-heading[hidden] {
          display: none;
        }

        h4 {
          font-weight: normal;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: .55px;
        } 
      </style>
      <section part="section">
        <div class="section-heading" part="heading">
          <h4>${label}</h4>
          <slot name="heading-action"></slot>
        </div>
        <slot></slot>
      </section>
    `;
    ensureBoxSizing(this.shadowRoot);
  }
};
customElements.define("synth-section", SynthSection);

// App.js
function App() {
}

// index.html
var index_default = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Triticale</title>
    <link rel="stylesheet" href="styles.css" />
    <link rel="icon" type="image/png" />
    <script>
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext('2d');
      context.fillStyle = 'pink';

      context.fillRect(0, 0, 16, 16);

      const favicon = canvas.toDataURL('image/png');

      document.querySelector('link[rel="icon"]').setAttribute('href', favicon);

    <\/script>
  </head>
  <body>
    <synth-brain>
        <synth-section id="granulation" label="Granulation">
          <div class="synth-controls">
            <synth-dial name="grainDuration" min="1" max="1000" label="Duration"></synth-dial>
            <synth-dial name="density" min="1" max="128" label="Density"></synth-dial>
            <synth-dial name="window" min="1" max="10" label="Window" step="0.1"></synth-dial>
            <synth-dial name="spray" min="1" max="128" label="Spray" step="1"></synth-dial>
            <synth-dial name="random" min="0" max="1" step="0.25" label="Random" format="percent"></synth-dial>
          </div>
        </synth-section>
        <section id="transport">
          <latch-button></latch-button>
        </section>
        <synth-display></synth-display>
        <synth-waveform></synth-waveform>
        <synth-section id="effects" label="Effects">
          <synth-segmented
            slot="heading-action"
            name="effectsChainMode"
            options='[{"value":"series","label":"Linear"},{"value":"parallel","label":"Parallel"}]'
          ></synth-segmented>
          <div class="synth-effects">
            <div class="synth-effect">
              <synth-switch name="effects.bitcrusher.active" label="Bitcrusher"></synth-switch>
              <div class="synth-controls">
                <synth-dial name="effects.bitcrusher.bits" min="0" max="16" step="4" label="Bits"></synth-dial>
                <synth-dial name="effects.bitcrusher.normfreq" min="0.0001" max="1" step="0.001" label="Norm Freq"></synth-dial>
              </div>
            </div>
            <div class="synth-effect">
              <synth-switch name="effects.delay.active" label="Delay"></synth-switch>
              <div class="synth-controls">
                <synth-dial name="effects.delay.feedback" min="0" max="1" step="0.01" label="Feedback"></synth-dial>
                <synth-dial name="effects.delay.time" min="0" max="1" step="0.01" label="Time"></synth-dial>
                <synth-dial name="effects.delay.mix" min="0" max="1" step="0.01" label="Mix"></synth-dial>
              </div>
            </div>
            <div class="synth-effect">
              <div class="section-heading">
                <synth-switch name="effects.biquad.active" label="Filter"></synth-switch>
                <synth-select
                  name="effects.biquad.type"
                  options='[{"value": "lowpass", "label": "Lowpass"}, {"value": "highpass", "label": "Highpass"}, {"value": "bandpass", "label": "Bandpass"}]'
                ></synth-select>
              </div>
              <div class="synth-controls">
                <synth-dial name="effects.biquad.biquadFrequency" min="20" max="22050" step="1" label="Frequency"></synth-dial>
                <synth-dial name="effects.biquad.quality" min="0" max="20" step="0.1" label="Quality"></synth-dial>
                <synth-dial name="effects.biquad.randomValues" min="0" max="100" step="1" label="Random"></synth-dial>
              </div>
            </div>
          </div>
        </synth-section>
        <section id="joystick">
          <synth-joystick name="effects.detune.value" min="-1200" max="1200" label="Pitch"></synth-joystick>
        </section>
        <section id="ribbon">
          <synth-ribbon></synth-ribbon>
        </section>
        <div id="logo">
          <img src="./logo.png" id="synth-logo" alt="Triticale logo" />
        </div>
    </synth-brain>
    <script type="importmap">
      {
        "imports": {
          "helpers/": "./helpers/"
        }
      }
    <\/script>
    <script type="module">
      import { setPublicPath } from "./helpers/setPublicPath.js";
      import { App } from "./App.js";

      setPublicPath(new URL("./", import.meta.url).href);
      App();
    <\/script>
  </body>
</html>
`;

// styles.css
var styles_default = ':host *, * {\n  box-sizing: border-box;\n\n  --vw: var(--root-slot-width, 100dvw);\n  --vh: var(--root-slot-height, 100dvh);\n}\n\nbody {\n  margin: 0;\n}\n\nsynth-brain {\n  background: #111417;\n  color: #f1f4f3;\n  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;\n  height: var(--vh);\n  width: var(--vw);\n  display: grid;\n  column-gap: 24px;\n  grid-template-columns: 24px minmax(0, 1fr) minmax(0, 3fr) minmax(0, 1fr) 24px;\n  grid-template-rows: 24px minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 24px;\n  grid-template-areas:\n    ". . . . ."\n    ". granulation display effects ."\n    ". transport display effects ."\n    ". joystick waveform logo ."\n    ". joystick ribbon logo .";\n}\n\n#granulation {\n  grid-area: granulation;\n}\n\n#effects {\n  grid-area: effects;\n}\n\n#joystick {\n  grid-area: joystick;\n}\n\n#ribbon {\n  grid-area: ribbon;\n}\n\n#transport {\n  grid-area: transport;\n}\n\n#logo {\n  grid-area: logo;\n  text-align: center;\n  place-self: center;\n}\n\n#logo img {\n  max-width: 100%;\n  max-height: 100%;\n}\n\n.section-heading {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n\nsynth-display { \n  grid-area: display;\n}\n\nsynth-waveform {\n  grid-area: waveform;\n}\n\n#granulation > dnd-wrapper {\n  display: flex;\n  flex: 1 1 auto;\n}\n\n#granulation > dnd-wrapper synth-waveform {\n  flex: 1 1 auto;\n}\n\n.synth-effects {\n  display: flex;\n  flex-direction: column;\n  gap: 36px;\n}\n\n.synth-effect {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  position: relative;\n\n  &:not(:first-child)::after {\n    background-clip: content-box;\n    background-image: repeating-linear-gradient(\n      to right,\n      white 0 6px,\n      transparent 6px 12px\n    );\n    box-sizing: border-box;\n    block-size: 1px;\n    inset-inline: 0;\n    content: "";\n    position: absolute;\n    inset-block-start: -18px;\n  }\n}\n\n.synth-controls {\n  align-items: flex-start;\n  display: flex;\n  flex-wrap: wrap;\n  column-gap: 24px;\n  row-gap: 12px;\n\n}\n';

// microfrontend.js
var templateString = null;
var appInitialized = false;
var cachedImportMap = void 0;
var EMPTY_IMPORT_MAP = Object.freeze({ imports: {} });
var ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:|\/\/|data:|blob:|#)/i;
var IMPORTMAP_PATTERN = /<script\s+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;
var HOST_CACHE_KEY = "triticale:state";
var publicPath = new URL("./", import.meta.url).href;
setPublicPath(publicPath);
function ensureApp() {
  if (!appInitialized) {
    App();
    appInitialized = true;
  }
}
function getTemplateFragment(root) {
  if (templateString === null) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(index_default, "text/html");
    const rootEl = doc.querySelector(root);
    if (!rootEl) {
      throw new Error(`Unable to locate ${root} in in index.html template`);
    }
    templateString = rootEl.outerHTML + getImportMapMarkup();
  }
  const template = document.createElement("template");
  template.innerHTML = templateString;
  return template.content.cloneNode(true);
}
function parseImportMapFromTemplate() {
  if (cachedImportMap !== void 0) {
    return cachedImportMap;
  }
  const match = index_default.match(IMPORTMAP_PATTERN);
  if (!match || !match[1]) {
    cachedImportMap = EMPTY_IMPORT_MAP;
    return cachedImportMap;
  }
  try {
    cachedImportMap = JSON.parse(match[1]);
  } catch (error) {
    console.warn("Failed to parse importmap from index.html", error);
    cachedImportMap = EMPTY_IMPORT_MAP;
  }
  return cachedImportMap;
}
function getImportMapMarkup() {
  const parsedImportMap = parseImportMapFromTemplate();
  if (!parsedImportMap || parsedImportMap === EMPTY_IMPORT_MAP) {
    return "";
  }
  const serializedMap = JSON.stringify(parsedImportMap, null, 2);
  return `<script type="importmap" data-triticale-importmap>${serializedMap}<\/script>`;
}
async function unmount(rootEl, hostContext = null) {
  if (!(rootEl instanceof HTMLElement)) {
    throw new Error("unmount() requires a root HTMLElement");
  }
  persistSynthState(rootEl, hostContext);
  try {
    rootEl.dispatchEvent(
      new Event("stop-synth", { bubbles: true, composed: true })
    );
  } catch (error) {
    console.error("Failed to dispatch stop-synth", error);
  }
  const ctx = rootEl.audioCtx;
  if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
    try {
      await ctx.close();
    } catch (error) {
      console.warn("Failed to close triticale audio context", error);
    }
  }
  rootEl.remove();
}
async function mount({ container, root, host } = {}) {
  if (!container) {
    throw new Error("mount() requires an { element } to attach to");
  }
  ensureApp();
  const fragment = getTemplateFragment(root);
  const rootEl = fragment.querySelector(root);
  if (!rootEl) {
    throw new Error(`Root ${root} should be present in the DOM`);
  }
  const style = document.createElement("style");
  style.textContent = styles_default;
  rootEl.appendChild(style);
  rewriteAssetReferences(fragment);
  container.style.backgroundColor = getComputedStyle(rootEl).backgroundColor;
  container.replaceChildren(fragment);
  restoreSynthState(rootEl, host);
  return {
    container,
    rootEl
  };
}
function rewriteAssetReferences(root) {
  if (!root) {
    return;
  }
  const mappings = [
    { selector: "img[src]", attribute: "src" }
  ];
  mappings.forEach(({ selector, attribute }) => {
    const elements = root.querySelectorAll(selector);
    elements.forEach((element) => {
      const current = element.getAttribute(attribute);
      if (!current) {
        return;
      }
      if (ABSOLUTE_URL_PATTERN.test(current)) {
        return;
      }
      const nextValue = makeAbsoluteUrl(current);
      if (nextValue !== current) {
        element.setAttribute(attribute, nextValue);
      }
    });
  });
}
function persistSynthState(rootEl, hostContext) {
  const cache = resolveHostCache(hostContext);
  if (!cache) {
    return;
  }
  const snapshot = createSynthSnapshot(rootEl);
  if (!snapshot) {
    cache.delete(HOST_CACHE_KEY);
    return;
  }
  cache.write(HOST_CACHE_KEY, snapshot);
}
function restoreSynthState(rootEl, hostContext) {
  const cache = resolveHostCache(hostContext);
  if (!cache) {
    return;
  }
  const snapshot = cache.read(HOST_CACHE_KEY);
  if (!snapshot) {
    return;
  }
  if (snapshot.config) {
    applyConfigSnapshot(rootEl, snapshot.config);
  }
  if (snapshot.audioSelection) {
    rootEl.applyAudioSelectionBuffer(snapshot.audioSelection);
  }
  if (snapshot.imageBuffer) {
    rootEl.applyImageBuffer(snapshot.imageBuffer);
  }
  const synthWaveform = rootEl.querySelector("synth-waveform");
  if (synthWaveform && snapshot.waveform?.buffer && typeof synthWaveform.loadAudio === "function") {
    synthWaveform.loadAudio(snapshot.waveform.buffer);
  }
  const synthDisplay = rootEl.querySelector("synth-display");
  if (synthDisplay && snapshot.display) {
    hydrateDisplay(synthDisplay, snapshot.display);
  }
}
function createSynthSnapshot(rootEl) {
  if (!(rootEl instanceof HTMLElement)) {
    return null;
  }
  const synthWaveform = rootEl.querySelector("synth-waveform");
  const synthDisplay = rootEl.querySelector("synth-display");
  const snapshot = {};
  if (rootEl.config) {
    snapshot.config = cloneConfig(rootEl.config);
  }
  if (rootEl.audioSelection) {
    snapshot.audioSelection = rootEl.audioSelection;
  }
  if (rootEl.imageBuffer) {
    snapshot.imageBuffer = rootEl.imageBuffer;
  }
  if (synthWaveform?.buffer) {
    snapshot.waveform = {
      buffer: synthWaveform.buffer
    };
  }
  const displaySnapshot = createDisplaySnapshot(synthDisplay);
  if (displaySnapshot) {
    snapshot.display = displaySnapshot;
  }
  if (Object.keys(snapshot).length === 0) {
    return null;
  }
  return snapshot;
}
function createDisplaySnapshot(display) {
  if (!display?.image) {
    return null;
  }
  const snapshot = {
    width: display.image?.width ?? null,
    height: display.image?.height ?? null,
    dataUrl: null,
    src: null
  };
  const canvas = display.canvas;
  if (canvas && typeof canvas.toDataURL === "function") {
    try {
      snapshot.dataUrl = canvas.toDataURL("image/png");
    } catch (error) {
      console.warn("Failed to serialize synth-display canvas", error);
      snapshot.src = display.image?.src ?? null;
    }
  } else {
    snapshot.src = display.image?.src ?? null;
  }
  if (!snapshot.dataUrl && !snapshot.src) {
    return null;
  }
  return snapshot;
}
function hydrateDisplay(display, snapshot) {
  const nextImage = new Image(snapshot.width || void 0, snapshot.height || void 0);
  nextImage.decoding = "async";
  nextImage.crossOrigin = "anonymous";
  const applyImage = () => {
    if (typeof display.drawImage === "function") {
      display.drawImage(nextImage);
    }
  };
  nextImage.onload = applyImage;
  nextImage.onerror = () => {
    if (snapshot.src && snapshot.src !== nextImage.src) {
      nextImage.src = snapshot.src;
      return;
    }
  };
  if (snapshot.dataUrl) {
    nextImage.src = snapshot.dataUrl;
  } else if (snapshot.src) {
    nextImage.src = snapshot.src;
  }
}
function applyConfigSnapshot(rootEl, snapshot) {
  if (!rootEl || typeof rootEl.updateConfig !== "function" || !snapshot) {
    return;
  }
  const entries = [];
  flattenConfig(snapshot, "", entries);
  entries.forEach(({ path, value }) => {
    try {
      rootEl.updateConfig(path, value);
    } catch (error) {
      console.warn(`Failed to restore config value for ${path}`, error);
    }
  });
}
function flattenConfig(node, prefix, accumulator) {
  if (node === null || typeof node !== "object") {
    if (prefix) {
      accumulator.push({ path: prefix, value: node });
    }
    return;
  }
  Object.entries(node).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flattenConfig(value, nextPrefix, accumulator);
    } else if (prefix || typeof value !== "object") {
      accumulator.push({ path: nextPrefix, value });
    }
  });
}
function cloneConfig(config) {
  if (!config) {
    return null;
  }
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(config);
    } catch {
    }
  }
  try {
    return JSON.parse(JSON.stringify(config));
  } catch {
    return null;
  }
}
function resolveHostCache(hostContext) {
  if (!hostContext) {
    return null;
  }
  if (hostContext.cache) {
    return hostContext.cache;
  }
  return hostContext;
}
export {
  mount,
  unmount
};
