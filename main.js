import Databender from './databend';
import config from './config.json';
import GranularSynth from './granular';
import dat from 'dat.gui';

function handleDatGUI(databender, granularSynth){
  const gui = new dat.GUI();
  Object.keys(config).forEach(function (param) {
    gui.add(config, param, 0, 2000, 1)
      .listen()
      .onFinishChange(function (value) { 
        config[param] = value;
        granularSynth.updateValues(config);
      });
  });
};

function renderVideoToCanvas(v, renderCanvas, databender, granularSynth) {
  let timer;
  let time;

  function drawFrame() {
    if(v.paused || v.ended) return false;
    databender.bend(v)
      .then((buffer) => {
        granularSynth.videoBuffer = buffer;
        granularSynth.createGrains();
      })
  }

  (function repeat() {
    time = 1000 / config.frameRate;  
    drawFrame(v, renderCanvas);
    timer = setTimeout(repeat, time);
  }());
}

function handleImageUpload (file, renderCanvas, databender, granularSynth) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      databender.bend(img)
        .then((buffer) => {
          granularSynth.videoBuffer = buffer;
          granularSynth.createGrains();
        })
    };
    img.src = e.target.result;
  }
  reader.readAsDataURL(file);
}; 

function handleVideoUpload(file, renderCanvas, databender, granularSynth){
  const reader = new FileReader();
  const video = document.createElement('video');

  video.addEventListener('play', () =>
    renderVideoToCanvas(video, renderCanvas, databender, granularSynth)
  , false);

  reader.onload = function (event) {
    video.src = this.result;
    video.muted = true;
    video.type = "video/mp4";
    video.loop = true;
    video.play();
  }
  reader.readAsDataURL(file);
}

function getFileType(file) {
  const imageFileTypes = ['jpg', 'png', 'bmp', 'jpeg'];
  const videoFileTypes = ['mp4', 'webm'];
  const fileExtension = file.name.split('.')[1];
  let fileType;

  if (imageFileTypes.includes(fileExtension)) { 
    fileType = 'image';
  } else if (videoFileTypes.indexOf(fileExtension) >= 0) {
    fileType = 'video';
  } else {
    return null;
  }

  return fileType;
};


function handleFileUpload(file, renderCanvas, databender, granularSynth) {
  const type = getFileType(file);
  switch (type) { 
    case 'image': 
      return handleImageUpload(file, renderCanvas, databender, granularSynth);
    case 'video':
      return handleVideoUpload(file, renderCanvas, databender, granularSynth);
    default:
      alert('File Type is not supported');
      return false;
  }
};

function loadTrack () {
  fetch('audience.mp3')
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      window.trackBuffer = buffer;
    }).catch((err) => {
      console.error(`Error while loading: ${err}`);
    });
};

function main () {
  loadTrack();
  const audioCtx = new AudioContext();
  const renderCanvas = document.querySelector('#canvas');
  const upload = document.querySelector('.upload');
  const fileUpload = document.querySelector('input[type=file]');
  upload.ondragover = function () { this.classList.add('hover'); return false; };
  upload.ondragend = function () { this.classList.remove('hover'); return false; };
  upload.ondrop = function (e) {
    e.preventDefault();
    const databender = new Databender(audioCtx, renderCanvas);
    const granularSynth = new GranularSynth(audioCtx, databender, config); 
    handleDatGUI(databender, granularSynth);
    document.querySelector('.upload').style.display = 'none';
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    handleFileUpload(files[0], renderCanvas, databender, granularSynth);
    audioCtx.decodeAudioData(window.trackBuffer, function (buffer) {
      granularSynth.audioBuffer = buffer;
      granularSynth.createGrains(true);

      const handleTrigger = (isAudio, originalBuffer, gainNode) => {
        if (isAudio) {
          const bufferSource = audioCtx.createBufferSource();
          bufferSource.buffer = originalBuffer;
          bufferSource.connect(audioCtx.destination);
          if (config.playAudio) {
            const duration = config.enableEnvelopes ? config.attack + config.release : bufferSource.buffer.duration
            bufferSource.start(0, config.offset,duration);
            bufferSource.loop = config.loopAudio;
            if (config.enableEnvelopes) {
              gainNode.gain.setValueAtTime(0.0, 0);
              gainNode.gain.linearRampToValueAtTime(Math.random(),0 + config.attack);
              gainNode.gain.linearRampToValueAtTime(0, 0 + (config.attack + config.release));
            }
          }
        } else {
          databender.render(originalBuffer, config)
            .then((buffer) => databender.draw.call(databender, buffer, config))
        }
      }

      document.addEventListener('keypress', (e) => {
        if (e.code === 'Enter') {
          granularSynth.play(handleTrigger);
        }
        if (e.code === 'Backslash') {
          granularSynth.stop();
        }
        if (e.code === 'KeyP') {
          config.grainIndex = 32;          
        }
        if (e.code === 'KeyO') {
          config.grainIndex = 27;          
        }
        if (e.code === 'KeyI') {
          config.grainIndex = 21;          
        }
        if (e.code === 'KeyU') {
          config.grainIndex = 18;          
        }
        if (e.code === 'KeyY') {
          config.grainIndex = 5;          
        }
        if (e.code === 'KeyT') {
          config.grainIndex = 11;          
        }
        if (e.code === 'KeyR') {
          config.grainIndex = 9;          
        }
        if (e.code === 'KeyE') {
          config.grainIndex = 25;          
        }
        if (e.code === 'KeyW') {
          config.grainIndex = 29;          
        }
        if (e.code === 'KeyQ') {
          config.grainIndex = 1;          
        }
      });
    });
  }
};

main();
