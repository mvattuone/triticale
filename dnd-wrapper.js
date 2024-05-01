export default class DndWrapper extends HTMLElement {
  constructor() {
    super(); 
    this.attachShadow({ mode: "open" }); 
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
                .dropzone {
                    text-align: center;
                }
                .dropzone.dropping {
                    background-color: #efefef;
                }

          
            </style>
            <div class="dropzone">
                <slot></slot>
            </div>
        `;

    const dropzone = this.shadowRoot.querySelector(".dropzone");
    dropzone.ondragover = this.handleDragOver.bind(this);
    dropzone.ondragleave = this.handleDragLeave.bind(this);
    dropzone.ondrop = this.handleDrop.bind(this);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy"; 
    this.shadowRoot.querySelector(".dropzone").classList.add("dropping");
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("dropping");
  }

  handleDrop(e) {
    e.preventDefault();
    this.shadowRoot.querySelector(".dropzone").classList.remove("dropping");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
       this.shadowRoot.querySelector('slot').assignedElements()[0].dispatchEvent(new CustomEvent('drop-success', {
         detail: { file: files[0] },
      bubbles: true,
      composed: true
  }));
    }
  }
}

customElements.define("dnd-wrapper", DndWrapper);
