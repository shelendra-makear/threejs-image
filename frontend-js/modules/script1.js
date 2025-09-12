import * as THREE from "three";

export function script2 () {
    // ---------------- THREE.JS SCENE ----------------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Video element as texture source
    const video = document.createElement("video");
    video.src = "/assets/videos/extra1.mp4"; // replace with your video
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.muted = false; // iOS Safari requires muted autoplay

    const videoTexture = new THREE.VideoTexture(video);
    const geometry = new THREE.PlaneGeometry(2, 1.2);
    const material = new THREE.MeshBasicMaterial({ map: videoTexture });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // ---------------- RECORDING ----------------
    let recorder, recordedChunks = [];
    let mimeType;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS && MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
      mimeType = "video/mp4;codecs=avc1";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    } else {
      mimeType = "video/mp4"; // fallback
    }

    function startRecording() {
      // Start video when recording starts
      video.currentTime = 0;
      video.play();

      const stream = renderer.domElement.captureStream(30); // capture canvas at 30 FPS
      recorder = new MediaRecorder(stream, { mimeType });
      recordedChunks = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };

      recorder.onstop = () => {
        // Pause video when recording stops
        video.pause();

        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        const videoPreview = document.getElementById("preview");
        videoPreview.src = url;

        const a = document.createElement("a");
        a.href = url;
        a.download = mimeType.includes("mp4") ? "recording.mp4" : "recording.webm";
        a.click();
      };

      recorder.start();
      document.getElementById("startBtn").disabled = true;
      document.getElementById("stopBtn").disabled = false;
    }

    function stopRecording() {
      recorder.stop();
      document.getElementById("startBtn").disabled = false;
      document.getElementById("stopBtn").disabled = true;
    }

    document.getElementById("startBtn").addEventListener("click", startRecording);
    document.getElementById("stopBtn").addEventListener("click", stopRecording);
}
