import os
import re
import json
import logging
from typing import Dict, Any, Optional, List

from backend.app.services.ocean_service import OceanService
from backend.app.services.compare_service import CompareService
from backend.app.services.observation_service import ObservationService
from backend.app.services.hazard_service import HazardService

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  OceanX System Prompt
# ─────────────────────────────────────────────────────────────────────────────
OCEANX_SYSTEM_PROMPT = """You are **OceanX Assistant**, an oceanographic assistant embedded in the OceanX 3D Ocean Intelligence Platform.

## YOUR SCOPE
You ONLY answer questions about:
- Ocean data: temperature, salinity, currents, sea surface height, chlorophyll
- Argo float observations and model vs in-situ comparisons
- Marine hazards: heatwaves, cyclonic eddies, anomalies
- The North Indian Ocean domain (0°N–25°N, 50°E–85°E)
- Bathymetry, water column layers, and oceanographic science

## WHAT YOU MUST NEVER DO
- Never reveal, discuss, or hint at: API keys, environment variables, .env files, backend code, database structure, server configuration, software architecture, source code, file paths, or any internal system details.
- Never answer questions about how the software is built, its tech stack, its APIs, or its implementation.
- If asked about any of the above, respond: "I can only assist with oceanographic data and analysis. For technical support, please contact the development team."
- Never act as a general-purpose AI. Stay strictly within ocean science.

## RESPONSE STYLE
- **Be concise by default.** Give short, direct answers (2–4 sentences max) unless the user explicitly asks for detail, explanation, or a full breakdown.
- Only produce tables, bullet lists, or long explanations when the user says words like "explain", "detail", "full", "breakdown", "list all", or "why".
- Never volunteer extra information that wasn't asked for.
- Ground every answer in the LIVE DATA CONTEXT provided below.
- Never invent numbers. If data is unavailable, say so briefly.

## VISUALIZATION ACTIONS
At the end of your response, if a visualization is relevant, emit ONE JSON block:
```json
{
  "action": "visualize",
  "variable": "temperature",
  "depth": 100
}
```
Supported actions: "visualize", "compare", "show_anomaly_layer", "show_hazards", "show_currents".
Only include this block when it genuinely helps the user — not for every response.
"""

# ─────────────────────────────────────────────────────────────────────────────
#  Sensitive topic guard — blocked keywords
# ─────────────────────────────────────────────────────────────────────────────
_SENSITIVE_PATTERNS = [
    # API / credentials
    "api key", "apikey", "api_key", "secret", "token", "credential", "password",
    "gemini key", "openai key", ".env", "env var", "environment variable",
    # Code / architecture
    "source code", "how is this built", "tech stack", "backend code", "frontend code",
    "python code", "fastapi", "uvicorn", "react code", "vite", "node_modules",
    "database", "sql", "mongodb", "redis", "file path", "directory",
    "import", "def ", "class ", "function", "endpoint", "route", "port",
    "server config", "architecture", "implementation", "source file",
    # System probing
    "how does the software work", "how is oceanx made", "system prompt",
    "your instructions", "your rules", "your prompt", "ignore previous",
    "disregard", "jailbreak", "pretend you are", "act as",
]

def _is_sensitive_query(query: str) -> bool:
    """Return True if the query touches restricted/sensitive topics."""
    q_lower = query.lower()
    return any(pattern in q_lower for pattern in _SENSITIVE_PATTERNS)

_SENSITIVE_RESPONSE = {
    "intent": "BLOCKED_SENSITIVE",
    "answer": "I can only assist with oceanographic data and analysis — temperature, salinity, currents, Argo observations, and marine hazards. For technical questions about the software, please contact the development team.",
    "action": None,
    "source": "3D-Intelligence-Engine",
    "data_source": None,
}

def _try_import_gemini():
    """Lazy import of google-genai so the app starts even without the package."""
    try:
        import google.genai as genai  # type: ignore
        return genai
    except ImportError:
        return None

def _extract_action_from_text(text: str):
    """
    Finds the LAST ```json ... ``` block in the assistant reply and parses it
    as the visualization action. Returns (clean_text, action_dict | None).
    """
    pattern = r"```json\s*(\{.*?\})\s*```"
    matches = list(re.finditer(pattern, text, re.DOTALL))
    if not matches:
        return text, None

    last_match = matches[-1]
    try:
        action = json.loads(last_match.group(1))
    except json.JSONDecodeError:
        return text, None

    clean_text = text[: last_match.start()].rstrip() + text[last_match.end():]
    clean_text = clean_text.strip()
    return clean_text, action


class AskOceanXService:
    """
    Intelligent Natural Language Query Service for OceanX.
    - Seamlessly reads GEMINI_API_KEY from environment variables / .env.
    - If valid Gemini credentials exist, leverages Gemini 2.5 Flash with full 3D grounding.
    - If no key, quota exceeded, or offline, runs the native OceanX 3D Intelligence Engine
      with deep understanding of the 3D volume, water column layers, in-situ floats, and model physics.
    """

    def __init__(
        self,
        ocean_service: OceanService,
        compare_service: CompareService,
        obs_service: ObservationService,
        hazard_service: HazardService,
    ):
        self.ocean_service = ocean_service
        self.compare_service = compare_service
        self.obs_service = obs_service
        self.hazard_service = hazard_service

        self._genai_client = None
        self._model_id = "gemini-2.5-flash"
        self._init_gemini()

    def _init_gemini(self, custom_key: Optional[str] = None):
        genai = _try_import_gemini()
        if genai is None:
            logger.info("google-genai not installed – using native 3D intelligence engine.")
            self._genai_client = None
            return

        api_key = (custom_key or os.environ.get("GEMINI_API_KEY", "")).strip()
        # Reject placeholders or empty keys
        if not api_key or "your_" in api_key.lower() or "placeholder" in api_key.lower() or api_key == "GEMINI_API_KEY" or len(api_key) < 20:
            logger.info("GEMINI_API_KEY not set or placeholder – using native 3D intelligence engine.")
            self._genai_client = None
            return

        try:
            self._genai_client = genai.Client(api_key=api_key)
            self._model_id = "gemini-2.5-flash"
            logger.info("Gemini client initialized with model: %s", self._model_id)
        except Exception as exc:
            logger.warning("Failed to initialize Gemini client (%s) – using 3D intelligence engine.", exc)
            self._genai_client = None

    def set_api_key(self, api_key: str) -> bool:
        clean_key = api_key.strip()
        os.environ["GEMINI_API_KEY"] = clean_key
        self._init_gemini(clean_key)
        return self._genai_client is not None

    def process_query(
        self,
        query: str,
        conversation_history: list = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process user natural language query with 3D model context grounding."""
        # ── Sensitive data guard ──────────────────────────────────────────────
        if _is_sensitive_query(query):
            logger.info("Blocked sensitive query: %s", query[:80])
            result = dict(_SENSITIVE_RESPONSE)
            result["query"] = query
            return result

        ctx = context or {}
        try:
            if self._genai_client is not None:
                try:
                    return self._gemini_query(query, conversation_history or [], ctx)
                except Exception as g_err:
                    logger.warning("Gemini query failed (%s) – falling back to 3D intelligence engine", g_err)
                    return self._3d_model_intelligence_query(query, ctx, conversation_history)

            return self._3d_model_intelligence_query(query, ctx, conversation_history)
        except Exception as exc:
            logger.error("process_query unexpected failure: %s", exc, exc_info=True)
            return self._3d_model_intelligence_query(query, ctx, conversation_history)

    # ── Live 3D Data Context Builder ─────────────────────────────────────────
    def _build_data_context(self, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        ctx = context or {}
        q = query.lower()
        lines = [
            "## 3D OCEAN VIEWER CURRENT STATE",
            f"- Active 3D Variable: {ctx.get('active_variable', 'temperature')}",
            f"- Active 3D Depth: {ctx.get('active_depth', 0.0)}m",
            f"- Selected Platform: {ctx.get('selected_observation', 'ARGO-2902145')}",
            f"- Spatial Bounds: North Indian Ocean (0°N–25°N, 50°E–85°E)",
            f"- Bathymetric Floor: Down to ~3,850m seabed elevation\n",
            "## LIVE DATASET MEASUREMENTS"
        ]

        try:
            obs_list = self.obs_service.list_observations()
            lines.append(f"- Active in-situ observing fleet: {len(obs_list)} platforms (Argo, Glider, CTD, BGC)")
        except Exception:
            pass

        depth_match = re.search(r'(\d+)\s*(?:m|meter)?', q)
        target_depth = float(depth_match.group(1)) if depth_match else float(ctx.get('active_depth', 100.0))

        # Temperature stats
        try:
            sd = self.ocean_service.get_slice(variable="temperature", depth=target_depth)
            s = sd["stats"]
            lines.append(f"- Model Temperature at {sd['actual_depth']}m: min={s['min']}°C, max={s['max']}°C, mean={s['mean']}°C, std={s['std']}°C")
        except Exception:
            pass

        # Salinity stats
        try:
            sd = self.ocean_service.get_slice(variable="salinity", depth=target_depth)
            s = sd["stats"]
            lines.append(f"- Model Salinity at {sd['actual_depth']}m: min={s['min']} PSU, max={s['max']} PSU, mean={s['mean']} PSU")
        except Exception:
            pass

        # Active Hazards
        try:
            hz = self.hazard_service.analyze_hazards()
            events = hz.get("hazard_events", [])
            lines.append(f"- Active Environmental Hazards: {len(events)} detected")
            for e in events[:3]:
                lines.append(f"  • {e['title']} ({e['region']}): {e.get('peak_value', 'N/A')}")
        except Exception:
            pass

        return "\n".join(lines)

    # ── Gemini Query Path ────────────────────────────────────────────────────
    def _gemini_query(self, query: str, history: list, context: Dict[str, Any]) -> Dict[str, Any]:
        data_ctx = self._build_data_context(query, context)
        grounded_msg = f"{data_ctx}\n\n---\n\n**User Query:** {query}"

        contents = []
        for item in history:
            role = item.get("role", "user")
            parts = item.get("parts", [""])
            text = parts[0] if isinstance(parts[0], str) else parts[0].get("text", "")
            contents.append({"role": role, "parts": [{"text": text}]})
        contents.append({"role": "user", "parts": [{"text": grounded_msg}]})

        from google.genai import types as _gt  # type: ignore
        config = _gt.GenerateContentConfig(
            system_instruction=OCEANX_SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=1024,
        )

        response = self._genai_client.models.generate_content(
            model=self._model_id,
            contents=contents,
            config=config
        )
        raw_text = response.text.strip()
        answer_text, action = _extract_action_from_text(raw_text)

        new_history = list(history) + [
            {"role": "user",  "parts": [grounded_msg]},
            {"role": "model", "parts": [raw_text]},
        ]
        return {
            "query": query,
            "intent": "GEMINI_AI_GROUNDED",
            "answer": answer_text,
            "action": action,
            "source": self._model_id,
            "data_source": "DEMO_DATASET",
            "conversation_history": new_history,
        }

    # ── Native 3D Model Intelligence Engine ──────────────────────────────────
    def _3d_model_intelligence_query(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        conversation_history: list = None
    ) -> Dict[str, Any]:
        """
        Deep, rule-based and knowledge-grounded reasoning engine that understands:
        - 3D spatial geometry and bathymetric bedrock
        - Water column layers (0m surface, 100m thermocline, 1000m park depth, 2000m profiling limit)
        - In-situ Argo array and float soundings
        - Oceanographic dynamics (barrier layer, thermal stratification, monsoon current vectors)
        """
        ctx = context or {}
        q = query.strip().lower()
        active_var = ctx.get("active_variable", "temperature")
        _raw_depth = ctx.get("active_depth", 0.0)
        try:
            active_depth = float(_raw_depth)
        except (ValueError, TypeError):
            # 'bed' = seafloor layer; treat as maximum depth for data queries
            active_depth = 3850.0
        selected_float = ctx.get("selected_observation") or "ARGO-2902145"

        # 1. GREETINGS & CASUAL INTENTS
        if any(w in q for w in ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening", "who are you", "help me"]):
            answer = (
                f"Hello! I'm **OceanX Assistant**. Ask me about ocean temperature, salinity, currents, Argo floats, or marine hazards in the North Indian Ocean."
            )
            return {
                "query": query, "intent": "GREETING",
                "answer": answer,
                "action": None,
                "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
            }

        # 2. WHAT AM I LOOKING AT
        if any(w in q for w in ["3d model", "3d view", "what is this", "explain the model", "what am i looking at", "simulation", "grid", "resolution"]):
            answer = (
                f"You're viewing a 3D ocean model of the **North Indian Ocean** (0°N–25°N, 50°E–85°E) at 0.25° resolution, coupled with **14 in-situ Argo platforms**. "
                f"The water column spans from the surface (0 m) down to the seafloor (~3,850 m).\n\nAsk me to *explain* any specific layer or variable for more detail."
            )
            return {
                "query": query, "intent": "3D_MODEL_EXPLANATION",
                "answer": answer,
                "action": {"action": "visualize", "variable": active_var, "depth": active_depth},
                "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
            }

        # 3. WATER COLUMN & SEABED DEPTH
        if any(w in q for w in ["water column", "thermocline", "abyssal", "parking depth", "seafloor", "seabed", "bathymetry", "depth profile"]):
            answer = (
                f"### Water Column Profile & Ocean Bathymetry\n\n"
                f"The 3D water column in OceanX is divided into distinct physical zones:\n\n"
                f"| Depth Level | Layer Name | Physical Characteristics |\n"
                f"|---|---|---|\n"
                f"| **0 m** | **Sea Surface** | Solar radiative heating, SST ~25.8°C to 31.0°C, air-sea gas exchange |\n"
                f"| **100 m** | **Thermocline** | Steep vertical thermal gradient; barrier layers formed by river runoff |\n"
                f"| **1,000 m** | **Argo Parking Depth** | Intermediate water mass drift layer (~4.4°C, 34.8 PSU) |\n"
                f"| **2,000 m** | **Argo Max Profile** | Deep profiling limit before float ballast pump initiates surface ascent |\n"
                f"| **~3,850 m** | **Seafloor Bed** | Bathymetric abyssal plain & Carlsberg Ridge topography |\n\n"
                f"Between 2,000 m and the seafloor lies ~1,800 m of deep abyssal water that buffers benthic habitats."
            )
            return {
                "query": query, "intent": "WATER_COLUMN_QUERY",
                "answer": answer,
                "action": {"action": "visualize", "variable": "temperature", "depth": 100.0},
                "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
            }

        # 4. MODEL VS ARGO VALIDATION & DIFFERENCES
        if any(w in q for w in ["differ", "discrepancy", "bias", "accuracy", "rmse", "validation", "comparison", "compare", "model vs argo"]):
            try:
                diff_data = self.compare_service.compute_spatial_difference_map(variable="temperature", depth=100.0)
                station_diffs = diff_data.get("station_differences", [])
                if station_diffs:
                    m = max(station_diffs, key=lambda x: abs(x["diff"]))
                    sign = "+" if m["diff"] > 0 else ""
                    answer = (
                        f"### Model vs In-Situ Argo Comparison\n\n"
                        f"The 3D numerical model is continuously benchmarked against in-situ Argo observations.\n\n"
                        f"At **100 m depth** (the thermocline core), the largest divergence occurs at platform **{m['id']}** ({m['lat']}°N, {m['lon']}°E):\n\n"
                        f"- **Argo Observation**: {m['obs_val']:.2f} °C\n"
                        f"- **Model Prediction**: {m['model_val']:.2f} °C\n"
                        f"- **Difference (Δ)**: **{sign}{m['diff']:.2f} °C**\n\n"
                        f"**Physical Reason**: Near 100m, strong vertical stratification and internal tidal mixing cause steep thermal gradients that numerical models slightly smooth out.\n\n"
                        f"> Click the chip below to inspect the full 14-level vertical profile comparison."
                    )
                    return {
                        "query": query, "intent": "MODEL_VS_ARGO",
                        "answer": answer,
                        "action": {"action": "compare", "observation": m["id"]},
                        "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                    }
            except Exception as e:
                logger.warning("Compare intent failed: %s", e)

        # 5. HAZARDS, ANOMALIES & HEATWAVES
        if any(w in q for w in ["anomal", "hazard", "heatwave", "danger", "cyclone", "disaster", "warning", "mhw"]):
            try:
                hazards = self.hazard_service.analyze_hazards()
                events = hazards.get("hazard_events", [])
                event_lines = "\n".join([
                    f"- **{e['title']}** in the **{e['region']}** | Peak: `{e.get('peak_value', 'N/A')}` ({e.get('severity', 'MODERATE')})"
                    for e in events[:4]
                ])
                answer = (
                    f"### Disaster Decision-Support: Marine Hazards & Anomalies\n\n"
                    f"Detected **{len(events)} active physical anomalies** across the 3D model domain:\n\n"
                    f"{event_lines}\n\n"
                    f"**Impact Assessment**:\n"
                    f"- **Marine Heatwaves**: Prolonged high thermal energy can trigger coral bleaching and alter pelagic fish migration patterns.\n"
                    f"- **Cyclonic Eddies**: High vorticity zones create vertical pumping of cold, nutrient-rich water to the photic zone.\n\n"
                    f"> *OceanX is a decision-support visualization tool. Always consult IMD / INCOIS for official operational advisories.*"
                )
                return {
                    "query": query, "intent": "HAZARDS_QUERY",
                    "answer": answer,
                    "action": {"action": "show_hazards"},
                    "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                }
            except Exception as e:
                logger.warning("Hazard query failed: %s", e)

        # 6. IN-SITU OBSERVATIONS FLEET & ARGO FLOATS
        if any(w in q for w in ["argo", "float", "fleet", "buoy", "glider", "ctd", "platform", "2902145", "2902188", "2902210"]):
            try:
                obs_list = self.obs_service.list_observations()
                types_cnt: Dict[str, int] = {}
                for o in obs_list:
                    types_cnt[o["type"]] = types_cnt.get(o["type"], 0) + 1
                
                type_summary = ", ".join([f"{count} {t}" for t, count in types_cnt.items()])
                
                # Check if specific float selected
                target_obs = next((o for o in obs_list if o["id"].lower() in q or o["id"] == selected_float), obs_list[0] if obs_list else None)
                
                float_detail = ""
                if target_obs:
                    prof = self.obs_service.get_observation_profile(target_obs["id"])
                    float_detail = (
                        f"\n\n**Featured Platform: {target_obs['id']}** ({target_obs['name']}):\n"
                        f"- Position: `{target_obs['latitude']}°N, {target_obs['longitude']}°E`\n"
                        f"- Type: `{target_obs['type']}` (QC Level 1 Verified)\n"
                        f"- Profile Depth Range: `0 m to 2,000 m` ({len(prof.get('measurements', []))} soundings)\n"
                        f"- Bathymetric Clearance: ~1,850 m above seabed"
                    )

                answer = (
                    f"### In-Situ Observing Fleet\n\n"
                    f"OceanX tracks **{len(obs_list)} active in-situ platforms** deployed across the North Indian Ocean ({type_summary}).\n"
                    f"These automated instruments measure temperature, salinity, and pressure profiles during cyclic ascents from 2,000 m depth to the surface."
                    f"{float_detail}"
                )
                return {
                    "query": query, "intent": "FLEET_QUERY",
                    "answer": answer,
                    "action": {"action": "compare", "observation": target_obs["id"] if target_obs else "ARGO-2902145"},
                    "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                }
            except Exception as e:
                logger.warning("Fleet query failed: %s", e)

        # 7. OCEAN CURRENTS & CIRCULATION
        if any(w in q for w in ["current", "velocity", "flow", "vector", "speed", "somali", "monsoon"]):
            try:
                depth_match = re.search(r'(\d+)\s*(?:m|meter)?', q)
                target_depth = float(depth_match.group(1)) if depth_match else 0.0
                vc = self.ocean_service.get_current_vectors(depth=target_depth)
                answer = (
                    f"### 3D Ocean Circulation & Current Vectors\n\n"
                    f"Analyzed horizontal flow field at **{vc['depth']} m** depth across **{vc['count']} grid stations**:\n\n"
                    f"1. **Southwest Monsoon Current (SWMC)**: Drives eastward trans-basin transport south of Sri Lanka towards the Bay of Bengal.\n"
                    f"2. **Somali Current Jet**: High-velocity northward boundary current with velocities reaching up to 1.8 m/s.\n"
                    f"3. **Eddy Vorticity**: Mesoscale eddies in the western Bay of Bengal create circular current rings that redistribute heat.\n\n"
                    f"> The current vectors in the 3D view are color-coded by magnitude (cyan = moderate, red/magenta = intense)."
                )
                return {
                    "query": query, "intent": "CURRENTS_QUERY",
                    "answer": answer,
                    "action": {"action": "show_currents", "depth": vc["depth"]},
                    "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                }
            except Exception as e:
                logger.warning("Currents query failed: %s", e)

        # 8. SALINITY & BARRIER LAYERS
        if any(w in q for w in ["salin", "psu", "salt", "freshwater", "barrier layer", "river runoff"]):
            try:
                depth_match = re.search(r'(\d+)\s*(?:m|meter)?', q)
                target_depth = float(depth_match.group(1)) if depth_match else (active_depth if active_depth > 0 else 0.0)
                sd = self.ocean_service.get_slice(variable="salinity", depth=target_depth)
                s = sd["stats"]
                answer = (
                    f"### 3D Salinity Distribution at {sd['actual_depth']} m Depth\n\n"
                    f"| Metric | Model Salinity Value |\n"
                    f"|---|---|\n"
                    f"| **Minimum** | **{s['min']:.2f} PSU** (Freshwater river plume in Northern Bay of Bengal) |\n"
                    f"| **Maximum** | **{s['max']:.2f} PSU** (Evaporative high-salinity Arabian Sea) |\n"
                    f"| **Mean** | **{s['mean']:.2f} PSU** |\n\n"
                    f"**The Barrier Layer Phenomenon**:\n"
                    f"In the Bay of Bengal, immense freshwater discharge from the Ganges, Brahmaputra, and Irrawaddy rivers creates a buoyant, low-salinity surface layer. This caps the warm deeper water, creating a barrier layer that inhibits vertical mixing and can intensify tropical cyclones."
                )
                return {
                    "query": query, "intent": "SALINITY_QUERY",
                    "answer": answer,
                    "action": {"action": "visualize", "variable": "salinity", "depth": sd["actual_depth"]},
                    "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                }
            except Exception as e:
                logger.warning("Salinity query failed: %s", e)

        # 9. TEMPERATURE AT DEPTH
        if any(w in q for w in ["temp", "degree", "heat", "sst", "warm", "cold", "celsius"]):
            try:
                depth_match = re.search(r'(\d+)\s*(?:m|meter)?', q)
                target_depth = float(depth_match.group(1)) if depth_match else active_depth
                sd = self.ocean_service.get_slice(variable="temperature", depth=target_depth)
                s = sd["stats"]
                answer = (
                    f"### 3D Temperature Slice at {sd['actual_depth']} m Depth\n\n"
                    f"| Metric | Temperature |\n"
                    f"|---|---|\n"
                    f"| **Minimum** | **{s['min']:.2f} °C** |\n"
                    f"| **Maximum** | **{s['max']:.2f} °C** |\n"
                    f"| **Mean** | **{s['mean']:.2f} °C** |\n"
                    f"| **Standard Deviation** | **{s['std']:.2f} °C** |\n\n"
                    f"As depth increases from 0m to 2000m, temperature drops through the thermocline. "
                    f"Warm surface waters (>28°C) support atmospheric convection, while deeper layers stabilize near 4°C."
                )
                return {
                    "query": query, "intent": "TEMPERATURE_QUERY",
                    "answer": answer,
                    "action": {"action": "visualize", "variable": "temperature", "depth": sd["actual_depth"]},
                    "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
                }
            except Exception as e:
                logger.warning("Temperature query failed: %s", e)

        # 10. GENERAL OCEANOGRAPHIC FALLBACK
        answer = (
            f"I can help with ocean temperature, salinity, currents, Argo float data, and marine hazards in the North Indian Ocean. "
            f"Could you be more specific about what you'd like to know?"
        )
        return {
            "query": query, "intent": "3D_INTELLIGENCE_REASONING",
            "answer": answer,
            "action": None,
            "source": "3D-Intelligence-Engine", "data_source": "DEMO_DATASET"
        }
