export default class SynthWaveform extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                canvas {
                    border: 1px solid black;
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
    this.audioCtx = this.closest('synth-brain').audioCtx;
    this.addEventListeners();
  }

  connectedCallback() {
    this.addEventListener("update-audio", this.handleAudioUploaded);
    console.log("Listener for update-audio added.");
  }

  disconnectedCallback() {
    this.removeEventListener("update-audio", this.handleAudioUploaded);
    console.log("Listener for update-audio removed.");
  }

  handleAudioUploaded(event) {
    const buffer = event.detail.buffer;
    this.loadAudio(buffer);
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
      this.drawSelection();
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if (!this.isSelecting) return;
      this.isSelecting = false;
      const x = e.offsetX;
      this.selectionToPixels.end = x;
      this.selection.end = this.pixelToSampleIndex(x);
      this.drawSelection();
      const updateSampleEvent = new CustomEvent('update-sample', {
        detail: { selection: this.selection, buffer: this.buffer },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(updateSampleEvent);
      console.log(
        `Selection from ${this.selection.start} to ${this.selection.end}`,
      );
    });
  }

  drawSelection() {
    this.drawWaveform(this.channelData);
    if (this.selectionToPixels.start !== null && this.selectionToPixels.end !== null) {
      this.context.fillStyle = "rgba(0, 100, 255, 0.3)";
      this.context.fillRect(
        Math.min(this.selectionToPixels.start, this.selectionToPixels.end),
        0,
        Math.abs(this.selectionToPixels.end - this.selectionToPixels.start),
        this.canvas.height,
      );
    }
  }

  drawWaveform(channel) {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.samplesPerPixel = Math.floor(
      this.channelData.length / this.canvas.width,
    );

    for (var i = 0; i < channel.length; i += this.samplesPerPixel) {
      var x = Math.floor((this.canvas.width * i) / channel.length);
      var y = (channel[i] * this.canvas.height) / 2;
      this.context.beginPath();
      this.context.moveTo(x, 0);
      this.context.lineTo(x + 1, y);
      this.context.stroke();
    }
  }

  loadAudio(buffer) {
    this.buffer = buffer;
    const channel = buffer.getChannelData(0);
    this.channelData = channel;
    this.canvas.width = 1000;
    this.canvas.height = 300;
    this.drawWaveform(channel);
  }
}

customElements.define("synth-waveform", SynthWaveform);
