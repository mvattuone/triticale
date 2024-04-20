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
