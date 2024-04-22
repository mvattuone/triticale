class SynthDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                canvas {
                    border: 1px solid black;
                    max-width: 100%;
                    width: 100%;
                }
            </style>
            <canvas></canvas>
        `;
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
  }

  connectedCallback() {
    this.addEventListener("update-image", this.handleImageUploaded, true);
    console.log("Listener for update-image added.");
  }

  disconnectedCallback() {
    this.removeEventListener("update-image", this.handleImageUploaded, true);
    console.log("Listener for update-image removed.");
  }

  handleImageUploaded(event) {
    const image = event.detail;
    this.drawImage(image);
  }

  drawImage(img) {
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(img, 0, 0);
  }
}

customElements.define("synth-display", SynthDisplay);
