export default class SynthWaveform extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                :host {
                    border: 1px solid black;
                    display: block;
                    height: 300px;
                    width: 1000px;
                }
            </style>
            <canvas></canvas>
        `;
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.canvas.width = 1000;
    this.canvas.height = 300;
    this.selection = { start: null, end: null };
    this.selectionToPixels = { start: null, end: null };
    this.selectionWidth = this.canvas.width;
    this.selectionX = 0;
    this.audioCtx = this.closest("synth-brain").audioCtx;
    this.addEventListeners();
  }

  connectedCallback() {
    this.addEventListener("drop-success", this.handleAudioUploaded);
    this.addEventListener("clear-grain", this.clearGrain);
    this.addEventListener("draw-grain", this.drawGrain);
  }

  disconnectedCallback() {
    this.removeEventListener("drop-success", this.handleAudioUploaded);
    this.removeEventListener("clear-grain", this.clearGrain);
    this.removeEventListener("draw-grain", this.drawGrain);
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
      const updateSampleEvent = new CustomEvent("update-sample", {
        detail: { selection: this.selection, buffer: this.buffer },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(updateSampleEvent);
    });
  }

  drawSelection() {
    if (
      this.selectionToPixels.start !== null &&
      this.selectionToPixels.end !== null
    ) {
      this.context.fillStyle = "rgba(0, 100, 255, 0.3)";
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
    reader.onload = () => {
      this.audioCtx.decodeAudioData(
        reader.result,
        (buffer) => {
          this.loadAudio(buffer);
        },
        (error) => {
          console.error("Error decoding audio file:", error);
        },
      );
    };
    reader.readAsArrayBuffer(file);
  }

  drawWaveform() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.samplesPerPixel = Math.floor(
      this.channelData.length / this.canvas.width,
    );

    for (var i = 0; i < this.channelData.length; i += this.samplesPerPixel) {
      var x = Math.floor((this.canvas.width * i) / this.channelData.length);
      var y = (this.channelData[i] * this.canvas.height) / 2;
      this.context.beginPath();
      this.context.moveTo(x, 0);
      this.context.lineTo(x + 1, y);
      this.context.stroke();
    }
  }

  drawGrain(e) {
    this.drawWaveform();
    if (this.selection.start || this.selection.end) {
      this.drawSelection();
    }
    const { grainIndex, grains } = e.detail;
    const grainWidth = Math.round(this.selectionWidth / grains.length);
    const grainHeight = this.canvas.height;

    const x = this.selectionX + Math.floor(grainWidth * grainIndex);
    const y = 0;
    this.context.fillStyle = "#ff0000";
    this.context.fillRect(x, y, grainWidth, grainHeight);
  }

  clearGrain() {
    this.drawWaveform();
    this.drawSelection();
  }

  loadAudio(buffer) {
    this.buffer = buffer;
    const channel = buffer.getChannelData(0);
    this.channelData = channel;
    this.canvas.width = 1000;
    this.canvas.height = 300;
    this.drawWaveform();
  }
}

customElements.define("synth-waveform", SynthWaveform);
