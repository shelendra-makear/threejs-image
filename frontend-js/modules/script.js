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

  container = document.getElementById(containerId);
  if (!container) return console.error(`Container ${containerId} not found!`);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10);
  camera.position.z = 1;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

  // Video plane shader (just plain texture)
  const fragmentShaderVideo = `
    uniform sampler2D map;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(map, vUv);
    }
  `;

  // Overlay circular zoom shader
  const overlayCircleShader = `
    uniform sampler2D map;
uniform float opacity;
uniform float progress; // 0 → 1
varying vec2 vUv;

void main() {
    vec2 center = vec2(0.5,0.5);
    float dist = distance(vUv, center);
    vec4 tex = texture2D(map, vUv);

    // Zoom in: progress 0→1, Zoom out: progress 1→0
    if(dist < progress){
        gl_FragColor = vec4(tex.rgb, opacity);
    } else {
        gl_FragColor = vec4(0.0,0.0,0.0,0.0); // fully transparent outside circle
    }
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

  let videoMesh;

  function createVideoPlane() {
    const videoTexture = new THREE.VideoTexture(video);
    const aspect = video.videoWidth / video.videoHeight;

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(fov / 2) * camera.position.z;
    const width = height * camera.aspect;

    let planeWidth, planeHeight;
    if (width / height > aspect) {
      planeHeight = height;
      planeWidth = height * aspect;
    } else {
      planeWidth = width;
      planeHeight = width / aspect;
    }

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: videoTexture } },
      vertexShader,
      fragmentShader: fragmentShaderVideo,
      transparent: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    if (videoMesh) scene.remove(videoMesh);
    videoMesh = new THREE.Mesh(geometry, material);
    scene.add(videoMesh);
  }

  function createOverlays() {
    const overlayData = [
      { startFrame: 0, endFrame: 100, image: "/assets/images/image1.png" },
      { startFrame: 200, endFrame: 350, image: "/assets/images/jjhjh.png" }
    ];

    overlayData.forEach(data => {
      const loader = new THREE.TextureLoader();
      const mat = new THREE.ShaderMaterial({
        uniforms: { 
          map: { value: null }, 
          opacity: { value: 1 }, 
          progress: { value: 0 } 
        },
        vertexShader,
        fragmentShader: overlayCircleShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const overlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat);
      scene.add(overlayMesh);
      overlays.push({ ...data, mesh: overlayMesh, material: mat });

    loader.load(data.image, tex => {
    mat.uniforms.map.value = tex;

    // Video plane size in pixels (optional: you can define a base scale)
    const videoPixelWidth = video.videoWidth;
    const videoPixelHeight = video.videoHeight;

    // Desired overlay size in pixels
    const overlayPixelWidth = 480;
    const overlayPixelHeight = 848;

    // Scale factor to convert pixels → world units
    const scaleX = (overlayPixelWidth / videoPixelWidth) * videoMesh.geometry.parameters.width;
    const scaleY = (overlayPixelHeight / videoPixelHeight) * videoMesh.geometry.parameters.height;

    overlayMesh.geometry.dispose();
    overlayMesh.geometry = new THREE.PlaneGeometry(scaleX, scaleY);

    // Center on video plane
    overlayMesh.position.copy(videoMesh.position);
    overlayMesh.position.z += 0.01;
});

    });
  }

  function animate() {
    requestAnimationFrame(animate);

    if(video && !video.paused && !video.ended){
      const fps = 30;
      const currentFrame = Math.floor(video.currentTime * fps);

      overlays.forEach(o => {
        const start = o.startFrame;
        const holdStart = start + 20;
        const holdEnd = o.endFrame - 20;
        const end = o.endFrame;

        if(currentFrame < start || currentFrame > end){
          o.material.uniforms.progress.value = 0;
        }
        else if(currentFrame >= start && currentFrame < holdStart){
          // zoom in circle
          o.material.uniforms.progress.value = (currentFrame - start)/(holdStart - start);
        }
        else if(currentFrame >= holdStart && currentFrame <= holdEnd){
          o.material.uniforms.progress.value = 1;
        }
       // currentFrame logic in animate()
else if(currentFrame > holdEnd && currentFrame <= end){
    // Zoom out circular
    o.material.uniforms.progress.value = 1 - (currentFrame - holdEnd) / (end - holdEnd);
}

      });
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- Recording + Sharing ---
  function startRecording(){
    if(!video) return alert("Video not ready!");
    video.currentTime = 0;
    video.play();

    const canvasStream = renderer.domElement.captureStream(30);
    if(video.captureStream){
      const audioStream = video.captureStream().getAudioTracks();
      if(audioStream.length) canvasStream.addTrack(audioStream[0]);
    }

    recorder = new MediaRecorder(canvasStream, { mimeType });
    recordedChunks = [];
    recorder.ondataavailable = e => { if(e.data.size) recordedChunks.push(e.data); };
    recorder.onstop = () => {
      video.pause();
      recordedBlob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(recordedBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = mimeType.includes("mp4") ? "recording.mp4" : "recording.webm";
      a.click();

      const videoPreview = document.getElementById("preview");
      if(videoPreview) videoPreview.src = url;
      const shareBtn = document.getElementById("shareBtn");
      if(shareBtn) shareBtn.disabled = false;
    };

    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    recorder.start();
    if(startBtn) startBtn.disabled = true;
    if(stopBtn) stopBtn.disabled = false;
  }

  function stopRecording(){
    if(recorder && recorder.state!=="inactive") recorder.stop();
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    if(startBtn) startBtn.disabled = false;
    if(stopBtn) stopBtn.disabled = true;
  }

  async function shareVideo() {
  if (!recordedBlob) {
    return alert("Please record video first!");
  }

  // Always save as WebM for widest support
  const fileType = mimeType.includes("webm") ? "video/webm" : "video/mp4";
  const file = new File([recordedBlob], "recording." + (fileType.includes("mp4") ? "mp4" : "webm"), { type: fileType });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // ✅ Modern Android Chrome supports this
      await navigator.share({
        files: [file],
        title: "My Video",
        text: "Check out this video!",
      });
    } else if (navigator.share) {
      // ✅ Fallback: only text share
      await navigator.share({
        title: "My Video",
        text: "Check out this video!",
      });
      alert("This browser cannot share video files, only text.");
    } else {
      // ❌ Not supported at all
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording." + (fileType.includes("mp4") ? "mp4" : "webm");
      a.click();
      alert("Sharing is not supported on this device. File downloaded instead.");
    }
  } catch (err) {
    console.error("Error sharing:", err);
    alert("Share failed: " + err.message);
  }
}


  // --- Button listeners ---
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const shareBtn = document.getElementById("shareBtn");
  if(startBtn) startBtn.addEventListener("click",startRecording);
  if(stopBtn) stopBtn.addEventListener("click",stopRecording);
 

  if (shareBtn) shareBtn.addEventListener("click", shareVideo);
}
