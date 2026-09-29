# 🌊 OceanLense — 3D Ocean Intelligence Platform

> Real-time 3D visualization and AI-powered analysis of the North Indian Ocean, integrating numerical model outputs with live in-situ Argo float observations.

![OceanLense Banner](https://img.shields.io/badge/OceanLense-3D%20Ocean%20Intelligence-0284c7?style=for-the-badge&logo=waves)
![Python](https://img.shields.io/badge/Python-3.14-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Gemini AI](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=flat-square&logo=google)

---

## 📌 Overview

**OceanLense** is a full-stack ocean intelligence platform that gives researchers, disaster managers, and oceanographers a powerful 3D window into the North Indian Ocean (0°N–25°N, 50°E–85°E).

It fuses:
- 🌐 **High-resolution numerical ocean model** data (ROMS/MOM6 compatible, 0.25° grid)
- 📡 **14 autonomous Argo profiling floats** reporting live temperature & salinity profiles
- 🤖 **Gemini AI assistant** grounded in real ocean data for natural language Q&A
- ⚠️ **Disaster hazard detection** — marine heatwaves, cyclonic eddies, model-observation discrepancies

---

## 🖥️ Features

| Feature | Description |
|---|---|
| **3D Ocean Explorer** | Interactive 3D visualization of ocean variables (temperature, salinity, currents, SSH, chlorophyll) from surface to 3,850 m seafloor |
| **Water Column Layers** | Slice through the ocean at any depth: 0m, 25m, 50m, 100m, 250m, 500m, 1000m, 2000m |
| **Model vs Argo Comparison** | Side-by-side comparison of numerical model predictions and real Argo float soundings with RMSE metrics |
| **In-Situ Observations** | Live positions, profiles, and QC-verified data from Argo floats, gliders, CTD stations, and BGC buoys |
| **Disaster Hazards Layer** | Automatic detection of marine heatwaves (MHW), cyclonic eddies, and anomalous regions |
| **OceanLense AI Assistant** | Gemini 2.5 Flash powered chatbot grounded in live ocean data — ask anything in natural language |
| **Data Pipeline** | Upload and validate custom NetCDF, CSV, or GeoJSON datasets |
| **INCOIS API Integration** | Ready-to-connect with live INCOIS ERDDAP/TDS data feeds |

---

## 🏗️ Tech Stack

### Backend
- **Python 3.14** + **FastAPI** + **Uvicorn**
- **NetCDF4 / xarray** for oceanographic data processing
- **Google Gemini 2.5 Flash** for AI-grounded natural language queries
- Modular service architecture: `OceanService`, `ObservationService`, `CompareService`, `HazardService`, `AskOceanXService`

### Frontend
- **React 19** + **Vite**
- **Three.js / React Three Fiber** for 3D ocean rendering
- **Tailwind CSS** for styling
- **Recharts** for data comparison charts
- **Lucide React** for icons

---

## 📁 Project Structure

```
oceanlense/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app & all API routes
│   │   ├── core/
│   │   │   ├── config.py         # Environment config & provenance
│   │   │   └── registry.py       # Variable registry
│   │   ├── services/
│   │   │   ├── ocean_service.py       # 3D model data slicing
│   │   │   ├── observation_service.py # Argo float data
│   │   │   ├── compare_service.py     # Model vs Argo comparison
│   │   │   ├── hazard_service.py      # Marine hazard detection
│   │   │   ├── nlp_query_service.py   # Gemini AI chatbot
│   │   │   └── explain_service.py     # Regional AI explanation
│   │   ├── adapters/
│   │   │   ├── netcdf_adapter.py
│   │   │   ├── csv_adapter.py
│   │   │   ├── json_adapter.py
│   │   │   └── incois_adapter.py
│   │   └── pipeline/
│   │       └── confidence.py     # Ocean Confidence Engine
│   ├── data/                     # Ocean model NetCDF data files
│   └── .env.example              # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Root app & state management
│   │   └── components/
│   │       ├── OceanViewer3D.jsx       # Main 3D viewer
│   │       ├── AskOceanXDrawer.jsx     # AI assistant chatbot
│   │       ├── ModelVsArgoView.jsx     # Comparison charts
│   │       ├── ObservationsView.jsx    # Float observations
│   │       ├── HazardsView.jsx         # Disaster hazards
│   │       ├── TopNavbar.jsx           # Navigation bar
│   │       └── DataPipelineModal.jsx   # Data upload modal
│   └── package.json
├── start_backend.bat             # Windows quick-start script
└── README.md
```

---

## ⚡ Getting Started

### Prerequisites
- Python 3.11+ (tested on Python 3.14)
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) *(optional — falls back to rule-based engine)*

### 1. Clone the Repository
```bash
git clone https://github.com/jashmohite31/oceanlense.git
cd oceanlense
```

### 2. Backend Setup
```bash
# Install Python dependencies
pip install fastapi uvicorn netcdf4 xarray numpy scipy python-dotenv google-genai

# Configure environment
cd backend
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Start the Backend
```bash
# From the project root
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 5. Open in Browser

| Service | URL |
|---|---|
| 🌊 Frontend App | http://localhost:5173 |
| ⚙️ Backend API | http://localhost:8000 |
| 📖 API Docs (Swagger) | http://localhost:8000/docs |

---

## 🔑 Environment Variables

Create `backend/.env` from the provided `backend/.env.example`:

```env
# Required for AI-powered OceanLense Assistant
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: INCOIS Live API integration
# INCOIS_API_BASE_URL=https://incois.gov.in/...
```

> Without a Gemini API key, the assistant automatically switches to the built-in rule-based oceanographic intelligence engine.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/ocean/slice` | Depth slice for any variable |
| GET | `/api/ocean/vectors` | Current velocity vectors |
| GET | `/api/observations` | List all in-situ platforms |
| GET | `/api/compare/argo-model` | Model vs Argo comparison |
| GET | `/api/hazards` | Marine hazard analysis |
| POST | `/api/nlp/ask` | AI assistant query |
| POST | `/api/upload` | Upload custom dataset |

Full interactive documentation: **http://localhost:8000/docs**

---

## 🗺️ Ocean Domain

- **Region**: North Indian Ocean (Arabian Sea + Bay of Bengal)
- **Bounds**: 0°N–25°N, 50°E–85°E
- **Resolution**: 0.25° horizontal grid
- **Depth Range**: 0 m (sea surface) → ~3,850 m (seafloor)
- **Key Depth Levels**: 0m, 25m, 50m, 100m, 250m, 500m, 1000m, 2000m
- **In-Situ Fleet**: 14 Argo floats, deep gliders, CTD stations, BGC buoys

---

## 🤖 AI Assistant

The **OceanLense Assistant** is powered by **Gemini 2.5 Flash** and grounded in live model data. It:
- Answers only oceanographic questions (temperature, salinity, currents, hazards, Argo observations)
- Automatically triggers 3D visualizations from natural language commands
- Falls back to a built-in rule-based engine if Gemini is unavailable
- Blocks sensitive/system questions for security

**Example queries:**
- *"What is the temperature at 100m depth?"*
- *"Show me active marine heatwaves"*
- *"Where does the model differ most from Argo floats?"*
- *"Explain the salinity barrier layer in the Bay of Bengal"*

---

## 💼 Business Model Canvas

<table width="100%">
  <tr>
    <td rowspan="2" width="20%" valign="top">
      <b>1️⃣ Key Partners</b><br><br>
      • <b>Data Providers:</b> INCOIS, NOAA, Copernicus<br>
      • <b>Hardware:</b> Argo & glider deployers<br>
      • <b>Cloud:</b> Google Cloud / AWS / Render<br>
      • <b>Research:</b> Universities & oceanographic institutes<br>
      • <b>Domain:</b> Marine technology organizations
    </td>
    <td width="20%" valign="top">
      <b>2️⃣ Key Activities</b><br><br>
      • Aggregate ocean-model & Argo data<br>
      • Develop 3D visualization platform<br>
      • AI natural language querying<br>
      • Model vs observation validation<br>
      • Cloud data processing
    </td>
    <td rowspan="2" width="20%" valign="top">
      <b>3️⃣ Value Propositions</b><br><br>
      <b>For Gov / Agencies:</b><br>Early detection of marine hazards (heatwaves, eddies) to protect coastal economies.<br><br>
      <b>For Researchers:</b><br>Unified 3D platform to explore and validate ocean models with real observations.<br><br>
      <b>For Industries:</b><br>Actionable subsurface intelligence.<br><br>
      <b>Core Innovation:</b><br>Converts NetCDF data into an interactive 3D web interface with an AI assistant.
    </td>
    <td width="20%" valign="top">
      <b>6️⃣ Customer Relationships</b><br><br>
      • High-touch support & SLAs<br>
      • Self-service platform<br>
      • Automated AI assistance<br>
      • Custom solutions & deployments
    </td>
    <td rowspan="2" width="20%" valign="top">
      <b>4️⃣ Customer Segments</b><br><br>
      <b>B2G (Government):</b><br>Ministry of Earth Sciences, INCOIS, IMD, Coast Guard.<br><br>
      <b>B2B (Marine Industries):</b><br>Commercial shipping, offshore energy, fishing fleets.<br><br>
      <b>B2I (Academic):</b><br>Universities, research institutes, climate NGOs.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>5️⃣ Key Resources</b><br><br>
      • Ocean datasets (INCOIS, Argo)<br>
      • Cloud computing & storage<br>
      • Tech stack (Python, React)<br>
      • Oceanographers & Developers<br>
      • Google Gemini APIs
    </td>
    <td valign="top">
      <b>7️⃣ Channels</b><br><br>
      • Direct sales<br>
      • Academic partnerships<br>
      • Conferences (Ocean Sciences)<br>
      • Online SaaS platform<br>
      • API ecosystem
    </td>
  </tr>
</table>

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <b>8️⃣ Cost Structure</b><br><br>
      • <b>Cloud & GPU:</b> Major cost for large datasets and 3D rendering<br>
      • <b>Data Storage:</b> Massive NetCDF files and real-time feeds<br>
      • <b>AI/API Costs:</b> Google Gemini usage fees<br>
      • <b>R&D:</b> Platform development and maintenance<br>
      • <b>Salaries:</b> Developers, data scientists, domain experts<br>
      • <b>Marketing:</b> B2B outreach and conference participation
    </td>
    <td width="50%" valign="top">
      <b>9️⃣ Revenue Streams</b><br><br>
      • <b>SaaS Subscriptions (Tiered):</b> <br>
      &nbsp;&nbsp;&nbsp;&nbsp;- <i>Basic:</i> Delayed data, 2D/3D views (Students)<br>
      &nbsp;&nbsp;&nbsp;&nbsp;- <i>Pro:</i> Live data, validation tools, AI access (Researchers)<br>
      &nbsp;&nbsp;&nbsp;&nbsp;- <i>Enterprise:</i> Real-time alerts, private deployment (Gov/Corp)<br>
      • <b>Custom Integration Fees:</b> Integrating private offshore sensor datasets<br>
      • <b>Enterprise Services:</b> Custom data pipelines and analytics reports
    </td>
  </tr>
</table>

---

## 📄 License

This project is developed for ocean research and disaster management decision-support purposes.

---

## 👨‍💻 Author

**Jash Mohite**
- GitHub: [@jashmohite31](https://github.com/jashmohite31)

---

*OceanLense — Because what happens beneath the surface matters.*
