## What is this

This is an attempt at making a granular synthesiser that affects both an audio sample as well as an image sampled as audio. Granular synthesis is a process in which a sound is broken up into many "microsounds", or "grains", and the reorganized to make new sounds.

The granular synth is a modified version of the demo synth used here - https://github.com/chrislo/synth_history/. Much thanks to Chris Lowis for making that available to learn from.

The databending component is a set of utility functions I have been copying around various applications that I would like to eventually make into an installable library.

## How to use

`python -m SimpleHTTPServer` and going to `localhost:8000` should get you going. Just drop an image in the dropzone, press Enter, and control the parameters via datgui
