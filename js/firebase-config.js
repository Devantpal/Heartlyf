/**
 * HeartLyft – Firebase Configuration & Initialization
 * All Firebase services initialized here — import this first on every page.
 */

const HEARTLYFT_CONFIG = {
  apiKey:            "AIzaSyCzVspRaeqMm6uab3DzvGNLJUkQrgJ60IE",
  authDomain:        "heartmonitorproject-ba398.firebaseapp.com",
  databaseURL:       "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com",
  projectId:         "heartmonitorproject-ba398",
  storageBucket:     "heartmonitorproject-ba398.firebasestorage.app",
  messagingSenderId: "509942804692",
  appId:             "1:509942804692:web:c2248b8a87205ff1974b41",
  measurementId:     "G-HPP83R4R5G"
};

// ── Initialize Firebase ──
if (!firebase.apps.length) {
  firebase.initializeApp(HEARTLYFT_CONFIG);
}

// ── Global service references ──
const auth      = firebase.auth();
const db        = firebase.database();
const analytics = typeof firebase.analytics === 'function' ? firebase.analytics() : null;

// ── Auth persistence ──
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ── Google Auth Provider ──
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Utility: Generate patient code ──
function generatePatientCode() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let code = 'PAT-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Utility: Timestamp ──
const SERVER_TIMESTAMP = firebase.database.ServerValue.TIMESTAMP;

console.log('🔥 HeartLyft Firebase initialized');
