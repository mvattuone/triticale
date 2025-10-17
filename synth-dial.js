import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class SynthDial extends HTMLElement {
  static observedAttributes = ["min", "max", "value"];
  
  constructor() {
    super();
    const inputName = this.getAttribute("name");
    const min = parseFloat(this.getAttribute("min") || "0");
    const max = parseFloat(this.getAttribute("max") || "100");
    const label = this.getAttribute("label") || "";
    const stepAttr = this.getAttribute("step");
    const step = parseFloat(stepAttr || "1");
    const stepPrecision = stepAttr && stepAttr.includes(".")
      ? stepAttr.split(".")[1].length
      : 0;
    const config = document.querySelector("synth-brain")?.config;
    
    let value;
    if (config && inputName.includes(".")) {
      const [groupKey, effectKey, valueKey] = inputName.split(".");
      value = config[groupKey][effectKey][valueKey] || min;
    } else if (config) {
      value = config[inputName] || min;
    } else {
      value = parseFloat(this.getAttribute("value") || min);
    }
    
    value = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(value)) {
      value = min;
    }

    const formatAttr = this.getAttribute("format");
    this.percentMode = formatAttr && formatAttr.toLowerCase() === "percent";

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          align-items: center;
          display: inline-flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .dial-container {
          position: relative;
          width: 60px;
          height: 60px;
          cursor: pointer;
          user-select: none;
        }
        
        .dial-background {
          width: 100%;
          height: 100%;
          background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
          border-radius: 50%;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.5),
            inset -2px -2px 4px rgba(60, 60, 60, 0.3),
            2px 2px 6px rgba(0, 0, 0, 0.3);
          position: relative;
        }
        
        .dial-ticks {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
        }
        
        .tick {
          position: absolute;
          width: 2px;
          height: 6px;
          background: rgba(255, 255, 255, 0.3);
          left: 50%;
          top: 4px;
          transform-origin: 50% 26px;
          margin-left: -1px;
        }
        
        .tick.major {
          height: 8px;
          width: 2px;
          background: rgba(255, 255, 255, 0.5);
        }
        
        .dial-indicator {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          transition: transform 0.1s ease-out;
        }
        
        .indicator-line {
          position: absolute;
          width: 3px;
          height: 20px;
          background: white;
          left: 50%;
          top: 8px;
          margin-left: -1.5px;
          border-radius: 2px;
          box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
        }
        
        .dial-center {
          position: absolute;
          width: 40px;
          height: 40px;
          background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.4),
            inset 1px 1px 2px rgba(80, 80, 80, 0.3);
        }
        
        .value-input {
          font-family: monospace;
          font-size: 13px;
          color: #fff;
          text-align: center;
          min-width: 60px;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 4px;
          padding: 2px 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
        }
        .value-input:focus {
          outline: none;
          border-color: rgba(102, 220, 255, 0.8);
          box-shadow: 0 0 4px rgba(102, 220, 255, 0.6);
        }
        .value-input::-webkit-outer-spin-button,
        .value-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .value-input[type="number"] {
          -moz-appearance: textfield;
        }

        .label {
          font-family: sans-serif;
          font-size: 11px;
          color: #ccc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      </style>
      
      <div class="dial-container">
        <div class="dial-background">
          <div class="dial-ticks"></div>
          <div class="dial-indicator">
            <div class="indicator-line"></div>
          </div>
          <div class="dial-center"></div>
        </div>
      </div>
      <input class="value-input" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
      <label class="label">${label}</label>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.startAngle = -140;
    this.endAngle = 140;
    this.rotationRangeRadians = (this.endAngle - this.startAngle) * (Math.PI / 180);

    const dragAttr = this.getAttribute('drag-sensitivity');
    const parsedDrag = dragAttr !== null ? parseFloat(dragAttr) : NaN;
    this.dragSensitivity = Number.isFinite(parsedDrag) && parsedDrag > 0 ? parsedDrag : 1.2;

    this.min = min;
    this.max = max;
    this.step = step;
    this.stepPrecision = stepPrecision;
    this.displayMode = this.percentMode
      ? "number"
      : formatAttr
        ? formatAttr.toLowerCase()
        : "number";
    this.value = value;
    this.continuousValue = value;
    this.inputName = inputName;

    this.dialContainer = this.shadowRoot.querySelector('.dial-container');
    this.dialIndicator = this.shadowRoot.querySelector('.dial-indicator');
    this.valueInput = this.shadowRoot.querySelector('.value-input');
    this.ticksContainer = this.shadowRoot.querySelector('.dial-ticks');

    this.isDragging = false;
    this.startY = 0;
    this.startValue = 0;

    if (this.percentMode) {
      this.valueInput.setAttribute('inputmode', 'decimal');
      this.valueInput.setAttribute('pattern', '[0-9]*\\.?[0-9]*');
      this.valueInput.setAttribute('placeholder', '0.0');
    }

    this.createTicks();
    this.updateRotation();

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleConfigUpdated = this.handleConfigUpdated.bind(this);
    this.handleValueInputChange = this.handleValueInputChange.bind(this);
    this.handleValueInputKeyDown = this.handleValueInputKeyDown.bind(this);
    this.handleValueInputFocus = this.handleValueInputFocus.bind(this);
  }
  
  createTicks() {
    const totalTicks = 21;
    const angleRange = this.endAngle - this.startAngle;
    
    for (let i = 0; i < totalTicks; i++) {
      const tick = document.createElement('div');
      const angle = this.startAngle + (angleRange * i / (totalTicks - 1));
      const isMajor = i % 5 === 0;
      
      tick.className = isMajor ? 'tick major' : 'tick';
      tick.style.transform = `rotate(${angle}deg)`;
      this.ticksContainer.appendChild(tick);
    }
  }
  
  valueToAngle(value) {
    const normalized = (value - this.min) / (this.max - this.min);
    return this.startAngle + normalized * (this.endAngle - this.startAngle);
  }
  
  updateRotation() {
    const angle = this.valueToAngle(this.value);
    this.dialIndicator.style.transform = `rotate(${angle}deg)`;
    if (this.valueInput) {
      this.valueInput.value = this.formatValue(this.value);
    }
  }

  formatValue(value) {
    if (this.displayMode === "percent") {
      const numeric = Number(value) * 100;
      if (Number.isNaN(numeric)) {
        return "0%";
      }
      const rounded = Number.isInteger(numeric)
        ? String(Math.round(numeric))
        : Number(numeric.toFixed(2))
            .toString()
            .replace(/\.0+$/, "")
            .replace(/(\.\d*?)0+$/, "$1");
      return `${rounded}%`;
    }

    const decimals = Math.max(this.stepPrecision, value % 1 === 0 ? 0 : 2);
    return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  handleConfigUpdated(event) {
    const { name, value } = event.detail;
    if (name !== this.inputName) {
      return;
    }
    const numericValue = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return;
    }
    this.commitValueChange(numericValue, false);
  }

  commitValueChange(rawValue, emit = true) {
    let numericValue;
    if (this.percentMode) {
      if (typeof rawValue === "number") {
        numericValue = rawValue;
      } else {
        const cleaned = String(rawValue).trim().replace(/%/g, "");
        numericValue = parseFloat(cleaned);
        if (Number.isNaN(numericValue)) {
          if (this.valueInput) {
            this.valueInput.value = this.formatValue(this.value);
          }
          return;
        }
      }
    } else {
      numericValue = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);
    }
    if (Number.isNaN(numericValue)) {
      if (this.valueInput) {
        this.valueInput.value = this.formatValue(this.value);
      }
      return;
    }

    numericValue = Math.max(this.min, Math.min(this.max, numericValue));
    this.continuousValue = numericValue;

    let quantizedValue = numericValue;
    if (this.step > 0) {
      quantizedValue = Math.round((numericValue - this.min) / this.step) * this.step + this.min;
    }

    const precision = Math.max(this.stepPrecision, 4);
    quantizedValue = parseFloat(quantizedValue.toFixed(precision));
    quantizedValue = Math.max(this.min, Math.min(this.max, quantizedValue));

    if (quantizedValue === this.value) {
      this.updateRotation();
      return;
    }

    this.value = quantizedValue;
    this.updateRotation();

    if (emit) {
      this.dispatchChangeEvent();
    }
  }

  handleValueInputChange() {
    this.commitValueChange(this.valueInput.value, true);
  }

  handleValueInputKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.commitValueChange(this.valueInput.value, true);
      this.valueInput.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.valueInput.value = this.formatValue(this.value);
      this.valueInput.blur();
    }
  }

  handleValueInputFocus(event) {
    event.target.select();
  }
  
  handleMouseDown(e) {
    e.preventDefault();
    this.isDragging = true;
    
    const rect = this.dialContainer.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    
    this.previousAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);
    this.continuousValue = this.value;
    
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }
  
  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    const currentAngle = Math.atan2(e.clientY - this.centerY, e.clientX - this.centerX);
    let angleDelta = currentAngle - this.previousAngle;
    
    // Handle wraparound at -PI/PI boundary
    if (angleDelta > Math.PI) {
      angleDelta -= 2 * Math.PI;
    } else if (angleDelta < -Math.PI) {
      angleDelta += 2 * Math.PI;
    }
    
    // Update previous angle for next iteration
    this.previousAngle = currentAngle;
    
    // Convert angle delta to value change
    const range = this.max - this.min;
    const fullRotation = this.rotationRangeRadians * this.dragSensitivity;
    const valueChange = (angleDelta / fullRotation) * range;
    
    const baseValue = typeof this.continuousValue === "number"
      ? this.continuousValue
      : this.value;
    const newValue = baseValue + valueChange;
    this.commitValueChange(newValue, true);
  }
  
  handleMouseUp() {
    this.isDragging = false;
    this.continuousValue = this.value;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
  
  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.isDragging = true;
    
    const rect = this.dialContainer.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    
    this.previousAngle = Math.atan2(touch.clientY - this.centerY, touch.clientX - this.centerX);
    this.continuousValue = this.value;
    
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);
  }
  
  handleTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const currentAngle = Math.atan2(touch.clientY - this.centerY, touch.clientX - this.centerX);
    let angleDelta = currentAngle - this.previousAngle;
    
    // Handle wraparound at -PI/PI boundary
    if (angleDelta > Math.PI) {
      angleDelta -= 2 * Math.PI;
    } else if (angleDelta < -Math.PI) {
      angleDelta += 2 * Math.PI;
    }
    
    // Update previous angle for next iteration
    this.previousAngle = currentAngle;
    
    // Convert angle delta to value change
    const range = this.max - this.min;
    const fullRotation = this.rotationRangeRadians * this.dragSensitivity;
    const valueChange = (angleDelta / fullRotation) * range;
    
    const baseValue = typeof this.continuousValue === "number"
      ? this.continuousValue
      : this.value;
    const newValue = baseValue + valueChange;
    this.commitValueChange(newValue, true);
  }
  
  handleTouchEnd() {
    this.isDragging = false;
    this.continuousValue = this.value;
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
  }
  
  dispatchChangeEvent() {
    const synthBrain = this.synthBrain || document.querySelector("synth-brain");
    if (synthBrain) {
      const updateConfigEvent = new CustomEvent("update-config", {
        detail: { name: this.inputName, value: this.value },
        bubbles: true,
        composed: true,
      });
      synthBrain.dispatchEvent(updateConfigEvent);
    }
    
    const changeEvent = new CustomEvent("change", {
      detail: { value: this.value },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(changeEvent);
  }
  
  connectedCallback() {
    this.dialContainer.addEventListener('mousedown', this.handleMouseDown);
    this.dialContainer.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    if (this.valueInput) {
      this.valueInput.addEventListener('change', this.handleValueInputChange);
      this.valueInput.addEventListener('keydown', this.handleValueInputKeyDown);
      this.valueInput.addEventListener('focus', this.handleValueInputFocus);
    }
    this.synthBrain = this.closest("synth-brain");
    if (this.synthBrain) {
      this.synthBrain.addEventListener("config-updated", this.handleConfigUpdated);
    }
  }

  disconnectedCallback() {
    this.dialContainer.removeEventListener('mousedown', this.handleMouseDown);
    this.dialContainer.removeEventListener('touchstart', this.handleTouchStart);
    if (this.valueInput) {
      this.valueInput.removeEventListener('change', this.handleValueInputChange);
      this.valueInput.removeEventListener('keydown', this.handleValueInputKeyDown);
      this.valueInput.removeEventListener('focus', this.handleValueInputFocus);
    }
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    if (this.synthBrain) {
      this.synthBrain.removeEventListener("config-updated", this.handleConfigUpdated);
    }
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    if (name === "max") {
      this.max = parseFloat(newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("max", newValue);
      }
      this.updateRotation();
    } else if (name === "min") {
      this.min = parseFloat(newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("min", newValue);
      }
      this.updateRotation();
    } else if (name === "value") {
      this.value = parseFloat(newValue);
      this.updateRotation();
    }
  }
}

customElements.define("synth-dial", SynthDial);
