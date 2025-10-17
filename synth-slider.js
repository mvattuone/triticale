import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class SynthSlider extends HTMLElement {
  static observedAttributes = ["min", "max"];
  constructor() {
    super();
    const inputName = this.getAttribute("name");
    const minAttr = this.getAttribute("min");
    const maxAttr = this.getAttribute("max");
    const stepAttr = this.getAttribute("step") ?? "1";
    const minValue = minAttr !== null ? parseFloat(minAttr) : 0;
    const maxValue = maxAttr !== null ? parseFloat(maxAttr) : minValue;
    const stepValue = parseFloat(stepAttr);
    const stepPrecision = stepAttr.includes('.') ? stepAttr.split('.')[1].length : 0;
    const minAttribute = minAttr ?? String(minValue);
    const maxAttribute = maxAttr ?? String(maxValue);
    const stepAttribute = Number.isNaN(stepValue) ? "any" : stepAttr;
    const label = this.getAttribute("label") ?? "";
    const config = document.querySelector("synth-brain").config;

    let value;
    if (inputName.includes(".")) {
      const [groupKey, effectKey, valueKey] = inputName.split(".");
      value = config[groupKey][effectKey][valueKey] ?? 0;
    } else {
      value = config[inputName] ?? 0;
    }

    value = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(value)) {
      value = minValue;
    }

    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host{
          --h: 160px;           /* overall slider height */
          --rail-w: 10px;       /* visual rail width */
          --tick-w: 16px;       /* how far ticks extend */
          --tick: #fff;         /* tick color */
          --rail-bg: #e9edf3;   /* inner bright slot */
          --rail-edge: #0e1013; /* dark edge around rail */
          --thumb: #2a2d31;     /* fader body */
          --thumb-hi:#3b3f45;   /* fader highlight */
          --brass: #c7a65a;

          display:inline-grid;
          grid-template-rows:auto 1fr auto;
          gap:6px;
          color:#ddd;
        }

        .wrap{
          position:relative;
          width: calc(var(--tick-w)*2 + var(--rail-w));
          height: var(--h);
        }

        /* left + right tick ladders */
        .ticks, .ticks::after{
          content:"";
          position:absolute; top:0; bottom:0; width:var(--tick-w);
          pointer-events:none;
          /* long marks + short marks */
          background:
            repeating-linear-gradient(
              to bottom,
              transparent 0 18px,               /* spacing before long */
              var(--tick) 18px 19px,            /* long line 1px */
              transparent 19px 20px
            ),
            repeating-linear-gradient(
              to bottom,
              transparent 0 8px,                /* short marks */
              var(--tick) 8px 9px,
              transparent 9px 10px
            );
          opacity:.85;
        }
        .ticks { left:0; }
        .ticks::after { right:0; left:auto; }

        /* the center vertical slot */
        .rail{
          position:absolute; left:50%; top:0; bottom:0;
          transform:translateX(-50%);
          width:var(--rail-w); border-radius:6px;
          background:
            linear-gradient(#0f1114,#0f1114) padding-box,
            linear-gradient(180deg, rgba(255,255,255,.25), rgba(0,0,0,.7)) border-box;
          border:1px solid var(--rail-edge);
        }
        .rail::before{
          content:"";
          position:absolute; left:50%; top:4px; bottom:4px;
          transform:translateX(-50%);
          width:4px; border-radius:3px;
          background: linear-gradient(180deg, var(--rail-bg) 0%, #cad1dc 50%, #e5eaf2 100%);
          box-shadow: inset 0 0 2px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.35);
        }

        /* vertically oriented range: we flip it so bottom=min, top=max */
        input[type="range"]{
          appearance:none; -webkit-appearance:none;
          width: var(--h);
          height: 28px;           /* give the thumb room */
          background: transparent;
          position:absolute;
          top:50%;
          left:50%;
          transform: translate(-50%, -50%) rotate(-90deg);
          transform-origin: 50% 50%;
          margin:0;
          cursor: pointer;
        }

        /* hide default track */
        input[type="range"]::-webkit-slider-runnable-track{ background:transparent; height:26px;}
        input[type="range"]::-moz-range-track{ background:transparent; height:26px;}

        /* rectangular fader cap (like the synth) */
        input[type="range"]::-webkit-slider-thumb{
          -webkit-appearance:none; appearance:none;
          width:26px; height:22px; border-radius:4px;
          background: linear-gradient(145deg, var(--thumb-hi), var(--thumb));
          border:1px solid #0e0f12;
          box-shadow:
            0 2px 6px rgba(0,0,0,.55),
            inset 0 1px 2px rgba(255,255,255,.08),
            inset 0 -1px 2px rgba(0,0,0,.5);
          position:relative;
        }
        input[type="range"]::-webkit-slider-thumb::after{
          content:""; position:absolute; left:4px; right:4px; top:10px; height:2px;
          background: linear-gradient(90deg, #9b7f3c, var(--brass), #9b7f3c);
          border-radius:1px; box-shadow: 0 0 0 1px rgba(0,0,0,.35);
        }
        input[type="range"]::-moz-range-thumb{
          width:26px; height:22px; border-radius:4px; border:1px solid #0e0f12;
          background: linear-gradient(145deg, var(--thumb-hi), var(--thumb));
          box-shadow:
            0 2px 6px rgba(0,0,0,.55),
            inset 0 1px 2px rgba(255,255,255,.08),
            inset 0 -1px 2px rgba(0,0,0,.5);
        }

        .value-input {
          font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color:#f0f0f0;
          text-align:center;
          min-width:48px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius:4px;
          padding:2px 6px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,.6);
        }
        .value-input:focus {
          outline:none;
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
        .top-label{
          font: 10px/1.1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          color:#bfbfbf; text-transform:uppercase; letter-spacing:.4px;
          text-align:center;
        }
      </style>

      ${label ? `<div class="top-label">${label}</div>` : ``}
      <div class="wrap">
        <div class="ticks"></div>
        <div class="rail"></div>
        <input type="range" name="${inputName}" min="${minAttribute}" max="${maxAttribute}" value="${value}" step="${stepAttribute}" />
      </div>
      <input class="value-input" type="number" min="${minAttribute}" max="${maxAttribute}" step="${stepAttribute}" value="${value}" />
    `;

    ensureBoxSizing(this.shadowRoot);

    this.rangeInput = this.shadowRoot.querySelector('input[type="range"]');
    this.valueInput = this.shadowRoot.querySelector('.value-input');
    this.value = value;
    this.minValue = Number.isNaN(minValue) ? 0 : minValue;
    this.maxValue = Number.isNaN(maxValue) ? Number.POSITIVE_INFINITY : maxValue;
    this.stepValue = Number.isNaN(stepValue) || stepValue <= 0 ? null : stepValue;
    this.stepPrecision = stepPrecision;

    this.rangeInput.value = this.value;
    if (this.valueInput) {
      this.valueInput.value = this.formatValue(this.value);
    }

    this.handleRangeInput = this.handleRangeInput.bind(this);
    this.handleValueInputChange = this.handleValueInputChange.bind(this);
    this.handleValueInputKeyDown = this.handleValueInputKeyDown.bind(this);
    this.handleValueInputFocus = this.handleValueInputFocus.bind(this);
    this.handleConfigUpdated = this.handleConfigUpdated.bind(this);

    this.commitValueChange(this.value, false);
  }

  handleRangeInput(event){
    this.commitValueChange(event.target.value, true);
  }

  handleValueInputChange(){
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

  commitValueChange(rawValue, emit = true) {
    let numericValue = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);
    if (Number.isNaN(numericValue)) {
      if (this.valueInput) {
        this.valueInput.value = this.formatValue(this.value);
      }
      return;
    }

    numericValue = Math.max(this.minValue, Math.min(this.maxValue, numericValue));

    if (this.stepValue) {
      numericValue = Math.round((numericValue - this.minValue) / this.stepValue) * this.stepValue + this.minValue;
    }

    const precision = Math.max(this.stepPrecision, 4);
    numericValue = parseFloat(numericValue.toFixed(precision));
    numericValue = Math.max(this.minValue, Math.min(this.maxValue, numericValue));

    if (numericValue === this.value) {
      if (this.valueInput) {
        this.valueInput.value = this.formatValue(this.value);
      }
      this.rangeInput.value = this.value;
      return;
    }

    this.value = numericValue;
    this.rangeInput.value = this.value;
    if (this.valueInput) {
      this.valueInput.value = this.formatValue(this.value);
    }

    if (emit) {
      const synthBrain = this.synthBrain || document.querySelector("synth-brain");
      if (synthBrain) {
        const updateConfigEvent = new CustomEvent("update-config", {
          detail: { name: this.rangeInput.name, value: this.value },
          bubbles: true,
          composed: true,
        });
        synthBrain.dispatchEvent(updateConfigEvent);
      }
    }
  }

  formatValue(value){
    const decimals = Math.max(this.stepPrecision, value % 1 === 0 ? 0 : 2);
    return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  connectedCallback(){
    this.rangeInput.addEventListener("input", this.handleRangeInput);
    if (this.valueInput) {
      this.valueInput.addEventListener("change", this.handleValueInputChange);
      this.valueInput.addEventListener("keydown", this.handleValueInputKeyDown);
      this.valueInput.addEventListener("focus", this.handleValueInputFocus);
    }
    this.synthBrain = this.closest("synth-brain");
    if (this.synthBrain) {
      this.synthBrain.addEventListener("config-updated", this.handleConfigUpdated);
    }
  }

  disconnectedCallback(){
    this.rangeInput.removeEventListener("input", this.handleRangeInput);
    if (this.valueInput) {
      this.valueInput.removeEventListener("change", this.handleValueInputChange);
      this.valueInput.removeEventListener("keydown", this.handleValueInputKeyDown);
      this.valueInput.removeEventListener("focus", this.handleValueInputFocus);
    }
    if (this.synthBrain) {
      this.synthBrain.removeEventListener("config-updated", this.handleConfigUpdated);
    }
  }
  
  handleConfigUpdated(event) {
    const { name, value } = event.detail;
    if (name !== this.rangeInput.name) {
      return;
    }
    const numericValue = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(numericValue)) {
      return;
    }
    this.commitValueChange(numericValue, false);
  }
  attributeChangedCallback(name, oldValue, newValue){
    if (oldValue === newValue) {
      return;
    }

    if (name === "max") {
      this.rangeInput.setAttribute("max", newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("max", newValue);
      }
      const parsedMax = parseFloat(newValue);
      this.maxValue = Number.isNaN(parsedMax) ? Number.POSITIVE_INFINITY : parsedMax;
    }

    if (name === "min") {
      this.rangeInput.setAttribute("min", newValue);
      if (this.valueInput) {
        this.valueInput.setAttribute("min", newValue);
      }
      const parsedMin = parseFloat(newValue);
      this.minValue = Number.isNaN(parsedMin) ? 0 : parsedMin;
    }

    if (typeof this.value !== 'undefined') {
      this.commitValueChange(this.value, false);
    }
  }
}
customElements.define("synth-slider", SynthSlider);
