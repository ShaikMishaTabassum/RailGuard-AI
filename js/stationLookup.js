const API_BASE = "http://localhost:8000";
let dynamicGroup = null;

export function initStationLookup(formId, resultId, svgId = "india-svg-map") {
  const form = document.getElementById(formId);
  if (!form) return;
  const input = form.querySelector('input[name="station"]');
  const button = form.querySelector('button[data-action="check"]');
  const clearBtn = form.querySelector('button[data-action="clear"]');
  const resultEl = document.getElementById(resultId);
  const svg = document.getElementById(svgId);

  dynamicGroup = svg ? svg.querySelector("#dynamic-stations") : null;
  if (svg && !dynamicGroup) {
    dynamicGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicGroup.setAttribute("id", "dynamic-stations");
    svg.appendChild(dynamicGroup);
  }

  if (button) button.addEventListener("click", () => runLookup(input, resultEl));
  if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") runLookup(input, resultEl); });
  if (clearBtn) clearBtn.addEventListener("click", () => {
    if (dynamicGroup) dynamicGroup.innerHTML = "";
    if (resultEl) resultEl.innerHTML = "";
  });
}

async function runLookup(input, resultEl) {
  const query = input.value.trim();
  if (!query) return;
  resultEl.innerHTML = `<p class="loading">Checking track conditions for "${query}"...</p>`;
  try {
    const res = await fetch(`${API_BASE}/api/track-condition?station=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    renderResult(resultEl, data);
    plotOnMap(data);
  } catch (err) {
    resultEl.innerHTML = `<p class="error">⚠ Backend unreachable: ${err.message}<br><small>Make sure uvicorn is running on port 8000</small></p>`;
  }
}

function renderResult(resultEl, data) {
  const sc = data.status.toLowerCase();
  const color = sc === "safe" ? "#22c55e" : sc === "warning" ? "#f5a623" : "#ef4444";
  resultEl.innerHTML = `
    <div class="station-card status-${sc}">
      <div class="station-card-header">
        <h4>${data.station_name}</h4>
        <span class="status-badge status-${sc}" style="background:${color}18;color:${color}">${data.status}</span>
      </div>
      <p class="station-meta">Code: ${data.station_code} &nbsp;•&nbsp; Zone: ${data.zone}</p>
      <p class="risk-score">Risk Score: <strong style="color:${color}">${data.risk_score}%</strong></p>
      <div class="metrics-grid">
        <div class="metric"><span>Vibration</span><strong>${data.metrics.vibration_mm_s} mm/s</strong></div>
        <div class="metric"><span>Rail Temp</span><strong>${data.metrics.rail_temperature_c} °C</strong></div>
        <div class="metric"><span>Rail Wear</span><strong>${data.metrics.rail_wear_percent}%</strong></div>
      </div>
      <p class="timestamp">Updated: ${new Date(data.last_updated).toLocaleTimeString()}</p>
    </div>`;
}

function plotOnMap(data) {
  if (!dynamicGroup) return;
  const id = `dyn-${data.station_code}`;
  const existing = dynamicGroup.querySelector(`#${id}`);
  if (existing) existing.remove();
  const color = data.status === "SAFE" ? "#22c55e" : data.status === "WARNING" ? "#f5a623" : "#ef4444";
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("id", id);
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", data.svg_x);
  circle.setAttribute("cy", data.svg_y);
  circle.setAttribute("r", "8");
  circle.setAttribute("fill", color);
  circle.setAttribute("stroke", color);
  circle.setAttribute("stroke-width", "2");
  circle.setAttribute("opacity", "0.85");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", data.svg_x);
  text.setAttribute("y", data.svg_y - 13);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "9");
  text.setAttribute("font-weight", "700");
  text.setAttribute("fill", color);
  text.textContent = `${data.station_name} (${data.station_code})`;
  g.appendChild(circle);
  g.appendChild(text);
  dynamicGroup.appendChild(g);
}
