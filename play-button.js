export default class PlayButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.playing = false;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          height: var(--play-button-size, 100px);
          flex: 0 0 auto;
        }

        button {
          position: relative;
          width: var(--play-button-size, 100px);
          height: var(--play-button-size, 100px);
          border: 1px solid rgba(87, 42, 9, 0.85);
          background:
            linear-gradient(
              180deg,
              rgba(255, 214, 168, 0.96) 0%,
              rgba(255, 183, 102, 0.94) 40%,
              rgba(211, 94, 24, 0.95) 100%
            );
          box-shadow:
            inset 0 4px 0 rgba(255, 255, 255, 0.65),
            inset 0 -8px 0 rgba(122, 56, 12, 0.55),
            0 10px 0 rgba(0, 0, 0, 0.55),
            0 16px 24px rgba(0, 0, 0, 0.6);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          outline: none;
          transition:
            transform 0.08s ease-out,
            box-shadow 0.18s ease,
            background 0.18s ease,
            border-color 0.18s ease,
            filter 0.18s ease;
        }

        button::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 55%);
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 0.85;
        }

        button::after {
          content: "";
          position: absolute;
          inset: 0;
          border-top: 2px solid rgba(255, 255, 255, 0.5);
          border-left: 2px solid rgba(255, 255, 255, 0.2);
          border-right: 2px solid rgba(0, 0, 0, 0.25);
          border-bottom: 2px solid rgba(0, 0, 0, 0.4);
          pointer-events: none;
        }

        button:hover {
          filter: brightness(1.04);
        }

        button:active {
          transform: translateY(2px);
          box-shadow:
            inset 0 3px 0 rgba(255, 255, 255, 0.55),
            inset 0 -6px 0 rgba(102, 46, 9, 0.5),
            0 6px 0 rgba(0, 0, 0, 0.55),
            0 12px 18px rgba(0, 0, 0, 0.55);
        }

        button:focus-visible {
          box-shadow:
            inset 0 4px 0 rgba(255, 255, 255, 0.65),
            inset 0 -8px 0 rgba(122, 56, 12, 0.55),
            0 0 0 3px rgba(255, 196, 128, 0.7),
            0 0 0 6px rgba(255, 196, 128, 0.3),
            0 16px 24px rgba(0, 0, 0, 0.6);
        }

        button[data-state="playing"] {
          background:
            linear-gradient(
              180deg,
              rgba(255, 232, 190, 1) 0%,
              rgba(255, 172, 72, 0.98) 45%,
              rgba(233, 110, 20, 0.98) 100%
            );
          border-color: rgba(255, 152, 60, 0.95);
          box-shadow:
            inset 0 4px 0 rgba(255, 255, 255, 0.75),
            inset 0 -8px 0 rgba(135, 50, 0, 0.6),
            0 0 24px rgba(255, 150, 62, 0.8),
            0 18px 28px rgba(0, 0, 0, 0.65);
        }

        button[data-state="playing"]::before {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), transparent 60%);
        }

        button[data-state="playing"]::after {
          border-top-color: rgba(255, 255, 255, 0.75);
          border-left-color: rgba(255, 213, 150, 0.5);
          border-right-color: rgba(140, 60, 12, 0.35);
          border-bottom-color: rgba(140, 60, 12, 0.5);
        }

        .icon {
          width: 38px;
          height: 38px;
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon::after {
          content: "";
          position: absolute;
          inset: -18px;
          box-shadow: 0 0 32px rgba(255, 140, 60, 0.5);
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        button[data-state="playing"] .icon::after {
          opacity: 1;
        }

        .symbol {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .symbol-play {
          background: linear-gradient(180deg, #6b2f0d 0%, #391203 100%);
          clip-path: polygon(32% 20%, 78% 50%, 32% 80%);
          opacity: 1;
        }

        button[data-state="playing"] .symbol-play {
          opacity: 0;
          transform: translateY(4px);
        }

        .symbol-pause {
          opacity: 0;
          justify-content: space-between;
          padding: 0 8px;
        }

        .symbol-pause::before,
        .symbol-pause::after {
          content: "";
          width: 8px;
          height: 70%;
          background: linear-gradient(180deg, #fff3d2 0%, #ffc571 100%);
          box-shadow: inset 0 0 2px rgba(122, 60, 18, 0.5);
        }

        button[data-state="playing"] .symbol-pause {
          opacity: 1;
          transform: translateY(-2px);
        }

        .label {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      </style>
      <button type="button" data-state="stopped" aria-pressed="false">
        <span class="icon" aria-hidden="true">
          <span class="symbol symbol-play"></span>
          <span class="symbol symbol-pause"></span>
        </span>
        <span class="label">Play</span>
      </button>
    `;

    this.button = this.shadowRoot.querySelector("button");
    this.label = this.shadowRoot.querySelector(".label");
    this.button.addEventListener("click", this.handleClick.bind(this));
    this.button.setAttribute("aria-label", "Play");
    this.audioCtx = this.closest("synth-brain")?.audioCtx;
  }

  setPlaying(playing) {
    this.playing = playing;
    const state = playing ? "playing" : "stopped";
    const labelText = playing ? "Pause" : "Play";
    this.button.dataset.state = state;
    this.button.setAttribute("aria-pressed", playing ? "true" : "false");
    this.button.setAttribute("aria-label", labelText);
    this.label.textContent = labelText;
  }

  handleClick() {
    if (!this.playing) {
      this.setPlaying(true);
      const playSynthEvent = new Event("play-synth", {
        composed: true,
        bubbles: true,
      });
      this.dispatchEvent(playSynthEvent);
    } else {
      const stopSynthEvent = new Event("stop-synth", {
        composed: true,
        bubbles: true,
      });
      this.dispatchEvent(stopSynthEvent);
      this.setPlaying(false);
    }
  }
}

customElements.define("play-button", PlayButton);
