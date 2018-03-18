    // Create a Databender instance
    var Databender = function (audioCtx, renderCanvas) {

      var defaultConfig = {
        'grainIndex': 3,
        'frameRate': 1,
        'numberOfGrains': 4,
        'grainsPerSecond': 4, 
        'walkProbability': 1,
        'playAudio': true
      }

      this.config = Object.assign({}, defaultConfig);

      // Create an AudioContext or use existing one
      this.audioCtx = audioCtx ? audioCtx : new AudioContext();
      this.renderCanvas = renderCanvas;
      
      this.channels = 1; // @TODO - What would multiple channels look like?

      this.bend = function (image) {
        if (!image) {
          return;
        }

        if (image instanceof Image || image instanceof HTMLVideoElement) {
          var canvas = document.createElement('canvas');
          // these are potentially interesting controls for creating a glitch-like effect (stretched pixels)
          canvas.width = image.width; 
          canvas.height = image.height;
          var context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        }
        
        this.imageData = imageData || image;
        var bufferSize = this.imageData.data.length / this.channels;

        // Make an audioBuffer on the audioContext to pass to the offlineAudioCtx AudioBufferSourceNode
        var audioBuffer = this.audioCtx.createBuffer(this.channels, bufferSize, this.audioCtx.sampleRate); 

        // This gives us the actual ArrayBuffer that contains the data
        var nowBuffering = audioBuffer.getChannelData(0);

        // set the AudioBuffer buffer to the same as the imageData audioBuffer
        // v. convenient becuase you do not need to convert the data yourself
        nowBuffering.set(this.imageData.data);

        return Promise.resolve(audioBuffer); 
      }

      this.granularize = function (buffer, isAudio) {
        var granularSynth = new GranularSynth(this.audioCtx, buffer, databender, isAudio);
        return granularSynth.play(isAudio);
      };

      this.render = function (buffer, time) {
        var _this = this;

        // Create offlineAudioCtx that will house our rendered buffer
        var offlineAudioCtx = new OfflineAudioContext(_this.channels, buffer.length, _this.audioCtx.sampleRate);

        // Create an AudioBufferSourceNode, which represents an audio source consisting of in-memory audio data
        var bufferSource = offlineAudioCtx.createBufferSource();

        // Set buffer to audio buffer containing image data
        bufferSource.buffer = buffer; 

        //  @NOTE: Calling this is when the AudioBufferSourceNode becomes unusable
        bufferSource.start();

        bufferSource.connect(offlineAudioCtx.destination);

        // Kick off the render, callback will contain rendered buffer in event
        return offlineAudioCtx.startRendering();
      };

      this.draw = function (buffer) {

        // Get buffer data
        var bufferData = buffer.getChannelData(0);

        // ImageData expects a Uint8ClampedArray so we need to make a typed array from our buffer
        // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
        var clampedDataArray = new Uint8ClampedArray(buffer.length)

        // set the renderedBuffer to Uint8ClampedArray to use in ImageData later
        clampedDataArray.set(bufferData);

        // putImageData requires an ImageData Object
        // @see https://developer.mozilla.org/en-US/docs/Web/API/ImageData
        // 4 * imageWidth * imageHeight = bufferSize

        // Okay so basically I am doing something awesome and creating a slightly larger ImageData object to handle whatever
        // segment of data we want. I have no idea what is going on with this and it's making some weird looking shit but it's kind
        // of cool so whatever!
        var widthToApply = Math.ceil(this.imageData.width / (this.config.numberOfGrains / Math.sqrt(this.config.numberOfGrains))); 
        var heightToApply = Math.ceil(this.imageData.height / (this.config.numberOfGrains / Math.sqrt(this.config.numberOfGrains)));
        console.log(widthToApply, 'original width to apply');
        console.log(heightToApply, 'height that will be applied');
        console.log(clampedDataArray.length, 'size of the buffer');
        var transformedImage;
        if (widthToApply * heightToApply * 4 !== clampedDataArray) {
        }
        
        var transformedImage = new ImageData(widthToApply, heightToApply);

        transformedImage.data.set(clampedDataArray);

        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = this.imageData.width / Math.sqrt(this.config.numberOfGrains);
        tmpCanvas.height = this.imageData.height / Math.sqrt(this.config.numberOfGrains);
        tmpCanvas.getContext('2d').putImageData(transformedImage, 0, 0);
        this.renderCanvas.getContext('2d').drawImage(tmpCanvas, 0, 0, 1280, 768);
      };


      return this;
    };
