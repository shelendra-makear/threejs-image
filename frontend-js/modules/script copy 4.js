import * as THREE from "three";

export function script(containerId = "canvasContainer") {
  let scene, camera, renderer, mesh, clock;
  let video, videoTexture, material;
  let container;

  // --- Container ---
  container = document.getElementById(containerId) || document.body;

  // --- Scene & Camera ---
  scene = new THREE.Scene();
  const { clientWidth, clientHeight } = container;
  camera = new THREE.PerspectiveCamera(60, clientWidth / clientHeight, 0.1, 10);
  camera.position.z = 1.5;

  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(clientWidth, clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  window.addEventListener("resize", onResize);

  // --- Shaders for video ---
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  const videoFragmentShader = `
    uniform sampler2D map;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec4 texelColor = texture2D(map, vUv);
      if (texelColor.a == 0.0) discard;

      texelColor.rgb = (texelColor.rgb - 0.5) * contrast + 0.5;
      texelColor.rgb *= brightness;

      float avg = (texelColor.r + texelColor.g + texelColor.b) / 3.0;
      texelColor.rgb = mix(vec3(avg), texelColor.rgb, saturation);

      gl_FragColor = texelColor;
    }
  `;

  // --- Start video ---
  startVideo("/assets/videos/intro.mp4", () => {
    console.log("Video ended");
  });

  function startVideo(path, onEnd) {
    video = document.createElement("video");
    video.src = path;
    video.crossOrigin = "anonymous";
    video.loop = false;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("canplay", () => {
      video.play().catch(err => console.warn("Autoplay blocked:", err));
    });

    videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    const geo = new THREE.PlaneGeometry(2, 2); // full video plane
    material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: videoTexture },
        brightness: { value: 1.0 },
        contrast: { value: 1.0 },
        saturation: { value: 1.2 },
        uTime: { value: 0 }
      },
      vertexShader,
      fragmentShader: videoFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    // --- Timeline Overlays (frame-based) ---
    const fps = 30; // adjust to your video frame rate
    const overlays = [
      { startFrame: 1, endFrame: 200, image: "/assets/images/image1.png", mesh: null },
      { startFrame: 300, endFrame: 550, image: "/assets/images/image2.png", mesh: null },
      { startFrame: 600, endFrame: 850, image: "/assets/images/image3.png", mesh: null }
    ];

    // --- Animate ---
    function animate() {
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      if (material?.uniforms?.uTime) material.uniforms.uTime.value = elapsed;

      // compute frame from video time
      if (video && !video.paused && !video.ended) {
        const currentFrame = Math.floor(video.currentTime * fps);

        overlays.forEach(event => {
          // show full screen overlay
          if (currentFrame >= event.startFrame && currentFrame <= event.endFrame && !event.mesh) {
            event.mesh = showOverlayImage(event.image);
          }
          // hide overlay
          if (event.mesh && currentFrame > event.endFrame) {
            scene.remove(event.mesh);
            event.mesh = null;
          }
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    video.onended = () => {
      scene.remove(mesh);
      video.pause();
      onEnd && onEnd();
    };
  }

  // --- Overlay helper (full size, full opacity) ---
  function showOverlayImage(path) {
    const loader = new THREE.TextureLoader();
    const geo = new THREE.PlaneGeometry(2, 2); // full video size
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1.0 });
    const overlay = new THREE.Mesh(geo, mat);
    overlay.position.set(0, 0, 0.51); // slightly above video
    scene.add(overlay);

    loader.load(path, tex => {
      mat.map = tex;
      mat.needsUpdate = true;
    });

    return overlay;
  }

  // --- Resize ---
  function onResize() {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }
}
