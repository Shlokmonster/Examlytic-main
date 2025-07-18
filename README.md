
# 🎓 Examlytics 

> Real-time webcam & screen monitoring for secure, fair exam.
> Exams start → both webcam + screen recording begin automatically → uploaded to Supabase for admin review.

---

## 🧠 Overview

**Examlytics** is a full-stack web application built for modern remote proctoring needs. It features:

- 🎥 Live webcam streaming for real-time monitoring  
- 🔒 Automatic screen recording upon exam start  
- 🚨 AI-based cheat detection & violation logging  
- 🌐 Supabase for authentication, storage, and database  
- 👨‍💻 Admin dashboard to view live sessions and past screen recordings

---

## ✨ Key Features

- 🕹 **Automatic Screen Recording**: Starts with the exam  
- ⬆️ **Auto-upload to Supabase** upon exam submission or timeout  
- 🖼 **Playback for Admins**: View past student exam recordings easily  
- 🧠 **AI Cheat Detection** via MidPipe API  
- 📊 **Admin Dashboard**: Tracks live and past violations, exam sessions

---

## 🧱 Tech Stack

| Component        | Technology             |
|------------------|------------------------|
| Frontend         | React + Vite           |
| Real-Time Media  | PeerJS (Live video)    |
| Recording        | Browser Screen Rec APIs|
| Backend / Auth   | Supabase               |
| AI Detection     | MidPipe API            |
| Hosting          | Node.js, Vercel/Netlify|

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Shlokmonster/Examlytics.git
cd Examlytics
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create `.env` file in root:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
npm run preview
```

---

## ⚙️ Usage Flow

1. Student logs in and starts the exam  
2. **Auto-triggers**:
   - Screen recording begins
   - Webcam live feed streams to admin  
3. On submission or timeout:
   - Screen recording uploads automatically to Supabase Storage  
   - Metadata saved in Supabase Database  
   - Admin can access recordings via dashboard

---

## 📁 Project Structure

```
src/
├── Pages/
│   ├── ExamIntro.jsx
│   ├── ExamAttempt.jsx
│   ├── ExamDone.jsx
│   └── AdminDashboard.jsx
├── Components/
│   ├── LiveMonitoring.jsx
│   ├── ScreenRecorder.jsx
│   └── TestComponent.jsx
├── App.jsx
├── index.html
└── vite.config.js
```

---

## 🧑‍💻 Admin Dashboard Capabilities

- View real-time live student exam streams  
- Playback functionality for previous exam recordings  
- Violation log with timestamps and behavior tags  
- Filtering of exam sessions by student, date, or flag type

---

## 🌱 Roadmap

- Add face identification to match student ID  
- Expand violation scoring & AI severity metrics  
- Multi-admin role support  
- Playback timeline scrubbing and jump-to-event  
- Email/sms alerts for serious violations

---

## 🧠 Built By

**Shlok Kadam**  
B.Tech CSE @ ITM Skills University  
Full-stack dev | AI explorer | SaaS builder

---
