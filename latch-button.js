import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class LatchButton extends HTMLElement {
  static get observedAttributes() {
    return ['active'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.latched = false;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          flex: 0 0 auto;
        }

        button {
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          padding: 10px 24px;
          border-radius: 0;
          border: 1px solid rgba(255, 122, 45, 0.35);
          background: rgba(32, 22, 14, 0.5);
          color: rgba(255, 214, 190, 0.92);
          cursor: pointer;
          transition:
            background 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            transform 0.12s ease;
          outline: none;
          min-width: 120px;
        }

        button:hover {
          background: rgba(46, 28, 16, 0.7);
          border-color: rgba(255, 122, 45, 0.55);
          box-shadow: 0 0 18px rgba(255, 122, 45, 0.35);
        }

        button:active {
          transform: translateY(1px);
        }

        button:focus-visible {
          border-color: rgba(255, 180, 120, 0.8);
          box-shadow: 0 0 0 3px rgba(255, 122, 45, 0.35);
        }

        button[data-active="true"] {
          background: rgba(64, 30, 12, 0.8);
          border-color: rgba(255, 122, 45, 0.75);
          box-shadow: 0 0 24px rgba(255, 122, 45, 0.5);
        }

        .label {
          pointer-events: none;
        }
      </style>
      <button type="button" aria-pressed="false" data-active="false">
        <span class="label">Latch</span>
      </button>
    `;

    ensureBoxSizing(this.shadowRoot);

    this.button = this.shadowRoot.querySelector('button');
    this.handleClick = this.handleClick.bind(this);
  }

  connectedCallback() {
    this.button.addEventListener('click', this.handleClick);
    this.applyInitialState();
  }

  disconnectedCallback() {
    this.button.removeEventListener('click', this.handleClick);
  }

  attributeChangedCallback(name) {
    if (name === 'active') {
      this.applyInitialState();
    }
  }

  applyInitialState() {
    const shouldLatch = this.hasAttribute('active') && this.getAttribute('active') !== 'false';
    this.setLatched(shouldLatch, { emit: false });
  }

  handleClick() {
    this.setLatched(!this.latched, { emit: true });
  }

  setLatched(nextState, { emit } = { emit: false }) {
    const latched = Boolean(nextState);
    this.latched = latched;

    const dataValue = latched ? 'true' : 'false';
    if (this.button.dataset.active !== dataValue) {
      this.button.dataset.active = dataValue;
    }
    if (this.button.getAttribute('aria-pressed') !== dataValue) {
      this.button.setAttribute('aria-pressed', dataValue);
    }

    const hasActiveAttribute = this.hasAttribute('active');
    if (latched && !hasActiveAttribute) {
      this.setAttribute('active', '');
    } else if (!latched && hasActiveAttribute) {
      this.removeAttribute('active');
    }

    if (emit) {
      this.dispatchState();
    }
  }

  dispatchState() {
    const latchChangedEvent = new CustomEvent('latch-changed', {
      detail: { active: this.latched },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(latchChangedEvent);
  }
}

customElements.define('latch-button', LatchButton);
