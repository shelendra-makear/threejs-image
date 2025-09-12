import * as THREE from "three";

export function script2() {
    // ---------------- THREE.JS SCENE ----------------
   const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const video = document.createElement("video");
    video.src = "/assets/videos/extra1.mp4"; // replace with your video
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.muted = false;

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
    let recordedBlob;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS && MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
      mimeType = "video/mp4;codecs=avc1";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    } else {
      mimeType = "video/mp4";
    }

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
            // Device can share the video file
            await navigator.share({
                files: [file],
                title: "My Video",
                text: "Check out this video I recorded!",
            });
            console.log("Video shared successfully!");
        } else if (navigator.share) {
            // Device cannot share files but can share text/URLs
            await navigator.share({
                title: "My Video",
                text: "Check out this video I recorded!",
            });
            alert("This device cannot share video files, only text.");
        } else {
            // Device does not support Web Share API at all
            alert(
                "Sharing is not supported on this device/browser. You cannot share the video here."
            );
        }
    } catch (err) {
        // User canceled or blocked sharing
        console.error("Error sharing:", err);
        if (err.name === "NotAllowedError") {
            alert(
                "Sharing was blocked or canceled. You cannot share the video on this device."
            );
        }
    }
}



    document.getElementById("startBtn").addEventListener("click", startRecording);
    document.getElementById("stopBtn").addEventListener("click", stopRecording);
    document.getElementById("shareBtn").addEventListener("click", shareVideo);
}
