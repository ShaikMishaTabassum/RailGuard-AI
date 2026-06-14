/* ==========================================
   canvas.js — Hero 3D rail perspective animation
   ========================================== */

export function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  const resize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);

  // Parallax scrolling tracker
  let scrollY = 0;
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  // Horizon vanishing point (shifted by scroll position for parallax effect)
  const hzX = () => W / 2;
  const hzY = () => H * 0.38 + scrollY * 0.12;

  // ---- Sleepers (ties) ----
  const NUM_SLEEPERS = 22;
  const sleepers = Array.from({ length: NUM_SLEEPERS }, (_, i) => i / NUM_SLEEPERS);

  // ---- Train Animation State ----
  let trainProgress = 0; // 0 (horizon) to 1.2 (past camera)
  const trainSpeed = 0.0035;

  // ---- Data particles on the rails ----
  class Particle {
    constructor() { this.reset(true); }
    reset(random = false) {
      this.progress = random ? Math.random() : 0;
      this.speed    = 0.003 + Math.random() * 0.005;
      this.side     = Math.random() > 0.5 ? 1 : -1;
      this.size     = 0.8 + Math.random() * 2.5;
      this.color    = Math.random() > 0.55 ? '#ff5e00' : '#00c3ff'; // Accents matching modern theme
      this.alpha    = 0.6 + Math.random() * 0.4;
    }
    update() {
      this.progress += this.speed;
      if (this.progress >= 1) this.reset(false);
    }
    draw() {
      const hy = hzY(), hx = hzX();
      const t  = Math.pow(this.progress, 2.2);
      const y  = hy + t * (H - hy);
      const x  = hx + this.side * 90 * t * 3.5;
      const r  = Math.max(0.3, this.size * t * 1.8);

      ctx.save();
      ctx.globalAlpha = this.alpha * t;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle    = this.color;
      ctx.shadowColor  = this.color;
      ctx.shadowBlur   = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  const particles = Array.from({ length: 72 }, () => new Particle());

  // ---- Floating data labels ----
  const labels = [
    { text: 'ACCEL: 1.02G', x: 0.15, y: 0.55, alpha: 0 },
    { text: 'NODE_07: OK',  x: 0.78, y: 0.45, alpha: 0 },
    { text: 'TinyML: 8ms', x: 0.2,  y: 0.70, alpha: 0 },
    { text: 'SIGNAL: GRN', x: 0.72, y: 0.62, alpha: 0 },
  ];
  let labelTick = 0;

  function drawRails() {
    const hy = hzY(), hx = hzX();
    const railOffsets = [90, 180]; // half-spreads at bottom

    railOffsets.forEach(spread => {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - spread * 3.5, H);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + spread * 3.5, H);
      ctx.strokeStyle = spread === 90
        ? 'rgba(0, 195, 255, 0.22)' // Glowing cyan rails
        : 'rgba(0, 195, 255, 0.05)';
      ctx.lineWidth = spread === 90 ? 2 : 1;
      ctx.stroke();
    });
  }

  function drawSleepers() {
    const hy = hzY(), hx = hzX();
    for (let i = 0; i < sleepers.length; i++) {
      sleepers[i] += 0.006;
      if (sleepers[i] >= 1) sleepers[i] = 0;

      const t   = Math.pow(sleepers[i], 2.4);
      const y   = hy + t * (H - hy);
      const hw  = 90 * t * 3.5; // half-width

      ctx.beginPath();
      ctx.moveTo(hx - hw, y);
      ctx.lineTo(hx + hw, y);
      ctx.strokeStyle = `rgba(0, 195, 255, ${t * 0.25})`; // modern cyber sleepers
      ctx.lineWidth   = 1 + t * 9;
      ctx.stroke();
    }
  }

  function drawTrain() {
    if (trainProgress < 0 || trainProgress > 1.05) return;

    const hy = hzY(), hx = hzX();
    // Use exponential curves to simulate fast perspective acceleration as it approaches
    const t = Math.pow(trainProgress, 2.8);
    if (t < 0.015) return; // Hide when too far at horizon

    const y = hy + t * (H - hy);
    const width = 75 * t * 3.5;
    const height = 55 * t * 3.5;
    const x = hx - width / 2;
    const trainY = y - height;

    ctx.save();
    
    // ── Locomotive Body ──
    // Indian Railways WAP-7 Blue/White high-tech paint scheme
    const bodyGrad = ctx.createLinearGradient(x, trainY, x + width, trainY);
    bodyGrad.addColorStop(0, '#0a2342'); // Navy Blue Side
    bodyGrad.addColorStop(0.35, '#00c3ff'); // Cyan Stripe
    bodyGrad.addColorStop(0.5, '#eaf4ff'); // White Center
    bodyGrad.addColorStop(0.65, '#00c3ff'); // Cyan Stripe
    bodyGrad.addColorStop(1, '#0a2342'); // Navy Blue Side
    
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = 'rgba(0, 195, 255, 0.7)';
    ctx.lineWidth = Math.max(1, t * 4);
    
    ctx.beginPath();
    ctx.roundRect(x, trainY, width, height, [6 * t, 6 * t, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // ── Warning Chevron Striping (Terracotta/Orange Accent) ──
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.moveTo(x, trainY + height * 0.72);
    ctx.lineTo(x + width * 0.25, trainY + height);
    ctx.lineTo(x + width * 0.75, trainY + height);
    ctx.lineTo(x + width, trainY + height * 0.72);
    ctx.closePath();
    ctx.fill();

    // ── Windshield (High tech reflection) ──
    ctx.fillStyle = 'rgba(14, 29, 54, 0.8)';
    ctx.strokeStyle = 'rgba(0, 195, 255, 0.5)';
    const wsW = width * 0.85;
    const wsH = height * 0.32;
    const wsX = x + width * 0.075;
    const wsY = trainY + height * 0.15;
    
    ctx.beginPath();
    ctx.roundRect(wsX, wsY, wsW, wsH, 3 * t);
    ctx.fill();
    ctx.stroke();

    // Windshield reflections
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(wsX, wsY);
    ctx.lineTo(wsX + wsW * 0.4, wsY);
    ctx.lineTo(wsX + wsW * 0.2, wsY + wsH);
    ctx.lineTo(wsX, wsY + wsH);
    ctx.closePath();
    ctx.fill();

    // ── Headlights ──
    const leftHlX = x + width * 0.22;
    const rightHlX = x + width * 0.78;
    const hlY = trainY + height * 0.62;
    const hlRad = Math.max(1, 4.5 * t);

    // Glowing flare
    ctx.shadowColor = '#00c3ff';
    ctx.shadowBlur = 15 * t + 5;
    ctx.fillStyle = '#ffffff';
    
    ctx.beginPath();
    ctx.arc(leftHlX, hlY, hlRad, 0, Math.PI * 2);
    ctx.arc(rightHlX, hlY, hlRad, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset shadow blur for other drawing
    ctx.shadowBlur = 0;

    // ── Glowing Light Beams Casting on Tracks ──
    const beamGrad = ctx.createLinearGradient(hx, hlY, hx, H);
    beamGrad.addColorStop(0, 'rgba(0, 195, 255, 0.38)');
    beamGrad.addColorStop(0.4, 'rgba(0, 195, 255, 0.15)');
    beamGrad.addColorStop(1, 'rgba(8, 17, 32, 0)');
    
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(leftHlX, hlY);
    ctx.lineTo(hx - W * 0.28 * t, H);
    ctx.lineTo(hx + W * 0.28 * t, H);
    ctx.lineTo(rightHlX, hlY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawFloatingLabels() {
    labelTick++;
    labels.forEach((lbl, i) => {
      const wave = Math.sin(labelTick * 0.015 + i * 1.4);
      lbl.alpha = 0.12 + 0.08 * wave;

      ctx.save();
      ctx.globalAlpha = Math.max(0, lbl.alpha);
      ctx.font        = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle   = '#00c3ff'; // Glowing cyan labels
      ctx.fillText(lbl.text, lbl.x * W, lbl.y * H);
      ctx.restore();
    });
  }

  function drawScanLines() {
    ctx.beginPath();
    for (let y = 0; y < H; y += 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.012)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  function animate() {
    // Cyber background fill
    ctx.fillStyle = 'rgba(8, 17, 32, 0.24)'; // Theme background
    ctx.fillRect(0, 0, W, H);

    drawScanLines();
    drawRails();
    drawSleepers();
    
    // Update and draw train
    trainProgress += trainSpeed;
    if (trainProgress > 1.15) {
      trainProgress = -0.1; // delay before next train spawns
    }
    drawTrain();

    particles.forEach(p => { p.update(); p.draw(); });
    drawFloatingLabels();

    requestAnimationFrame(animate);
  }

  animate();
}
