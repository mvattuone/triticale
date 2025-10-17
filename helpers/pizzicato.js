import "/node_modules/pizzicato/distr/Pizzicato.min.js";

const { Pizzicato } = window;

if (!Pizzicato) {
  throw new Error("Pizzicato failed to load from /node_modules/pizzicato/distr/Pizzicato.min.js");
}

export default Pizzicato;
