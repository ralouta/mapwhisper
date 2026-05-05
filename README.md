# Tactile Map Voice Assistant

A voice-first web app for blind users to query tactile map descriptions using the ArcGIS AI data-exploration agent.

## How it works

1. User presses the mic button and asks a question (e.g., "What is at Beulekamperweg?")
2. Web Speech API transcribes the voice to text
3. The `arcgis-assistant-data-exploration-agent` queries the hosted feature layer
4. The response is spoken aloud via Speech Synthesis

No typing required. The map is hidden by default.

## Setup

```bash
cd web
npm install
cp .env.example .env
```

Edit `.env` with your values:

- `VITE_WEBMAP_ID` — the **Web Map** item ID (not the Feature Layer ID)
- `VITE_OAUTH_APP_ID` — your ArcGIS OAuth application ID
- `VITE_PORTAL_URL` — your portal URL (defaults to ArcGIS Online)
- `VITE_LANG_DETECT_PROVIDER` — `heuristic`, `llm`, or `hybrid` (recommended)
- `VITE_LLM_BASE_URL` — OpenAI-compatible endpoint (for example `https://api.openai.com/v1` or local `http://localhost:11434/v1`)
- `VITE_LLM_MODEL` — model name for your LLM endpoint
- `VITE_LLM_API_KEY` — API key for cloud endpoints (optional for local servers)

> **Important:** The `VITE_WEBMAP_ID` must be a Web Map that contains the tactile map descriptions feature layer. If you only have a Feature Layer, open Map Viewer, add the layer, save the map, and use that map's item ID.

> **Embeddings required:** The data-exploration agent needs embeddings generated for the web map. In Map Viewer, open the AI Assistant panel and click "Prepare assistant" if prompted. This only needs to be done once per web map.

## Run

```bash
npm run dev
```

## Edit mode

Append `?mode=edit` to the URL to enable the map toggle button:

```
http://localhost:5173/?mode=edit
```

## Build

```bash
npm run build
```

Output is in `dist/`.

## Spoken language detection

The app supports pluggable spoken-language detection:

- `heuristic`: fully local detection (script + lexical rules + franc).
- `llm`: uses your configured OpenAI-compatible endpoint only.
- `hybrid`: tries LLM first, then local heuristics, then recognizer locale.

Recommended for reliability: use `hybrid` with either a local or cloud LLM endpoint.
