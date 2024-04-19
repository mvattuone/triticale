export default class ImageUploader extends HTMLElement {
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
                    background-color: #f0f0f0;
                }
            </style>
            <div class="dropzone">
                <p>Drop image file here to upload</p>
            </div>
        `;

    const dropzone = this.shadowRoot.querySelector(".dropzone");
    dropzone.ondragover = this.handleDragOver;
    dropzone.ondragleave = this.handleDragLeave;
    dropzone.ondrop = this.handleDrop;
  }

  handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    this.shadowRoot.querySelector(".dropzone").classList.add("hover");
    this.shadowRoot.querySelector(".dropzone p").textContent =
      "Release to upload image";
  };

  handleDragLeave = (e) => {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("hover");
    this.shadowRoot.querySelector(".dropzone p").textContent =
      "Drop image file here to upload";
  };

  handleDrop = (e) => {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("hover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  };

  handleFileUpload = (file) => {
    if (!file.type.startsWith("image/")) {
      alert("File type not supported. Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
    };
    reader.readAsDataURL(file);
  };
}

customElements.define("image-uploader", ImageUploader);
