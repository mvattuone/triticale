import Databender from './databend';
import config from './config.json';
import GranularSynth from './granular';
import dat from 'dat.gui';

function handleDatGUI(databender, audioGranularSynth, videoGranularSynth){
  const gui = new dat.GUI();
  Object.keys(config).forEach(function (param) {
    gui.add(config, param, 0, 2000, 1)
      .listen()
      .onFinishChange(function (value) { 
        config[param] = value;
        audioGranularSynth.updateValues(config);
        videoGranularSynth.updateValues(config);
      });
  });
};

function renderVideoToCanvas(v, renderCanvas, databender, videoGranularSynth) {
  let timer;
  let time;

  function drawFrame() {
    if(v.paused || v.ended) return false;
    databender.bend(v)
      .then((buffer) => {
        videoGranularSynth.createGrains(buffer);
      })
  }

  (function repeat() {
    time = 1000 / config.frameRate;  
    drawFrame(v, renderCanvas);
    timer = setTimeout(repeat, time);
  }());
}

function handleImageUpload (file, renderCanvas, databender, videoGranularSynth) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      databender.bend(img)
        .then((buffer) => {
          videoGranularSynth.createGrains(buffer);
        })
    };
    img.src = e.target.result;
  }
  reader.readAsDataURL(file);
}; 

function handleVideoUpload(file, renderCanvas, databender, videoGranularSynth){
  const reader = new FileReader();
  const video = document.createElement('video');

  video.addEventListener('play', () =>
    renderVideoToCanvas(video, renderCanvas, databender, videoGranularSynth)
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


function handleFileUpload(file, renderCanvas, databender, videoGranularSynth) {
  const type = getFileType(file);
  switch (type) { 
    case 'image': 
      return handleImageUpload(file, renderCanvas, databender, videoGranularSynth);
    case 'video':
      return handleVideoUpload(file, renderCanvas, databender, videoGranularSynth);
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
    const audioGranularSynth = new GranularSynth(audioCtx, config); 
    const videoGranularSynth = new GranularSynth(audioCtx, config); 
    handleDatGUI(databender, audioGranularSynth, videoGranularSynth);
    document.querySelector('.upload').style.display = 'none';
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    handleFileUpload(files[0], renderCanvas, databender, videoGranularSynth);
    audioCtx.decodeAudioData(window.trackBuffer, function (buffer) {
      audioGranularSynth.createGrains(buffer);

      const audioTriggerCallback = (originalBuffer, gainNode) => {
        databender.render(originalBuffer, config)
          .then((buffer) => {
              const bufferSource = audioCtx.createBufferSource();
              bufferSource.buffer = buffer;
              bufferSource.loop = config.loopAudio;
              bufferSource.connect(audioCtx.destination);
            if (config.playAudio) {
              bufferSource.start(0);
            }
          });
      }

      const videoTriggerCallback = (originalBuffer) => {
        databender.render(originalBuffer, config)
          .then((buffer) => databender.draw.call(databender, buffer, config))
      }

      document.addEventListener('keypress', (e) => {
        if (e.code === 'Enter') {
          audioGranularSynth.play(audioTriggerCallback);
          videoGranularSynth.play(videoTriggerCallback);
        }
        if (e.code === 'Backslash') {
          audioGranularSynth.stop();
          videoGranularSynth.stop();
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
