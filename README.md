# 🚆 RailGuard AI — Intelligent Railway Risk Monitoring & Simulation System

##  Tagline
AI-powered railway safety monitoring, risk prediction, and real-time simulation dashboard for next-generation smart rail infrastructure.

---

##  Problem Statement
Railway systems currently lack:
- Real-time risk monitoring across stations  
- Predictive accident prevention systems  
- Unified visualization of train + station conditions  
- Intelligent decision-support for operators  

This leads to delayed responses and increased safety risks.

---

##  Our Solution
RailGuard AI is a full-stack intelligent railway monitoring system that combines:

- AI-based risk prediction engine  
- Real-time station condition monitoring  
- Interactive India railway map  
- 3D train simulation system  
- Smart control dashboard  
- Digital twin visualization  

It acts as a **centralized railway intelligence control system**.

---

##  Key Features

###  AI Risk Prediction
- Predicts station risk levels dynamically  
- Python-based condition analysis engine  
- Generates alerts based on system inputs  

###  Interactive Railway Map
- Visual India railway network  
- Clickable stations with live status  
- Color-coded risk indicators  

###  Smart Dashboard
- Real-time monitoring interface  
- System health overview  
- Station-level analytics  

###  3D Train Simulation
- Realistic train movement visualization  
- Demonstrates congestion and flow  
- Helps simulate real-world railway operations  

###  AI Control Interface
- AI assistant dashboard (`ai.html`)  
- System insights and predictions  
- Smart decision support layer  

###  Backend Intelligence
- Python-based backend system  
- Station dataset processing  
- Condition evaluation logic  

---

##  Tech Stack

**Frontend**
- HTML5  
- CSS3  
- JavaScript  
- Vite  

**Backend**
- Python  
- Custom AI logic modules  

**Files**
- backend_main.py  
- station_conditions.py  
- stations_data.py  

---

## 📁 Project Structure
RailGuard/
│
├── assets/                 # Images, icons, media
├── dist/                  # Production build
├── js/                   # Frontend logic
├── node_modules/         # Dependencies
│
├── ai.html               # AI assistant interface
├── dashboard.html        # Main control dashboard
├── india-map.html        # Interactive railway map
├── index.html            # Landing page
├── simulator.html        # Basic simulation view
├── simulation-3d.html    # 3D train simulation
├── predict.html          # Prediction system UI
├── twin.html             # Digital twin module
│
├── backend_main.py       # Core backend logic
├── station_conditions.py # Station risk analysis
├── stations_data.py      # Dataset of stations
│
├── main.js               # Frontend core logic
├── style.css             # Global styling
├── vite.config.js        # Build configuration
│
├── package.json
└── package-lock.json


---

## 🚀 How to Run

### 1. Clone repository
```
git clone https://github.com/ShaikMishaTabassum/RailGuard-AI.git
cd RailGuard-AI
### 2. Install dependencies
npm install
### 3. Run frontend
npm run dev
### 4. Run backend
python backend_main.py

-------------

### System Architecture
Frontend (UI Dashboard + Map + Simulation)
            ↓
JavaScript Logic Layer
            ↓
Python Backend Engine
            ↓
Station Dataset + AI Logic
            ↓
Real-time Risk Output Visualization

------------

### Impact
-Improves railway safety monitoring
-Reduces accident response time
-Enables predictive railway analytics
-Provides unified control dashboard
-Visualizes entire railway system in real-time

------------

### Future Enhancements
-Live IoT sensor integration
-WebSocket real-time updates
-ML-based accident prediction model
-GPS-based live train tracking
-AI voice assistant for control room
-National-scale deployment system

---------------
