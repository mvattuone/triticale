import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class SynthSelect extends HTMLElement {
  constructor() {
    super();

    const rawName = this.getAttribute("name") || "";
    const rawLabel = this.getAttribute("label") || "";
    const ariaLabelAttr = this.getAttribute("aria-label");
    const optionsAttr = this.getAttribute("options") || "[]";

    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    let options;
    try {
      const parsed = JSON.parse(optionsAttr);
      options = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse synth-select options', error);
      options = [];
    }

    const normalizedOptions = options.map((option) => {
      const optionValue = Object.prototype.hasOwnProperty.call(option, 'value')
        ? option.value
        : option?.label;

      return {
        value: optionValue != null ? String(optionValue) : "",
        label: option?.label != null ? String(option.label) : String(optionValue ?? ""),
      };
    });

    const synthBrain = document.querySelector("synth-brain");
    const config = synthBrain?.config ?? {};

    const resolveConfigValue = (name) => {
      if (!name) {
        return undefined;
      }

      if (!name.includes(".")) {
        return config?.[name];
      }

      return name.split(".").reduce((cursor, segment) => (
        cursor && Object.prototype.hasOwnProperty.call(cursor, segment)
          ? cursor[segment]
          : undefined
      ), config);
    };

    const configValue = resolveConfigValue(rawName);
    const initialValue = configValue != null
      ? String(configValue)
      : normalizedOptions?.[0]?.value ?? "";

    const selectId = `${rawName || 'synth-select'}-${Math.random().toString(36).slice(2, 7)}`;
    const safeName = escapeHtml(rawName);
    const safeLabel = escapeHtml(rawLabel);
    const fallbackAriaLabel = escapeHtml(ariaLabelAttr || rawLabel || rawName || 'Select option');

    const optionsMarkup = normalizedOptions.map(({ label, value }) => {
      const safeValue = escapeHtml(value);
      const safeOptionLabel = escapeHtml(label);
      const isSelected = value === initialValue;
      const selectedAttr = isSelected ? ' selected' : '';
      return `<option value="${safeValue}"${selectedAttr}>${safeOptionLabel}</option>`;
    }).join("");

    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          flex-direction: column;
          color: inherit;
          font-size: 0.75rem;
          gap: 6px;
          min-width: 0;
        }

        .field {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .field-label {
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(240, 244, 243, 0.78);
          font-size: 0.68rem;
          line-height: 1;
        }

        .select-shell {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-width: 140px;
          border-radius: 8px;
          padding: 6px 36px 6px 12px;
          background: linear-gradient(145deg, rgba(50, 54, 58, 0.92), rgba(22, 24, 27, 0.92));
          border: 1px solid rgba(0, 0, 0, 0.65);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 6px 16px rgba(0, 0, 0, 0.35);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        :host(:focus-within) .select-shell {
          border-color: rgba(102, 220, 255, 0.85);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 0 0 3px rgba(102, 220, 255, 0.18),
            0 6px 16px rgba(0, 0, 0, 0.35);
        }

        select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          flex: 1 1 auto;
          width: 100%;
          background: transparent;
          border: none;
          color: #f1f4f3;
          font: 500 0.9rem/1.2 "IBM Plex Sans", "Segoe UI", sans-serif;
          letter-spacing: 0.01em;
          padding: 0;
          cursor: pointer;
          min-width: 0;
        }

        select:focus {
          outline: none;
        }

        select::-ms-expand {
          display: none;
        }

        option {
          background-color: #111417;
          color: #f1f4f3;
        }

        .select-shell::after {
          content: "";
          position: absolute;
          right: 12px;
          top: 50%;
          width: 10px;
          height: 10px;
          transform: translateY(-50%) rotate(45deg);
          border-right: 2px solid rgba(243, 206, 122, 0.9);
          border-bottom: 2px solid rgba(243, 206, 122, 0.9);
          pointer-events: none;
          box-shadow: 0 0 4px rgba(243, 206, 122, 0.3);
        }

        .select-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }

        .select-shell:hover {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 6px 16px rgba(0, 0, 0, 0.45);
        }
      </style>
      <div class="field">
        ${safeLabel ? `<label class="field-label" for="${selectId}">${safeLabel}</label>` : ""}
        <div class="select-shell">
          <select id="${selectId}" name="${safeName}" aria-label="${fallbackAriaLabel}">
            ${optionsMarkup}
          </select>
        </div>
      </div>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.selectElement = this.shadowRoot.querySelector("select");

    if (this.selectElement && normalizedOptions.some((option) => option.value === initialValue)) {
      this.selectElement.value = initialValue;
    }
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  handleOnChange(event) {
    const { name, value } = event.target;

    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value },
      bubbles: true,
      composed: true,
    });

    document.querySelector("synth-brain")?.dispatchEvent(updateConfigEvent);
  }

  connectedCallback() {
    this.selectElement?.addEventListener("change", this.handleOnChange);
  }

  disconnectedCallback() {
    this.selectElement?.removeEventListener("change", this.handleOnChange);
  }
}

customElements.define("synth-select", SynthSelect);
