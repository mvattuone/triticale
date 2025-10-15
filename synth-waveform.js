export default class SynthWaveform extends HTMLElement {
  constructor() {
    super();
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
                  padding: 0.3rem 0.55rem;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #f0f5ef, #cdd8cf);
                  cursor: pointer;
                  font-size: 10px;
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
                    <button class="refresh" type="button" aria-label="Load new random audio">R</button>
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
    this.remoteAudioSources = [
      "https://archive.org/download/aporee_69834_81312/202507302277310N12113125E.mp3",
      "https://archive.org/download/aporee_69841_81320/2509280023.mp3",
      "https://archive.org/download/aporee_11664_13718/SBGNouMurcielagos.mp3",
      "example.mp3",
    ];
    this.archiveCollectionId = "radio-aporee-maps";
    this.archiveSearchBaseUrl = "https://archive.org/advancedsearch.php";
    this.archiveMetadataBaseUrl = "https://archive.org/metadata/";
    this.archiveDownloadBaseUrl = "https://archive.org/download/";
    this.archiveTotalItems = null;
    this.archiveMp3Cache = new Map();
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
          Math.floor(this.channelData.length / this.canvas.width),
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
    if (
      this.overlayCanvas.width !== this.canvas.width ||
      this.overlayCanvas.height !== this.canvas.height
    ) {
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
        this.noiseCanvas.height,
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
    const sweepCenter = ((time * 0.08) % (height + sweepHeight)) - sweepHeight / 2;
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
      composed: true,
    });
    this.dispatchEvent(updateSampleEvent);
  }

  drawSelection() {
    if (
      this.selectionToPixels.start !== null &&
      this.selectionToPixels.end !== null
    ) {
      this.context.fillStyle = "rgba(79, 255, 173, 0.2)";
      (this.selectionX = Math.min(
        this.selectionToPixels.start,
        this.selectionToPixels.end,
      )),
        (this.selectionWidth = Math.abs(
          this.selectionToPixels.end - this.selectionToPixels.start,
        ));
      this.context.fillRect(
        Math.min(this.selectionToPixels.start, this.selectionToPixels.end),
        0,
        Math.abs(this.selectionToPixels.end - this.selectionToPixels.start),
        this.canvas.height,
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

  handleRandomAudioClick = async () => {
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
  };

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

    const archiveUrl = await this.getRandomArchiveMp3Url();
    if (archiveUrl) {
      try {
        return await this.fetchAudioBufferFromUrl(archiveUrl);
      } catch (error) {
        console.warn("Archive audio fetch failed, trying fallback list.", error);
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

  async getRandomArchiveMp3Url() {
    try {
      const total = await this.getArchiveItemCount();
      if (!total) {
        return null;
      }
      const randomIndex = Math.floor(Math.random() * total);
      const params = new URLSearchParams({
        q: `collection:${this.archiveCollectionId} AND format:MP3`,
        output: "json",
        rows: "1",
        start: String(randomIndex),
      });
      const searchUrl = `${this.archiveSearchBaseUrl}?${params.toString()}`;
      const searchData = await this.fetchArchiveJson(searchUrl);
      const docs = searchData?.response?.docs;
      if (!Array.isArray(docs) || !docs.length) {
        return null;
      }
      const identifier = docs[0]?.identifier;
      if (!identifier) {
        return null;
      }
      const mp3FileName = await this.getArchiveMp3FileName(identifier);
      if (!mp3FileName) {
        return null;
      }
      return `${this.archiveDownloadBaseUrl}${encodeURIComponent(identifier)}/${encodeURIComponent(mp3FileName)}`;
    } catch (error) {
      console.warn("Archive random audio lookup failed:", error);
      return null;
    }
  }

  async getArchiveItemCount() {
    if (typeof this.archiveTotalItems === "number") {
      return this.archiveTotalItems;
    }
    try {
      const params = new URLSearchParams({
        q: `collection:${this.archiveCollectionId} AND format:MP3`,
        output: "json",
        rows: "0",
        start: "0",
      });
      const countUrl = `${this.archiveSearchBaseUrl}?${params.toString()}`;
      const data = await this.fetchArchiveJson(countUrl);
      const total = data?.response?.numFound;
      if (typeof total === "number" && total > 0) {
        this.archiveTotalItems = total;
        return total;
      }
    } catch (error) {
      console.warn("Archive item count lookup failed:", error);
    }
    return null;
  }

  async fetchArchiveJson(url) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`Archive request failed: ${response.status}`);
    }
    return response.json();
  }

  async getArchiveMp3FileName(identifier) {
    if (this.archiveMp3Cache.has(identifier)) {
      return this.archiveMp3Cache.get(identifier);
    }
    const metadataUrl = `${this.archiveMetadataBaseUrl}${encodeURIComponent(identifier)}`;
    const metadata = await this.fetchArchiveJson(metadataUrl);
    const files = metadata?.files;
    if (!Array.isArray(files) || !files.length) {
      return null;
    }
    const mp3Entry = files.find((file) => typeof file?.name === "string" && file.name.toLowerCase().endsWith(".mp3"));
    const fileName = mp3Entry?.name || null;
    if (fileName) {
      this.archiveMp3Cache.set(identifier, fileName);
    }
    return fileName;
  }

  generateProceduralAudio() {
    const durationSeconds = 8;
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(durationSeconds * sampleRate));
    const buffer = this.audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [
      196.0, // G3
      246.94, // B3
      293.66, // D4
      329.63, // E4
      392.0, // G4
      440.0, // A4
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
      const envelope = Math.sin((Math.PI * positionInNote) / noteDuration);
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
        composed: true,
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

  handleResetAudioClick = () => {
    this.setAudioControlsDisabled(true);
    this.handleRandomAudioClick();
  };

  handleRemoveAudioClick = () => {
    this.clearAudio();
    const audioClearedEvent = new CustomEvent("audio-cleared", {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(audioClearedEvent);
  };

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
    const amplitude = (this.canvas.height / 2) - 8;
    const ctx = this.context;

    ctx.save();
    ctx.strokeStyle = "#4dffb5";
    ctx.lineWidth = Math.max(1, this.canvas.height * 0.0035);
    ctx.shadowColor = "rgba(79, 255, 173, 0.45)";
    ctx.shadowBlur = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";

    ctx.beginPath();
    let moved = false;
    const total = this.channelData.length;
    for (let i = 0; i < total; i += this.samplesPerPixel) {
      const x = (i / total) * this.canvas.width;
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

    // Baseline glow
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
      Math.floor(this.channelData.length / this.canvas.width),
    );
    this.selectionToPixels.start = 0;
    this.selectionToPixels.end = this.canvas.width;
    this.selection.start = this.pixelToSampleIndex(this.selectionToPixels.start);
    this.selection.end = this.pixelToSampleIndex(this.selectionToPixels.end);
    this.drawWaveform();
    this.drawSelection();
    this.updateSample();
  }
}

customElements.define("synth-waveform", SynthWaveform);
