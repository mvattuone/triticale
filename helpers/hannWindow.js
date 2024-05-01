export function hannWindow(length, modifier) {
    let window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (modifier * (length - 1))));
    }
    return window;
}

