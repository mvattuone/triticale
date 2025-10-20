import { ensureBoxSizing } from 'helpers/boxSizing.js';

class SynthSegmented extends HTMLElement {
  constructor() {
    super();

    this.controlName = this.getAttribute('name') || '';
    this.label = this.getAttribute('label') || '';

    const optionsAttr = this.getAttribute('options');
    this.options = this.parseOptions(optionsAttr);

    this.uniquePrefix = `segmented-${Math.random().toString(36).slice(2)}`;
    this.groupName = `${this.uniquePrefix}-group`;

    this.attachShadow({ mode: 'open' });
    this.render();

    this.handleChange = this.handleChange.bind(this);
    this.handleConfigUpdated = this.handleConfigUpdated.bind(this);
    this.synthBrain = null;
  }

  connectedCallback() {
    this.segmented?.addEventListener('change', this.handleChange);
    this.synthBrain = this.closest('synth-brain')
      || (typeof document !== 'undefined' ? document.querySelector('synth-brain') : null);
    this.synthBrain?.addEventListener('config-updated', this.handleConfigUpdated);
    this.syncFromConfig();
  }

  disconnectedCallback() {
    this.segmented?.removeEventListener('change', this.handleChange);
    this.synthBrain?.removeEventListener('config-updated', this.handleConfigUpdated);
    this.synthBrain = null;
  }

  parseOptions(rawOptions) {
    if (!rawOptions) {
      return [];
    }

    if (Array.isArray(rawOptions)) {
      return rawOptions;
    }

    try {
      const parsed = JSON.parse(rawOptions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse synth-segmented options', error);
      return [];
    }
  }

  render() {
    const makeOption = ({ value, label }, index) => {
      const safeValue = String(value ?? '');
      const optionId = `${this.uniquePrefix}-${index}`;
      const safeLabel = label ?? safeValue;

      return `
        <label class="option" for="${optionId}">
          <input type="radio" id="${optionId}" name="${this.groupName}" value="${safeValue}" />
          <span class="option-label">${safeLabel}</span>
        </label>
      `;
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          color: inherit;
          font-size: 0.75rem;
        }

        .wrapper {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
        }

        .label {
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .segmented {
          display: inline-flex;
          border-radius: 999px;
          padding: 2px;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          gap: 2px;
        }

        .option {
          position: relative;
          display: inline-flex;
          border-radius: 999px;
          cursor: pointer;
          overflow: hidden;
        }

        .option input {
          position: absolute;
          opacity: 0;
          inset: 0;
          margin: 0;
          pointer-events: none;
        }

        .option-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 14px;
          border-radius: 999px;
          transition: background 0.2s ease, color 0.2s ease;
          min-width: 80px;
        }

        .option input:checked + .option-label {
          background: rgba(58, 210, 163, 0.24);
          color: #f7faf8;
        }

        .option input:focus-visible + .option-label {
          outline: 2px solid rgba(58, 210, 163, 0.85);
          outline-offset: 2px;
        }
      </style>
      <div class="wrapper">
        ${this.label ? `<span class="label">${this.label}</span>` : ''}
        <div class="segmented" role="radiogroup" aria-label="${this.label || this.controlName}">
          ${this.options.map(makeOption).join('')}
        </div>
      </div>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.segmented = this.shadowRoot.querySelector('.segmented');
    this.inputs = Array.from(this.shadowRoot.querySelectorAll('input[type="radio"]'));
  }

  handleChange(event) {
    const input = event.target;
    if (!input || input.type !== 'radio') {
      return;
    }

    const { value } = input;
    if (!value) {
      return;
    }

    this.dispatchUpdate(value);
  }

  handleConfigUpdated(event) {
    const { name, value } = event.detail || {};
    if (name !== this.controlName) {
      return;
    }
    this.setActiveValue(value);
  }

  dispatchUpdate(value) {
    if (!this.controlName) {
      return;
    }

    const updateConfigEvent = new CustomEvent('update-config', {
      detail: { name: this.controlName, value },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(updateConfigEvent);
  }

  syncFromConfig() {
    const synthBrain = this.synthBrain || this.closest('synth-brain');
    if (!synthBrain) {
      return;
    }

    const value = typeof synthBrain.getConfigValue === 'function'
      ? synthBrain.getConfigValue(this.controlName)
      : synthBrain.config?.[this.controlName];

    this.setActiveValue(value);
  }

  getCurrentValue() {
    const active = this.inputs?.find((input) => input.checked);
    return active ? active.value : null;
  }

  setActiveValue(value) {
    if (!this.inputs?.length) {
      return;
    }

    const targetValue = value != null ? String(value) : null;
    let matched = false;

    this.inputs.forEach((input) => {
      const isMatch = input.value === targetValue;
      input.checked = isMatch;
      if (isMatch) {
        matched = true;
      }
    });

    if (!matched && this.inputs.length > 0) {
      this.inputs[0].checked = true;
    }
  }
}

if (!customElements.get('synth-segmented')) {
  customElements.define('synth-segmented', SynthSegmented);
}
