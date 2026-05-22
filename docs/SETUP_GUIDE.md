# 🏠 Family Tracker - Complete Setup Guide

## Project Structure
```
family-tracker/
├── backend/          ← Node.js + Express + MongoDB + Socket.IO
│   ├── server.js
│   ├── models/       ← User, Location, Geofence
│   ├── routes/       ← auth, location, geofence, admin
│   ├── middleware/   ← JWT auth
│   └── utils/        ← cleanup
│
└── mobile/           ← React Native (Android APK)
    ├── App.js
    └── src/
        ├── screens/  ← Login, Register, UserHome, AdminDashboard
        ├── services/ ← API, Socket, LocationService, AlertService
        ├── hooks/    ← useAuth (AuthContext)
        └── navigation/
```

---

## STEP 1: Backend Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Install & Run
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and secrets

npm install
npm start
# Server runs on http://localhost:3000
```

### Default Admin Code
- Admin registration code: `FAMILY2024` (change in .env)
- Device reset code: `RESET2024` (change in .env)

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user/admin |
| POST | /api/auth/login | Login (returns JWT) |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/create-user | Admin creates user |
| POST | /api/location/update | User updates location |
| GET | /api/location/history/:userId | 12h history |
| GET | /api/location/all-latest | All users latest |
| GET | /api/location/highlights/:userId | Stop highlights |
| POST | /api/geofence/create | Create geofence |
| GET | /api/geofence/list | List geofences |
| PUT | /api/geofence/:id | Update geofence |
| DELETE | /api/geofence/:id | Delete geofence |
| GET | /api/admin/users | List managed users |
| POST | /api/admin/reset-device | Reset admin device lock |

---

## STEP 2: Mobile App Setup

### Prerequisites
- Node.js 18+
- React Native CLI
- Android Studio + Android SDK
- JDK 17

### Configure Server URL
Edit these two files and set your server IP:
- `mobile/src/services/api.js` → `BASE_URL`
- `mobile/src/services/socket.js` → `SOCKET_URL`

Example: `http://192.168.1.100:3000`

### Google Maps API Key
1. Go to https://console.cloud.google.com
2. Enable "Maps SDK for Android"
3. Create API key
4. Add to `android/AndroidManifest.xml` → `YOUR_GOOGLE_MAPS_API_KEY_HERE`

### Firebase Setup (for push notifications)
1. Create Firebase project at https://console.firebase.google.com
2. Add Android app with your package name
3. Download `google-services.json`
4. Place in `android/app/google-services.json`

### Install & Build APK
```bash
cd mobile
npm install

# Link native dependencies
npx react-native link

# Debug run (connected phone/emulator)
npx react-native run-android

# Release APK
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## STEP 3: VS Code + Codex Improvements

### VS Code Extensions to Install
```
- ESLint
- Prettier
- React Native Tools
- MongoDB for VS Code
- Thunder Client (API testing)
- GitLens
```

### Using GitHub Copilot / Codex in VS Code
1. Install GitHub Copilot extension
2. Open the project in VS Code
3. Copilot will suggest improvements as you type
4. Use Ctrl+I (inline chat) for specific improvements

### Suggested Codex Prompts
```
"Add battery level monitoring to location updates"
"Improve geofence accuracy with Haversine formula"
"Add offline location queue that syncs when online"
"Add user profile photo support"
"Add location sharing history export to CSV"
```

---

## Key Features

### ✅ Unified Login (Admin + User)
- Single screen, role detected from DB
- Admin: one device lock enforced
- User: any device

### ✅ Forced Location (User)
- App checks GPS permission on open
- If denied → permission screen (cannot bypass)
- If GPS off → GPS enable screen (cannot bypass)
- Only shows main UI when location is ACTIVE

### ✅ Live Tracking
- Socket.IO for real-time updates
- HTTP fallback every 30s
- Background tracking via react-native-geolocation-service

### ✅ 12-Hour History
- Stored in MongoDB with auto-expiry
- Polyline path shown on map
- Stops ≥10 min highlighted (yellow circle)

### ✅ Geofence Alerts
- Admin sets lat/lng + radius per user
- Server checks on every location update
- If user exits fence: Socket alert to admin
- Admin phone: vibrates + notification + alert dialog

### ✅ Admin Single Device
- On login, device UUID stored
- Second device login rejected with error
- Reset via `/api/admin/reset-device` with reset code

---

## Security Notes
- Change `JWT_SECRET` in .env before production
- Change `ADMIN_CODE` and `DEVICE_RESET_CODE`
- Use HTTPS in production (reverse proxy with nginx + SSL)
- MongoDB Atlas with IP whitelist recommended

---

## Production Deployment
```bash
# Backend on server
npm install -g pm2
pm2 start server.js --name family-tracker
pm2 save

# MongoDB Atlas URI
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/family-tracker
```
