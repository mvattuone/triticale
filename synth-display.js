class SynthDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                :host {
                    box-sizing: border-box;
                    border: 1px solid black;
                    display: block;
                    height: 450px;
                    width: 800px;
                }

                canvas {
                  max-width: 100%;
                }


            </style>
            <canvas></canvas>
        `;
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
  }

  connectedCallback() {
    this.addEventListener("drop-success", this.handleImageUploaded, true);
  }

  disconnectedCallback() {
    this.removeEventListener("drop-success", this.handleImageUploaded, true);
  }

  handleImageUploaded = (event) => {
    const { file } = event.detail;

    if (!file.type.startsWith("image/")) {
      alert("File type not supported. Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        const imageUploadedEvent = new CustomEvent("image-uploaded", {
          detail: { image },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(imageUploadedEvent);
        this.drawImage(image);
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  drawImage(image) {
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(image, 0, 0);
  }
}

customElements.define("synth-display", SynthDisplay);
