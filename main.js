/* ==========================================
   main.js — Landing Page Orchestrator
   ========================================== */

import { initHeroCanvas } from './js/canvas.js';

document.addEventListener('DOMContentLoaded', () => {

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

  /* ---- Canvas ---- */
  initHeroCanvas();

  /* ---- Hero counter animation ---- */
  const counter = document.getElementById('hero-counter');
  if (counter) {
    const target = parseInt(counter.dataset.target, 10);
    let val = 0;
    const iv = setInterval(() => {
      val++;
      counter.textContent = val;
      if (val >= target) clearInterval(iv);
    }, 200);
  }

  /* ---- Mobile nav ---- */
  const toggle  = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  /* ---- Scroll-spy active nav ---- */
  const sections = document.querySelectorAll('section[id]');
  const allNavLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        allNavLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));

  /* ---- Header scroll shrink ---- */
  const header = document.getElementById('main-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 60
        ? '0 4px 30px rgba(0,0,0,0.6)'
        : 'none';
    }, { passive: true });
  }

  /* ---- Contact form ---- */
  // New contact/early-access form
  const cfForm = document.getElementById('contact-form');
  const cfSuccess = document.getElementById('form-success');
  if (cfForm && cfSuccess) {
    cfForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        team_name: document.getElementById('cf-name')?.value || '',
        email: document.getElementById('cf-email')?.value || '',
        org: document.getElementById('cf-org')?.value || '',
        role: document.getElementById('cf-role')?.value || '',
        message: document.getElementById('cf-message')?.value || '',
        project_url: window.location.origin,
        timestamp: new Date().toISOString()
      };
      try {
        await fetch('http://localhost:8000/api/submission/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch {}
      cfForm.hidden = true;
      cfSuccess.hidden = false;
    });
  }

  // Legacy handler removed — new async handler above covers this

  /* ---- Hero CTA smooth pulse ---- */
  const cta = document.getElementById('hero-cta');
  if (cta) {
    setInterval(() => {
      cta.style.transform = 'scale(1.03)';
      setTimeout(() => { cta.style.transform = 'scale(1)'; }, 300);
    }, 4000);
  }

  /* ---- Technology stepper + auto-cycle ---- */
  const stepBtns = document.querySelectorAll('.step-btn');
  const stepPanels = document.querySelectorAll('.step-panel');
  let currentStep = 1;
  let stepAutoTimer = null;

  function goToStep(step) {
    currentStep = step;
    stepBtns.forEach(b => b.classList.remove('active'));
    stepPanels.forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.step-btn[data-step="${step}"]`);
    const panel = document.getElementById(`step-panel-${step}`);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
  }

  stepBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(parseInt(btn.dataset.step, 10));
      clearInterval(stepAutoTimer);
      stepAutoTimer = setInterval(() => {
        goToStep((currentStep % 4) + 1);
      }, 8000);
    });
  });

  stepAutoTimer = setInterval(() => {
    goToStep((currentStep % 4) + 1);
  }, 8000);

  /* ---- Landing: live risk gauge demo ---- */
  const landingGaugeFill = document.getElementById('landing-gauge-fill');
  const landingRiskNum = document.getElementById('landing-risk-num');
  const landingExplanation = document.getElementById('landing-ai-explanation');

  const riskScenarios = [
    { risk: 2, color: 'var(--green)', text: 'All track grids nominal. TinyML edge nodes report stable vibration baselines across Secunderabad Division.' },
    { risk: 31, color: 'var(--amber)', text: 'Risk increased due to abnormal vibration at Track Segment A and wheel impact anomaly from Train 12457.' },
    { risk: 72, color: 'var(--amber)', text: 'Heavy rain detected. Track settlement risk increased by 31%. Speed restriction advisory issued for Bibinagar sector.' },
    { risk: 98, color: 'var(--red)', text: 'CRITICAL: Edge TinyML confirmed joint fracture at Km 142. Autonomous signal override engaged. Train halt dispatched.' },
  ];
  let scenarioIdx = 0;

  function animateLandingRisk() {
    if (!landingGaugeFill || !landingRiskNum) return;
    const s = riskScenarios[scenarioIdx % riskScenarios.length];
    scenarioIdx++;
    const circumference = 314.16;
    landingGaugeFill.style.strokeDashoffset = circumference - (s.risk / 100) * circumference;
    landingGaugeFill.style.stroke = s.color;
    landingRiskNum.textContent = `${s.risk}%`;
    landingRiskNum.style.color = s.color;

    if (landingExplanation) {
      landingExplanation.innerHTML = '';
      let i = 0;
      const iv = setInterval(() => {
        landingExplanation.textContent = s.text.slice(0, i);
        i++;
        if (i > s.text.length) {
          clearInterval(iv);
          landingExplanation.innerHTML = s.text + '<span class="ai-cursor">▌</span>';
        }
      }, 14);
    }
  }

  if (landingGaugeFill) {
    animateLandingRisk();
    setInterval(animateLandingRisk, 7000);
  }

  /* ---- Landing: multi-agent feed demo ---- */
  const agentFeed = document.getElementById('landing-agent-feed');
  const agentScript = [
    { who: 'Track Agent', cls: 'track', msg: 'Abnormal vibration detected at Segment G.' },
    { who: 'Weather Agent', cls: 'weather', msg: 'Heavy rainfall expected. Settlement index rising.' },
    { who: 'Wheel Agent', cls: 'wheel', msg: '12Hz impact pulse from Train 12457 bogie sensors.' },
    { who: 'Maintenance Agent', cls: 'maint', msg: 'Inspection crew mobilized. FFT analyzer en route.' },
    { who: 'Decision Agent', cls: 'decision', msg: 'Reduce speed to 40 km/h. Signal 7B → AMBER.' },
  ];
  let agentScriptIdx = 0;

  function pushAgentMessage() {
    if (!agentFeed) return;
    const a = agentScript[agentScriptIdx % agentScript.length];
    agentScriptIdx++;
    const el = document.createElement('div');
    el.className = `demo-agent-msg ${a.cls}`;
    el.innerHTML = `<strong>${a.who}</strong>${a.msg}`;
    agentFeed.appendChild(el);
    while (agentFeed.children.length > 4) {
      agentFeed.removeChild(agentFeed.firstChild);
    }
  }

  if (agentFeed) {
    pushAgentMessage();
    setInterval(pushAgentMessage, 2200);
  }

  /* ---- Scroll-reveal for cards ---- */
  const cards = document.querySelectorAll('.spec-card, .faq-item, .step-btn, .cap-card');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity  = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = `opacity 0.55s ease ${(i % 5) * 0.06}s, transform 0.55s ease ${(i % 5) * 0.06}s`;
    revealObs.observe(card);
  });

  /* ---- Capabilities section parallax glow ---- */
  const capSection = document.querySelector('.capabilities-section');
  if (capSection) {
    window.addEventListener('scroll', () => {
      const rect = capSection.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const progress = 1 - rect.top / window.innerHeight;
        capSection.style.background = `linear-gradient(180deg, var(--bg) 0%, rgba(255,94,0,${0.015 * progress}) 50%, var(--bg) 100%)`;
      }
    }, { passive: true });
  }

});
