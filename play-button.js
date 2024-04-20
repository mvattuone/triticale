export default class PlayButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.playing = false;
    this.shadowRoot.innerHTML = `
      <button type="button">Play</Button>
    `
    this.button = this.shadowRoot.querySelector('button');
    this.button.onclick = this.handleClick.bind(this); 
    this.audioCtx = this.closest('synth-brain').audioCtx;
  }

  handleClick() {
    this.buffer = this.previousElementSibling.buffer;
    this.selection = {};
    this.selection.start = this.previousElementSibling.selection.start;
    this.selection.end = this.previousElementSibling.selection.end;
    if (!this.buffer) return;

    if (!this.playing) {
      this.playing = true;
      this.button.innerText = 'Stop';
      const playSynthEvent = new CustomEvent("play-synth", {
        detail: { selection: this.selection, buffer: this.buffer },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(playSynthEvent);

    } else {
      const stopSynthEvent = new CustomEvent("stop-synth", {
        detail: { selection: this.selection, buffer: this.buffer },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(stopSynthEvent);
      this.button.innerText = 'Play';
      this.playing = false;
    }
  }

  playSelectedPartOfBuffer(
    originalBuffer,
    selectionStart,
    selectionEnd,
  ) {
    const frameCount = selectionEnd - selectionStart;
    const numberOfChannels = originalBuffer.numberOfChannels;
    const sampleRate = originalBuffer.sampleRate;

    let newBuffer = this.audioCtx.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate,
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        newData[i] = originalData[i + selectionStart];
      }
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = newBuffer;
    source.connect(this.audioCtx.destination);

    source.start();
  }
}

customElements.define("play-button", PlayButton);
