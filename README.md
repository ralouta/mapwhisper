# GeoAccesser

A voice-first web app for blind and low-vision users to query geographic locations hands-free using ArcGIS AI services.

Press the mic button, ask a question — "What is around me?" or "Describe Museumplein in Amsterdam" — and hear a spoken geographic description. No typing or map interaction required.

## How it works

1. User presses the mic button and speaks a location question
2. Web Speech API transcribes the voice to text
3. The app geocodes any named location, captures a map screenshot, and analyzes it via ArcGIS AI
4. The description is translated (if needed) and spoken aloud via Speech Synthesis

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `VITE_WEBMAP_ID` | ArcGIS Online Web Map item ID |
| `VITE_OAUTH_APP_ID` | ArcGIS OAuth application ID |
| `VITE_PORTAL_URL` | Portal URL (default: `https://www.arcgis.com`) |

## Run

```bash
npm run dev
```

## Language configuration

Go to `http://localhost:5173/?mode=edit` to open the language selector. Pick the speech and response language — it is saved locally and persists across sessions.

Supported languages: Arabic, Chinese, English, French, German, Hindi, Italian, Japanese, Korean, Portuguese, Russian, Spanish, Swedish, Turkish.

## Build

```bash
npm run build
# Output in dist/
```

## Requirements

- Node.js 18+
- ArcGIS Online account with AI utility services enabled
- Modern browser with Web Speech API support (Chrome, Edge, Safari)
