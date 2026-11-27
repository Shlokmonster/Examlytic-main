# EXAMLYTIC — SYSTEM BASELINE

**Date:** 2026-11-23  
**Implementation Branch:** `reliability-improvements`  
**Base Commit:** `a18106fa7f0775d81a941a877ee5b191a27e7774`  
**Base Branch:** `main`  
**Repository State:** Clean working tree prior to branching

---

## 1. Environment & Stack Baseline

| Layer | Component | Version / Provider | Notes |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ / ES Modules | `"type": "module"` in `package.json` |
| **Frontend Framework** | React | `19.1.0` | React 19 with React DOM 19 |
| **Bundler** | Vite | `7.0.0` | Output chunk size warning on `index-*.js` (>6MB due to TF.js/MediaPipe) |
| **Routing** | React Router DOM | `7.6.3` | SPA client routing with role-based navigation guards |
| **UI Components** | Material UI / styled-components | `@mui/material: 7.3.1`, `styled-components: 6.1.19` | Mixed CSS & styled-components styling |
| **Database & Auth** | Supabase | `@supabase/supabase-js: 2.110.0` | PostgreSQL with Row-Level Security (RLS) |
| **Edge Functions** | Supabase Functions (Deno) | `rapid-task` | Issues LiveKit JWT access tokens |
| **WebRTC SFU** | LiveKit | `livekit-client: 2.20.1`, `@livekit/components-react: 2.9.21` | WebRTC audio/video/screen tracks |
| **AI Computer Vision** | MediaPipe & TensorFlow.js | `@mediapipe/tasks-vision: 0.10.22`, `@tensorflow-models/coco-ssd: 2.2.3` | Client-side FaceLandmarker & object detection |
| **Media Storage** | Cloudinary | Unsigned REST Upload | Stores candidate screen recordings (WebM format) |
| **AI Text Generation** | Groq API | `llama-3.3-70b-versatile` | Used for dynamic exam question generation |

---

## 2. Baseline Build & Performance Metrics

* **Production Build Status:** Passed (`npm run build` completed in 15.65s).
* **Bundle Composition:**
  * `dist/index.html`: `1.58 kB` (gzip: `0.73 kB`)
  * `dist/assets/index-*.css`: `102.86 kB` (gzip: `18.72 kB`)
  * `dist/assets/index-*.js`: `6,261.96 kB` (gzip: `1,365.39 kB`) — *Heavy bundle due to bundling TensorFlow & MediaPipe models.*
* **Socket.IO / Express Presence:** **None**. Zero files, zero dependencies, zero running servers. (README divergence confirmed).

---

## 3. Git Checkpoint

* **Initial Commit:** `a18106fa Merge branch 'main' of https://github.com/Shlokmonster/Examlytic-main`
* **Dedicated Branch:** `reliability-improvements`
* **Policy:** All Phase 0–11 changes are committed exclusively to this dedicated branch without modifying `main` until final acceptance.

