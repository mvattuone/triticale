import { ensureBoxSizing } from 'helpers/boxSizing.js';

class SynthSection extends HTMLElement {
  constructor() {
    super();

    const label = this.getAttribute("label") || "";

    this.attachShadow({ mode: "open" });

    this._headingSlot = this.shadowRoot.querySelector('slot[name="heading-action"]');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        section {
          display: block;
        }

        .section-heading {
          align-items: center;
          display: flex;
          gap: var(--synth-section-heading-gap, 16px);
          justify-content: space-between;
        }

        .section-heading[hidden] {
          display: none;
        }

        h4 {
          font-weight: normal;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: .55px;
        } 
      </style>
      <section part="section">
        <div class="section-heading" part="heading">
          <h4>${label}</h4>
          <slot name="heading-action"></slot>
        </div>
        <slot></slot>
      </section>
    `;

    ensureBoxSizing(this.shadowRoot);
  }
}

customElements.define('synth-section', SynthSection);
