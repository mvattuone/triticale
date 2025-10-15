class SynthDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                .bezel {
                  border-radius: 30px;
                  padding: 48px;
                  background:
                    radial-gradient(circle at 18% 20%, rgba(90, 100, 115, 0.45), transparent 55%),
                    radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.6), transparent 60%),
                    linear-gradient(145deg, #2f3540, #12161d);
                  box-shadow:
                    inset 10px 14px 18px rgba(0, 0, 0, 0.7),
                    inset -8px -10px 16px rgba(45, 50, 60, 0.85),
                    0 18px 40px rgba(0, 0, 0, 0.55);
                }

                .display {
                  position: relative;
                  height: 100%;
                  width: 100%;
                  border-radius: 12px;
                  overflow: hidden;
                  background: #040608;
                  box-shadow:
                    inset 0 1px 1px rgba(255, 255, 255, 0.08),
                    inset 0 -1px 2px rgba(0, 0, 0, 0.55);
                }

                .random-trigger {
                  position: absolute;
                  inset: 1rem auto auto 1rem;
                  z-index: 4;
                  padding: 0.4rem 0.65rem;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #efefef, #bcbcbc);
                  cursor: pointer;
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.12em;
                  box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                    0 2px 6px rgba(0, 0, 0, 0.35);
                }

                .control-buttons {
                  position: absolute;
                  inset: 1rem 1rem auto auto;
                  z-index: 4;
                  display: flex;
                  gap: 0.5rem;
                  opacity: 0;
                  pointer-events: none;
                  transition: opacity 0.2s ease;
                }

                .display.has-image:hover .control-buttons {
                  opacity: 1;
                  pointer-events: auto;
                }

                .control-buttons button {
                  padding: 0.35rem 0.55rem;
                  border-radius: 999px;
                  border: 1px solid #0e1116;
                  background: linear-gradient(145deg, #efefef, #bcbcbc);
                  cursor: pointer;
                  font-size: 11px;
                }

                canvas {
                  display: block;
                  height: 100%;
                  width: 100%;
                  image-rendering: pixelated;
                }

                .display-canvas {
                  border-radius: 14px;
                  transform: perspective(1200px) rotateX(4deg) scaleY(0.995);
                  box-shadow:
                    inset 0 0 40px rgba(0, 0, 0, 0.35);
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
                    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08), transparent 46%),
                    radial-gradient(circle at 70% 22%, rgba(255, 255, 255, 0.05), transparent 48%),
                    radial-gradient(circle at 50% 125%, rgba(0, 0, 0, 0.45), transparent 60%);
                  mix-blend-mode: screen;
                  opacity: 0.55;
                  filter: blur(0.2px);
                }

                .vignette {
                  pointer-events: none;
                  position: absolute;
                  inset: 0;
                  border-radius: 14px;
                  background: radial-gradient(circle at center, transparent 60%, rgba(0, 0, 0, 0.65));
                  mix-blend-mode: multiply;
                }

                p {
                  position: absolute;
                  transform: translate(-50%, -50%);
                  left: 50%;
                  top: 50%;
                  margin: 0;
                  color: rgba(255, 255, 255, 0.8);
                  text-transform: uppercase;
                  letter-spacing: 0.18em;
                  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
                  font-size: 13px;
                }


            </style>
                <div class="bezel">
                  <dnd-wrapper>
                  <div class="display">
                    <button class="random-trigger" type="button">Random image</button>
                    <div class="control-buttons">
                      <button class="refresh" type="button" aria-label="Load new random image">R</button>
                      <button class="remove" type="button" aria-label="Remove image">X</button>
                    </div>
                    <canvas class="display-canvas"></canvas>
                    <canvas class="crt-overlay"></canvas>
                    <div class="overlay-curvature"></div>
                    <div class="vignette"></div>
                    <p>Drop image here</p>
                  </div>
                  </dnd-wrapper>
              </div>
        `;
    this.displayContainer = this.shadowRoot.querySelector(".display");
    this.canvas = this.shadowRoot.querySelector(".display-canvas");
    this.context = this.canvas.getContext("2d");
    this.overlayCanvas = this.shadowRoot.querySelector(".crt-overlay");
    this.overlayContext = this.overlayCanvas.getContext("2d");
    this.dropMessage = this.shadowRoot.querySelector("p");
    this.randomImageButton = this.shadowRoot.querySelector(".random-trigger");
    this.imageControlButtons = this.shadowRoot.querySelector(".control-buttons");
    this.resetImageButton = this.shadowRoot.querySelector(".control-buttons .refresh");
    this.removeImageButton = this.shadowRoot.querySelector(".control-buttons .remove");
    this.randomImageButtonLabel = this.randomImageButton?.textContent || "Random image";
    this.image = null;
    this.animationFrameId = null;
    this.scanlineSource = this.createScanlineCanvas();
    this.noiseCanvas = null;
    this.noiseContext = null;
    this.noiseImageData = null;
  }

  connectedCallback() {
    this.addEventListener("drop-success", this.handleImageUploaded, true);
    this.addEventListener("update-image", this.handleUpdateImage, true);
    if (this.randomImageButton) {
      this.randomImageButton.addEventListener("click", this.handleRandomImageClick);
      this.randomImageButtonLabel = this.randomImageButton.textContent;
    }
    if (this.resetImageButton) {
      this.resetImageButton.addEventListener("click", this.handleResetImageClick);
    }
    if (this.removeImageButton) {
      this.removeImageButton.addEventListener("click", this.handleRemoveImageClick);
    }
  }

  disconnectedCallback() {
    this.removeEventListener("drop-success", this.handleImageUploaded, true);
    this.removeEventListener("update-image", this.handleUpdateImage, true);
    if (this.randomImageButton) {
      this.randomImageButton.removeEventListener("click", this.handleRandomImageClick);
    }
    if (this.resetImageButton) {
      this.resetImageButton.removeEventListener("click", this.handleResetImageClick);
    }
    if (this.removeImageButton) {
      this.removeImageButton.removeEventListener("click", this.handleRemoveImageClick);
    }
    this.stopCRTLoop();
  }

  handleImageUploaded = (event) => {
    const { file } = event.detail;

    if (!file.type.startsWith("image/")) {
      alert("File type not supported. Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      this.loadImageFromSource(event.target.result, {
        emitUploadEvent: true,
        updateFavicon: true,
      });
    };
    reader.readAsDataURL(file);
  };

  handleUpdateImage = (event) => {
    const { detail } = event;
    if (detail instanceof HTMLImageElement) {
      this.drawImage(detail);
    }
  };

  handleRandomImageClick = () => {
    if (!this.randomImageButton) {
      return;
    }

    const button = this.randomImageButton;
    button.disabled = true;
    button.textContent = "Loading image...";
    this.setImageControlsDisabled(true);

    const { width, height } = this.canvas.getBoundingClientRect();
    const imageWidth = Math.max(1, Math.round(width || this.canvas.width || this.clientWidth || 800));
    const imageHeight = Math.max(1, Math.round(height || this.canvas.height || this.clientHeight || 450));
    const randomImageUrl = `https://picsum.photos/${imageWidth}/${imageHeight}?random=${Date.now()}`;

    this.loadImageFromSource(randomImageUrl, {
      emitUploadEvent: true,
      updateFavicon: true,
      onError: () => {
        button.disabled = false;
        button.textContent = this.randomImageButtonLabel;
        this.setImageControlsDisabled(false);
        alert("Could not load a random image. Please try again.");
      },
    });
  };

  loadImageFromSource(src, { emitUploadEvent = false, updateFavicon = false, onError } = {}) {
    const { width, height } = this.canvas.getBoundingClientRect();
    const imageWidth = Math.max(1, Math.round(width || this.canvas.width || this.clientWidth || 800));
    const imageHeight = Math.max(1, Math.round(height || this.canvas.height || this.clientHeight || 450));
    const image = new Image(imageWidth, imageHeight);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      this.handleImageReady(image, { emitUploadEvent, updateFavicon });
    };
    image.onerror = () => {
      if (typeof onError === "function") {
        onError();
      }
    };
    image.src = src;
  }

  handleImageReady(image, { emitUploadEvent = false, updateFavicon = false } = {}) {
    if (emitUploadEvent) {
      const imageUploadedEvent = new CustomEvent("image-uploaded", {
        detail: { image },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(imageUploadedEvent);
    }

    if (updateFavicon) {
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.setAttribute('href', image.src);
      }
    }

    this.drawImage(image);

    if (this.randomImageButton) {
      this.randomImageButton.disabled = false;
      this.randomImageButton.textContent = this.randomImageButtonLabel;
    }
    this.setImageControlsDisabled(false);
  }

  hideRandomImageButton() {
    if (this.randomImageButton) {
      this.randomImageButton.style.display = "none";
    }
  }

  showRandomImageButton() {
    if (this.randomImageButton) {
      this.randomImageButton.style.display = "block";
      this.randomImageButton.disabled = false;
      this.randomImageButton.textContent = this.randomImageButtonLabel;
    }
  }

  setImageControlsDisabled(disabled) {
    if (this.resetImageButton) {
      this.resetImageButton.disabled = disabled;
    }
    if (this.removeImageButton) {
      this.removeImageButton.disabled = disabled;
    }
  }

  handleResetImageClick = () => {
    this.setImageControlsDisabled(true);
    this.handleRandomImageClick();
  };

  handleRemoveImageClick = () => {
    this.clearImage();
    const imageClearedEvent = new CustomEvent("image-cleared", {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(imageClearedEvent);
  };

  clearImage() {
    this.stopCRTLoop();
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.width = this.canvas.width;
      this.canvas.height = this.canvas.height;
    }
    if (this.overlayContext && this.overlayCanvas) {
      this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
      this.overlayCanvas.width = this.overlayCanvas.width;
      this.overlayCanvas.height = this.overlayCanvas.height;
    }
    this.image = null;
    this.displayContainer?.classList.remove("has-image");
    this.showRandomImageButton();
    this.setImageControlsDisabled(false);
    this.showDropMessage();
  }

  showDropMessage() {
    if (this.dropMessage) {
      this.dropMessage.style.display = "";
    }
  }

  drawImage(image) {
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.image = image;
    this.context.imageSmoothingEnabled = false;
    this.context.imageSmoothingQuality = "low";
    if (this.dropMessage) {
      this.dropMessage.style.display = "none";
    }
    this.displayContainer?.classList.add("has-image");
    this.hideRandomImageButton();
    this.syncOverlaySize();
    this.startCRTLoop();
    this.context.drawImage(image, 0, 0);
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
      const flickerAmount = 0.02 + Math.random() * 0.04;
      this.overlayContext.fillStyle = `rgba(0, 0, 0, ${flickerAmount})`;
      this.overlayContext.fillRect(0, 0, width, height);

      this.drawRGBBleed(time);
      this.drawScanlines(width, height);
      this.drawNoise(width, height);
      this.drawVignette(width, height);

      this.animationFrameId = requestAnimationFrame(renderFrame);
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  stopCRTLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
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

  drawRGBBleed(time = 0) {
    if (!this.overlayContext) {
      return;
    }
    const { width, height } = this.canvas;
    const shift = Math.sin(time * 0.006) * 1.5;

    this.overlayContext.save();
    this.overlayContext.globalCompositeOperation = "screen";
    this.overlayContext.globalAlpha = 0.18;

    this.overlayContext.filter = `drop-shadow(${shift}px 0 0 rgba(255, 0, 120, 0.9))`;
    this.overlayContext.drawImage(this.canvas, 0, 0, width, height);

    this.overlayContext.filter = `drop-shadow(${-shift}px 0 0 rgba(0, 220, 255, 0.85))`;
    this.overlayContext.drawImage(this.canvas, 0, 0, width, height);

    this.overlayContext.restore();
    this.overlayContext.filter = "none";
    this.overlayContext.globalCompositeOperation = "source-over";
  }

  createScanlineCanvas() {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = 1;
    scanCanvas.height = 2;
    const scanContext = scanCanvas.getContext("2d");
    scanContext.fillStyle = "rgba(0, 0, 0, 0.25)";
    scanContext.fillRect(0, 0, 1, 1);
    scanContext.fillStyle = "rgba(0, 0, 0, 0)";
    scanContext.fillRect(0, 1, 1, 1);
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
    this.overlayContext.globalAlpha = 0.35;
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
        this.noiseCanvas.height
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
      data[i] = shade;
      data[i + 1] = shade;
      data[i + 2] = shade;
      data[i + 3] = 40 + Math.random() * 40;
    }
    this.noiseContext.putImageData(this.noiseImageData, 0, 0);

    const pattern = this.overlayContext.createPattern(this.noiseCanvas, "repeat");
    if (!pattern) {
      return;
    }

    this.overlayContext.save();
    this.overlayContext.globalAlpha = 0.1;
    this.overlayContext.fillStyle = pattern;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }

  drawVignette(width, height) {
    if (!this.overlayContext) {
      return;
    }
    const gradient = this.overlayContext.createRadialGradient(
      width / 2,
      height / 2,
      Math.max(width, height) * 0.1,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    this.overlayContext.save();
    this.overlayContext.fillStyle = gradient;
    this.overlayContext.fillRect(0, 0, width, height);
    this.overlayContext.restore();
  }
}

customElements.define("synth-display", SynthDisplay);
