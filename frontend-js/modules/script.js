import * as THREE from "three";

export default function script() {

  let scene, camera, renderer, mesh, clock;
  let current = 0, next = 1, isAnimating = false;
  let textures = [];
  let material;
  let currentEffect = 0;
  let isImagePhase = false; // slideshow active flag
  let video, videoTexture;

  // --- Assets ---
  const imagePaths = [
    "/assets/images/image1.png",
    "/assets/images/image2.png",
    "/assets/images/image3.png"
  ];

  const videoPaths = [
    "/assets/videos/intro1.mp4",   // first
    "/assets/videos/extra1.mp4"
  ];

  // --- Shaders ---
  const shaders = [
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;
        uniform float uTime;

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv);
          float ripple = sin(dist * 40.0 - uTime * 4.0) * 0.02;
          uv += normalize(uv) * ripple * (1.0 - uProgress);
          uv += 0.5;
          vec4 c1 = texture2D(uTex1, uv);
          vec4 c2 = texture2D(uTex2, uv);
          gl_FragColor = mix(c1, c2, uProgress);
        }
      `
    }
  ];

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  // --- Init ---
  init();

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10);
    camera.position.z = 1.5;

    renderer = new THREE.WebGLRenderer({ antialias: true });

    // --- Card container ---
    const card = document.createElement("div");
    card.style.position = "relative";
    card.style.margin = "50px auto";
    card.style.width = "80%";
    card.style.height = "500px";
    card.style.border = "2px solid #ccc";
    card.style.borderRadius = "16px";
    card.style.overflow = "hidden";
    card.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
    card.style.background = "#000";
    document.body.appendChild(card);

    // attach renderer to card
    card.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    window.addEventListener("resize", onResize);
    onResize(); // run once to size correctly

    // --- UI button ---
    const btn = document.createElement("button");
    btn.innerText = "Start Experience";
    btn.style.position = "absolute";
    btn.style.top = "50%";
    btn.style.left = "50%";
    btn.style.transform = "translate(-50%, -50%)";
    btn.style.padding = "20px 40px";
    btn.style.fontSize = "18px";
    btn.style.cursor = "pointer";
    btn.style.zIndex = "9999";
    card.appendChild(btn);

    btn.addEventListener("click", async () => {
      btn.remove();
      await loadAllTextures(imagePaths);
      startVideo(videoPaths[0], startSlideshow);

      // allow sound after first click
      card.addEventListener("click", () => {
        if (video) {
          video.muted = false;
          video.play();
        }
      }, { once: true });
    });
  }

  // --- Play Video ---
  function startVideo(path, onEnd) {
    video = document.createElement("video");
    video.src = path;
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.autoplay = true;
    video.muted = false;
    video.playsInline = true;

    video.addEventListener("canplay", () => {
      video.play().catch(err => console.warn("Autoplay blocked:", err));
    });

    videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    const geo = new THREE.PlaneGeometry(2, 2);
    material = new THREE.MeshBasicMaterial({ map: videoTexture });
    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    animate();

    video.onended = () => {
      scene.remove(mesh);
      video.pause();
      onEnd && onEnd();
    };
  }

  // --- Slideshow ---
  function startSlideshow() {
    isImagePhase = true;
    const geo = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: shaders[currentEffect].fragmentShader,
      uniforms: {
        uTex1: { value: textures[current] },
        uTex2: { value: textures[next] },
        uProgress: { value: 0 },
        uTime: { value: 0 }
      },
      side: THREE.DoubleSide
    });

    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    setInterval(nextSlide, 4000);

    setTimeout(() => {
      isImagePhase = false;
      scene.remove(mesh);
      playExtraVideos();
    }, imagePaths.length * 4000 + 2000);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (isImagePhase && material.uniforms) {
      material.uniforms.uTime.value = clock.getElapsedTime();
    }
    renderer.render(scene, camera);
  }

  function nextSlide() {
    if (!isImagePhase || isAnimating) return;
    isAnimating = true;

    const total = textures.length;
    current = (current + 1) % total;
    next = (current + 1) % total;
    currentEffect = (currentEffect + 1) % shaders.length;

    material.fragmentShader = shaders[currentEffect].fragmentShader;
    material.needsUpdate = true;
    material.uniforms.uTex1.value = textures[(current - 1 + total) % total];
    material.uniforms.uTex2.value = textures[current];

    tween(0, 1, 1500, (p) => {
      material.uniforms.uProgress.value = p;
    }, () => { isAnimating = false; });
  }

  async function playExtraVideos() {
    for (let i = 1; i < videoPaths.length; i++) {
      await new Promise(resolve => startVideo(videoPaths[i], resolve));
    }
  }

  // --- Helpers ---
  function tween(from, to, duration, onUpdate, onComplete) {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      onUpdate(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
      else onComplete && onComplete();
    }
    requestAnimationFrame(step);
  }

  function loadAllTextures(paths) {
    const loader = new THREE.TextureLoader();
    return Promise.all(paths.map(p => new Promise((res, rej) => {
      loader.load(p, tex => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        res(tex);
      }, undefined, rej);
    }))).then(list => textures = list);
  }

  function onResize() {
    const card = renderer.domElement.parentElement;
    const width = card.clientWidth;
    const height = card.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // --- Recording Setup (unchanged) ---
  let recordedChunks = [];
  let recorder, isRecording = false;
  let mimeType;
  let recordedVideoBlob;

  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    mimeType = "video/webm;codecs=vp8";
  } else if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
    mimeType = "video/mp4;codecs=avc1";
  } else {
    alert("No supported MIME type found for MediaRecorder.");
  }

  const recordBtn = document.createElement("button");
  recordBtn.innerText = "Start Recording";
  recordBtn.style.position = "absolute";
  recordBtn.style.bottom = "20px";
  recordBtn.style.left = "50%";
  recordBtn.style.transform = "translateX(-50%)";
  recordBtn.style.padding = "10px 20px";
  recordBtn.style.zIndex = "9999";
  document.body.appendChild(recordBtn);

  recordBtn.addEventListener("click", () => {
    if (!isRecording) {
      startRecording();
      recordBtn.innerText = "Stop Recording";
    } else {
      stopRecording();
      recordBtn.innerText = "Start Recording";
    }
  });

  function startRecording() {
    recordedChunks = [];
    const canvasStream = renderer.domElement.captureStream(60);

    let combinedStream = canvasStream;
    if (video) {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioCtx.destination);
      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);
    }

    recorder = new MediaRecorder(combinedStream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    recorder.onstop = () => {
      recordedVideoBlob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(recordedVideoBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "recording." + (mimeType.includes("webm") ? "webm" : "mp4");
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    isRecording = true;
  }

  function stopRecording() {
    if (isRecording) {
      recorder.stop();
      isRecording = false;
    }
  }
}
