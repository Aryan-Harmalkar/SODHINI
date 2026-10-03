# EcoClean

React + Vite + Tailwind CSS frontend, Express + SQLite (Node's built-in `node:sqlite`) backend.

```bash
npm install
npm run dev        # API on :3001 + Vite on :5173 (proxied /api)
npm run build && npm start   # production: Express serves dist/ on :3001
```

Demo accounts (password `demo1234`): `demo@ecoclean.in` (Citizen, 1,250 pts), `collector@ecoclean.in` (Garbage Collector).

- OTP and Aadhaar verification are mocked; the OTP is shown on screen.
- `POST /api/classify` is a mock with a 2s delay (`server/classify.js`). Keywords in the description pick the
  category; type "not waste" or "selfie" to get the 🚫 Not waste result.
- Camera and geolocation need a secure context: `localhost` works, but phones on your LAN need HTTPS.
- The database file is `server/data/ecoclean.db`. Delete it to reset.
