/* ==========================================
   simulation.js — Interactive Incident Console
   ========================================== */

export function initSimulator() {

  /* ---- DOM refs ---- */
  const btnTrigger  = document.getElementById('btn-trigger-sim');
  const simNode     = document.getElementById('sim-node');
  const simFault    = document.getElementById('sim-fault');
  const simTrain    = document.getElementById('sim-train');

  const statEdge    = document.getElementById('stat-edge-status');
  const statSig     = document.getElementById('stat-signal-status');
  const statSpeed   = document.getElementById('stat-train-speed');
  const statTTI     = document.getElementById('stat-tti');

  const vTrain      = document.getElementById('visual-train');
  const vTrainName  = document.getElementById('visual-train-name');
  const vTrainSpeed = document.getElementById('visual-train-speed');

  const sigRed      = document.getElementById('sig-red');
  const sigAmber    = document.getElementById('sig-amber');
  const sigGreen    = document.getElementById('sig-green');

  const nodeLed     = document.getElementById('node-led');
  const faultBurst  = document.getElementById('fault-burst');
  const nodeIdLbl   = document.getElementById('node-id-lbl');

  const distFill    = document.getElementById('dist-fill');
  const distLabel   = document.getElementById('dist-label');

  const telOut      = document.getElementById('telemetry-output');
  const chatOut     = document.getElementById('chat-output');

  const liveDot     = document.getElementById('live-dot');
  const ctrlBadge   = document.getElementById('ctrl-mode-badge');

  const globalDot   = document.getElementById('global-status-dot');
  const globalTxt   = document.getElementById('global-status-text');

  /* ---- Tab switching ---- */
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  /* ---- Live clock ---- */
  const clockEl = document.getElementById('clock');
  setInterval(() => {
    if (clockEl) clockEl.textContent = new Date().toTimeString().slice(0, 8);
  }, 1000);

  /* ---- Build sleepers ---- */
  const sleepersRow = document.getElementById('sleepers-row');
  if (sleepersRow) {
    const vis = document.getElementById('track-visualizer');
    const w   = vis ? vis.offsetWidth : 800;
    const count = Math.ceil(w / 20);
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.style.cssText = `width:3px;height:100%;background:#1e1e2a;flex-shrink:0;margin-right:17px`;
      sleepersRow.appendChild(s);
    }
  }

  let simRunning = false;
  let simTimer   = null;

  if (!btnTrigger) return;

  btnTrigger.addEventListener('click', () => {
    if (simRunning) return;
    runSimulation();
  });

  /* =======================================
     MAIN SIMULATION FUNCTION
     ======================================= */
  function runSimulation() {
    simRunning = true;
    btnTrigger.disabled = true;
    btnTrigger.textContent = '⏳ SIMULATION IN PROGRESS...';
    ctrlBadge.textContent = 'ACTIVE';
    ctrlBadge.className = 'ctrl-badge active';

    /* --- Read params --- */
    const nodeOpt  = simNode.options[simNode.selectedIndex];
    const nodeVal  = simNode.value;               // "Node-07"
    const nodeKm   = nodeOpt.dataset.km;          // "142.4"
    const nodeZone = nodeOpt.dataset.zone;        // "SEC"

    const faultOpt  = simFault.options[simFault.selectedIndex];
    const faultVal  = simFault.value;             // "Thermal Track Buckle"
    const severity  = faultOpt.dataset.severity; // "HIGH"

    const trainOpt  = simTrain.options[simTrain.selectedIndex];
    const trainNum  = simTrain.value;             // "12621"
    const trainName = trainOpt.dataset.name;      // "Tamil Nadu Express"
    let   trainSpeed = parseInt(trainOpt.dataset.speed, 10); // 110

    /* --- Reset visuals --- */
    nodeIdLbl.textContent = nodeVal.replace('Node-', 'N-');
    vTrainName.textContent = `TN ${trainNum}`;
    vTrainSpeed.textContent = `${trainSpeed} km/h`;

    vTrain.style.left = '-160px';

    // Reset signals
    sigGreen.classList.add('active');
    sigAmber.classList.remove('active');
    sigRed.classList.remove('active');

    nodeLed.className = 'node-led';
    faultBurst.style.display = 'none';

    liveDot.className = 'live-dot';
    distFill.style.width = '0%';
    distFill.style.background = 'var(--green)';
    distLabel.textContent = '4.2 km';

    statEdge.textContent  = 'NOMINAL';   statEdge.className  = 'stat-val text-green';
    statSig.textContent   = 'GREEN';     statSig.className   = 'stat-val text-green';
    statSpeed.textContent = `${trainSpeed} km/h`;
    statTTI.textContent   = '138s';

    globalDot.className = 'status-indicator';
    globalTxt.textContent = 'SYSTEMS ACTIVE';

    /* --- Clear logs --- */
    telOut.textContent = '';
    chatOut.innerHTML  = '';

    /* Start on telemetry tab */
    document.querySelector('[data-tab="telemetry-tab"]').click();

    /* ---- Helpers ---- */
    const ts = () => new Date().toTimeString().slice(0, 8);
    const ts3 = () => {
      const now = new Date();
      return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3,'0');
    };

    function addTelemetry(line) {
      telOut.textContent += `[${ts3()}] ${line}\n`;
      telOut.scrollTop = telOut.scrollHeight;
    }

    function addChat(sender, role, body, type) {
      const div = document.createElement('div');
      div.className = `chat-msg type-${type}`;
      div.innerHTML = `
        <div class="chat-role type-${type}">${role} <span class="chat-time-tag">${ts()}</span></div>
        <div class="chat-body"><strong>${sender}:</strong> ${body}</div>`;
      chatOut.appendChild(div);
      chatOut.scrollTop = chatOut.scrollHeight;
    }

    let tick      = 0;
    let trainLeft = -10;     // percentage
    let brakesOn  = false;
    const initSpeed = trainSpeed;

    /* ---- Initial log ---- */
    addTelemetry('SYSTEM PRE-CHECK: All LoRa gateways responsive.');
    addTelemetry(`Tracking: Train ${trainNum} (${trainName}) | Initial speed: ${trainSpeed} km/h`);
    addTelemetry(`Monitoring: ${nodeVal} — Km ${nodeKm} | Zone: ${nodeZone}`);
    addTelemetry('AWAITING ANOMALY EVENT...');

    /* ---- Timeline ---- */
    simTimer = setInterval(() => {
      tick++;

      /* Move train */
      if (!brakesOn) {
        trainLeft += (trainSpeed / initSpeed) * 1.1;
      } else {
        trainLeft += Math.max(0, trainSpeed / initSpeed) * 0.7;
        trainSpeed = Math.max(0, trainSpeed - (initSpeed / 22) - Math.random() * 2);
        vTrainSpeed.textContent = `${Math.round(trainSpeed)} km/h`;
        statSpeed.textContent   = `${Math.round(trainSpeed)} km/h`;

        // Distance bar — fill as train approaches
        const pct = Math.min(100, ((tick - 52) / 70) * 100);
        distFill.style.width = `${pct}%`;
        if (pct > 50) { distFill.style.background = 'var(--amber)'; distFill.style.boxShadow = '0 0 6px rgba(255,183,0,0.5)'; }
        if (pct > 80) { distFill.style.background = 'var(--red)';   distFill.style.boxShadow = '0 0 6px var(--red-glow)'; }

        const remKm = Math.max(0, 4.2 - (pct / 100) * 4.2).toFixed(2);
        distLabel.textContent = `${remKm} km`;
        const tti = Math.max(0, Math.round((parseFloat(remKm) / Math.max(1, trainSpeed)) * 3600));
        statTTI.textContent = trainSpeed < 1 ? 'HALTED' : `${tti}s`;
      }

      vTrain.style.left = `${trainLeft}%`;

      /* ---- EVENT TIMELINE ---- */

      // T~1s — subtle vibration noise detected
      if (tick === 8) {
        addTelemetry(`[${nodeVal}] ACCEL Z-axis deviation: +2.1G (above 1.5G threshold)`);
        addTelemetry(`[${nodeVal}] Activating extended vibration capture window...`);
      }

      // T~1.5s — anomaly confirmed by vibration
      if (tick === 15) {
        addTelemetry(`WARNING: Persistent vibration anomaly — Z:+4.82G X:+1.24G Y:-0.87G`);
        addTelemetry(`[TinyML] Spectral extraction started — window: 100 samples`);

        statEdge.textContent = 'ANOMALY'; statEdge.className = 'stat-val text-amber';
        nodeLed.className    = 'node-led fault';
        faultBurst.style.display = 'block';
        globalDot.className = 'status-indicator warn';
        globalTxt.textContent = 'ANOMALY DETECTED';
        liveDot.className   = 'live-dot inactive';
      }

      // T~2s — TinyML classification
      if (tick === 22) {
        addTelemetry(`[TinyML] Inference complete in 8.7ms`);
        addTelemetry(`[TinyML] Classification: "${faultVal}" — Confidence: 97.4%`);
        addTelemetry(`[TinyML] Severity: ${severity} | Fault class: CRITICAL`);
        addTelemetry(`[LoRa] Alert packet signed (HMAC-SHA256) & transmitted.`);

        statEdge.textContent = `CRITICAL (${severity})`; statEdge.className = 'stat-val text-red';
        globalDot.className  = 'status-indicator alert';
        globalTxt.textContent = '⚠ CRITICAL ALERT';
      }

      // T~2.8s — gateway relays to AI
      if (tick === 28) {
        document.querySelector('[data-tab="agent-tab"]').click();
        addChat('LoRa Gateway', 'System', `Alert envelope received from ${nodeVal}. Event: <strong>${faultVal}</strong> (${severity}). Broadcasting to RailGuard AI core.`, 'system');
      }

      // T~3.5s — AI begins reasoning
      if (tick === 36) {
        addChat('RailGuard AI Agent', 'AI System', `Ingesting anomaly. Node GPS: Km ${nodeKm} (Zone ${nodeZone}). Querying NTES API for trains within 15km sector...`, 'agent');
      }

      // T~4s — AI identifies train
      if (tick === 42) {
        const tti = Math.round(4200 / (initSpeed / 3.6));
        addChat('RailGuard AI Agent', 'AI System', `Target identified: <strong>Train ${trainNum} (${trainName})</strong> approaching at ${initSpeed} km/h. Distance: 4.2km. Time-to-impact: ~${tti}s. Stopping distance required: ~${Math.round(initSpeed * initSpeed / 180)}m.`, 'agent');
      }

      // T~5s — AI decision
      if (tick === 52) {
        addChat('RailGuard AI Agent', 'AI System', `DECISION: Impact window CRITICAL. Initiating full emergency override. Signal Zone ${nodeZone}-7B → RED. RF emergency brake broadcast → Train ${trainNum}.`, 'agent');

        // Signal flip
        sigGreen.classList.remove('active');
        sigAmber.classList.add('active');
        setTimeout(() => {
          sigAmber.classList.remove('active');
          sigRed.classList.add('active');
        }, 600);

        statSig.textContent = 'EMERGENCY RED'; statSig.className = 'stat-val text-red';
        brakesOn = true;
      }

      // T~5.5s — Signal interlock confirms
      if (tick === 56) {
        addChat('Signal Interlock 7B', 'Signal System', `Relay state confirmed: RED. Cab-signal RF beacon broadcasting on 433MHz (code 0xFF). Track exclusive — all trains holding.`, 'signal');
      }

      // T~6.5s — Loco pilot confirms
      if (tick === 66) {
        addChat(`Loco Pilot — Train ${trainNum}`, 'Cabin Operator', `RF emergency override received. Audio-visual alarm active in cab. Traction cut. Applying full vacuum brake. Visual RED signal confirmed ahead.`, 'crew');
      }

      // T~8s — Control room
      if (tick === 82) {
        addChat('SCR Control Room — Secunderabad', 'Secunderabad HQ', `Alert acknowledged on safety console. Train ${trainNum} decelerating confirmed via GPS. Signal lock maintained by RailGuard. Dispatching S&T team.`, 'crew');
      }

      // T~10s — Field team
      if (tick === 102) {
        addChat('S&T Field Engineer', 'Field Maintenance', `Maintenance team deployed with welding gear and hydraulic jacks to Km ${nodeKm}. ETA: 12 minutes. Track corridor closed in both directions.`, 'crew');
      }

      // T~14s — Train halted
      if (tick >= 120 && trainSpeed <= 0) {
        clearInterval(simTimer);
        simTimer = null;

        addChat('RailGuard AI Agent', 'AI System', `✓ Train ${trainNum} has halted safely at Km ${(parseFloat(nodeKm) - 0.38).toFixed(2)} — 380m before the fault point. Zero casualty. Pipeline total latency: <strong>4.8 seconds</strong>.`, 'agent');
        addChat('LoRa Gateway', 'System', `Incident closed. Audit trail logged to blockchain ledger. Node ${nodeVal} continuing to monitor. Signal zone locked until maintenance clears.`, 'system');

        statTTI.textContent = 'TRAIN HALTED';
        globalDot.className = 'status-indicator';
        globalTxt.textContent = 'INCIDENT RESOLVED';

        ctrlBadge.textContent = 'COMPLETE';
        ctrlBadge.className   = 'ctrl-badge done';
        btnTrigger.disabled   = false;
        btnTrigger.textContent = '↺ RUN AGAIN';
        simRunning = false;
      }

    }, 100);
  }
}
