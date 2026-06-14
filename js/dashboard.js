/* ==========================================================
   js/dashboard.js — RailGuard AI Command Center Logic
   ========================================================== */

import { initTrack3D } from './track3d.js';

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════
  // BACKEND INTEGRATION — RailGuard AI v2.0
  // ══════════════════════════════════════════
  const API_BASE = 'http://localhost:8000';
  let backendOnline = false;

  async function probeBackend() {
    try {
      const r = await fetch(API_BASE + '/health', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        backendOnline = true;
        showBackendStatus('LIVE');
        loadLiveSensorData();
        connectWebSocket();
      } else {
        showBackendStatus('DEMO');
      }
    } catch {
      showBackendStatus('DEMO');
    }
  }

  function showBackendStatus(status) {
    let badge = document.getElementById('backend-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'backend-status-badge';
      badge.className = 'backend-status-badge';
      document.body.appendChild(badge);
    }
    badge.className = 'backend-status-badge ' + (status === 'LIVE' ? 'live' : 'demo');
    badge.innerHTML = `<span></span> AI BACKEND ${status === 'LIVE' ? 'LIVE' : 'DEMO MODE'}`;
  }

  function connectWebSocket() {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
      ws.onopen = () => console.log('[RailGuard] WebSocket connected');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') updateLiveTelemetry(data);
        } catch(e) {}
      };
      ws.onerror = () => {};
      ws.onclose = () => setTimeout(connectWebSocket, 5000);
    } catch(e) {}
  }

  function updateLiveTelemetry(data) {
    if (data.risk_score > 40) {
      const nodeEl = document.querySelector(`[data-node="${data.node_id}"]`);
      if (nodeEl) { nodeEl.classList.add('node-alert'); setTimeout(() => nodeEl.classList.remove('node-alert'), 1500); }
    }
    addTelemetryLogEntry(data);
  }

  function addTelemetryLogEntry(data) {
    if (!telemetryLog) return;
    const line = `[${new Date().toTimeString().slice(0,8)}] ${data.node_id} | vibe=${data.vibe_vertical?.toFixed(2)}G temp=${data.temperature?.toFixed(1)}°C risk=${data.risk_score?.toFixed(1)}% [${data.status}]\n`;
    telemetryLog.textContent = line + (telemetryLog.textContent || '').slice(0, 2000);
  }

  async function loadLiveSensorData() {
    try {
      const r = await fetch(API_BASE + '/api/sensors/live');
      if (r.ok) {
        const nodes = await r.json();
        nodes.forEach(node => {
          const sensorCode = document.querySelector(`.sensor-json-readout code`);
          if (sensorCode && nodes[0]) {
            sensorCode.textContent = JSON.stringify({node_id: nodes[0].node_id, vibe_v: nodes[0].vibe_vertical, temp: nodes[0].temperature, risk: nodes[0].risk_score, status: nodes[0].status}, null, 2);
          }
        });
      }
    } catch {}
  }

  probeBackend();

  // --- STATE VARIABLES ---
  let activeStation = "Secunderabad";
  let activeSegment = null;
  let activeSegmentId = null;
  let activeScenario = null;
  let faultZ3D = 0;
  let dashboardRiskBase = 2; // base nominal risk
  let weatherRain = 12; // mm
  let weatherTemp = 34; // °C
  let weatherWind = 15; // km/h
  let currentFutureMode = "current"; // "current", "24h", "7d"
  
  // Simulation trajectory state variables
  let simRunning = false;
  let simTimer = null;
  let simTick = 0;
  let simMaxTicks = 120; // 12 seconds total simulation time at 100ms intervals
  let simTrainSpeed = 110;
  let simTrainDistance = 4.2; // km
  let simBrakesApplied = false;
  let simTrainPositionPercent = -20; // visual train left position percent
  
  // Replay database
  let simTelemetryHistory = [];
  let simAgentDiscussionHistory = [];
  let simRiskHistory = [];
  let simSpeedHistory = [];
  let simDistanceHistory = [];
  let simSignalHistory = [];
  let simIsReplayMode = false;
  let replayTick = 0;
  let alertCount = 0;
  let criticalAlertShown = false;

  // Pre-configured database for scenarios
  const scenarioDatabase = {
    "broken-rail": {
      name: "Broken Rail / Joint Fracture",
      targetRisk: 98,
      explanation: "Critical derailment threat: Edge sensor TinyML node at active sector confirmed vertical shear anomaly (amplitude: 8.9G) consistent with a complete structural joint fracture. Intervention loop engaged.",
      priority: "CRITICAL",
      team: "4 S&T Track Engineers",
      time: "3.5 Hours",
      tools: ["Hydraulic Rail Clamps", "Gas Cutting Saws", "Thermite Welding Kit", "Ultrasonic Crack Detector"],
      checklist: [
        "Secure the structural fracture zone and halt inbound traffic",
        "Deploy emergency fishplate clamps to secure the shear gap",
        "Cut and replace the fractured 2-meter rail section",
        "Perform thermite weld and verify alignment via ultrasonic testing",
        "Release signal interlock once alignment is certified"
      ],
      agents: [
        { agent: "Track Agent", text: "HIGH-FREQUENCY shear pulse detected at sector. Amplitude 8.9G exceeds fracture threshold.", class: "track" },
        { agent: "Weather Agent", text: "Temperature stable (34°C). Joint fatigue classified as mechanical wear rather than thermal stress.", class: "weather" },
        { agent: "Wheel Agent", text: "Onboard axle sensors report clear. No pre-existing bogie fault detected.", class: "wheel" },
        { agent: "Maintenance Agent", text: "Emergency team dispatched with welding gear and hydraulic fishplates. ETA 12 mins.", class: "maint" },
        { agent: "Decision Agent", text: "Risk score 98%. Safety trajectory compromised. Switch Sector Signal to EMERGENCY RED immediately. Deploy RF cab brake alert.", class: "decision" }
      ]
    },
    "wheel-crack": {
      name: "Wheel Flat / Impact Anomaly",
      targetRisk: 68,
      explanation: "High Risk: Continuous periodic impact pulses (4.2G vertical amplitude at 12Hz frequency) detected, corresponding to a severe wheel flat/crack on Carriage 4 of Train 12621.",
      priority: "HIGH",
      team: "2 Mechanical Engineers",
      time: "2.5 Hours",
      tools: ["Wheel Profile Gauge", "Laser Axle Alignment Rig", "Shunting Coupling Bars"],
      checklist: [
        "Alert locomotive driver and slow train speed to 40 km/h",
        "Switch track interlock to divert train into Secunderabad siding loop",
        "Isolate Carriage 4 and secure secondary brakes",
        "Shunt affected carriage to maintenance depot for wheel turning",
        "Verify track integrity along sector for secondary impact cracks"
      ],
      agents: [
        { agent: "Wheel Agent", text: "Vibration signature indicates periodic impact pulse at 12Hz. Signature matches carriage wheel flat defect.", class: "wheel" },
        { agent: "Track Agent", text: "Sector vibration telemetry reports track stress rise of 44% during train passage.", class: "track" },
        { agent: "Weather Agent", text: "No weather modifiers active. Risk purely mechanical.", class: "weather" },
        { agent: "Maintenance Agent", text: "Vikarabad siding line cleared. Wheel shop standby at depot.", class: "maint" },
        { agent: "Decision Agent", text: "Risk score 68%. Initiate speed restriction to 40 km/h. Divert train to siding at next station. Cab alert pushed.", class: "decision" }
      ]
    },
    "flooded-track": {
      name: "Flooded Track / Subgrade Settlement",
      targetRisk: 45,
      explanation: "Medium Risk: Heavy rain (112mm) detected near station zone. Subgrade water sensors report soil saturation. Track settlement risk has increased by 31%.",
      priority: "MEDIUM",
      team: "6 Track Crew Engineers",
      time: "6.0 Hours",
      tools: ["Ballast Packing Jacks", "Soil Penetrometer", "Drainage Clearing shovels", "Laser Leveling Sights"],
      checklist: [
        "Dispatch track surveyors to inspect subgrade water levels",
        "Enforce warning limit of 30 km/h speed restriction on affected sector",
        "Clear mud silt and debris blocking drainage channels",
        "Inject ballast packing to stabilize shifting sleepers",
        "Verify alignment levels before restoring line speed"
      ],
      agents: [
        { agent: "Weather Agent", text: "Rainfall sensor reports 112mm over 3 hours. Flood index exceeds 78%.", class: "weather" },
        { agent: "Track Agent", text: "Subgrade displacement sensors report lateral slippage of 8mm. Ballast stiffness reduced.", class: "track" },
        { agent: "Wheel Agent", text: "Slight hunting oscillation detected in bogies due to soft rail bed, but remains in limits.", class: "wheel" },
        { agent: "Maintenance Agent", text: "Ballast crew mobilized with gravel packs and leveling gear. Corridor blocked.", class: "maint" },
        { agent: "Decision Agent", text: "Risk score 45%. Set safety speed limit to 30 km/h. Switch interlocking signal to warning AMBER.", class: "decision" }
      ]
    },
    "excessive-vibration": {
      name: "Excessive Track Vibration",
      targetRisk: 72,
      explanation: "Risk increased due to abnormal vibration at Track Segment G and wheel impact anomaly from Train 12457. Spectral FFT shows 27% amplitude rise over 14-day baseline with 12Hz harmonic — matching historical defect precursors.",
      priority: "HIGH",
      team: "2 Engineers + 1 Vibration Analyst",
      time: "3.0 Hours",
      tools: ["Portable FFT Analyzer", "Rail Profile Gauge", "Bogie Vibration Logger", "Torque Wrench Set"],
      checklist: [
        "Deploy portable FFT analyzer to confirm harmonic signature at Km 201",
        "Reduce corridor speed to 40 km/h until structural review completes",
        "Inspect fishplate bolts and sleeper anchoring on Segment G",
        "Correlate onboard bogie telemetry from Train 12457 Carriage 3",
        "Schedule ultrasonic rail head inspection within 24 hours"
      ],
      agents: [
        { agent: "Track Agent", text: "Abnormal vibration detected. Vertical amplitude +27% over baseline at Segment G.", class: "track" },
        { agent: "Wheel Agent", text: "Wheel impact anomaly from Train 12457. Periodic 12Hz pulse consistent with flat spot.", class: "wheel" },
        { agent: "Weather Agent", text: "No weather modifiers. Vibration isolated to mechanical track-wheel interaction.", class: "weather" },
        { agent: "Maintenance Agent", text: "FFT crew and vibration analyst dispatched. Inspection checklist generated.", class: "maint" },
        { agent: "Decision Agent", text: "Risk score 72%. Reduce speed to 40 km/h. Hold express traffic until harmonic decays below threshold.", class: "decision" }
      ]
    },
    "track-buckling": {
      name: "Thermal Rail Buckling",
      targetRisk: 84,
      explanation: "High Risk: Rail temperature sensor exceeded critical safety threshold (72°C). TinyML edge node reports lateral track alignment deviation consistent with thermal buckling.",
      priority: "CRITICAL",
      team: "3 S&T Engineers",
      time: "4.0 Hours",
      tools: ["Hydraulic Destressing Tensors", "Water Cooling Tanks", "Anchor Bolt wrenches"],
      checklist: [
        "Initiate emergency halt for all inbound trains to the sector",
        "Apply water cooling tanks to lower rail temperature below 45°C",
        "Loosen rail anchors to relieve internal thermal expansion stress",
        "Use hydraulic rail tensors to re-align lateral buckling curve",
        "Re-tighten structural anchor bolts and test lateral resistance"
      ],
      agents: [
        { agent: "Weather Agent", text: "Ambient temp 46°C, solar radiation high. Steel rail temperature peaked at 72°C.", class: "weather" },
        { agent: "Track Agent", text: "Lateral displacement sensor triggered. Structural strain limit exceeded at Km 142.", class: "track" },
        { agent: "Wheel Agent", text: "Critical hazard. Buckled track represents immediate derailment threat to inbound axles.", class: "wheel" },
        { agent: "Maintenance Agent", text: "Water tanker and stress relief teams en route. ETA 8 mins.", class: "maint" },
        { agent: "Decision Agent", text: "Risk score 84%. Immediate halt required. Switch Sector Signal to RED. Notify approaching express cabin.", class: "decision" }
      ]
    }
  };

  // --- DOM REFERENCES ---
  const dashClock = document.getElementById('dash-clock');
  const viewBtns = document.querySelectorAll('.side-nav-btn');
  const viewPanels = document.querySelectorAll('.dash-view-panel');
  
  // Weather HUD
  const sliderRain = document.getElementById('weather-rain');
  const sliderTemp = document.getElementById('weather-temp');
  const sliderWind = document.getElementById('weather-wind');
  const valRain = document.getElementById('val-rain');
  const valTemp = document.getElementById('val-temp');
  const valWind = document.getElementById('val-wind');

  // Gauge & Explanation
  const gaugeFill = document.getElementById('gauge-fill-circle');
  const gaugeRiskVal = document.getElementById('gauge-risk-val');
  const gaugeRiskLbl = document.getElementById('gauge-risk-lbl');
  const riskExplanationText = document.getElementById('risk-explanation-text');

  // Map HUD
  const mapStations = document.querySelectorAll('.map-station');
  const mapSegments = document.querySelectorAll('.map-rail-line.segment');
  const mapActiveSegmentText = document.getElementById('map-active-segment');
  const mapActiveNodeText = document.getElementById('map-active-node');
  const btnSimFaultSegment = document.getElementById('btn-sim-fault-segment');
  const btnClearSegment = document.getElementById('btn-clear-segment');
  const floodRiskVal = document.getElementById('flood-risk-val');
  const mapTrackTempText = document.getElementById('map-track-temp');
  const mapVibeVertText = document.getElementById('map-vibe-vert');
  const mapVibeLatText = document.getElementById('map-vibe-lat');
  const mapPredictedOutcomeText = document.getElementById('map-predicted-outcome');
  const mapTrainDot = document.getElementById('map-train-dot');

  // Future View Mode
  const futureBtns = document.querySelectorAll('.future-toggle-btn');
  const futureProbability = document.getElementById('future-probability');
  const futureStatusDesc = document.getElementById('future-status-desc');
  const futureSettle = document.getElementById('future-settle');
  const futureSeparation = document.getElementById('future-separation');
  const futureBuckle = document.getElementById('future-buckle');
  const futureAdvisory = document.getElementById('future-advisory');
  const futureMainLbl = document.getElementById('future-main-lbl');

  // Incident Console / Simulator
  const injectBtns = document.querySelectorAll('.inject-btn');
  const simStationSelect = document.getElementById('sim-active-station');
  const simTrainSelect = document.getElementById('sim-approaching-train');
  const btnRunSim = document.getElementById('btn-run-emergency-sim');
  const btnResetSim = document.getElementById('btn-reset-sim');
  const telemetryLog = document.getElementById('dashboard-telemetry-log');
  
  // HUD Readout
  const hudTrainSpeed = document.getElementById('hud-train-speed');
  const hudTTI = document.getElementById('hud-tti');
  const hudSignal = document.getElementById('hud-signal');

  // Timeline / Replay
  const btnReplayPlay = document.getElementById('btn-replay-play-pause');
  const replaySlider = document.getElementById('replay-timeline-slider');

  // AI Chat
  const chatForm = document.getElementById('ai-chat-form');
  const chatInputField = document.getElementById('chat-input-field');
  const chatHistory = document.getElementById('ai-chat-history');
  const chatSugBtns = document.querySelectorAll('.chat-sug-btn');

  // Maintenance Copilot
  const mPriority = document.getElementById('m-copilot-priority');
  const mTeam = document.getElementById('m-copilot-team');
  const mTime = document.getElementById('m-copilot-time');
  const mChecklist = document.getElementById('m-copilot-checklist');
  const mTools = document.getElementById('m-copilot-tools');

  // Right Sidebar Agents
  const agentDiscussionFeed = document.getElementById('multi-agent-discussion-feed');


  // --- CLOCK CONTROLLER ---
  setInterval(() => {
    if (dashClock) {
      dashClock.textContent = new Date().toTimeString().slice(0, 8);
    }
  }, 1000);

  /* ---- Theme Toggle ---- */
  const themeToggle = document.getElementById('theme-toggle');
  const themeToggleIcon = document.getElementById('theme-toggle-icon');
  const themeToggleText = document.getElementById('theme-toggle-text');

  // Load saved theme
  const savedTheme = localStorage.getItem('railguard-theme') || 'dark';
  document.documentElement.className = `theme-${savedTheme}`;
  updateThemeUI(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.className = `theme-${newTheme}`;
      localStorage.setItem('railguard-theme', newTheme);
      updateThemeUI(newTheme);
    });
  }

  function updateThemeUI(theme) {
    if (themeToggleIcon && themeToggleText) {
      if (theme === 'light') {
        themeToggleIcon.textContent = '🌙';
        themeToggleText.textContent = 'DARK';
      } else {
        themeToggleIcon.textContent = '☀';
        themeToggleText.textContent = 'LIGHT';
      }
    }
  }

  /* ---- KPI Animated Counters ---- */
  function animateCounter(id, start, end, duration, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      el.textContent = Math.floor(progress * (end - start) + start) + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // Run animations on load
  setTimeout(() => {
    animateCounter('kpi-health', 0, 94, 1500, '%');
    animateCounter('kpi-trains', 0, 7, 1000);
    animateCounter('kpi-sensors', 0, 24, 1200);
    animateCounter('kpi-alerts', 0, 0, 800);
  }, 200);

  /* ---- PDF Report Generation ---- */
  const btnReportOverview = document.getElementById('btn-generate-report-overview');
  if (btnReportOverview) {
    btnReportOverview.addEventListener('click', () => {
      generatePDFReport();
    });
  }

  function generatePDFReport() {
    let incidentId = activeScenario ? `INC-${activeScenario.toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}` : "INC-NOMINAL-0842";
    let timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST";
    let faultType = activeScenario ? scenarioDatabase[activeScenario].name : "Nominal State / Baseline Check";
    let location = activeSegment || (activeStation ? `${activeStation} Division` : "Secunderabad Junction Outskirts");
    let riskScore = activeScenario ? `${scenarioDatabase[activeScenario].targetRisk}%` : `${dashboardRiskBase}%`;
    
    let aiDecision = "All systems green. Autonomous signal override armed.";
    if (activeScenario) {
      let db = scenarioDatabase[activeScenario];
      aiDecision = `Autonomous halt sequence triggered. Signal changed to RED. Cab brakes applied. Crew dispatched (${db.team}).`;
    }
    
    let passengersProtected = activeScenario ? (activeScenario === 'broken-rail' ? "1240 passengers" : "840 passengers") : "0 (Baseline)";
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>RailGuard AI - Incident Safety Audit Report</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #2B2B2B;
              background: #F8F5F0;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 3px double #C96A3D;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .logo {
              font-weight: 800;
              font-size: 1.8rem;
              letter-spacing: -0.03em;
              color: #C96A3D;
            }
            .title {
              font-size: 1.5rem;
              font-weight: 700;
              color: #2B2B2B;
              margin-top: 10px;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .meta-table td {
              padding: 12px;
              border: 1px solid rgba(201,106,61,0.15);
              font-size: 0.9rem;
            }
            .meta-table td.label {
              font-weight: bold;
              background: #efebd5;
              width: 30%;
              color: #2B2B2B;
            }
            .section-title {
              font-size: 1.15rem;
              font-weight: 700;
              color: #C96A3D;
              border-bottom: 1px solid rgba(201,106,61,0.3);
              padding-bottom: 6px;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            .audit-log {
              background: #ffffff;
              border: 1px solid rgba(201,106,61,0.15);
              padding: 15px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 0.8rem;
              white-space: pre-wrap;
              color: #555555;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid rgba(201,106,61,0.15);
              padding-top: 20px;
              text-align: center;
              font-size: 0.75rem;
              color: #888888;
            }
            .stamp {
              float: right;
              border: 3px solid #7D9B76;
              color: #7D9B76;
              padding: 10px 20px;
              font-weight: 800;
              font-size: 1.1rem;
              text-transform: uppercase;
              transform: rotate(-5deg);
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">RAILGUARD AI</div>
              <div class="title">INCIDENT SAFETY AUDIT REPORT</div>
            </div>
            <div style="text-align: right; font-size: 0.8rem; color: #888;">
              Document Ref: RG-IST-\${Math.floor(100000 + Math.random()*900000)}<br>
              Indian Railways S&T Division
            </div>
          </div>
          
          <table class="meta-table">
            <tr>
              <td class="label">Incident ID</td>
              <td><strong>\${incidentId}</strong></td>
            </tr>
            <tr>
              <td class="label">Timestamp</td>
              <td>\${timestamp}</td>
            </tr>
            <tr>
              <td class="label">Fault Classification</td>
              <td><span style="color: #c44d3d; font-weight: bold;">\${faultType}</span></td>
            </tr>
            <tr>
              <td class="label">Geospatial Location</td>
              <td>\${location}</td>
            </tr>
            <tr>
              <td class="label">Max Risk Score</td>
              <td style="color: #c44d3d; font-weight: bold;">\${riskScore}</td>
            </tr>
            <tr>
              <td class="label">Cognitive AI Decision</td>
              <td>\${aiDecision}</td>
            </tr>
            <tr>
              <td class="label">Passengers Protected</td>
              <td style="color: #7d9b76; font-weight: bold;">\${passengersProtected}</td>
            </tr>
          </table>

          <div class="section-title">Telemetry Audit Log Trajectory</div>
          <div class="audit-log">\${
            document.getElementById('dashboard-telemetry-log')?.textContent || 
            "[SYSTEM] Normal operations checked.\\n[Node-SEC] Accelerometer nominal.\\n[SYSTEM] Audit trace validated."
          }</div>

          <div class="stamp">VERIFIED BY AI</div>
          
          <div style="clear: both;"></div>

          <div class="footer">
            RailGuard AI Autonomous Intervention System — Secunderabad Division, South Central Railway Zone, Govt. of India.
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }


  // --- TAB NAVIGATION SYSTEM ---
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetView = btn.dataset.view;
      const targetPanel = document.getElementById(`view-${targetView}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // Handle URL Query Parameter Gating
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab) {
    let mapping = {
      'dashboard': 'overview',
      'overview': 'overview',
      'twin': 'digital-twin',
      'predict': 'future-view',
      'simulator': 'incident-simulator',
      'ai': 'ai-copilot'
    };
    let btnVal = mapping[targetTab];
    if (btnVal) {
      const targetBtn = document.querySelector(`.side-nav-btn[data-view="${btnVal}"]`);
      if (targetBtn) targetBtn.click();
    }
  }

  // Quick navigation from overview
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.goto;
      const targetBtn = document.querySelector(`.side-nav-btn[data-view="${view}"]`);
      if (targetBtn) targetBtn.click();
    });
  });


  // --- TYPEWRITER AI EXPLANATION ---
  let typewriterTimer = null;
  function setRiskExplanation(text, animate = true) {
    if (!riskExplanationText) return;
    if (typewriterTimer) clearInterval(typewriterTimer);
    if (!animate) {
      riskExplanationText.textContent = text;
      return;
    }
    riskExplanationText.textContent = '';
    riskExplanationText.classList.add('typing-active');
    let i = 0;
    typewriterTimer = setInterval(() => {
      riskExplanationText.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(typewriterTimer);
        riskExplanationText.classList.remove('typing-active');
      }
    }, 12);
  }

  function updateRiskGauge(risk) {
    if (!gaugeFill || !gaugeRiskVal || !gaugeRiskLbl) return;
    const rawVal = Math.max(0, Math.min(100, Math.round(risk)));
    gaugeRiskVal.textContent = `${rawVal}%`;
    
    // Circle math: radius is 50, circumference is 2 * PI * r = 314.16
    const circumference = 314.16;
    const offset = circumference - (rawVal / 100) * circumference;
    gaugeFill.style.strokeDashoffset = offset;

    // Adjust stroke colors based on severity
    if (rawVal < 15) {
      gaugeFill.style.stroke = "var(--green)";
      gaugeRiskLbl.textContent = "NOMINAL";
      gaugeRiskLbl.className = "gauge-lbl text-green";
    } else if (rawVal < 50) {
      gaugeFill.style.stroke = "var(--amber)";
      gaugeRiskLbl.textContent = "WARNING";
      gaugeRiskLbl.className = "gauge-lbl text-amber";
    } else {
      gaugeFill.style.stroke = "var(--red)";
      gaugeRiskLbl.textContent = "CRITICAL";
      gaugeRiskLbl.className = "gauge-lbl text-red";
    }

    syncOverviewKPIs(rawVal);
    showCriticalAlertIfNeeded(rawVal);
  }

  function syncOverviewKPIs(risk) {
    const kpiRisk = document.getElementById('kpi-risk');
    const kpiRiskLbl = document.getElementById('kpi-risk-lbl');
    const kpiHealth = document.getElementById('kpi-health');
    const kpiAlerts = document.getElementById('kpi-alerts');
    const kpiAlertsTrend = document.getElementById('kpi-alerts-trend');
    const kpiWeather = document.getElementById('kpi-weather');
    const kpiWeatherDetail = document.getElementById('kpi-weather-detail');
    const ovNetwork = document.getElementById('ov-network-status');

    if (kpiRisk) {
      kpiRisk.textContent = `${risk}%`;
      kpiRisk.className = `kpi-value ${risk < 15 ? 'text-green' : risk < 50 ? 'text-amber' : 'text-red'}`;
    }
    if (kpiRiskLbl) kpiRiskLbl.textContent = risk < 15 ? 'Nominal' : risk < 50 ? 'Warning' : 'Critical';
    if (kpiHealth) {
      const health = Math.max(62, 100 - risk * 0.85);
      kpiHealth.textContent = `${Math.round(health)}%`;
      kpiHealth.className = `kpi-value ${health > 80 ? 'text-green' : health > 60 ? 'text-amber' : 'text-red'}`;
    }
    if (kpiAlerts) {
      kpiAlerts.textContent = String(alertCount);
      kpiAlerts.className = `kpi-value ${alertCount === 0 ? 'text-green' : 'text-red'}`;
    }
    if (kpiAlertsTrend) {
      kpiAlertsTrend.textContent = alertCount === 0 ? 'All systems clear' : `${alertCount} active alert(s)`;
      kpiAlertsTrend.className = alertCount === 0 ? 'kpi-trend' : 'kpi-trend down';
    }
    if (kpiWeather) {
      kpiWeather.textContent = weatherRain > 80 ? 'Heavy Rain' : weatherTemp > 55 ? 'Hot' : 'Clear';
    }
    if (kpiWeatherDetail) {
      kpiWeatherDetail.textContent = `${weatherTemp}°C · ${weatherRain}mm rain`;
    }
    if (ovNetwork) {
      ovNetwork.textContent = risk > 50 ? '● DEGRADED' : '● NOMINAL';
      ovNetwork.className = `cc-stat-val ${risk > 50 ? 'text-amber' : 'text-green'}`;
    }
  }

  // --- CRITICAL ALERT OVERLAY ---
  const criticalOverlay = document.getElementById('critical-alert-overlay');
  const criticalRiskVal = document.getElementById('critical-alert-risk-val');
  const criticalAction = document.getElementById('critical-alert-action');
  const criticalDismiss = document.getElementById('critical-alert-dismiss');

  function showCriticalAlertIfNeeded(risk) {
    if (risk >= 85 && !criticalAlertShown) {
      criticalAlertShown = true;
      if (criticalOverlay) {
        criticalOverlay.hidden = false;
        requestAnimationFrame(() => criticalOverlay.classList.add('visible'));
      }
      if (criticalRiskVal) criticalRiskVal.textContent = `${Math.round(risk)}%`;
      if (criticalAction) {
        criticalAction.textContent = simBrakesApplied
          ? 'Brake intervention active. Maintain speed restriction until crew clearance.'
          : 'Recommended Action: Reduce speed immediately to 40 km/h and dispatch inspection crew.';
      }
    }
    if (risk < 50) criticalAlertShown = false;
  }

  if (criticalDismiss) {
    criticalDismiss.addEventListener('click', () => {
      if (criticalOverlay) {
        criticalOverlay.classList.remove('visible');
        setTimeout(() => { criticalOverlay.hidden = true; }, 400);
      }
    });
  }

  // --- TRAIN ETA COUNTDOWN ---
  let etaSeconds = 23 * 60 + 8;
  let etaDistanceKm = 42.4;
  let etaSpeed = 110;

  function tickETA() {
    const etaCountdown = document.getElementById('eta-countdown');
    const etaDistance = document.getElementById('eta-distance');
    const etaSpeedEl = document.getElementById('eta-speed');
    const etaStatus = document.getElementById('eta-status');

    if (simRunning) {
      etaSpeed = simTrainSpeed;
      etaDistanceKm = simTrainDistance;
      etaSeconds = Math.max(0, Math.round((etaDistanceKm / Math.max(1, etaSpeed)) * 3600));
    } else if (!simIsReplayMode) {
      etaSeconds = Math.max(0, etaSeconds - 1);
      etaDistanceKm = Math.max(0.1, etaDistanceKm - (etaSpeed / 3600));
    }

    const h = String(Math.floor(etaSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((etaSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(etaSeconds % 60).padStart(2, '0');

    if (etaCountdown) etaCountdown.textContent = `${h}:${m}:${s}`;
    if (etaDistance) etaDistance.textContent = `${etaDistanceKm.toFixed(1)} km`;
    if (etaSpeedEl) etaSpeedEl.textContent = `${Math.round(etaSpeed)} km/h`;
    if (etaStatus) {
      const restricted = simBrakesApplied || (activeScenario && dashboardRiskBase > 40);
      etaStatus.textContent = restricted ? 'RESTRICTED' : 'EN ROUTE';
      etaStatus.className = restricted ? 'eta-status restricted' : 'eta-status';
    }
  }
  setInterval(tickETA, 1000);

  // --- OVERVIEW CHARTS ---
  const overviewHistory = { health: [], sensor: [], forecast: [] };

  function drawOverviewChart(canvasId, data, color, fillColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = 240;
    ctx.fillStyle = '#080F1E';
    ctx.fillRect(0, 0, w, h);
    if (data.length < 2) return;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = 8 + (i / (data.length - 1)) * (w - 16);
      const y = h - 12 - ((v - min) / range) * (h - 24);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.lineTo(w - 8, h - 12);
    ctx.lineTo(8, h - 12);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  function tickOverviewCharts() {
    const riskMult = activeScenario ? 1.6 : dashboardRiskBase / 12;
    overviewHistory.health.push(88 + Math.random() * 8 - riskMult * 3);
    overviewHistory.sensor.push(60 + Math.random() * 30 + riskMult * 5);
    overviewHistory.forecast.push(15 + dashboardRiskBase + Math.random() * 8);

    ['health', 'sensor', 'forecast'].forEach(k => {
      if (overviewHistory[k].length > 24) overviewHistory[k].shift();
    });

    drawOverviewChart('chart-track-health', overviewHistory.health, '#7D9B76', 'rgba(125,155,118,0.15)');
    drawOverviewChart('chart-sensor-activity', overviewHistory.sensor, '#C96A3D', 'rgba(201,106,61,0.12)');
    drawOverviewChart('chart-risk-forecast', overviewHistory.forecast, '#D4AF37', 'rgba(212,175,55,0.12)');
  }
  setInterval(tickOverviewCharts, 2500);
  tickOverviewCharts();
  window.addEventListener('resize', tickOverviewCharts);

  // --- INCIDENT TIMELINE ---
  const incidentTimeline = document.getElementById('incident-timeline');
  const incidentTimelineEvents = [
    { time: '12:00', event: 'System Normal — all baselines stable', cls: 'normal' },
    { time: '12:02', event: 'Vibration increase detected at Km 142', cls: 'warning' },
    { time: '12:04', event: 'Sensor warning — amplitude exceeds threshold', cls: 'warning' },
    { time: '12:05', event: 'Crack detected — TinyML classification 98.1%', cls: 'critical' },
    { time: '12:06', event: 'Alert sent to command center & locomotive cab', cls: 'critical' },
    { time: '12:07', event: 'Train speed reduced — emergency brake applied', cls: 'critical' },
  ];

  function setIncidentTimelineIdle() {
    if (!incidentTimeline) return;
    incidentTimeline.innerHTML = `
      <div class="it-item normal" style="animation-delay:0ms"><span class="it-time">12:00</span><span class="it-event">System Normal — all baselines stable</span></div>
      <div class="it-item" style="animation-delay:80ms"><span class="it-time">—</span><span class="it-event">Awaiting fault injection or simulation</span></div>`;
  }

  function animateIncidentTimeline() {
    if (!incidentTimeline) return;
    incidentTimeline.innerHTML = '';
    incidentTimelineEvents.forEach((ev, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = `it-item ${ev.cls}`;
        el.style.animationDelay = '0ms';
        el.innerHTML = `<span class="it-time">${ev.time}</span><span class="it-event">${ev.event}</span>`;
        incidentTimeline.appendChild(el);
      }, i * 700);
    });
  }

  // --- FAULT SCENARIO SELECTOR (shared) ---
  function selectFaultScenario(faultKey, autoRun = false) {
    if (simRunning) return;
    activeScenario = faultKey;
    const db = scenarioDatabase[faultKey];
    if (!db) return;

    injectBtns.forEach(b => b.classList.toggle('active', b.dataset.fault === faultKey));
    document.querySelectorAll('[data-fault-quick]').forEach(b =>
      b.classList.toggle('active', b.dataset.faultQuick === faultKey)
    );

    setRiskExplanation(db.explanation, false);
    updateRiskGauge(db.targetRisk * 0.55);
    mPriority.textContent = db.priority;
    mPriority.className = `m-val ${db.priority === 'CRITICAL' ? 'text-red' : 'text-amber'}`;
    btnRunSim.disabled = false;

    pushAgentDiscussionStaggered(db.agents.slice(0, 3));

    if (autoRun) {
      const incidentBtn = document.querySelector('.side-nav-btn[data-view="incident-simulator"]');
      if (incidentBtn) incidentBtn.click();
      setTimeout(() => runCognitiveSimulation(), 400);
    }
  }

  function pushAgentDiscussionStaggered(agents) {
    if (!agentDiscussionFeed) return;
    agentDiscussionFeed.innerHTML = '';
    agents.forEach((agent, i) => {
      setTimeout(() => {
        appendAgentMessage(agent);
        updateLiveAgentCard(agent);
      }, i * 900);
    });
  }

  function appendAgentMessage(agent) {
    const msg = document.createElement('div');
    msg.className = `agent-msg-box ${agent.class}`;
    msg.style.animationDelay = '0ms';
    msg.innerHTML = `
      <div class="agent-msg-header ${agent.class}">${agent.agent} <span class="chat-time-tag">${new Date().toTimeString().slice(0, 8)}</span></div>
      <div class="agent-msg-body">${agent.text}</div>`;
    agentDiscussionFeed.appendChild(msg);
    agentDiscussionFeed.scrollTop = agentDiscussionFeed.scrollHeight;
  }

  function updateLiveAgentCard(agent) {
    const map = {
      'Track Agent': 'agent-msg-track',
      'Weather Agent': 'agent-msg-weather',
      'Maintenance Agent': 'agent-msg-maint',
      'Wheel Agent': 'agent-msg-safety',
      'Safety Agent': 'agent-msg-safety',
      'Decision Agent': 'agent-msg-decision',
    };
    const elId = map[agent.agent];
    const el = elId ? document.getElementById(elId) : null;
    if (el) {
      el.textContent = agent.text;
      el.closest('.ai-agent-card')?.classList.add('loading-shimmer');
      setTimeout(() => el.closest('.ai-agent-card')?.classList.remove('loading-shimmer'), 600);
    }
  }

  document.querySelectorAll('[data-fault-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectFaultScenario(btn.dataset.faultQuick, false);
      animateIncidentTimeline();
    });
  });

  // Calculate baseline risk derived from Weather Conditions
  function calculateWeatherRisk() {
    let base = 2; // normal default

    // Rain effect: above 50mm increases mud slide/settlement risk
    if (weatherRain > 40) {
      base += Math.round((weatherRain - 40) * 0.15); // max approx 16% risk add
    }

    // Heat effect: high steel temp causes buckles
    if (weatherTemp > 50) {
      base += Math.round((weatherTemp - 50) * 0.6); // max approx 15% risk add
    }

    // Wind effect
    if (weatherWind > 45) {
      base += Math.round((weatherWind - 45) * 0.1); // max approx 4% risk add
    }

    dashboardRiskBase = base;
    
    // Update dashboard visual if no emergency simulation is active
    if (!simRunning && !simIsReplayMode) {
      updateRiskGauge(dashboardRiskBase);
      updateWeatherAdvisory();
      updatePredictiveStrip();
      updateRiskEquation();
    }
  }

  function updateWeatherAdvisory() {
    if (simRunning || simIsReplayMode) return;
    
    let advice = "All track grids normal. TinyML signals active. LoRa networks reporting stable vibration baselines.";
    let parts = [];
    
    if (weatherRain > 80) {
      parts.push(`Heavy rain detected (${weatherRain}mm). Soil settlement risk increased by 31%.`);
    }
    if (weatherTemp > 65) {
      parts.push(`Critical rail expansion (Steel Temp: ${weatherTemp}°C). Monitor track for buckling hazard.`);
    }
    if (weatherWind > 60) {
      parts.push(`High winds alert (${weatherWind} km/h). Advisory alert pushed.`);
    }

    if (parts.length > 0) {
      advice = parts.join(" ");
    }
    setRiskExplanation(advice);
    updateFloodRisk();
  }

  function updateFloodRisk() {
    if (!floodRiskVal) return;
    let risk = Math.min(98, Math.round(4 + weatherRain * 0.35 + (weatherWind > 40 ? 8 : 0)));
    let label = 'LOW';
    let cls = 'intel-val text-green';
    if (risk > 60) { label = 'CRITICAL'; cls = 'intel-val text-red'; }
    else if (risk > 35) { label = 'ELEVATED'; cls = 'intel-val text-amber'; }
    else if (risk > 15) { label = 'MODERATE'; cls = 'intel-val text-amber'; }
    floodRiskVal.textContent = `${label} (${risk}%)`;
    floodRiskVal.className = cls;
  }

  // --- WEATHER EVENT HANDLERS ---
  if (sliderRain) {
    sliderRain.addEventListener('input', (e) => {
      weatherRain = parseInt(e.target.value, 10);
      if (valRain) valRain.textContent = weatherRain;
    calculateWeatherRisk();
    updateFloodRisk();
    updatePredictiveStrip();
    updateRiskEquation();
  });
  }
  if (sliderTemp) {
    sliderTemp.addEventListener('input', (e) => {
      weatherTemp = parseInt(e.target.value, 10);
      if (valTemp) valTemp.textContent = weatherTemp;
      calculateWeatherRisk();
    });
  }
  if (sliderWind) {
    sliderWind.addEventListener('input', (e) => {
      weatherWind = parseInt(e.target.value, 10);
      if (valWind) valWind.textContent = weatherWind;
      calculateWeatherRisk();
    });
  }


  // --- DIGITAL TWIN: SEGMENT SELECTION ---
  function selectSegment(seg) {
    mapSegments.forEach(s => s.classList.remove('selected'));
    seg.classList.add('selected');
    activeSegment = seg.dataset.segment;
    activeSegmentId = seg.id;
    activeStation = seg.dataset.station;
    if (mapActiveSegmentText) mapActiveSegmentText.textContent = activeSegment;

    const stationNode = document.querySelector(`.map-station[data-station="${activeStation}"]`);
    if (stationNode) {
      mapStations.forEach(s => s.classList.remove('selected'));
      stationNode.classList.add('selected');
    }
    simStationSelect.value = activeStation;

    const segIndex = { 'seg-A': -18, 'seg-B': -6, 'seg-C': 6, 'seg-D': 12, 'seg-E': 18, 'seg-F': -6, 'seg-G': 6, 'seg-H': 12 };
    faultZ3D = segIndex[activeSegmentId] ?? 0;

    let baseTemp = weatherTemp + (Math.random() * 2 - 1);
    let vibeVert = 0.98 + Math.random() * 0.05;
    let vibeLat = 0.03 + Math.random() * 0.03;
    mapActiveNodeText.textContent = `${activeStation} Junction`;
    mapTrackTempText.textContent = `${baseTemp.toFixed(1)}°C`;
    mapVibeVertText.textContent = `${vibeVert.toFixed(2)}G`;
    mapVibeLatText.textContent = `${vibeLat.toFixed(2)}G`;
    mapPredictedOutcomeText.textContent = "NOMINAL";
    mapPredictedOutcomeText.className = "h-val text-green";

    if (activeScenario && activeStation === simStationSelect.value) {
      const db = scenarioDatabase[activeScenario];
      mapPredictedOutcomeText.textContent = db.priority;
      mapPredictedOutcomeText.className = `h-val ${db.priority === 'CRITICAL' ? 'text-red' : 'text-amber'}`;
    }
  }

  mapSegments.forEach(seg => {
    seg.addEventListener('click', (e) => {
      e.stopPropagation();
      selectSegment(seg);
    });
  });

  if (btnSimFaultSegment) {
    btnSimFaultSegment.addEventListener('click', () => {
      if (!activeSegmentId || simRunning) return;
      activeScenario = 'excessive-vibration';
      injectBtns.forEach(b => b.classList.remove('active'));
      const vibBtn = document.querySelector('.inject-btn[data-fault="excessive-vibration"]');
      if (vibBtn) vibBtn.classList.add('active');
      const db = scenarioDatabase[activeScenario];
      setRiskExplanation(`Risk increased due to abnormal vibration at ${activeSegment} and wheel impact anomaly from Train 12457.`);
      updateRiskGauge(db.targetRisk * 0.5);
      mPriority.textContent = db.priority;
      mPriority.className = `m-val text-amber`;
      btnRunSim.disabled = false;
      const targetSeg = document.getElementById(activeSegmentId);
      if (targetSeg) targetSeg.className = 'map-rail-line segment risk';
    });
  }

  if (btnClearSegment) {
    btnClearSegment.addEventListener('click', () => {
      if (simRunning) return;
      mapSegments.forEach(s => {
        if (!s.classList.contains('critical') && !s.classList.contains('risk')) {
          s.className = 'map-rail-line segment nominal';
        }
        s.classList.remove('selected');
      });
      activeSegment = null;
      activeSegmentId = null;
      if (mapActiveSegmentText) mapActiveSegmentText.textContent = '—';
    });
  }

  // --- DIGITAL TWIN INTERACTIVE MAP (STATIONS) ---
  mapStations.forEach(station => {
    station.addEventListener('click', () => {
      // Clear selections
      mapStations.forEach(s => s.classList.remove('selected'));
      station.classList.add('selected');

      activeStation = station.dataset.station;
      simStationSelect.value = activeStation;

      // Generate randomized telemetry matching selection
      let baseTemp = weatherTemp + (Math.random() * 2 - 1);
      let vibeVert = 0.98 + Math.random() * 0.05;
      let vibeLat = 0.03 + Math.random() * 0.03;

      mapActiveNodeText.textContent = `${activeStation} Junction`;
      mapTrackTempText.textContent = `${baseTemp.toFixed(1)}°C`;
      mapVibeVertText.textContent = `${vibeVert.toFixed(2)}G`;
      mapVibeLatText.textContent = `${vibeLat.toFixed(2)}G`;
      
      // Update outcome
      mapPredictedOutcomeText.textContent = "NOMINAL";
      mapPredictedOutcomeText.className = "h-val text-green";

      // If a scenario has been simulated and affecting this station
      if (activeScenario && activeStation === simStationSelect.value) {
        let db = scenarioDatabase[activeScenario];
        mapPredictedOutcomeText.textContent = db.priority;
        mapPredictedOutcomeText.className = `h-val ${db.priority === 'CRITICAL' ? 'text-red' : 'text-amber'}`;
      }
    });
  });

  // Map station synchronizer from simulator select
  if (simStationSelect) {
    simStationSelect.addEventListener('change', () => {
      const matchingNode = document.querySelector(`.map-station[data-station="${simStationSelect.value}"]`);
      if (matchingNode) matchingNode.click();
    });
  }


  // --- THREE.JS 3D TRACK VISUALIZER ---
  const canvas3D = document.getElementById('track-3d-canvas');
  initTrack3D(canvas3D, () => ({
    activeScenario,
    simRunning,
    simIsReplayMode,
    simTrainPositionPercent,
    simBrakesApplied,
    weatherRain,
    weatherTemp,
    faultZ: faultZ3D,
  }));


  // --- "FUTURE VIEW" MODE CONTROLLER ---
  futureBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      futureBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFutureMode = btn.dataset.mode;
      updateFutureViewStats();
    });
  });

  function updateFutureViewStats() {
    let mode = currentFutureMode;
    let label = "Current State";
    let prob = "NORMAL";
    let desc = "Grid fully functional. Failure probability: 0.05%. Base thermal stability.";
    let settle = "2.4%";
    let separation = "1.1%";
    let buckle = "0.3%";
    let advice = "No immediate safety interventions required. Continue routine inspections on next maintenance schedule.";

    if (mode === "24h") {
      label = "24-Hour Failure Probability";
      
      // Scale with weather factors
      let calcProb = 12 + (weatherTemp > 50 ? (weatherTemp-50)*0.8 : 0) + (weatherRain > 60 ? (weatherRain-60)*0.2 : 0);
      prob = `${calcProb.toFixed(1)}%`;
      desc = "Moderate risk levels detected in Vikarabad joint nodes due to scheduled high load.";
      settle = `${(5.4 + (weatherRain*0.08)).toFixed(1)}%`;
      separation = "4.2%";
      buckle = `${(0.8 + (weatherTemp*0.12)).toFixed(1)}%`;
      advice = "Vikarabad Sector: Set predictive speed dampening warnings on Segment B. Schedule thermal de-stressing checks.";
    } else if (mode === "7d") {
      label = "7-Day Failure Probability";
      let calcProb = 43 + (weatherTemp > 50 ? (weatherTemp-50)*1.2 : 0) + (weatherRain > 60 ? (weatherRain-60)*0.3 : 0);
      prob = `${calcProb.toFixed(1)}%`;
      desc = "Elevated risk index. Accelerated fatigue wear predicted at Kazipet structural joints.";
      settle = `${(12.2 + (weatherRain*0.2)).toFixed(1)}%`;
      separation = "18.4%";
      buckle = `${(4.8 + (weatherTemp*0.25)).toFixed(1)}%`;
      advice = "Kazipet Sector: Schedule sleeper replacement within 72 hours. Mobilize S&T maintenance division for joint welding.";
    }

    futureMainLbl.textContent = label;
    futureProbability.textContent = prob;
    futureStatusDesc.textContent = desc;
    futureSettle.textContent = settle;
    futureSeparation.textContent = separation;
    futureBuckle.textContent = buckle;
    futureAdvisory.textContent = advice;

    // Change outcome styles based on risk levels
    const probNum = parseFloat(prob);
    if (mode === "current" || prob === "NORMAL") {
      futureProbability.className = "f-num text-green";
    } else if (!isNaN(probNum) && probNum < 30) {
      futureProbability.className = "f-num text-amber";
    } else if (!isNaN(probNum)) {
      futureProbability.className = "f-num text-red";
    } else {
      futureProbability.className = "f-num text-amber";
    }

    // Redraw prediction chart
    renderPredictionChart();
  }

  // Predictive chart renderer using HTML5 Canvas
  const chartCanvas = document.getElementById('prediction-chart-canvas');
  const chartCtx = chartCanvas.getContext('2d');

  function renderPredictionChart() {
    let w = chartCanvas.width = chartCanvas.parentElement.offsetWidth;
    let h = chartCanvas.height = chartCanvas.parentElement.offsetHeight;

    chartCtx.fillStyle = '#080F1E';
    chartCtx.fillRect(0, 0, w, h);

    // Draw axis lines
    chartCtx.strokeStyle = 'rgba(201,106,61,0.12)';
    chartCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      let y = h - (i * h / 4);
      chartCtx.beginPath();
      chartCtx.moveTo(40, y);
      chartCtx.lineTo(w - 20, y);
      chartCtx.stroke();
    }

    // Plot predictive values based on future view mode
    let points = [];
    let scaleVal = 1;

    if (currentFutureMode === "current") {
      points = [1.2, 1.4, 1.3, 1.5, 1.4, 1.6, 1.5, 1.7];
      scaleVal = 0.15;
    } else if (currentFutureMode === "24h") {
      points = [1.5, 2.8, 4.2, 5.9, 7.8, 9.4, 11.2, 12.8];
      scaleVal = 0.55;
    } else if (currentFutureMode === "7d") {
      points = [1.8, 5.4, 12.1, 19.8, 27.2, 34.9, 41.2, 45.8];
      scaleVal = 0.95;
    }

    // Draw chart line
    chartCtx.beginPath();
    chartCtx.strokeStyle = currentFutureMode === "current" ? 'var(--green)' : 'var(--orange)';
    chartCtx.lineWidth = 2.5;

    let spacing = (w - 70) / (points.length - 1);
    
    points.forEach((val, i) => {
      let x = 50 + i * spacing;
      let y = h - 30 - (val * (h - 60) / 50); // relative to risk amplitude
      if (i === 0) {
        chartCtx.moveTo(x, y);
      } else {
        chartCtx.lineTo(x, y);
      }
    });
    chartCtx.stroke();

    // Draw dots
    points.forEach((val, i) => {
      let x = 50 + i * spacing;
      let y = h - 30 - (val * (h - 60) / 50);
      chartCtx.beginPath();
      chartCtx.arc(x, y, 4, 0, Math.PI*2);
      chartCtx.fillStyle = currentFutureMode === "current" ? 'var(--green)' : '#fff';
      chartCtx.fill();
    });

    // Draw X labels
    chartCtx.fillStyle = 'var(--text-3)';
    chartCtx.font = '500 8px "JetBrains Mono", monospace';
    let labelTexts = [];
    if (currentFutureMode === "current") labelTexts = ["T-7h", "T-6h", "T-5h", "T-4h", "T-3h", "T-2h", "T-1h", "Now"];
    if (currentFutureMode === "24h") labelTexts = ["Now", "+3h", "+6h", "+9h", "+12h", "+15h", "+18h", "+24h"];
    if (currentFutureMode === "7d") labelTexts = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Outlook"];

    labelTexts.forEach((lbl, i) => {
      chartCtx.fillText(lbl, 45 + i * spacing, h - 10);
    });
  }

  // Initial draw of chart
  renderPredictionChart();
  window.addEventListener('resize', renderPredictionChart);


  // --- EMERGENCY DECISION SIMULATOR (Injectors) ---
  injectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (simRunning) return;
      selectFaultScenario(btn.dataset.fault, false);
    });
  });


  // --- SIMULATION & MITIGATION INTERVENTION LOOP ---
  if (btnRunSim) {
    btnRunSim.addEventListener('click', () => {
      if (simRunning || !activeScenario) return;
      runCognitiveSimulation();

      // Backend integration: inject fault and get real AI responses
      if (backendOnline) {
        fetch(API_BASE + '/api/incidents/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fault_type: activeScenario,
            station: simStationSelect?.value || 'Secunderabad',
            train_id: simTrainSelect?.value || '12027'
          })
        })
        .then(r => r.json())
        .then(incident => {
          if (incident.agent_discussion && incident.agent_discussion.length > 0) {
            setTimeout(() => populateAgentFeedFromBackend(incident.agent_discussion), 3000);
          }
        })
        .catch(() => {});
      }
    });
  }

  function populateAgentFeedFromBackend(discussion) {
    if (!agentDiscussionFeed) return;
    agentDiscussionFeed.innerHTML = '';
    discussion.forEach((entry, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = `agent-msg-box ${entry.role || 'track'}`;
        el.innerHTML = `<div class="agent-msg-header ${entry.role || 'track'}">${entry.agent} <span class="chat-time-tag">${new Date().toTimeString().slice(0,8)}</span></div><div class="agent-msg-body">${entry.text}</div>`;
        agentDiscussionFeed.appendChild(el);
        agentDiscussionFeed.scrollTop = agentDiscussionFeed.scrollHeight;
      }, i * 800);
    });
  }

  if (btnResetSim) {
    btnResetSim.addEventListener('click', () => {
      resetSimulationState();
    });
  }

  function resetSimulationState() {
    clearInterval(simTimer);
    simTimer = null;
    simRunning = false;
    simIsReplayMode = false;
    simTick = 0;
    activeScenario = null;

    // Reset buttons
    injectBtns.forEach(b => b.classList.remove('active'));
    btnRunSim.disabled = true;
    btnRunSim.textContent = "LAUNCH INTERVENTION LOOP";
    btnRunSim.className = "btn btn-primary";
    btnResetSim.disabled = true;

    // Reset timeline slider
    replaySlider.disabled = true;
    replaySlider.value = 100;
    btnReplayPlay.disabled = true;
    btnReplayPlay.innerHTML = "<span>&#9658;</span> PLAY REPLAY";

    // Reset gauge and status indicators
    updateRiskGauge(dashboardRiskBase);
    updateWeatherAdvisory();
    
    // Clear log outputs
    telemetryLog.textContent = `[SYSTEM] Secure telemetry gateway online
[SYSTEM] LoRa mesh synchronized: 24 edge nodes connected
[Node-${activeStation.substring(0, 3).toUpperCase()}] BATT: 3.92V SOLAR: 1.4W RAIL-TEMP: 34.2C
[Node-${activeStation.substring(0, 3).toUpperCase()}] FFT Analysis: baselines stable
[SYSTEM] Awaiting fault injection parameters...`;

    hudTrainSpeed.textContent = "—";
    hudTTI.textContent = "—";
    hudSignal.textContent = "GREEN";
    hudSignal.className = "d-val text-green";

    // Clear agents conversation log
    agentDiscussionFeed.innerHTML = `<div class="agent-empty-state">
      No incident active. Launch a simulation to view the agents discuss, correlate telemetry, and vote on safety interventions.
    </div>`;

    // Clear copilot checklist
    mChecklist.innerHTML = `<li class="checklist-empty">No active faults. Maintenance checklist will be generated once an anomaly is detected.</li>`;
    mTools.innerHTML = `<span class="tool-badge-empty">None</span>`;
    mTeam.textContent = "—";
    mTime.textContent = "—";
    mPriority.textContent = "NOMINAL";
    mPriority.className = "m-val text-green";

    // Reset visual map states
    document.querySelectorAll('.map-rail-line.segment').forEach(seg => {
      seg.className = "map-rail-line segment nominal";
    });
    mapStations.forEach(st => {
      st.className = "map-station";
    });
    let selectedStation = document.querySelector(`.map-station[data-station="${simStationSelect.value}"]`);
    if (selectedStation) {
      selectedStation.classList.add('active');
    }

    mapTrainDot.setAttribute('cx', '-20');
    mapTrainDot.setAttribute('cy', '-20');

    alertCount = 0;
    if (ccAlertCount) { ccAlertCount.textContent = '0'; ccAlertCount.className = 'cc-stat-val text-green'; }
    if (alertCenter) alertCenter.classList.remove('visible');
    if (alertCenterBody) alertCenterBody.innerHTML = '<div class="alert-empty">No active alerts. Network nominal.</div>';
    if (emergencyBanner) emergencyBanner.hidden = true;
    ['notify-sms', 'notify-email', 'notify-mobile'].forEach(id => {
      const chip = document.getElementById(id);
      if (chip) chip.classList.remove('sent');
    });
    setFaultReplayIdle();
    setIncidentTimelineIdle();
    criticalAlertShown = false;
    if (criticalOverlay) {
      criticalOverlay.classList.remove('visible');
      criticalOverlay.hidden = true;
    }

    // Reset canvas HUD parameters
    document.getElementById('canvas-train-speed').textContent = "110 km/h";
    document.getElementById('canvas-stress-val').textContent = "NOMINAL";
    document.getElementById('canvas-stress-val').className = "o-val text-green";
  }

  function runCognitiveSimulation() {
    simRunning = true;
    simIsReplayMode = false;
    simBrakesApplied = false;
    btnRunSim.disabled = true;
    btnResetSim.disabled = true;
    btnRunSim.textContent = "⏳ PROCESSING INTERVENTION...";
    
    // Select targets
    let station = simStationSelect.value;
    let trainNum = simTrainSelect.value;
    let trainOpt = simTrainSelect.options[simTrainSelect.selectedIndex];
    let trainName = trainOpt.dataset.name;
    let initialSpeed = parseInt(trainOpt.dataset.speed, 10);
    
    simTrainSpeed = initialSpeed;
    simTrainDistance = 4.2; // km
    simTrainPositionPercent = -20;
    simTick = 0;
    
    // Clear histories for replay functionality
    simTelemetryHistory = [];
    simAgentDiscussionHistory = [];
    simRiskHistory = [];
    simSpeedHistory = [];
    simDistanceHistory = [];
    simSignalHistory = [];

    // Trigger visual segments hazard representation
    let nodeKey = station.substring(0, 3).toUpperCase();
    let targetSegment = document.getElementById(`seg-B`); // default Vikarabad
    if (station === "Secunderabad") targetSegment = document.getElementById(`seg-A`);
    if (station === "Kazipet") targetSegment = document.getElementById(`seg-D`);
    if (station === "Warangal") targetSegment = document.getElementById(`seg-G`);
    if (station === "Bibinagar") targetSegment = document.getElementById(`seg-F`);

    if (targetSegment) {
      targetSegment.className = `map-rail-line segment ${activeScenario === 'broken-rail' || activeScenario === 'track-buckling' ? 'critical' : 'risk'}`;
    }

    let stationNode = document.querySelector(`.map-station[data-station="${station}"]`);
    if (stationNode) {
      stationNode.className = `map-station ${activeScenario === 'broken-rail' || activeScenario === 'track-buckling' ? 'critical' : 'risk'}`;
    }

    // Telemetry log builder helper
    telemetryLog.textContent = `[${ts()}] [SYSTEM] Emergency pipeline initialized.
[${ts()}] [SYSTEM] Ingesting parameters: Station: ${station} | Train: ${trainNum} (${trainName})
[${ts()}] [Node-${nodeKey}] Accelerometer sampling continuous at 100Hz.\n`;

    agentDiscussionFeed.innerHTML = ""; // Clear agent messages

    animateFaultReplay();
    animateIncidentTimeline();

    // Auto-generate Maintenance Copilot checklist
    let db = scenarioDatabase[activeScenario];
    mTeam.textContent = db.team;
    mTime.textContent = db.time;
    mPriority.textContent = db.priority;
    
    mChecklist.innerHTML = "";
    db.checklist.forEach(item => {
      let li = document.createElement('li');
      li.className = "checklist-item";
      li.innerHTML = `<span class="checklist-check">☐</span> ${item}`;
      mChecklist.appendChild(li);
    });

    mTools.innerHTML = "";
    db.tools.forEach(tool => {
      let span = document.createElement('span');
      span.className = "tool-badge";
      span.textContent = tool;
      mTools.appendChild(span);
    });
    syncMaintenanceStrip();

    // Add Incident Row dynamically to Overview Table
    let activeIncidentId = `INC-${activeScenario.toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`;
    const incidentsBody = document.getElementById('incidents-table-body');
    if (incidentsBody) {
      incidentsBody.innerHTML = `
        <tr id="active-inc-row" style="background: rgba(255,59,92,0.04); transition: background 0.3s ease;">
          <td style="padding: 12px 10px; font-family: var(--mono); font-size: 0.75rem;">${activeIncidentId}</td>
          <td style="padding: 12px 10px; font-size: 0.75rem;">${station} Segment (Km ${simStationSelect.selectedIndex > 0 ? '88-201' : '142'})</td>
          <td style="padding: 12px 10px; font-size: 0.75rem;"><span class="emb-action" style="background: var(--red-dim); color: var(--red); border: 1px solid var(--red); padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 700;">${db.priority}</span></td>
          <td style="padding: 12px 10px; font-family: var(--mono); font-size: 0.75rem; color: var(--red); font-weight: 700;" id="inc-row-risk">0%</td>
          <td style="padding: 12px 10px; font-size: 0.75rem; color: var(--amber); font-weight: 700;" id="inc-row-status">MITIGATING (BRAKES ARMED)</td>
        </tr>
      ` + incidentsBody.innerHTML;
    }

    // Update AI Safety Directives
    const aiRecTitle = document.getElementById('ai-rec-title');
    const aiRecText = document.getElementById('ai-rec-text');
    const aiRecLog = document.getElementById('ai-rec-log');
    if (aiRecTitle && aiRecText) {
      aiRecTitle.textContent = `CRITICAL INTERVENTION DIRECTIVE: ${db.name.toUpperCase()}`;
      aiRecTitle.style.color = 'var(--red)';
      aiRecText.textContent = db.explanation;
    }
    if (aiRecLog) {
      aiRecLog.innerHTML = `
        <div>[${new Date().toTimeString().slice(0,8)}] CRITICAL: ${db.priority} alert received for ${db.name}.</div>
        <div>[${new Date().toTimeString().slice(0,8)}] DECISION: Bypassing human verification. Autonomy engaged.</div>
        <div>[${new Date().toTimeString().slice(0,8)}] INTERVENTION: Switched signal RED. RF broadcast applied.</div>
      ` + aiRecLog.innerHTML;
    }

    pushAlert('CRITICAL ALERT', `Location: ${station} (Km ${simStationSelect.selectedIndex > 0 ? '88–201' : '142'})<br>Issue: ${db.name}<br>Confidence: 91%<br>Action: Slow trains immediately`, db.priority === 'CRITICAL');

    // Run Timer loop simulating high speed telemetry feed
    simTimer = setInterval(() => {
      simTick++;
      
      // Compute train kinematics
      if (!simBrakesApplied) {
        simTrainPositionPercent += (simTrainSpeed / initialSpeed) * 0.9;
        // Distance decreases slightly
        simTrainDistance = Math.max(0.1, simTrainDistance - (simTrainSpeed / 3600) * 0.1);
      } else {
        // Decelerate kinematics
        simTrainSpeed = Math.max(0, simTrainSpeed - (initialSpeed / 20) - Math.random() * 2);
        simTrainPositionPercent += (simTrainSpeed / initialSpeed) * 0.6;
        simTrainDistance = Math.max(0.1, simTrainDistance - (simTrainSpeed / 3600) * 0.1);
      }

      // Update Train Dot position along SVG track coordinates dynamically
      let pathElem = document.querySelector('.map-rail-line.track-bg');
      if (pathElem) {
        let pct = (simTrainPositionPercent + 20) / 120; // convert to 0-1 range
        if (pct >= 0 && pct <= 1) {
          let point = pathElem.getPointAtLength(pct * pathElem.getTotalLength());
          mapTrainDot.setAttribute('cx', point.x);
          mapTrainDot.setAttribute('cy', point.y);
        }
      }

      // Live HUD readouts
      hudTrainSpeed.textContent = `${Math.round(simTrainSpeed)} km/h`;
      document.getElementById('canvas-train-speed').textContent = `${Math.round(simTrainSpeed)} km/h`;
      
      let computedTTI = Math.round((simTrainDistance / Math.max(1, simTrainSpeed)) * 3600);
      hudTTI.textContent = simTrainSpeed <= 0 ? "HALTED" : `${computedTTI}s`;

      // Update active incident row risk percentage
      const incRowRisk = document.getElementById('inc-row-risk');
      if (incRowRisk) {
        let currentRisk = parseFloat(gaugeRiskVal.textContent) || 0;
        incRowRisk.textContent = `${Math.round(currentRisk)}%`;
      }

      // Telemetry trigger logs ticking
      tickingTelemetryLogs(nodeKey, initialSpeed);

      // Multi-Agent feed triggers ticking
      tickingMultiAgentDialogues(db);

      // Record logs for replay database
      recordReplayFrame();

      // Check if train successfully halted before the incident segment
      if (simTrainSpeed <= 0 && simBrakesApplied) {
        clearInterval(simTimer);
        simTimer = null;
        simRunning = false;
        
        btnResetSim.disabled = false;
        btnRunSim.textContent = "INTERVENTION SUCCESSFUL";
        btnRunSim.className = "btn btn-primary text-green";

        // Enable Replay scrubbing
        replaySlider.disabled = false;
        replaySlider.min = 0;
        replaySlider.max = simTick - 1;
        replaySlider.value = simTick - 1;
        btnReplayPlay.disabled = false;

        // Log final resolution
        logFinalResolution(trainNum);

        // Update incidents table row status
        const incRowStatus = document.getElementById('inc-row-status');
        const activeIncRow = document.getElementById('active-inc-row');
        if (incRowStatus) {
          incRowStatus.textContent = 'RESOLVED (HALTED)';
          incRowStatus.style.color = 'var(--green)';
        }
        if (activeIncRow) {
          activeIncRow.style.background = 'transparent';
        }
        if (aiRecLog) {
          aiRecLog.innerHTML = `<div>[${new Date().toTimeString().slice(0,8)}] RESOLVED: Train ${trainNum} halted safely. Collision avoided.</div>` + aiRecLog.innerHTML;
        }
      }
    }, 100);
  }

  function ts() {
    let d = new Date();
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function tickingTelemetryLogs(nodeKey, initialSpeed) {
    if (simTick === 10) {
      telemetryLog.textContent += `[${ts()}] [Node-${nodeKey}] Anomaly Alert: Acceleration Y-axis lateral deviation rose to +1.8G (Threshold: 1.5G)\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;
    }
    if (simTick === 20) {
      telemetryLog.textContent += `[${ts()}] [Node-${nodeKey}] Confirming persistent stress anomaly: Z-axis vertical amplitude peak: 5.82G\n`;
      telemetryLog.textContent += `[${ts()}] [Node-${nodeKey}] Initializing edge TinyML window analysis...\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;

      document.getElementById('canvas-stress-val').textContent = "ANOMALY";
      document.getElementById('canvas-stress-val').className = "o-val text-amber";
    }
    if (simTick === 35) {
      let faultName = scenarioDatabase[activeScenario].name;
      telemetryLog.textContent += `[${ts()}] [Node-${nodeKey}] TinyML Edge classification complete (9ms). Anomaly Type: "${faultName}" | Confidence: 98.1%\n`;
      telemetryLog.textContent += `[${ts()}] [Node-${nodeKey}] Cryptographic packet signed (HMAC-SHA256). Transmitting alert payload over LoRa mesh...\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;

      // Escalation of risk
      let db = scenarioDatabase[activeScenario];
      updateRiskGauge(db.targetRisk * 0.4);
      setRiskExplanation(`Edge node classified anomaly as "${db.name}" with 98.1% confidence. Transmitting alert envelope to command agent.`);
      
      document.getElementById('canvas-stress-val').textContent = "CRITICAL LIMIT";
      document.getElementById('canvas-stress-val').className = "o-val text-red";
    }
    if (simTick === 50) {
      telemetryLog.textContent += `[${ts()}] [LoRa-Gateway] Anomaly broadcast packet successfully decrypted and routed to Cognitive Command\n`;
      telemetryLog.textContent += `[${ts()}] [SYSTEM] RailGuard AI correlation engine active. Mobilizing committee safety consensus...\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;
      
      let db = scenarioDatabase[activeScenario];
      updateRiskGauge(db.targetRisk * 0.85);
      setRiskExplanation(db.explanation);
    }
    if (simTick === 65) {
      telemetryLog.textContent += `[${ts()}] [SYSTEM] Multi-Agent Committee votes achieved. Intervention trigger dispatch: FORCE SIGNAL RED.\n`;
      telemetryLog.textContent += `[${ts()}] [Interlock-${nodeKey}-7B] Switch Interlock Relays forced to EMERGENCY RED.\n`;
      telemetryLog.textContent += `[${ts()}] [RF-Broadcast] Encrypted braking command packet (Code: 0x9B) dispatched to locomotive cab receiver.\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;

      // Brakes trigger!
      simBrakesApplied = true;
      hudSignal.textContent = "EMERGENCY RED";
      hudSignal.className = "d-val text-red";
      
      let db = scenarioDatabase[activeScenario];
      updateRiskGauge(db.targetRisk);
    }
    if (simTick === 85) {
      telemetryLog.textContent += `[${ts()}] [Loco-Pilot] Cab receiver alert triggered! Traction circuit disconnected automatically. Vacuum brakes applying.\n`;
      telemetryLog.scrollTop = telemetryLog.scrollHeight;
    }
  }

  function tickingMultiAgentDialogues(db) {
    // Ticks agent dialogues one by one
    let targetIndex = -1;
    if (simTick === 42) targetIndex = 0;
    if (simTick === 50) targetIndex = 1;
    if (simTick === 55) targetIndex = 2;
    if (simTick === 60) targetIndex = 3;
    if (simTick === 65) targetIndex = 4;

    if (targetIndex >= 0 && targetIndex < db.agents.length) {
      appendAgentMessage(db.agents[targetIndex]);
      updateLiveAgentCard(db.agents[targetIndex]);
    }
  }

  function logFinalResolution(trainNum) {
    telemetryLog.textContent += `\n[${ts()}] [SYSTEM] Intervention Pipeline Complete. Train ${trainNum} has halted safely at Km ${(parseFloat(simTrainDistance) + 0.35).toFixed(2)}.
[${ts()}] [SYSTEM] Collision avoided. Casualty risk reduced to 0%. Audit trail dispatched to immutable blockchain.`;
    telemetryLog.scrollTop = telemetryLog.scrollHeight;

    // Check checklist items on completion
    document.querySelectorAll('.checklist-item').forEach(item => {
      item.innerHTML = `<span class="checklist-check" style="color:var(--green)">✓</span> <span style="text-decoration:line-through;color:var(--text-3)">${item.textContent.substring(2)}</span>`;
    });
  }

  function recordReplayFrame() {
    simTelemetryHistory.push(telemetryLog.textContent);
    simAgentDiscussionHistory.push(agentDiscussionFeed.innerHTML);
    simRiskHistory.push(parseFloat(gaugeRiskVal.textContent));
    simSpeedHistory.push(simTrainSpeed);
    simDistanceHistory.push(simTrainDistance);
    simSignalHistory.push({
      text: hudSignal.textContent,
      className: hudSignal.className
    });
  }


  // --- REPLAY SYSTEM CONTROLS (Scrubbing) ---
  replaySlider.addEventListener('input', (e) => {
    clearInterval(simTimer);
    simTimer = null;
    simRunning = false;
    simIsReplayMode = true;
    
    replayTick = parseInt(e.target.value, 10);
    loadReplayFrame(replayTick);
    
    btnReplayPlay.innerHTML = "<span>&#9658;</span> PLAY REPLAY";
  });

  btnReplayPlay.addEventListener('click', () => {
    if (simRunning) return;

    if (btnReplayPlay.textContent.includes("PLAY")) {
      btnReplayPlay.innerHTML = "<span>||</span> PAUSE REPLAY";
      
      // Start playback loop
      simTimer = setInterval(() => {
        replayTick++;
        if (replayTick >= simTelemetryHistory.length) {
          clearInterval(simTimer);
          simTimer = null;
          btnReplayPlay.innerHTML = "<span>&#9658;</span> PLAY REPLAY";
          replayTick = simTelemetryHistory.length - 1;
        } else {
          replaySlider.value = replayTick;
          loadReplayFrame(replayTick);
        }
      }, 200);
    } else {
      btnReplayPlay.innerHTML = "<span>&#9658;</span> PLAY REPLAY";
      clearInterval(simTimer);
      simTimer = null;
    }
  });

  function loadReplayFrame(idx) {
    if (idx >= 0 && idx < simTelemetryHistory.length) {
      telemetryLog.textContent = simTelemetryHistory[idx];
      telemetryLog.scrollTop = telemetryLog.scrollHeight;

      agentDiscussionFeed.innerHTML = simAgentDiscussionHistory[idx];
      agentDiscussionFeed.scrollTop = agentDiscussionFeed.scrollHeight;

      updateRiskGauge(simRiskHistory[idx]);
      hudTrainSpeed.textContent = `${Math.round(simSpeedHistory[idx])} km/h`;
      document.getElementById('canvas-train-speed').textContent = `${Math.round(simSpeedHistory[idx])} km/h`;

      hudTTI.textContent = simSpeedHistory[idx] <= 0 ? "HALTED" : `${Math.round((simDistanceHistory[idx] / Math.max(1, simSpeedHistory[idx])) * 3600)}s`;

      hudSignal.textContent = simSignalHistory[idx].text;
      hudSignal.className = simSignalHistory[idx].className;

      // Re-map visual train left position
      let progressRatio = idx / (simTelemetryHistory.length - 1);
      simTrainPositionPercent = -20 + progressRatio * 72; // matching visually
      
      // Re-map dot on SVG map
      let pathElem = document.querySelector('.map-rail-line.track-bg');
      if (pathElem) {
        let pct = (simTrainPositionPercent + 20) / 120;
        let point = pathElem.getPointAtLength(pct * pathElem.getTotalLength());
        mapTrainDot.setAttribute('cx', point.x);
        mapTrainDot.setAttribute('cy', point.y);
      }
    }
  }


  // --- AI INVESTIGATION AGENT CHATBOT ---
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let query = chatInputField.value.trim();
    if (!query) return;

    appendChatBubble("user", query);
    chatInputField.value = "";
    
    // Simulate AI thinking and typing latency
    setTimeout(async () => {
      let reply = await handleChatbotResponse(query);
      appendChatBubble("bot", reply);
    }, 800);
  });

  chatSugBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      let query = btn.textContent;
      appendChatBubble("user", query);
      setTimeout(async () => {
        let reply = await handleChatbotResponse(query);
        appendChatBubble("bot", reply);
      }, 700);
    });
  });

  function appendChatBubble(role, text) {
    let bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    chatHistory.appendChild(bubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  async function handleChatbotResponse(query) {
    if (backendOnline) {
      try {
        const resp = await fetch(API_BASE + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query })
        });
        if (resp.ok) {
          const data = await resp.json();
          return data.reply;
        }
      } catch {}
    }
    return getOfflineChatResponse(query);
  }

  function getOfflineChatResponse(query) {
    let lower = query.toLowerCase();

    if (lower.includes("segment b") || lower.includes("track segment b")) {
      return "Vibration increased 32% above baseline and displacement sensors detected a 1.5 mm shift on Track Segment B (Vikarabad corridor, Km 88). Similar patterns preceded track failures in previous records. Confidence: 91%. Recommended action: slow trains immediately and dispatch ultrasonic inspection crew.";
    }
    if (lower.includes("track 5") || lower.includes("segment g") || lower.includes("track segment g")) {
      return "Vibration increased 27% over baseline, temperature rose 12°C, and similar patterns preceded defects in 8 previous cases. Track Segment G (Warangal corridor, Km 201) shows a 12Hz harmonic wheel-impact signature from Train 12457. Settlement risk: 18.4%. Recommended action: reduce speed to 40 km/h and dispatch FFT inspection crew within 2 hours.";
    }
    if (lower.includes("vikarabad")) {
      return "Safety Analysis: Vikarabad Jn sector (Km 88) currently experiences elevated steel expansion strains due to high thermal exposure (current weather temp: " + weatherTemp + "°C). In previous history, similar expansion gradients combined with 120 km/h traffic resulted in joint fractures. Recommend de-stressing checks and ballast packing inspection.";
    }
    if (lower.includes("vibration spike") || lower.includes("tn 12621")) {
      return "Telemetry Report: Train 12621 bogie accelerometers recorded lateral vibration spikes at 4.2G. The spectral peak is located at 12Hz. This pattern matches historical wheel flat defects rather than subgrade displacement. Slowing to 40 km/h avoids secondary rail cracks.";
    }
    if (lower.includes("safety report") || lower.includes("scr zone")) {
      return "SCR Zone Health Summary:\n- 24/24 edge nodes online and reporting nominal vibrations.\n- Thermal Expansion Index: STABLE (Average rail temp: 34.2°C).\n- Heavy rainfall alert active at Bibinagar sectors. Soil saturation stands at 78%, settlement factor at 2.4%.\n- Next maintenance queue: Vikarabad joint inspection.";
    }
    
    return "I have analyzed your query. My monitoring models verify track parameters are stable. If you simulate an incident (e.g. Broken Rail or Flooded Track) on the Incident Console, I will automatically ingest the telemetry logs and provide a detailed structural diagnostic analysis.";
  }

  // --- COMMAND CENTER: LIVE SENSOR MONITORING ---
  const sensorHistory = { vibration: [], temperature: [], shift: [], wheel: [] };
  const sensorEls = {
    vibration: { canvas: document.getElementById('chart-vibration'), val: document.getElementById('val-vibration') },
    temperature: { canvas: document.getElementById('chart-temperature'), val: document.getElementById('val-temperature') },
    shift: { canvas: document.getElementById('chart-shift'), val: document.getElementById('val-shift') },
    wheel: { canvas: document.getElementById('chart-wheel'), val: document.getElementById('val-wheel') },
  };
  const sensorJsonText = document.getElementById('sensor-json-text');

  function drawMiniChart(canvas, data, color) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = 100;
    ctx.fillStyle = '#080F1E';
    ctx.fillRect(0, 0, w, h);
    if (data.length < 2) return;
    const max = Math.max(...data, 0.01);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    data.forEach((v, i) => {
      const x = 4 + (i / (data.length - 1)) * (w - 8);
      const y = h - 8 - ((v - min) / range) * (h - 16);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function tickLiveSensors() {
    const riskMult = activeScenario ? 1.8 : (dashboardRiskBase / 15);
    const vib = (1.02 + (Math.random() - 0.5) * 0.08 * riskMult + (activeScenario ? 2 : 0)).toFixed(2);
    const temp = Math.round(weatherTemp + (Math.random() - 0.5) * 2);
    const shift = (0.4 + (weatherRain > 60 ? 0.8 : 0) + (activeScenario ? 1.1 : 0) + Math.random() * 0.2).toFixed(1);
    const humidity = Math.min(99, Math.round(55 + weatherRain * 0.25));
    const wheel = (0.05 + (activeScenario === 'wheel-crack' ? 2.5 : 0) + Math.random() * 0.04).toFixed(2);

    ['vibration', 'temperature', 'shift', 'wheel'].forEach((key, i) => {
      const vals = [parseFloat(vib), temp, parseFloat(shift), parseFloat(wheel)];
      sensorHistory[key].push(vals[i]);
      if (sensorHistory[key].length > 20) sensorHistory[key].shift();
      const colors = ['#7D9B76', '#C96A3D', '#D4AF37', '#C44D3D'];
      drawMiniChart(sensorEls[key].canvas, sensorHistory[key], colors[i]);
      if (sensorEls[key].val) sensorEls[key].val.textContent = vals[i];
    });

    if (sensorJsonText) {
      sensorJsonText.textContent = JSON.stringify({
        vibration: parseFloat(vib),
        temperature: temp,
        track_shift: parseFloat(shift),
        humidity,
        wheel_impact: parseFloat(wheel),
      }, null, 2);
    }
  }

  setInterval(tickLiveSensors, 3000);
  tickLiveSensors();

  // --- PREDICTIVE TIMELINE STRIP ---
  const ptToday = document.getElementById('pt-today');
  const ptTomorrow = document.getElementById('pt-tomorrow');
  const pt3days = document.getElementById('pt-3days');

  function updatePredictiveStrip() {
    const today = Math.min(99, Math.round(15 + dashboardRiskBase * 0.8 + (activeScenario ? 20 : 0)));
    const tomorrow = Math.min(99, Math.round(35 + weatherRain * 0.15 + weatherTemp * 0.1));
    const threeDay = Math.min(99, Math.round(72 + weatherRain * 0.1 + (weatherTemp > 55 ? 10 : 0)));
    if (ptToday) { ptToday.textContent = `${today}%`; ptToday.className = `pt-val ${today < 25 ? 'text-green' : today < 50 ? 'text-amber' : 'text-red'}`; }
    if (ptTomorrow) { ptTomorrow.textContent = `${tomorrow}%`; ptTomorrow.className = `pt-val ${tomorrow < 30 ? 'text-green' : tomorrow < 55 ? 'text-amber' : 'text-red'}`; }
    if (pt3days) { pt3days.textContent = `${threeDay}%`; pt3days.className = `pt-val ${threeDay < 40 ? 'text-amber' : 'text-red'}`; }
  }

  // --- AI RISK EQUATION PANEL ---
  const eqResult = document.getElementById('eq-result');
  const riskEquation = document.getElementById('risk-equation');

  function updateRiskEquation() {
    if (!riskEquation) return;
    const risk = activeScenario
      ? scenarioDatabase[activeScenario].targetRisk
      : dashboardRiskBase;
    let factors = [];
    if (risk > 60) {
      factors = [
        'High vibration detected',
        'Track displacement increasing',
        weatherRain > 50 ? 'Heavy rainfall forecast' : 'Structural stress elevated',
      ];
    } else if (risk > 30) {
      factors = [
        'Elevated vibration trend',
        'Minor track displacement',
        weatherRain > 40 ? 'Rainfall correlation active' : 'Weather within elevated band',
      ];
    } else {
      factors = ['Stable vibration baseline', 'Nominal track displacement', 'Weather within limits'];
    }
    let html = '';
    factors.forEach((f, i) => {
      if (i > 0) html += '<div class="eq-line eq-plus">+</div>';
      html += `<div class="eq-line"><span class="eq-factor">${f}</span></div>`;
    });
    const resultCls = risk > 60 ? 'text-red' : risk > 30 ? 'text-amber' : 'text-green';
    const resultTxt = risk > 60 ? 'Critical derailment risk' : risk > 30 ? 'Elevated derailment risk' : 'Low derailment risk';
    html += `<div class="eq-line eq-equals">=</div><div class="eq-line eq-result ${resultCls}">${resultTxt}</div>`;
    riskEquation.innerHTML = html;
  }

  // --- ALERT CENTER & EMERGENCY MODE ---
  const alertCenter = document.getElementById('alert-center');
  const alertCenterBody = document.getElementById('alert-center-body');
  const alertDismiss = document.getElementById('alert-dismiss');
  const emergencyBanner = document.getElementById('emergency-mode-banner');
  const ccAlertCount = document.getElementById('cc-alert-count');
  const ccNetworkStatus = document.getElementById('cc-network-status');

  function pushAlert(title, body, critical = false) {
    alertCount++;
    syncOverviewKPIs(parseFloat(gaugeRiskVal?.textContent) || dashboardRiskBase);
    if (ccAlertCount) {
      ccAlertCount.textContent = String(alertCount);
      ccAlertCount.className = `cc-stat-val ${critical ? 'text-red' : 'text-amber'}`;
    }
    if (alertCenter) alertCenter.classList.add('visible');
    if (alertCenterBody) {
      const empty = alertCenterBody.querySelector('.alert-empty');
      if (empty) empty.remove();
      const el = document.createElement('div');
      el.className = `alert-item ${critical ? 'critical' : ''}`;
      el.innerHTML = `<strong>${title}</strong>${body}`;
      alertCenterBody.prepend(el);
    }
    ['notify-sms', 'notify-email', 'notify-mobile'].forEach((id, i) => {
      setTimeout(() => {
        const chip = document.getElementById(id);
        if (chip) chip.classList.add('sent');
      }, 400 + i * 600);
    });
  }

  if (alertDismiss) {
    alertDismiss.addEventListener('click', () => {
      if (alertCenter) alertCenter.classList.remove('visible');
    });
  }

  function updateEmergencyMode(risk) {
    const show = risk >= 85 || (activeScenario && scenarioDatabase[activeScenario].targetRisk >= 85);
    if (emergencyBanner) emergencyBanner.hidden = !show;
    if (ccNetworkStatus) {
      ccNetworkStatus.textContent = risk > 50 ? '● DEGRADED' : '● NOMINAL';
      ccNetworkStatus.className = `cc-stat-val ${risk > 50 ? 'text-amber' : 'text-green'}`;
    }
    if (show && risk >= 85) {
      const embMsg = document.getElementById('emb-message');
      if (embMsg) embMsg.textContent = `Risk at ${Math.round(risk)}%. Reduce speed, stop approaching trains, dispatch inspection crew, notify control room.`;
    }
  }

  const origUpdateRiskGauge = updateRiskGauge;
  updateRiskGauge = function(risk) {
    origUpdateRiskGauge(risk);
    updateEmergencyMode(risk);
    updateRiskEquation();
    updatePredictiveStrip();
    if (risk >= 50 && !simRunning) {
      // throttle alerts
    }
  };

  // --- MAINTENANCE STRIP SYNC ---
  const ccMsPriority = document.getElementById('cc-ms-priority');
  const ccMsLocation = document.getElementById('cc-ms-location');
  const ccMsTeam = document.getElementById('cc-ms-team');
  const ccMsTime = document.getElementById('cc-ms-time');
  const ccMsEquipment = document.getElementById('cc-ms-equipment');

  function syncMaintenanceStrip() {
    if (mPriority && ccMsPriority) {
      ccMsPriority.textContent = mPriority.textContent;
      ccMsPriority.className = `ms-val ${mPriority.className.replace('m-val ', '')}`;
    }
    if (ccMsLocation) ccMsLocation.textContent = activeSegment || activeStation || '—';
    if (ccMsTeam && mTeam) ccMsTeam.textContent = mTeam.textContent;
    if (ccMsTime && mTime) ccMsTime.textContent = mTime.textContent;
    if (ccMsEquipment && mTools) {
      const badges = mTools.querySelectorAll('.tool-badge');
      ccMsEquipment.textContent = badges.length
        ? Array.from(badges).map(b => b.textContent).join(', ')
        : 'Routine inspection tools';
    }
  }

  // --- FAULT REPLAY TIMELINE ---
  const faultReplayTimeline = document.getElementById('fault-replay-timeline');
  const replayEvents = [
    { time: '14:05', event: 'Normal — all baselines stable', cls: 'active' },
    { time: '14:12', event: 'Increased vibration detected', cls: 'warn' },
    { time: '14:18', event: 'Track displacement rising', cls: 'warn' },
    { time: '14:23', event: 'AI warning generated', cls: 'warn' },
    { time: '14:30', event: 'Risk exceeded threshold', cls: 'crit' },
  ];

  function setFaultReplayIdle() {
    if (!faultReplayTimeline) return;
    faultReplayTimeline.innerHTML = `
      <div class="frt-item active"><span class="frt-time">14:05</span><span class="frt-event">Normal — all baselines stable</span></div>
      <div class="frt-item"><span class="frt-time">—</span><span class="frt-event">Awaiting anomaly or run simulation</span></div>`;
  }

  function animateFaultReplay() {
    if (!faultReplayTimeline) return;
    faultReplayTimeline.innerHTML = '';
    replayEvents.forEach((ev, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = `frt-item ${ev.cls}`;
        el.innerHTML = `<span class="frt-time">${ev.time}</span><span class="frt-event">${ev.event}</span>`;
        faultReplayTimeline.appendChild(el);
      }, i * 800);
    });
  }

  // --- INITIAL WEATHER RISK SETUP ---
  calculateWeatherRisk();
  updateFloodRisk();
  updatePredictiveStrip();
  updateRiskEquation();
  syncOverviewKPIs(dashboardRiskBase);

  // Default segment selection
  const defaultSeg = document.getElementById('seg-A');
  if (defaultSeg) selectSegment(defaultSeg);

  // Ambient multi-agent idle chatter (when no sim running)
  const idleAgentMessages = [
    { agent: "Track Agent", text: "All sector vibration baselines within nominal envelope.", class: "track" },
    { agent: "Weather Agent", text: "Rainfall correlation stable. No settlement acceleration detected.", class: "weather" },
    { agent: "Wheel Agent", text: "Onboard bogie telemetry nominal across active corridor trains.", class: "wheel" },
    { agent: "Maintenance Agent", text: "Next scheduled inspection: Vikarabad joint sector in 48 hours.", class: "maint" },
    { agent: "Decision Agent", text: "Consensus: maintain green signal. Autonomous override armed.", class: "decision" },
  ];
  let idleAgentIdx = 0;
  setInterval(() => {
    if (simRunning || simIsReplayMode || activeScenario) return;
    if (!agentDiscussionFeed.querySelector('.agent-empty-state') && agentDiscussionFeed.children.length > 3) return;
    if (agentDiscussionFeed.querySelector('.agent-empty-state')) {
      agentDiscussionFeed.innerHTML = '';
    }
    const msg = idleAgentMessages[idleAgentIdx % idleAgentMessages.length];
    idleAgentIdx++;
    appendAgentMessage(msg);
    updateLiveAgentCard(msg);
    while (agentDiscussionFeed.children.length > 5) {
      agentDiscussionFeed.removeChild(agentDiscussionFeed.firstChild);
    }
    agentDiscussionFeed.scrollTop = agentDiscussionFeed.scrollHeight;
  }, 4500);
});
