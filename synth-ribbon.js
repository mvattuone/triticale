import { ensureBoxSizing } from 'helpers/boxSizing.js';

const DEFAULT_SEGMENTS = 1;

export default class SynthRibbon extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
          color: #f5f8f6;
        }

        .container {
          justify-content: center;
          display: flex;
          height: 100%;
          flex-direction: column;
          gap: 8px;
        }

        .ribbon {
          position: relative;
          width: 100%;
          height: 100px;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(26, 34, 40, 0.95), rgba(14, 18, 22, 0.95));
          box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.55),
            0 6px 10px rgba(0, 0, 0, 0.35);
          overflow: hidden;
          cursor: pointer;
          touch-action: none;
        }

        .ribbon::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.3;
          background-image: repeating-linear-gradient(
            to right,
            rgba(96, 255, 184, 0.22) 0,
            rgba(96, 255, 184, 0.22) 2px,
            transparent 2px,
            transparent calc(100% / var(--segments, 1))
          );
        }

        .indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          width: calc(100% / var(--segments, 1));
          transform: translate3d(calc(var(--indicator-index, 0) * 100%), 0, 0);
          will-change: transform;
          background: linear-gradient(180deg, rgba(60, 255, 174, 0.95), rgba(42, 215, 247, 0.8));
          box-shadow:
            inset 0 0 10px rgba(15, 255, 200, 0.45),
            0 0 18px rgba(80, 255, 180, 0.55),
            0 0 34px rgba(80, 255, 180, 0.25);
          pointer-events: none;
          transition:
            transform 0.08s ease-out,
            width 0.08s ease-out;
        }

        :host([data-dragging="true"]) .indicator {
          transition: none;
        }

        :host([data-empty="true"]) .ribbon {
          cursor: default;
        }

        :host([data-empty="true"]) .ribbon::after,
        :host([data-empty="true"]) .indicator {
          opacity: 0;
          display: none;
        }

        :host([data-empty="true"]) .value {
          color: rgba(200, 255, 230, 0.45);
        }

        .info {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(200, 255, 230, 0.75);
        }

        .value {
          font-size: 11px;
          letter-spacing: 0.08em;
          color: rgba(200, 255, 230, 0.85);
        }
      </style>
      <div class="container">
        <div class="ribbon" role="slider" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1" aria-label="Grain Position">
          <div class="indicator"></div>
        </div>
        <div class="info">
          <span>Position</span>
          <span class="value">1 / 1</span>
        </div>
      </div>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.ribbon = this.shadowRoot.querySelector('.ribbon');
    this.indicator = this.shadowRoot.querySelector('.indicator');
    this.valueDisplay = this.shadowRoot.querySelector('.value');
    this.segments = DEFAULT_SEGMENTS;
    this.currentIndex = 1; // 1-based
    this.active = false;
    this.pointerId = null;
    this.synthBrain = null;
    this.hasGrains = false;
    this.suppressExternalUpdates = false;
    this.pendingExternalIndex = null;
    this.externalSyncHandle = null;
  }

  connectedCallback() {
    this.synthBrain = this.closest('synth-brain');
    const initialIndex = this.synthBrain && this.synthBrain.config
      ? Math.max(1, Math.round(this.synthBrain.config.grainIndex || 1))
      : this.currentIndex;
    const hasAudio = this.synthBrain && Array.isArray(this.synthBrain.audioGrains)
      ? this.synthBrain.audioGrains.length > 0
      : false;
    const initialSegments = hasAudio && this.synthBrain && typeof this.synthBrain.getMaxGrainIndex === 'function'
      ? this.synthBrain.getMaxGrainIndex()
      : 0;
    this.currentIndex = initialIndex;
    this.updateSegments(initialSegments);

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);

    this.addEventListener("draw-grain", this.handleDrawGrain);

    this.ribbon.addEventListener('pointerdown', this.boundPointerDown);
    this.ribbon.addEventListener('pointermove', this.boundPointerMove);
    this.ribbon.addEventListener('pointerup', this.boundPointerUp);
    this.ribbon.addEventListener('pointercancel', this.boundPointerLeave);
    this.ribbon.addEventListener('pointerleave', this.boundPointerLeave);

    if (this.synthBrain) {
      this.boundConfigUpdated = this.handleConfigUpdated.bind(this);
      this.boundGrainCountChanged = this.handleGrainCountChanged.bind(this);
      this.synthBrain.addEventListener('config-updated', this.boundConfigUpdated);
      this.synthBrain.addEventListener('grain-count-changed', this.boundGrainCountChanged);
    }
  }

  disconnectedCallback() {
    this.ribbon.removeEventListener('pointerdown', this.boundPointerDown);
    this.ribbon.removeEventListener('pointermove', this.boundPointerMove);
    this.ribbon.removeEventListener('pointerup', this.boundPointerUp);
    this.ribbon.removeEventListener('pointercancel', this.boundPointerLeave);
    this.ribbon.removeEventListener('pointerleave', this.boundPointerLeave);
    this.ribbon.removeEventListener("draw-grain", this.handleDrawGrain);

    if (this.synthBrain) {
      this.synthBrain.removeEventListener('config-updated', this.boundConfigUpdated);
      this.synthBrain.removeEventListener('grain-count-changed', this.boundGrainCountChanged);
    }

    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
      this.externalSyncHandle = null;
    }
  }

  handleDrawGrain(e) {
    if (!this.hasGrains) {
      return;
    }
    const { grainIndex = 0 } = e.detail;
    this.handleExternalIndex(grainIndex);
  }

  handlePointerDown(event) {
    event.preventDefault();
    if (!this.hasGrains) {
      return;
    }
    if (this.synthBrain && typeof this.synthBrain.beginRibbonInteraction === 'function') {
      this.synthBrain.beginRibbonInteraction();
    }
    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
      this.externalSyncHandle = null;
    }
    this.ribbon.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    this.active = true;
    this.suppressExternalUpdates = true;
    this.pendingExternalIndex = null;
    this.setAttribute('data-dragging', 'true');
    this.updateFromEvent(event);
  }

  handlePointerMove(event) {
    if (!this.active || event.pointerId !== this.pointerId || !this.hasGrains) {
      return;
    }
    this.updateFromEvent(event);
  }

  handlePointerUp(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.finishInteraction();
  }

  handlePointerLeave(event) {
    if (!this.active || event.pointerId !== this.pointerId) {
      return;
    }
    this.finishInteraction({ cancel: true });
  }

  updateFromEvent(event) {
    if (!this.hasGrains) {
      return;
    }
    const rect = this.ribbon.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      this.finishInteraction({ cancel: true });
      return;
    }

    const segments = Math.max(DEFAULT_SEGMENTS, this.segments);
    const segmentWidth = rect.width / segments;
    const index = Math.min(
      segments - 1,
      Math.max(0, Math.floor(x / segmentWidth))
    );

    this.setIndex(index);
  }

  finishInteraction({ cancel = false } = {}) {
    if (this.pointerId !== null) {
      try {
        this.ribbon.releasePointerCapture(this.pointerId);
      } catch (err) {
        // ignore
      }
    }
    this.pointerId = null;
    if (this.active && this.synthBrain && typeof this.synthBrain.endRibbonInteraction === 'function') {
      this.synthBrain.endRibbonInteraction();
    }
    this.active = false;
    this.removeAttribute('data-dragging');
    this.scheduleExternalSync();
  }

  setIndex(index) {
    if (!this.hasGrains) {
      return;
    }
    const segments = Math.max(1, this.segments);
    const clamped = Math.max(0, Math.min(index, segments));
    this.currentIndex = clamped;
    this.updateIndicator(this.currentIndex);
    this.updateValueDisplay();
    this.sendConfigUpdate(clamped);
  }

  updateSegments(segments) {
    const numericSegments = Number.isFinite(segments) ? segments : 0;
    this.hasGrains = numericSegments > 0;
    this.segments = this.hasGrains ? Math.max(1, Math.round(numericSegments)) : 0;
    const cssSegments = this.hasGrains ? this.segments : 1;
    this.ribbon.style.setProperty('--segments', cssSegments);
    this.toggleAttribute('data-empty', !this.hasGrains);
    if (this.hasGrains) {
      this.ribbon.setAttribute('aria-valuemax', String(this.segments));
      this.ribbon.setAttribute('aria-valuemin', '1');
      this.ribbon.removeAttribute('aria-disabled');
      this.currentIndex = Math.max(1, Math.min(this.currentIndex, this.segments));
      this.updateIndicator(this.currentIndex - 1);
    } else {
      this.ribbon.setAttribute('aria-valuemax', '0');
      this.ribbon.setAttribute('aria-valuemin', '0');
      this.ribbon.setAttribute('aria-disabled', 'true');
      this.currentIndex = 1;
      this.updateIndicator(null);
    }
    this.updateValueDisplay();
  }

  updateIndicator(index) {
    if (!this.hasGrains || typeof index !== 'number') {
      this.indicator.style.display = 'none';
      this.ribbon.style.removeProperty('--indicator-index');
      this.ribbon.setAttribute('aria-valuenow', '0');
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, this.segments - 1));
    this.indicator.style.display = '';
    this.ribbon.style.setProperty('--indicator-index', clampedIndex);
    this.ribbon.setAttribute('aria-valuenow', String(clampedIndex));
  }

  updateValueDisplay() {
    if (!this.hasGrains) {
      this.valueDisplay.textContent = '--';
      return;
    }
    this.valueDisplay.textContent = `${this.currentIndex + 1} / ${this.segments}`;
  }

  sendConfigUpdate(index) {
    const updateConfigEvent = new CustomEvent('update-config', {
      detail: { name: 'grainIndex', value: index },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(updateConfigEvent);
  }

  handleConfigUpdated(event) {
    const { name, value } = event.detail;
    if (name !== 'grainIndex') {
      return;
    }
    if (!this.hasGrains) {
      this.updateIndicator(null);
      this.updateValueDisplay();
      return;
    }
    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return;
    }
    const clamped = Math.max(1, Math.min(Math.round(numericValue), this.segments));
    this.handleExternalIndex(clamped - 1);
  }

  handleGrainCountChanged(event) {
    const { audio, image, total } = event.detail || {};

    if (typeof audio === 'number' && audio > 0) {
      this.updateSegments(audio);
      return;
    }

    if (typeof image === 'number' && image > 0) {
      this.updateSegments(image);
      return;
    }

    if (typeof total === 'number') {
      this.updateSegments(total);
      return;
    }

    this.updateSegments(0);
  }

  isPlaybackActive() {
    return Boolean(this.synthBrain && this.synthBrain.isPlaying);
  }

  handleExternalIndex(index) {
    if (!this.hasGrains || typeof index !== 'number') {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(Math.round(index), this.segments - 1));
    if (this.suppressExternalUpdates) {
      this.pendingExternalIndex = clampedIndex;
      return;
    }
    this.applyExternalIndex(clampedIndex);
  }

  applyExternalIndex(clampedIndex) {
    this.pendingExternalIndex = null;
    this.updateIndicator(this.currentIndex);
    this.currentIndex = clampedIndex;
    this.updateValueDisplay();
  }

  scheduleExternalSync() {
    if (!this.hasGrains) {
      this.suppressExternalUpdates = false;
      this.pendingExternalIndex = null;
      return;
    }
    this.suppressExternalUpdates = true;
    if (this.externalSyncHandle !== null) {
      cancelAnimationFrame(this.externalSyncHandle);
    }
    this.externalSyncHandle = requestAnimationFrame(() => {
      this.externalSyncHandle = null;
      this.suppressExternalUpdates = false;
      if (typeof this.pendingExternalIndex === 'number') {
        this.applyExternalIndex(this.pendingExternalIndex);
      }
    });
  }
}

customElements.define('synth-ribbon', SynthRibbon);
