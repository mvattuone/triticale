import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class SynthSwitch extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  constructor() {
    super();

    this.inputName = this.getAttribute("name") || "";
    this.labelText = this.getAttribute("label");
    this.ariaLabel = this.getAttribute("aria-label") || this.labelText || this.inputName || "Toggle";

    const synthBrain = document.querySelector("synth-brain");
    const config = synthBrain?.config ?? {};

    let checked = false;

    if (this.inputName) {
      const path = this.inputName.split(".");
      let cursor = config;

      for (const segment of path) {
        if (cursor && Object.prototype.hasOwnProperty.call(cursor, segment)) {
          cursor = cursor[segment];
        } else {
          cursor = undefined;
          break;
        }
      }

      checked = Boolean(cursor);
    }

    this.attachShadow({ mode: "open" });

    const safeAriaLabel = this.ariaLabel.replace(/"/g, "&quot;");
    const labelMarkup = this.labelText ? `<span class="switch-text">${this.labelText}</span>` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-size: 0.75rem;
          color: inherit;
        }

        .switch-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          user-select: none;
        }

        .switch-wrapper.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .switch-text {
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.7rem;
        }

        .switch {
          position: relative;
          display: inline-flex;
          width: var(--switch-width, 46px);
          height: var(--switch-height, 24px);
        }

        input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: inherit;
        }

        .switch-visual {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: var(--switch-height, 24px);
          background: var(--switch-track-off, rgba(255, 255, 255, 0.16));
          transition: background 0.2s ease, box-shadow 0.2s ease;
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(0, 0, 0, 0.35);
        }

        .switch-thumb {
          position: absolute;
          top: var(--switch-padding, 2px);
          left: var(--switch-padding, 2px);
          width: calc(var(--switch-height, 24px) - var(--switch-padding, 2px) * 2);
          height: calc(var(--switch-height, 24px) - var(--switch-padding, 2px) * 2);
          border-radius: 50%;
          background: var(--switch-thumb, #f7faf8);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
          transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        input:checked + .switch-visual {
          background: var(--switch-track-on, #3ad2a3);
          box-shadow:
            inset 0 1px 2px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(0, 0, 0, 0.25);
        }

        input:checked + .switch-visual .switch-thumb {
          transform: translateX(calc(var(--switch-width, 46px) - var(--switch-height, 24px)));
        }

        input:focus-visible + .switch-visual {
          outline: 2px solid rgba(58, 210, 163, 0.85);
          outline-offset: 3px;
        }

        input:disabled + .switch-visual {
          background: var(--switch-track-disabled, rgba(255, 255, 255, 0.08));
        }

        input:disabled + .switch-visual .switch-thumb {
          background: var(--switch-thumb-disabled, rgba(255, 255, 255, 0.5));
          box-shadow: none;
        }
      </style>
      <div class="switch-wrapper">
        ${labelMarkup}
        <label class="switch">
          <input type="checkbox" name="${this.inputName}" aria-label="${safeAriaLabel}">
          <span class="switch-visual">
            <span class="switch-thumb"></span>
          </span>
        </label>
      </div>
    `;
    ensureBoxSizing(this.shadowRoot);

    this.wrapper = this.shadowRoot.querySelector(".switch-wrapper");
    this.inputElement = this.shadowRoot.querySelector('input[type="checkbox"]');
    this.inputElement.checked = checked;

    this.handleOnChange = this.handleOnChange.bind(this);
    this.syncDisabled();
  }

  handleOnChange(event) {
    const { name, checked } = event.target;

    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: checked },
      bubbles: true,
      composed: true,
    });

    document.querySelector("synth-brain")?.dispatchEvent(updateConfigEvent);
  }

  connectedCallback() {
    this.inputElement.addEventListener("change", this.handleOnChange);
  }

  disconnectedCallback() {
    this.inputElement.removeEventListener("change", this.handleOnChange);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.syncDisabled();
    }
  }

  syncDisabled() {
    const isDisabled = this.hasAttribute("disabled");

    if (isDisabled) {
      this.inputElement.setAttribute("disabled", "");
    } else {
      this.inputElement.removeAttribute("disabled");
    }

    if (this.wrapper) {
      this.wrapper.classList.toggle("disabled", isDisabled);
    }
  }
}

customElements.define("synth-switch", SynthSwitch);
