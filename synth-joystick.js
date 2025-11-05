import { ensureBoxSizing } from 'helpers/boxSizing.js';

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const easeInOutSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

export default class SynthJoystick extends HTMLElement {
  static get observedAttributes() {
    return ["min", "max"];
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
:host {
  --joystick-width: 62px;             
  --track-width: 26px;                 
  --nub-width: 28px;                  
  --nub-height: 16px;
  --accent: #ff7a2d;                 
  --accent-strong: #ff5a00;
  --panel: #0b0d11;
  --panel-hi: #1c1f25;

  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  color: inherit;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  height: 100%;
}

/* ============ PANEL / BASE ============ */
.wrapper {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.joystick-base {
  position: relative;
  width: var(--joystick-width);
  flex: 1 1 auto;
  border-radius: 16px;
  background: radial-gradient(120% 90% at 40% 35%, var(--panel-hi), var(--panel) 60%);
  box-shadow:
    inset 0 10px 22px rgba(0,0,0,.85),
    inset 0 -18px 28px rgba(0,0,0,.9),
    0 18px 34px rgba(0,0,0,.55);
  cursor: grab;
  touch-action: none;
}

/* Subtle inset border */
.joystick-base::before {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.05),
    inset 0 0 0 2px rgba(0,0,0,.6);
  pointer-events: none;
}

/* Right-side tick marks (MIN…MAX) */
.joystick-base::after {
  content: "";
  position: absolute;
  top: 10px; bottom: 10px; right: 12px; width: 18px;
  background:
    linear-gradient(#0000 22%, rgba(255,255,255,.12) 22% 24%, #0000 24%) 0 0/100% 12% repeat-y;
  pointer-events: none;
  mask:
    linear-gradient(transparent, white 10%, white 90%, transparent);
  opacity: .8;
}

/* Up / Down arrows at the left */
.joystick-base i {
  position: absolute; left: 12px; top: 50%;
  font-style: normal; color: rgba(255,255,255,.6);
  display: grid; place-items: center; gap: 4px;
  transform: translateY(-50%);
  pointer-events: none; user-select: none;
}

/* ============ HANDLE + TRACK ============ */
.joystick-handle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--track-width);
  height: calc(100% - 28px);
  display: grid;
  grid-template-rows: 1fr auto;       /* tall stem + nub */
  align-items: center;
  justify-items: center;
  transform: translate(-50%, -50%);
  transform-style: preserve-3d;
  transition: transform .1s ease-out;
  pointer-events: none;
}

.joystick-base.interacting .joystick-handle { transition: none; }

/* The recessed vertical slot with orange glow */
.joystick-handle .stem {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background:
    linear-gradient(90deg,
      #040507 0%,
      #12151b 24%,
      #191d24 50%,
      #12151b 76%,
      #040507 100%);
  box-shadow:
    inset 0 0 0 2px #000,
    inset 0 0 20px rgba(0,0,0,.9),
    0 6px 10px rgba(0,0,0,.45);
}

/* inner orange strip */
.joystick-handle .stem::before {
  content: "";
  position: absolute;
  inset: 3px;
  left: 50%;
  width: 7px;
  transform: translateX(-50%);
  border-radius: 10px;
  background:
    linear-gradient(180deg,
      rgba(255,120,40,.15) 0%,
      rgba(255,120,40,.55) 50%,
      rgba(255,120,40,.18) 100%);
  box-shadow:
    0 0 10px rgba(255,120,40,.55),
    inset 0 0 6px rgba(255,120,40,.6);
  filter: saturate(120%);
}

/* subtle rim highlights on slot edges */
.joystick-handle .stem::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background:
    linear-gradient(90deg,
      rgba(255,255,255,.09), transparent 30% 70%, rgba(255,255,255,.09));
  mix-blend-mode: screen;
  pointer-events: none;
}

/* The little horizontal nub that rides in the slot */
.joystick-handle .cap {
  position: absolute;
  left: -2px;
  /* vertically centered by the parent translateY in JS */
  width: var(--nub-width);
  height: var(--nub-height);
  border-radius: 8px;
  background: linear-gradient(#1f232b, #0c0f14);
  border: 1px solid rgba(0,0,0,.7);
  box-shadow:
    inset 0 1px 3px rgba(255,255,255,.08),
    inset 0 -3px 6px rgba(0,0,0,.7),
    0 3px 8px rgba(0,0,0,.6);
}

/* tiny top highlight to make it feel plastic */
.joystick-handle .cap::after {
  content: "";
  position: absolute;
  inset: 2px 6px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0));
}

/* Disabled & misc */
:host([data-disabled="true"]) .joystick-base {
  cursor: not-allowed; opacity: .45; filter: grayscale(.35);
}

.value-readout { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: var(--accent); }
.label { font-size: 11px; letter-spacing: .55px; text-transform: uppercase; color: rgba(255,214,190,.65); }
.actions { display: flex; gap: 10px; }
.random-button {
  font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  padding: 6px 18px; border-radius: 0;
  border: 1px solid rgba(255,122,45,.35);
  background: rgba(32,22,14,.5);
  color: rgba(255,214,190,.92); cursor: pointer;
  transition: background .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.random-button:hover   { background: rgba(46,28,16,.7); border-color: rgba(255,122,45,.55); box-shadow: 0 0 18px rgba(255,122,45,.35); }
.random-button[data-active="true"] { background: rgba(64,30,12,.8); border-color: rgba(255,122,45,.75); box-shadow: 0 0 24px rgba(255,122,45,.5); }
:host([data-disabled="true"]) .random-button { pointer-events: none; opacity: .35; box-shadow: none; }</style>
      <div class="actions">
        <button type="button" class="random-button" aria-pressed="false">Random</button>
      </div>
      <div class="wrapper">
        <div class="label"></div>
        <div class="joystick-base" role="slider" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-label="Pitch bend">
          <div class="joystick-handle">
            <div class="stem"></div>
            <div class="cap"></div>
          </div>
        </div>
        <div class="value-readout">0</div>
      </div>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.baseElement = this.shadowRoot.querySelector('.joystick-base');
    this.capElement = this.shadowRoot.querySelector('.cap');
    this.valueElement = this.shadowRoot.querySelector('.value-readout');
    this.labelElement = this.shadowRoot.querySelector('.label');
    this.randomButton = this.shadowRoot.querySelector('.random-button');

    this.name = this.getAttribute('name') || '';
    this.randomName = this.getAttribute('random-name') || this.derivePath('randomize');
    this.activeName = this.getAttribute('active-name') || this.derivePath('active');
    this.labelText = this.getAttribute('label') || 'Pitch Bend';

    this.min = parseFloat(this.getAttribute('min') ?? '-1');
    this.max = parseFloat(this.getAttribute('max') ?? '1');
    if (!Number.isFinite(this.min)) {
      this.min = -1;
    }
    if (!Number.isFinite(this.max)) {
      this.max = 1;
    }
    if (this.min > this.max) {
      [this.min, this.max] = [this.max, this.min];
    }

    this.maxAbs = Math.max(Math.abs(this.min), Math.abs(this.max)) || 1;
    this.currentValue = 0;
    this.visualValue = 0;
    this.lastEmittedValue = null;
    this.randomizeActive = false;
    this.isInteracting = false;
    this.pointerId = null;
    this.randomAnimationFrame = null;
    this.randomPhase = null;
    this.metrics = null;
  }

  connectedCallback() {
    this.labelElement.textContent = this.labelText;
    this.baseElement.setAttribute('aria-valuemin', `${Math.round(this.min)}`);
    this.baseElement.setAttribute('aria-valuemax', `${Math.round(this.max)}`);

    this.synthBrain = this.closest('synth-brain');

    const initialValue = this.readConfigValue(this.name);
    if (Number.isFinite(initialValue)) {
      this.setCurrentValue(initialValue, { emit: false, forceVisual: true });
    } else {
      this.render();
    }

    const initialRandomize = this.readConfigValue(this.randomName);
    if (typeof initialRandomize === 'boolean') {
      this.updateRandomize(initialRandomize, { emit: false });
    }

    const activeState = this.readConfigValue(this.activeName);
    if (typeof activeState === 'boolean') {
      this.updateDisabledState(!activeState);
    }

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.baseElement.addEventListener('pointerdown', this.boundPointerDown);
    this.baseElement.addEventListener('pointermove', this.boundPointerMove);
    this.baseElement.addEventListener('pointerup', this.boundPointerUp);
    this.baseElement.addEventListener('pointercancel', this.boundPointerCancel);
    this.baseElement.addEventListener('pointerleave', this.boundPointerCancel);

    this.boundConfigUpdated = this.handleConfigUpdated.bind(this);
    this.synthBrain?.addEventListener('config-updated', this.boundConfigUpdated);

    this.boundResizeObserver = new ResizeObserver(() => {
      this.metrics = null;
      this.render();
    });
    this.boundResizeObserver.observe(this.baseElement);

    this.boundRandomClick = this.handleRandomClick.bind(this);
    this.randomButton.addEventListener('click', this.boundRandomClick);
  }

  disconnectedCallback() {
    this.baseElement.removeEventListener('pointerdown', this.boundPointerDown);
    this.baseElement.removeEventListener('pointermove', this.boundPointerMove);
    this.baseElement.removeEventListener('pointerup', this.boundPointerUp);
    this.baseElement.removeEventListener('pointercancel', this.boundPointerCancel);
    this.baseElement.removeEventListener('pointerleave', this.boundPointerCancel);

    this.synthBrain?.removeEventListener('config-updated', this.boundConfigUpdated);

    if (this.boundResizeObserver) {
      this.boundResizeObserver.disconnect();
    }

    this.randomButton.removeEventListener('click', this.boundRandomClick);
    this.stopRandomMotion();
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'min' || name === 'max') {
      const parsed = parseFloat(newValue);
      if (Number.isFinite(parsed)) {
        this[name] = parsed;
        if (this.min > this.max) {
          [this.min, this.max] = [this.max, this.min];
        }
        this.maxAbs = Math.max(Math.abs(this.min), Math.abs(this.max)) || 1;
        this.metrics = null;
        this.setCurrentValue(this.currentValue, { emit: false, forceVisual: true });
      }
    }
  }

  derivePath(targetSegment) {
    if (!this.name || !this.name.includes('.')) {
      return '';
    }
    const segments = this.name.split('.');
    segments[segments.length - 1] = targetSegment;
    return segments.join('.');
  }

  readConfigValue(path) {
    if (!path || !this.synthBrain?.config) {
      return undefined;
    }
    return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), this.synthBrain.config);
  }

  emitConfigUpdate(name, value) {
    if (!name) {
      return;
    }
    const event = new CustomEvent('update-config', {
      detail: { name, value },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  handlePointerDown(event) {
    if (this.isDisabled) {
      return;
    }
    event.preventDefault();
    this.isInteracting = true;
    this.pointerId = event.pointerId;
    this.baseElement.classList.add('interacting');
    this.baseElement.setPointerCapture(event.pointerId);
    if (this.randomizeActive) {
      this.updateRandomize(false, { emit: true });
    }
    this.updateFromPointer(event, { emit: true });
  }

  handlePointerMove(event) {
    if (!this.isInteracting || event.pointerId !== this.pointerId) {
      return;
    }
    event.preventDefault();
    this.updateFromPointer(event, { emit: true });
  }

  handlePointerUp(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.finishPointerInteraction();
  }

  handlePointerCancel(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.finishPointerInteraction();
  }

  finishPointerInteraction() {
    if (!this.isInteracting) {
      return;
    }
    const pointerId = this.pointerId;
    this.isInteracting = false;
    this.pointerId = null;
    this.baseElement.classList.remove('interacting');
    if (pointerId !== null && this.baseElement.releasePointerCapture) {
      try {
        this.baseElement.releasePointerCapture(pointerId);
      } catch (_error) {
        // ignore pointer capture release errors
      }
    }
    this.setCurrentValue(0, { emit: true });
  }

  updateFromPointer(event, { emit } = { emit: false }) {
    const metrics = this.ensureMetrics();
    if (!metrics) {
      return;
    }

    const relativeY = clamp((metrics.centerY - event.clientY) / metrics.rangeY, -1, 1);
    const value = relativeY * this.maxAbs;
    this.setCurrentValue(value, { emit, forceVisual: true });
  }

  ensureMetrics() {
    if (this.metrics) {
      return this.metrics;
    }
    const baseRect = this.baseElement.getBoundingClientRect();
    if (!baseRect.height) {
      return null;
    }
    const handleRect = this.capElement.getBoundingClientRect();
    const travelY = Math.max(0, (baseRect.height - handleRect.height) / 2);
    this.metrics = {
      travelY,
      centerY: baseRect.top + baseRect.height / 2,
      rangeY: travelY > 0 ? travelY : baseRect.height / 2,
    };
    return this.metrics;
  }

  setCurrentValue(value, { emit = false, forceVisual = false } = {}) {
    const clamped = clamp(value, -this.maxAbs, this.maxAbs);
    this.currentValue = clamped;
    if (!this.randomizeActive || forceVisual) {
      this.visualValue = clamped;
      this.render();
    }
    if (emit) {
      if (this.lastEmittedValue === null || Math.abs(clamped - this.lastEmittedValue) >= 0.1) {
        this.emitConfigUpdate(this.name, clamped);
        this.lastEmittedValue = clamped;
      }
    }
    this.baseElement.setAttribute('aria-valuenow', `${Math.round(this.visualValue)}`);
  }

  setVisualValue(value) {
    const clamped = clamp(value, -this.maxAbs, this.maxAbs);
    this.visualValue = clamped;
    this.render();
    this.baseElement.setAttribute('aria-valuenow', `${Math.round(this.visualValue)}`);
  }

  render() {
    const metrics = this.ensureMetrics();
    const travel = metrics ? metrics.travelY : 0;
    const ratio = this.maxAbs ? clamp(this.visualValue / this.maxAbs, -1, 1) : 0;
    const translateY = travel * -ratio;
    const tilt = ratio * 16;
    this.capElement.style.transform = `translateY(${translateY}px) rotateX(${tilt}deg)`;
    this.valueElement.textContent = `${Math.round(this.visualValue)}`;
  }

  handleRandomClick() {
    if (this.isDisabled) {
      return;
    }
    this.updateRandomize(!this.randomizeActive, { emit: true });
  }

  updateRandomize(state, { emit } = { emit: false }) {
    if (state === this.randomizeActive) {
      return;
    }
    this.randomizeActive = state;
    this.randomButton.dataset.active = state ? 'true' : 'false';
    this.randomButton.setAttribute('aria-pressed', state ? 'true' : 'false');
    if (state) {
      this.startRandomMotion();
    } else {
      this.stopRandomMotion();
      this.setVisualValue(this.currentValue);
      this.lastEmittedValue = null;
    }
    if (emit) {
      this.emitConfigUpdate(this.randomName, state);
    }
  }

  startRandomMotion() {
    this.stopRandomMotion();
    const scheduleNextPhase = (startValue = this.visualValue) => {
      const duration = 450 + Math.random() * 600;
      const target = (Math.random() * 2 - 1) * this.maxAbs;
      this.randomPhase = {
        start: performance.now(),
        duration,
        from: startValue,
        to: target,
      };
    };

    const step = (timestamp) => {
      if (!this.randomizeActive) {
        return;
      }
      if (!this.randomPhase) {
        scheduleNextPhase();
      }
      const { start, duration, from, to } = this.randomPhase;
      const elapsed = timestamp - start;
      const progress = duration > 0 ? clamp(elapsed / duration, 0, 1) : 1;
      const eased = easeInOutSine(progress);
      const nextValue = from + (to - from) * eased;
      this.setVisualValue(nextValue);
      if (progress >= 1) {
        scheduleNextPhase(nextValue);
      }
      this.randomAnimationFrame = requestAnimationFrame(step);
    };

    this.randomAnimationFrame = requestAnimationFrame(step);
  }

  stopRandomMotion() {
    if (this.randomAnimationFrame) {
      cancelAnimationFrame(this.randomAnimationFrame);
      this.randomAnimationFrame = null;
    }
    this.randomPhase = null;
  }

  updateDisabledState(isDisabled) {
    this.isDisabled = Boolean(isDisabled);
    this.toggleAttribute('data-disabled', this.isDisabled);
    if (this.isDisabled) {
      this.stopRandomMotion();
    }
  }

  handleConfigUpdated(event) {
    const { name, value } = event.detail || {};
    if (!name) {
      return;
    }
    if (name === this.name && Number.isFinite(value)) {
      this.setCurrentValue(value, { emit: false, forceVisual: !this.randomizeActive });
    }
    if (name === this.randomName) {
      this.updateRandomize(Boolean(value), { emit: false });
    }
    if (name === this.activeName) {
      this.updateDisabledState(!value);
    }
  }
}

customElements.define('synth-joystick', SynthJoystick);
