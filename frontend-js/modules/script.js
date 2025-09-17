import * as THREE from "three";

export function script(containerId = "canvasContainer") {


    let scene, camera, renderer, mesh, clock;
    let video, videoTexture, material;
    let container;
    let overlays = [];
    let recorder, recordedChunks = [];
    let mimeType;
    let recordedBlob;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS && MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
      mimeType = "video/mp4;codecs=avc1";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    } else {
      mimeType = "video/mp4";
    }

    container = document.getElementById("canvasContainer");

    // --- Scene ---
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.z = 1;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    window.addEventListener("resize", onResize);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(map, vUv);
      }
    `;

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

    function createVideoPlane() {
      if (mesh) scene.remove(mesh);

      videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;

      const screenAspect = window.innerWidth / window.innerHeight;
      const videoAspect = video.videoWidth / video.videoHeight;

      let width, height;
      if (screenAspect > videoAspect) {
        height = 1;
        width = height * videoAspect / screenAspect;
      } else {
        width = 1;
        height = width * screenAspect / videoAspect;
      }

      const geo = new THREE.PlaneGeometry(width, height);
      material = new THREE.ShaderMaterial({
        uniforms: { map: { value: videoTexture } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      mesh = new THREE.Mesh(geo, material);
      scene.add(mesh);
    }

    function createOverlays() {
      const fps = 30;
      const overlayData = [
        { startFrame: 30, endFrame: 150, image: "/assets/images/image1.png" },
        { startFrame: 200, endFrame: 350, image: "/assets/images/image2.png" }
      ];

      overlayData.forEach(data => {
        const loader = new THREE.TextureLoader();
        const geo = new THREE.PlaneGeometry(2, 2); // full plane
        const mat = new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0 });
        const overlayMesh = new THREE.Mesh(geo, mat);
        overlayMesh.position.set(-1.2, 0, 0.51); // start off-screen left
        scene.add(overlayMesh);
        overlays.push({ ...data, mesh: overlayMesh, material: mat });
        
        loader.load(data.image, tex => {
          mat.map = tex;
          mat.needsUpdate = true;
        });
      });
    }

    function animate() {
      requestAnimationFrame(animate);

      // Overlay animation
      if (video && !video.paused && !video.ended) {
        const fps = 30;
        const currentFrame = Math.floor(video.currentTime * fps);

        overlays.forEach(o => {
          if (currentFrame >= o.startFrame && currentFrame <= o.endFrame) {
            o.material.opacity = Math.min(1, o.material.opacity + 0.05);
            const progress = (currentFrame - o.startFrame) / (o.endFrame - o.startFrame);
            o.mesh.position.x = -1.2 + 2.4 * progress;
          } else {
            o.material.opacity = Math.max(0, o.material.opacity - 0.05);
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
      if (video && video.videoWidth > 0) createVideoPlane();
    }

    // --- Recording ---
    function startRecording() {
      video.currentTime = 0;
      video.play();

      const stream = renderer.domElement.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType });
      recordedChunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      recorder.onstop = () => {
        video.pause();
        recordedBlob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(recordedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = mimeType.includes("mp4") ? "recording.mp4" : "recording.webm";
        a.click();

        const videoPreview = document.getElementById("preview");
        videoPreview.src = url;

        document.getElementById("shareBtn").disabled = false;
      };

      recorder.start();
      document.getElementById("startBtn").disabled = true;
      document.getElementById("stopBtn").disabled = false;
    }

    function stopRecording() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      document.getElementById("startBtn").disabled = false;
      document.getElementById("stopBtn").disabled = true;
    }

    async function shareVideo() {
      if (!recordedBlob) return alert("Please record video first!");
      const file = new File([recordedBlob], "recording.mp4", { type: mimeType });

      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Video",
            text: "Check out this video I recorded!",
          });
        } else if (navigator.share) {
          await navigator.share({
            title: "My Video",
            text: "Check out this video I recorded!",
          });
          alert("This device cannot share video files, only text.");
        } else {
          alert("Sharing is not supported on this device/browser.");
        }
      } catch (err) {
        console.error("Error sharing:", err);
      }
    }

    document.getElementById("startBtn").addEventListener("click", startRecording);
    document.getElementById("stopBtn").addEventListener("click", stopRecording);
    document.getElementById("shareBtn").addEventListener("click", shareVideo);
}
