import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let stateRef = {};

export function initTrack3D(canvas, getState) {
  if (!canvas) return;

  // ─────────────────────────────
  // RENDERER (BRIGHT MODE)
  // ─────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  // ─────────────────────────────
  // SCENE (INDIAN RAILWAY DAYLIGHT)
  // ─────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaed6ff); // bright sky blue
  scene.fog = new THREE.Fog(0xaed6ff, 60, 200);

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
  camera.position.set(18, 14, 30);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = true;

  // ─────────────────────────────
  // LIGHTING (IMPORTANT UPGRADE)
  // ─────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));

  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  scene.add(sun);

  // ─────────────────────────────
  // GROUND & BALLAST
  // ─────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x6e7f60, roughness: 1.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.4, 150),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 })
  );
  ballast.position.y = 0.2;
  ballast.receiveShadow = true;
  scene.add(ballast);

  // ─────────────────────────────
  // TRACK (SEGMENTED HEATMAP)
  // ─────────────────────────────
  const railSegments = [];

  for (let zVal = -60; zVal <= 60; zVal += 12) {
    const matL = new THREE.MeshStandardMaterial({ color: 0x7d9b76, metalness: 0.9, roughness: 0.2 }); // Nominal Sage green rails
    const matR = new THREE.MeshStandardMaterial({ color: 0x7d9b76, metalness: 0.9, roughness: 0.2 });

    const rL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 12), matL);
    rL.position.set(-1.5, 0.48, zVal);
    rL.receiveShadow = true;
    scene.add(rL);

    const rR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 12), matR);
    rR.position.set(1.5, 0.48, zVal);
    rR.receiveShadow = true;
    scene.add(rR);

    railSegments.push({ z: zVal, left: rL, right: rR, matL, matR });
  }

  // sleepers
  for (let i = 0; i < 50; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8a847e, roughness: 0.8 })
    );
    s.position.set(0, 0.35, -60 + i * 2.5);
    s.receiveShadow = true;
    s.castShadow = true;
    scene.add(s);
  }

  // ─────────────────────────────
  // FAULT NODES (IP68 edge nodes)
  // ─────────────────────────────
  const nodes = [];
  const nodePositions = [-40, -20, 0, 20, 40];

  nodePositions.forEach((z, i) => {
    const group = new THREE.Group();
    group.position.set(-2.2, 0.6, z);

    // Node body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 })
    );
    body.castShadow = true;
    group.add(body);

    // LED
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.12),
      new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88 })
    );
    led.position.y = 0.25;
    group.add(led);

    scene.add(group);
    nodes.push({ group, led, z, risk: 0 });
  });

  // ─────────────────────────────
  // TRAIN (WAP-7 LOCOMOTIVE MODEL)
  // ─────────────────────────────
  const train = new THREE.Group();

  const coach = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x0044ff, metalness: 0.6, roughness: 0.2 }) // WAP-7 blue
  );
  coach.position.y = 1.1;
  coach.castShadow = true;
  coach.receiveShadow = true;
  train.add(coach);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.25, 11),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
  );
  roof.position.y = 2.1;
  train.add(roof);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.5, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 })
  );
  windshield.position.set(0, 1.4, 6.01);
  train.add(windshield);

  // Chevron orange nose
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.35, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xff6b35 })
  );
  nose.position.set(0, 0.6, 6.02);
  train.add(nose);

  const panto = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 1),
    new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true })
  );
  panto.position.set(0, 2.4, 2);
  train.add(panto);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
  const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
  wheelGeom.rotateZ(Math.PI / 2);

  for (let zOffset of [-4, -1.5, 1.5, 4]) {
    const wL = new THREE.Mesh(wheelGeom, wheelMat);
    wL.position.set(-1.6, 0.45, zOffset);
    wL.castShadow = true;
    train.add(wL);

    const wR = new THREE.Mesh(wheelGeom, wheelMat);
    wR.position.set(1.6, 0.45, zOffset);
    wR.castShadow = true;
    train.add(wR);
  }

  // Headlight spot
  const headLight = new THREE.SpotLight(0xffffff, 4, 30, Math.PI / 6, 0.5, 1);
  headLight.position.set(0, 1.0, 6.1);
  headLight.target.position.set(0, 0, 100);
  train.add(headLight);
  train.add(headLight.target);

  train.position.set(0, 0, 60);
  scene.add(train);

  // ─────────────────────────────
  // FAULT ZONE GLOW
  // ─────────────────────────────
  const faultGlow = new THREE.Mesh(
    new THREE.CircleGeometry(5, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0
    })
  );
  faultGlow.rotation.x = -Math.PI / 2;
  faultGlow.position.y = 0.49;
  scene.add(faultGlow);

  // ─────────────────────────────
  // UPDATE LOOP
  // ─────────────────────────────
  let pulseClock = 0;

  function animate() {
    requestAnimationFrame(animate);

    pulseClock += 0.05;

    const state = getState?.() || {};
    stateRef = state;

    // TRAIN MOVEMENT
    train.position.z = 60 - (state.simTrainPositionPercent / 100) * 120;

    // LED indicator pulsing
    nodes.forEach((n) => {
      const dist = Math.abs(n.z - (state.faultZ || 0));

      if (state.activeScenario && dist < 10) {
        let riskVal = state.simTrainPositionPercent || 0; // -20 to 100
        if (riskVal < 20) {
          // Stage 1: Yellow flash
          n.led.material.color.setHex(0xffb800);
          n.led.material.emissive.setHex(0xffb800);
          document.getElementById('canvas-node-led').textContent = "WARNING";
          document.getElementById('canvas-node-led').className = "o-val text-amber";
        } else if (riskVal < 60) {
          // Stage 2: Orange alert
          n.led.material.color.setHex(0xff6b35);
          n.led.material.emissive.setHex(0xff6b35);
          document.getElementById('canvas-node-led').textContent = "RESTRICTED";
          document.getElementById('canvas-node-led').className = "o-val text-orange";
        } else {
          // Stage 3/4: Critical red flashing
          n.led.material.color.setHex(0xff3b5c);
          n.led.material.emissive.setHex(0xff3b5c);
          n.led.material.emissiveIntensity = 2.0 + Math.sin(pulseClock * 15) * 1.0;
          document.getElementById('canvas-node-led').textContent = "HALTED";
          document.getElementById('canvas-node-led').className = "o-val text-red";
        }
        n.risk += 0.02;
      } else {
        // Nominal green status
        n.led.material.color.setHex(0x00ff88);
        n.led.material.emissive.setHex(0x00ff88);
        n.led.material.emissiveIntensity = 1.0 + Math.sin(pulseClock * 5) * 0.4;
        n.risk *= 0.95;
      }
    });

    // HEATMAP RAIL COLORING
    railSegments.forEach((seg) => {
      const dist = Math.abs(seg.z - (state.faultZ || 0));
      if (state.activeScenario && dist < 18) {
        let riskVal = state.simTrainPositionPercent || 0;
        if (riskVal < 20) {
          seg.matL.color.setHex(0xd4af37); // Gold
          seg.matR.color.setHex(0xd4af37);
        } else if (riskVal < 60) {
          seg.matL.color.setHex(0xc96a3d); // Orange/Terracotta
          seg.matR.color.setHex(0xc96a3d);
        } else {
          seg.matL.color.setHex(0xff3b5c); // Red
          seg.matR.color.setHex(0xff3b5c);
        }
      } else {
        seg.matL.color.setHex(0x7d9b76); // Sage green (safe)
        seg.matR.color.setHex(0x7d9b76);
      }
    });

    // FAULT GLOW BEHAVIOR
    if (state.activeScenario) {
      faultGlow.position.z = state.faultZ || 0;
      faultGlow.material.opacity = 0.25 + Math.sin(pulseClock * 10) * 0.15;
    } else {
      faultGlow.material.opacity = 0;
    }

    // CAMERA INTERPOLATION COGNITIVE FOCUS
    if (state.activeScenario && state.simRunning) {
      let focusZ = state.faultZ || 0;
      
      // Follow train Z position once brakes are engaged
      if (state.simBrakesApplied || train.position.z < focusZ + 15) {
        focusZ = train.position.z;
      }

      controls.target.x += (0 - controls.target.x) * 0.05;
      controls.target.y += (1.0 - controls.target.y) * 0.05;
      controls.target.z += (focusZ - controls.target.z) * 0.05;

      const idealCamPos = new THREE.Vector3(12, 6, focusZ + 15);
      camera.position.lerp(idealCamPos, 0.03);
    } else {
      // Default camera focal target
      controls.target.set(0, 1.0, 0);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  // ─────────────────────────────
  // RESIZE FIX
  // ─────────────────────────────
  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
}