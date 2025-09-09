import * as THREE from "three";
export default function script() {


  let scene, camera, renderer, mesh, clock;
  let current = 0, next = 1, isAnimating = false;
  let textures = [];
  let material;
  let currentEffect = 0;

  const imagePaths = [
    "/assets/images/image1.png",
    "/assets/images/image2.png",
    "/assets/images/image3.png",
    "/assets/images/image4.png",
    "/assets/images/image5.png",
    "/assets/images/image6.png"
  ];

  // --- Shaders ---
  const shaders = [
    // 1. Wave Ripple Diffraction
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;
        uniform float uTime;

        void main() {
          vec2 uv = vUv;
          uv.y += sin(uv.x * 20.0 + uTime * 2.0) * 0.05 * (1.0 - uProgress);
          vec4 c1 = texture2D(uTex1, uv);
          vec4 c2 = texture2D(uTex2, uv);
          gl_FragColor = mix(c1, c2, uProgress);
        }
      `
    },
    // 2. RGB Split Diffraction
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;
        uniform float uTime;

        void main() {
          vec2 uv = vUv;
          vec4 c1 = vec4(
            texture2D(uTex1, uv + vec2(0.01 * uProgress,0)).r,
            texture2D(uTex1, uv).g,
            texture2D(uTex1, uv - vec2(0.01 * uProgress,0)).b,
            1.0);
          vec4 c2 = texture2D(uTex2, uv);
          gl_FragColor = mix(c1, c2, uProgress);
        }
      `
    },
    // 3. Circular Ripple
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
    },
    // 4. Swirl Distortion
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;

        void main() {
          vec2 uv = vUv - 0.5;
          float angle = uProgress * 3.14159;
          float s = sin(angle), c = cos(angle);
          uv = mat2(c, -s, s, c) * uv;
          uv += 0.5;
          vec4 c1 = texture2D(uTex1, uv);
          vec4 c2 = texture2D(uTex2, uv);
          gl_FragColor = mix(c1, c2, uProgress);
        }
      `
    },
    // 5. Glass Refraction
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;
        uniform float uTime;

        void main() {
          vec2 uv = vUv;
          uv.x += sin(uv.y*20.0+uTime*2.0)*0.02*uProgress;
          uv.y += cos(uv.x*20.0+uTime*2.0)*0.02*uProgress;
          vec4 c1 = texture2D(uTex1, uv);
          vec4 c2 = texture2D(uTex2, uv);
          gl_FragColor = mix(c1, c2, uProgress);
        }
      `
    },
    // 6. Kaleidoscope Diffraction
    // {
    //   fragmentShader: `
    //     varying vec2 vUv;
    //     uniform sampler2D uTex1;
    //     uniform sampler2D uTex2;
    //     uniform float uProgress;

    //     void main() {
    //       vec2 uv = vUv - 0.5;
    //       float angle = atan(uv.y, uv.x);
    //       float radius = length(uv);
    //       angle = mod(angle, 3.14159/3.0); // 6-way symmetry
    //       vec2 kaleido = vec2(cos(angle), sin(angle)) * radius;
    //       vec4 c1 = texture2D(uTex1, kaleido + 0.5);
    //       vec4 c2 = texture2D(uTex2, kaleido + 0.5);
    //       gl_FragColor = mix(c1, c2, uProgress);
    //     }
    //   `
    // },
    // 9. Glitter Transition
{
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform float uProgress;
    uniform float uTime;

    // Simple pseudo-random
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec4 c1 = texture2D(uTex1, vUv);
      vec4 c2 = texture2D(uTex2, vUv);

      // Glitter mask: random threshold that changes over time
      float sparkle = random(vUv * (10.0 + sin(uTime*5.0)*5.0) + uTime);

      // Glitter activates gradually with uProgress
      float alpha = step(sparkle, uProgress);

      // Add some shimmer by mixing slightly
      vec4 color = mix(c1, c2, alpha);
      color.rgb += (sparkle < 0.05) ? vec3(0.2,0.2,0.2) : vec3(0.0);

      gl_FragColor = color;
    }
  `
},
    // 7. Dissolve Transition
    {
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;
        uniform float uProgress;
        uniform float uTime;

        // Simple hash-based random
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
          vec4 c1 = texture2D(uTex1, vUv);
          vec4 c2 = texture2D(uTex2, vUv);

          float threshold = random(vUv + uTime * 0.05);
          float alpha = step(threshold, uProgress);

          gl_FragColor = mix(c1, c2, alpha);
        }
      `
    },
    // 8. Checkerboard Transition
    {
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform float uProgress;

    void main() {
      vec4 c1 = texture2D(uTex1, vUv);
      vec4 c2 = texture2D(uTex2, vUv);

      // Checkerboard grid size
      float squares = 20.0; // increase for finer grid
      vec2 coord = floor(vUv * squares);

      // Alternate pattern
      float checker = mod(coord.x + coord.y, 2.0);

      // Each square flips based on progress and checker pattern
      float threshold = mix(0.0, 1.0, checker);
      float alpha = step(threshold, uProgress);

      gl_FragColor = mix(c1, c2, alpha);
    }
  `
},
// 10. Blinds Transition
{
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform float uProgress;

    void main() {
      vec4 c1 = texture2D(uTex1, vUv);
      vec4 c2 = texture2D(uTex2, vUv);

      // Number of blinds
      float blinds = 10.0;  // increase for thinner blinds
      float pos = floor(vUv.x * blinds) / blinds;

      // Each blind opens as uProgress increases
      float alpha = step(pos, uProgress);

      gl_FragColor = mix(c1, c2, alpha);
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
  loadAllTextures(imagePaths).then(start);

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 10);
    camera.position.z = 1.5;

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    window.addEventListener("resize", onResize);
  }

  async function start() {
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

    animate();
    setInterval(nextSlide, 4000);
  }

  function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }

  function nextSlide() {
    if (isAnimating) return;
    isAnimating = true;

    const total = textures.length;
    current = (current + 1) % total;
    next = (current + 1) % total;
    currentEffect = (currentEffect + 1) % shaders.length;

    // Switch shader
    material.fragmentShader = shaders[currentEffect].fragmentShader;
    material.needsUpdate = true;
    material.uniforms.uTex1.value = textures[(current - 1 + total) % total];
    material.uniforms.uTex2.value = textures[current];

    tween(0, 1, 1500, (p) => {
      material.uniforms.uProgress.value = p;
    }, () => {
      isAnimating = false;
    });
  }

  // simple tween
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
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
}


