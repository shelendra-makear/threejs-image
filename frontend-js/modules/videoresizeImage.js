


import * as THREE from "three";

export function script(containerId = "canvasContainer") {
  let scene, camera, renderer, mesh, clock;
  let video, videoTexture, material;
  let container;
  let overlays = [];
  let recorder, recordedChunks = [];
  let mimeType;
  let recordedBlob;

  // --- Detect iOS for MediaRecorder support ---
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
    mimeType = "video/mp4;codecs=avc1";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    mimeType = "video/webm;codecs=vp8";
  } else {
    mimeType = "video/mp4";
  }

  // --- Get container ---
  container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found!`);
    return;
  }

  // --- Scene setup ---
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10);
  camera.position.z = 1;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  window.addEventListener("resize", onResize);

  // --- Shaders ---
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  const fragmentShaderVideo = `
    uniform sampler2D map;
    uniform vec2 scale;
    varying vec2 vUv;
    void main() {
      vec2 uv = (vUv - 0.5) / scale + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // red fill
      } else {
        gl_FragColor = texture2D(map, uv);
      }
    }
  `;

  const overlayFragmentShader = `
    uniform sampler2D map;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(map, vUv);
      gl_FragColor = vec4(tex.rgb, tex.a * opacity);
    }
  `;

  // --- Start video ---
  startVideo("/assets/videos/intro11.mp4");

  function startVideo(path) {
    video = document.createElement("video");
    video.src = path;
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.autoplay = true;
    video.muted = false;
    video.playsInline = true;

    video.addEventListener("canplay", () => {
      video.play().catch(err => console.warn("Autoplay blocked:", err));
      createVideoPlane();
      createOverlays();
    });
  }

  // // --- Video plane ---
 
function createVideoPlane() {
  if (mesh) scene.remove(mesh);

  videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.format = THREE.RGBAFormat;

  // --- Calculate visible size at camera ---
  const fov = THREE.MathUtils.degToRad(camera.fov); // vertical fov in radians
  const height = 2 * Math.tan(fov / 2) * camera.position.z;
  const width = height * camera.aspect;

  const videoAspect = video.videoWidth / video.videoHeight;

  let planeWidth, planeHeight;

  if (width / height > videoAspect) {
    // screen wider than video, video height = screen height
    planeHeight = height;
    planeWidth = height * videoAspect;
  } else {
    // screen taller than video, video width = screen width
    planeWidth = width;
    planeHeight = width / videoAspect;
  }

  const geo = new THREE.PlaneGeometry(planeWidth, planeHeight);

  material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: videoTexture },
      scale: { value: new THREE.Vector2(1, 1) }, // shader no longer needs scale
    },
    vertexShader,
    fragmentShader: fragmentShaderVideo,
    transparent: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
}

  // --- Overlay images ---
  


  function createOverlays() {
  const overlayData = [
    { startFrame: 30, endFrame: 150, image: "/assets/images/image1.png" },
    { startFrame: 200, endFrame: 350, image: "/assets/images/image2.png" }
  ];

  overlayData.forEach(data => {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, opacity: { value: 0 } },
      vertexShader,
      fragmentShader: overlayFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const overlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    scene.add(overlayMesh);
    overlays.push({ ...data, mesh: overlayMesh, material: mat });

    loader.load(data.image, tex => {
      mat.uniforms.map.value = tex;

      // --- Adjust plane size to fit screen like videoPlane ---
      const imgAspect = tex.image.width / tex.image.height;

      const fov = THREE.MathUtils.degToRad(camera.fov);
      const camHeight = 2 * Math.tan(fov / 2) * camera.position.z;
      const camWidth = camHeight * camera.aspect;

      let planeWidth, planeHeight;
      if (camWidth / camHeight > imgAspect) {
        // screen wider than image
        planeHeight = camHeight * 0.5; // scale factor (0.5 = half screen height)
        planeWidth = planeHeight * imgAspect;
      } else {
        planeWidth = camWidth * 0.5; // scale factor (0.5 = half screen width)
        planeHeight = planeWidth / imgAspect;
      }

      overlayMesh.geometry.dispose();
      overlayMesh.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

      // initial position (can animate later)
      overlayMesh.position.set(-camWidth / 2 - planeWidth / 2, 0, 0.5);
    });
  });
}


  // --- Animation loop ---
  function animate() {
    requestAnimationFrame(animate);

    if (video && !video.paused && !video.ended) {
      const fps = 30;
      const currentFrame = Math.floor(video.currentTime * fps);

      overlays.forEach(o => {
        const start = o.startFrame;
        const holdStart = start + 20;
        const holdEnd = o.endFrame - 20;
        const end = o.endFrame;

        if (currentFrame < start || currentFrame > end) {
          o.material.uniforms.opacity.value = 0;
        } else if (currentFrame >= start && currentFrame < holdStart) {
          o.material.uniforms.opacity.value = Math.min(1, o.material.uniforms.opacity.value + 0.05);
          const progress = (currentFrame - start) / (holdStart - start);
          o.mesh.position.x = -1.2 + progress * 1.2;
        } else if (currentFrame >= holdStart && currentFrame <= holdEnd) {
          o.material.uniforms.opacity.value = 1;
          o.mesh.position.x = 0;
        } else if (currentFrame > holdEnd && currentFrame <= end) {
          const progress = (currentFrame - holdEnd) / (end - holdEnd);
          o.material.uniforms.opacity.value = Math.max(0, o.material.uniforms.opacity.value - 0.05);
          o.mesh.position.x = progress * 1.2;
        }
      });
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (video && video.videoWidth > 0 && mesh) {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(fov / 2) * camera.position.z;
    const width = height * camera.aspect;
    const videoAspect = video.videoWidth / video.videoHeight;

    let planeWidth, planeHeight;
    if (width / height > videoAspect) {
      planeHeight = height;
      planeWidth = height * videoAspect;
    } else {
      planeWidth = width;
      planeHeight = width / videoAspect;
    }

    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  }
}

  
  function startRecording() {
    if (!video) return alert("Video not ready!");
    video.currentTime = 0;
    video.play();
    const stream = renderer.domElement.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType });
    recordedChunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    recorder.onstop = () => {
      video.pause();
      recordedBlob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mimeType.includes("mp4") ? "recording.mp4" : "recording.webm";
      a.click();
      const videoPreview = document.getElementById("preview");
      if (videoPreview) videoPreview.src = url;
      const shareBtn = document.getElementById("shareBtn");
      if (shareBtn) shareBtn.disabled = false;
    };
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    recorder.start();
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  async function shareVideo() {
    if (!recordedBlob) return alert("Please record video first!");
    const file = new File([recordedBlob], "recording.mp4", { type: mimeType });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Video", text: "Check out this video!" });
      } else if (navigator.share) {
        await navigator.share({ title: "My Video", text: "Check out this video!" });
        alert("This device cannot share video files, only text.");
      } else {
        alert("Sharing is not supported on this device/browser.");
      }
    } catch (err) { console.error("Error sharing:", err); }
  }

  // --- Button listeners ---
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const shareBtn = document.getElementById("shareBtn");
  if (startBtn) startBtn.addEventListener("click", startRecording);
  if (stopBtn) stopBtn.addEventListener("click", stopRecording);
  if (shareBtn) shareBtn.addEventListener("click", shareVideo);
}
