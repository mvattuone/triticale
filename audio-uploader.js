export default class AudioUploader extends HTMLElement {
  constructor() {
    super(); // Always call super first in constructor
    this.attachShadow({ mode: "open" }); // Attach a shadow root to the element.
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
                .dropzone {
                    border: 2px dashed #ccc;
                    border-radius: 5px;
                    padding: 20px;
                    text-align: center;
                    transition: background-color 0.3s;
                }
                .dropzone.hover {
                    background-color: #efefef;
                }
            </style>
            <div class="dropzone">
                <p>Drop audio file here to upload</p>
            </div>
        `;

    const dropzone = this.shadowRoot.querySelector(".dropzone");
    dropzone.ondragover = this.handleDragOver.bind(this);
    dropzone.ondragleave = this.handleDragLeave.bind(this);
    dropzone.ondrop = this.handleDrop.bind(this);
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
    this.shadowRoot.querySelector(".dropzone").classList.add("hover");
    this.shadowRoot.querySelector(".dropzone p").textContent = `Upload ${
      e.dataTransfer.items[0].type.split("/")[0]
    }`;
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("hover");
    this.shadowRoot.querySelector(".dropzone p").textContent =
      "Drop audio file here to upload";
  }

  handleDrop(e) {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("hover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  }

  handleFileUpload(file) {
    if (!file.type.startsWith("audio/")) {
      alert("File type not supported. Please upload an audio file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.audioCtx.decodeAudioData(
        reader.result,
        (buffer) => {
        },
        (error) => {
          console.error("Error decoding audio file:", error);
        },
      );
    };
    reader.readAsArrayBuffer(file);
  }
}

customElements.define("audio-uploader", AudioUploader);
