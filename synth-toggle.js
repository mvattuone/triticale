import SynthSwitch from "./synth-switch.js";

export default class SynthToggle extends SynthSwitch {}

if (!customElements.get("synth-toggle")) {
  customElements.define("synth-toggle", SynthToggle);
}
