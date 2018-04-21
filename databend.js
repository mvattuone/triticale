class Databender { 

  constructor(audioCtx, renderCanvas) {
    const defaultConfig = {
      'loopAudio': false,
      'loopVideo': false,
      'attack': 0.4,
      'enableEnvelopes': false,
      'release': 1.5,
      'grainIndex': 3,
      'offset': 0,
      'frameRate': 20,
      'numberOfGrains': 4,
      'walkProbability': 1,
      'playAudio': true
    }

    this.config = Object.assign({}, defaultConfig);

    // Create an AudioContext or use existing one
    this.audioCtx = audioCtx ? audioCtx : new AudioContext();
    this.renderCanvas = renderCanvas;

    this.channels = 1; // @TODO - What would multiple channels look like?
    this.bend = this.bend.bind(this);
    this.render = this.render.bind(this);
    this.draw = this.draw.bind(this);
  }

  bend(image) {
    let imageData; 

    if (!image) {
      return;
    }

    if (image instanceof Image || image instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      // these are potentially interesting controls for creating a glitch-like effect (stretched pixels)
      canvas.width = image.width || 1280; 
      canvas.height = image.height || 768;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    }

    this.imageData = imageData || image;
    const bufferSize = this.imageData.data.length / this.channels;

    // Make an audioBuffer on the audioContext to pass to the offlineAudioCtx AudioBufferSourceNode
    const audioBuffer = this.audioCtx.createBuffer(this.channels, bufferSize, this.audioCtx.sampleRate); 

    // This gives us the actual ArrayBuffer that contains the data
    const nowBuffering = audioBuffer.getChannelData(0);

    // set the AudioBuffer buffer to the same as the imageData audioBuffer
    // v. convenient becuase you do not need to convert the data yourself
    nowBuffering.set(this.imageData.data);

    return Promise.resolve(audioBuffer); 
  }

  render(buffer) {
    // Create offlineAudioCtx that will house our rendered buffer
    const offlineAudioCtx = new OfflineAudioContext(this.channels, buffer.length, this.audioCtx.sampleRate);

    // Create an AudioBufferSourceNode, which represents an audio source consisting of in-memory audio data
    const bufferSource = offlineAudioCtx.createBufferSource();
    const gainNode = offlineAudioCtx.createGain();

    // Set buffer to audio buffer containing image data
    bufferSource.buffer = buffer; 

    bufferSource.connect(offlineAudioCtx.destination);

    const duration = this.config.enableEnvelopes ? this.config.attack + this.config.release : bufferSource.buffer.duration;

    //  @NOTE: Calling this is when the AudioBufferSourceNode becomes unusable
    bufferSource.start(0, this.config.offset, duration);
    bufferSource.loop = this.config.loopVideo;
    if (this.config.enableEnvelopes) {
      gainNode.gain.setValueAtTime(0.0, 0);
      gainNode.gain.linearRampToValueAtTime(Math.random(),0 + this.config.attack);
      gainNode.gain.linearRampToValueAtTime(0, 0 + (this.config.attack + this.config.release));
    }
    bufferSource.connect(gainNode);


    // Kick off the render, callback will contain rendered buffer in event
    return offlineAudioCtx.startRendering();
  };

  draw(buffer) {
    // Get buffer data
    const bufferData = buffer.getChannelData(0);

    // ImageData expects a Uint8ClampedArray so we need to make a typed array from our buffer
    // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
    const clampedDataArray = new Uint8ClampedArray(buffer.length)

    // set the renderedBuffer to Uint8ClampedArray to use in ImageData later
    clampedDataArray.set(bufferData);

    // putImageData requires an ImageData Object
    // @see https://developer.mozilla.org/en-US/docs/Web/API/ImageData
    // 4 * imageWidth * imageHeight = bufferSize

    // Okay so basically I am doing something awesome and creating a slightly larger ImageData object to handle whatever
    // segment of data we want. I have no idea what is going on with this and it's making some weird looking shit but it's kind
    // of cool so whatever!
    const widthToApply = Math.ceil(this.imageData.width / (this.config.numberOfGrains / Math.sqrt(this.config.numberOfGrains))); 
    const heightToApply = Math.ceil(this.imageData.height / (this.config.numberOfGrains / Math.sqrt(this.config.numberOfGrains)));

    const transformedImage = new ImageData(widthToApply, heightToApply);

    transformedImage.data.set(clampedDataArray);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = this.imageData.width / Math.sqrt(this.config.numberOfGrains);
    tmpCanvas.height = this.imageData.height / Math.sqrt(this.config.numberOfGrains);
    tmpCanvas.getContext('2d').putImageData(transformedImage, 0, 0);
    this.renderCanvas.getContext('2d').drawImage(tmpCanvas, 0, 0, 1280, 768);
  };
};

export default Databender;
