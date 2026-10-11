# 🪐 ClassOrbit — Secure Admin-Controlled Online Classroom

> **Enterprise-grade real-time online classroom platform with zero-trust media broadcasting, instructor authority, frictionless anonymous student access, MongoDB Atlas Free persistent records, daily CSV attendance exports, and automated storage cleanup.**

---

## 📖 Overview

Standard video-conferencing tools grant participants publishing privileges by default. In educational environments, this leads to interruptions, uninvited noise, and moderation chaos.

**ClassOrbit reverses this paradigm completely:**
- **Teacher-First Authority:** Only authenticated instructors can create classrooms, generate invitation tokens, and control media broadcasting.
- **Strict Server-Side Media Isolation:** Students join with **Microphone, Camera, and Screen Sharing permanently disabled** on the media SFU / token level.
- **Granular Independent Approval:** A student can request voice access to ask a question. The teacher can approve microphone without exposing webcam or screen sharing.
- **Instant Revocation:** Revoking permission immediately kills the participant's media track both on the client and the media server.
- **Frictionless Anonymous Student Joining:** Students never create accounts, remember passwords, or disclose emails. They enter an invitation token, supply a display name, and enter.
- **MongoDB Atlas Free Storage (< 500 MB Free Tier):** Stores only essential records (`Admin`, `Classroom`, `Attendance`). Ephemeral state (sockets, WebRTC tracks, transient requests) remains strictly in memory.
- **Daily CSV Attendance Export:** End-of-class duration calculation, RFC-4180 CSV export for single classes and daily multi-class rollups.
- **Automated Daily Cleanup & Safe Acknowledgment:** Automated `node-cron` scheduled cleanup at 02:00 AM (`Asia/Kolkata`). Never deletes unacknowledged records.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Lucide React, Socket.IO Client, LiveKit Client & Components |
| **Backend** | Node.js (v20+ / v24+), Express.js, Socket.IO, LiveKit Server SDK |
| **Database** | MongoDB Atlas Free (Mongoose ODM, DNS resilience, ~100 MB budget target out of 500 MB free allocation) |
| **Real-time Ephemeral State** | High-performance JavaScript `Map` and `Set` in-memory store for active sockets & LiveKit tracks |
| **Scheduled Tasks** | `node-cron` daily scheduled task (02:00 AM `Asia/Kolkata`) |
| **Security & Auth** | Argon2 / Bcrypt password hashing, SHA-256 token hashing, HTTP-Only SameSite Cookies, Helmet security headers, Express Rate Limiter, Zod input validation |
| **Testing** | Node.js native test runner (`node --test`), automated end-to-end security & lifecycle test suite |

---

## 🍃 MongoDB Atlas Architecture & Essential Storage

To respect the **500 MB MongoDB Atlas Free limit** and maintain a clean target budget of **~100 MB**, persistent records are kept strictly minimal:

1. **Admin Model (`Admin`)**:
   - `adminId`: UUID
   - `username`: unique string
   - `passwordHash`: bcrypt hash

2. **Classroom Model (`Classroom`)**:
   - `classroomId`: UUID
   - `name`: String
   - `tokenHash`: SHA-256 hash of invitation token (never plain tokens)
   - `status`: `ACTIVE`, `ENDING`, `ENDED`
   - `isAttendanceExported`: Boolean flag
   - `attendanceAcknowledged`: Boolean flag
   - `createdAt`, `endedAt`

3. **Attendance Model (`Attendance`)**:
   - `classroomId`, `participantId`, `studentName`, `mobileNumber`
   - `joinTime`, `leaveTime`
   - `durationMinutes`: Computed once at class conclusion
   - `status`: `PRESENT`, `LATE`, `ABSENT`, `EXCUSED`
   - `classDate`: `YYYY-MM-DD`
   - `acknowledged`: Boolean flag

4. **Ephemeral Memory (`memoryStore`)**:
   - Real-time socket connections, WebRTC media track state, whiteboard locks, live presence list.
   - Cleared immediately upon admin acknowledgment or automated cleanup.

---

## 📊 Daily CSV Attendance & Safe Pruning Workflow

1. **Class Ends**:
   - Backend computes duration minutes for all active participants: `Math.round((leaveTime - joinTime) / 60000)`.
   - Classroom status transitions to `ENDED`.
2. **CSV Generation & Download**:
   - Admin downloads classroom CSV (`GET /api/classrooms/:id/attendance.csv`) or consolidated daily CSV (`GET /api/attendance/daily.csv`).
   - Format: `Classroom Name, Classroom ID, Class Date, Student Name, Join Time, Leave Time, Duration Minutes`.
   - Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="attendance-<id>-<date>.csv"`.
3. **Safe Acknowledgment**:
   - Admin acknowledges receipt (`POST /api/classrooms/:id/attendance/acknowledge`).
   - Marks `attendanceAcknowledged = true` and purges in-memory ephemeral state immediately.
4. **Scheduled Automated Pruning**:
   - Daily cron runs at 02:00 AM (`Asia/Kolkata`).
   - Prunes classrooms and attendance records that have been acknowledged.
   - **Critical Rule:** Unacknowledged attendance records are **never** deleted.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** v20.x or v24.x
- **npm** v10.x+
- **MongoDB Atlas Cluster** (or local MongoDB)

### 2. Configure Backend `.env`
In `backend/.env`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/classorbit?retryWrites=true&w=majority
SESSION_SECRET="your-secure-jwt-session-secret-min-32-chars"
CLEANUP_TIMEZONE="Asia/Kolkata"
STORAGE_WARNING_THRESHOLD_MB=80
```

### 3. Run Backend Server
```bash
cd backend
npm install
npm run dev # or node src/index.js
```
*The backend connects to MongoDB Atlas, verifies the default administrator (`admin` / `OrbitAdmin2025!`), initializes the daily cleanup cron, and starts on port 5000.*

### 4. Run Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
*Access ClassOrbit in your browser at `http://localhost:5173`.*

---

## 🧪 Automated Testing & Verification

ClassOrbit includes an automated end-to-end test suite running against MongoDB Atlas:
- Health check verification
- Unauthenticated access rejection (`401 UNAUTHORIZED`)
- Admin login (`POST /api/admin/login`) and session verification (`GET /api/admin/me`)
- Classroom creation and token SHA-256 validation
- Student join, token authorization, and attendance recording
- Mic permission request, admin review, and revocation
- Attendance CSV export and RFC-4180 parsing
- Admin download acknowledgment and ephemeral state clearing
- Storage status inspection (`GET /api/admin/storage-status`) and manual cleanup (`POST /api/admin/cleanup`)

To run tests:
```bash
cd backend
npm test
```

---

## 📡 API Reference (Section 9 Specification)

### Admin Endpoints
- `POST /api/admin/login`: Administrator login with credentials.
- `POST /api/admin/logout`: Clear session cookies.
- `GET /api/admin/me`: Retrieve authenticated administrator profile.
- `GET /api/admin/storage-status`: Check MongoDB storage usage, free-tier percentage, and warning indicators.
- `POST /api/admin/cleanup`: Manually trigger pruning of acknowledged and expired records.

### Classroom Endpoints
- `POST /api/classrooms`: Create a new classroom.
- `GET /api/classrooms`: List classrooms managed by the administrator.
- `GET /api/classrooms/:id`: Get detailed classroom status and active session count.
- `POST /api/classrooms/:id/end`: Terminate classroom and finalize attendance durations.
- `POST /api/classrooms/:id/invite`: Generate or refresh classroom invitation token.
- `POST /api/classrooms/:id/join`: Student joins classroom via invitation token.
- `POST /api/classrooms/:id/leave`: Student exits classroom; sets `leaveTime` in MongoDB.
- `GET /api/classrooms/:id/participants`: List active connected participants.
- `DELETE /api/classrooms/:id/participants/:participantId`: Remove participant from room.

### Permission Request Endpoints
- `POST /api/classrooms/:id/permission-requests`: Student requests media access (`MIC`, `CAM`, `SCREEN`).
- `GET /api/classrooms/:id/permission-requests`: Admin reviews pending requests.
- `POST /api/classrooms/:id/permission-requests/:requestId/approve`: Approve media capability.
- `POST /api/classrooms/:id/permission-requests/:requestId/reject`: Reject request.
- `POST /api/classrooms/:id/permission-requests/:requestId/revoke`: Revoke media capability.

### Attendance & CSV Endpoints
- `GET /api/classrooms/:id/attendance.csv`: Download classroom attendance CSV file.
- `POST /api/classrooms/:id/attendance/acknowledge`: Acknowledge CSV export and mark for cleanup.
- `GET /api/attendance/daily.csv`: Download consolidated daily attendance CSV across all classrooms.

---

## ⚖️ License
Proprietary & Secure Educational Software. Designed for **ClassOrbit**.
