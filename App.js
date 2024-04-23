import Databender from "databender";
import dat from "dat.gui";
import config from "./config.json" assert { type: "json" };
import { GranularSynth } from "./GranularSynth.js";

function handleDatGUI(audioGranularSynth, videoGranularSynth) {
  const gui = new dat.GUI();
  Object.keys(config).forEach(function (param) {
    gui
      .add(config, param, 0, 2000, 1)
      .listen()
      .onFinishChange(function (value) {
        config[param] = value;
        audioGranularSynth.updateValues(config);
        videoGranularSynth.updateValues(config);
      });
  });
}

function renderVideoToCanvas(v, renderCanvas, databender, videoGranularSynth) {
  let timer;
  let time;

  function drawFrame() {
    if (v.paused || v.ended) return false;
    databender.convert(v).then((buffer) => {
      videoGranularSynth.createGrains(buffer);
    });
  }

  (function repeat() {
    time = 1000 / config.frameRate;
    drawFrame(v, renderCanvas);
    timer = setTimeout(repeat, time);
  })();
}

function handleImageUpload(file, renderCanvas, databender, videoGranularSynth) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      databender.convert(img).then((buffer) => {
        videoGranularSynth.createGrains(buffer);
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleVideoUpload(file, renderCanvas, databender, videoGranularSynth) {
  const reader = new FileReader();
  const video = document.createElement("video");

  video.addEventListener(
    "play",
    () =>
      renderVideoToCanvas(video, renderCanvas, databender, videoGranularSynth),
    false,
  );

  reader.onload = function (event) {
    video.src = this.result;
    video.muted = true;
    video.type = "video/mp4";
    video.loop = true;
    video.play();
  };
  reader.readAsDataURL(file);
}

function handleAudioUpload(file, audioCtx, audioGranularSynth) {
  var audioFileReader = new FileReader();
  audioFileReader.onload = () => {
    audioCtx.decodeAudioData(audioFileReader.result, function (buffer) {
      audioGranularSynth.createGrains(buffer);
    });
  };

  audioFileReader.readAsArrayBuffer(file);
}

function getFileType(extension) {
  const audioFileTypes = ["m4a", "x-m4a", "mp3"];
  const imageFileTypes = ["jpg", "png", "bmp", "jpeg"];
  const videoFileTypes = ["mp4", "webm"];
  let fileType;

  if (imageFileTypes.includes(extension)) {
    fileType = "image";
  } else if (videoFileTypes.includes(extension)) {
    fileType = "video";
  } else if (audioFileTypes.includes(extension)) {
    fileType = "audio";
  } else {
    return null;
  }

  return fileType;
}

function handleFileUpload(
  file,
  renderCanvas,
  databender,
  videoGranularSynth,
  audioGranularSynth,
  audioCtx,
) {
  const type = getFileType(file.name.split(".")[1]);
  switch (type) {
    case "image":
      return handleImageUpload(
        file,
        renderCanvas,
        databender,
        videoGranularSynth,
      );
    case "video":
      return handleVideoUpload(
        file,
        renderCanvas,
        databender,
        videoGranularSynth,
      );
    case "audio":
      return handleAudioUpload(file, audioCtx, audioGranularSynth);
    default:
      alert("File Type is not supported");
      return false;
  }
}

function handleDragOver(e) {
  e.preventDefault();
  const fileType = e.dataTransfer.items[0].type.split("/")[0];
  this.innerHTML = `Upload ${fileType}`;
  this.classList.add("hover");
}

function handleDragLeave(e) {
  e.preventDefault();
  this.innerHTML = "Drop file here to upload";
  this.classList.remove("hover");
}

function handleDragEnd(e) {
  e.preventDefault();
}

export function App() {
  const audioCtx = new AudioContext();
  const renderCanvas = document.querySelector("#canvas");
  const dropzone = document.querySelector(".dropzone");
  const button = document.querySelector("button");
  const databender = new Databender(config, audioCtx);
  const audioGranularSynth = new GranularSynth(audioCtx, config);
  const videoGranularSynth = new GranularSynth(audioCtx, config);
  handleDatGUI(audioGranularSynth, videoGranularSynth);
  dropzone.ondragover = handleDragOver;
  dropzone.ondragleave = handleDragLeave;
  dropzone.ondragend = handleDragEnd;
  dropzone.ondrop = function (e) {
    e.preventDefault();
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    handleFileUpload(
      files[0],
      renderCanvas,
      databender,
      videoGranularSynth,
      audioGranularSynth,
      audioCtx,
    );
  };

  button.onclick = (e) => {
    if (!audioGranularSynth.grains || !videoGranularSynth.grains) {
      alert("You need to upload video and audio before you can granulate");
      return false;
    } else if (!audioGranularSynth.grains) {
      alert("You need to upload audio before you can granulate");
    } else if (!videoGranularSynth.grains) {
      alert("You need to upload image or video before you can granulate");
    }

    let bufferSource;

    document.querySelector(".dropzone").style.display = "none";
    const audioTriggerCallback = (originalBuffer, gainNode) => {
      databender.render(originalBuffer).then((buffer) => {
        if (bufferSource) bufferSource.stop();
        bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = buffer;
        bufferSource.loop = config.loopAudio;
        bufferSource.connect(audioCtx.destination);
        if (config.playAudio) {
          bufferSource.start(0);
        }
      });
    };

    const videoTriggerCallback = (originalBuffer) => {
      databender
        .render(originalBuffer)
        .then((buffer) =>
          databender.draw(
            buffer,
            renderCanvas.getContext("2d"),
            0,
            0,
            0,
            0,
            databender.imageData.width,
            databender.imageData.height / config.numberOfGrains,
          ),
        );
    };

    document.addEventListener("keypress", (e) => {
      var keyboard = "`qwertyuiopasdfghjklzxcvbnm";

      if (e.code === "Backslash") {
        audioGranularSynth.stop();
        videoGranularSynth.stop();
      }

      // Key codes are kind of inflexible if you're using a shift+key
      if (e.code === "Equal")
        config.numberOfGrains > 0 ? (config.numberOfGrains += 5) : 0;
      if (e.key === "-")
        config.numberOfGrains > 0 ? (config.numberOfGrains -= 5) : 0;

      keyboard
        .toUpperCase()
        .split("")
        .forEach((letter, index) => {
          if (e.code === `Key${letter}`) {
            config.grainIndex = index + 1;
          }
        });

      audioGranularSynth.updateValues(config);
      videoGranularSynth.updateValues(config);
    });

    audioGranularSynth.play(audioTriggerCallback);
    videoGranularSynth.play(videoTriggerCallback);
  };
}
