/**
 * HEARTLYF — Firebase Authentication Module
 * ==========================================
 * Handles all Firebase Auth operations:
 *  - Email/Password sign-in & sign-up
 *  - Google OAuth sign-in
 *  - Auth state management
 *  - User profile persistence in Firestore
 *
 * SETUP: Replace the firebaseConfig object below
 * with your actual Firebase project credentials.
 * Get them from: https://console.firebase.google.com
 */

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp }
                                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── ⚙️  FIREBASE CONFIG — REPLACE THIS ── */
const firebaseConfig = {

    apiKey: "AIzaSyDf_eg6rmbvb_4sM_haZCRc0oOxtI7HqS8",
    authDomain: "myloginapp-4e769.firebaseapp.com",
    projectId: "myloginapp-4e769",
    storageBucket: "myloginapp-4e769.firebasestorage.app",
    messagingSenderId: "111106458658",
    appId: "1:111106458658:web:bc11898fc27c4b46fff67b",
    databaseURL:"https://heartmonitorproject-ba398-default-rtdb.firebaseio.com/",
};
/* ─────────────────────────────────────── */

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const gProvider = new GoogleAuthProvider();

/* ── HELPERS ──────────────────────────── */

/**
 * Map Firebase error codes → human-readable messages
 * @param {string} code
 * @returns {string}
 */
function friendlyError(code) {
  const map = {
    "auth/invalid-email":          "Invalid email address.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/email-already-in-use":   "This email is already registered.",
    "auth/weak-password":          "Password must be at least 8 characters.",
    "auth/too-many-requests":      "Too many failed attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-blocked":          "Popup blocked. Please allow popups for this site.",
    "auth/popup-closed-by-user":   null,   // silent — user closed popup
    "auth/cancelled-popup-request":null,
  };
  return map[code] || `Something went wrong (${code}). Please try again.`;
}

/**
 * Persist user profile data to Firestore 'users' collection.
 * Uses merge:true so existing fields are not overwritten on re-login.
 * @param {import("firebase/auth").User} user
 * @param {{ role?: string, displayName?: string }} [extra]
 */
async function saveUserProfile(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  await setDoc(ref, {
    uid:         user.uid,
    email:       user.email,
    displayName: user.displayName || extra.displayName || "",
    role:        extra.role || "patient",
    photoURL:    user.photoURL || "",
    lastSeen:    serverTimestamp(),
    createdAt:   serverTimestamp(),   // ignored on merge if already set
  }, { merge: true });
}

/* ── AUTH STATE LISTENER ──────────────── */

/**
 * Attach a callback that fires whenever authentication state changes.
 * Call this once on page load.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

/* ── SIGN-IN ──────────────────────────── */

/**
 * Email & Password sign-in.
 * @param {string} email
 * @param {string} password
 * @returns {{ user: User } | { error: string }}
 */
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  } catch (e) {
    const msg = friendlyError(e.code);
    if (!msg) return { error: null };   // silent (popup closed etc.)
    return { error: msg };
  }
}

/* ── SIGN-UP ──────────────────────────── */

/**
 * Create a new account with email, password, display name, and role.
 * @param {{ email: string, password: string, displayName: string, role: string }} params
 * @returns {{ user: User } | { error: string }}
 */
export async function signUpWithEmail({ email, password, displayName, role }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await saveUserProfile(cred.user, { displayName, role });
    return { user: cred.user };
  } catch (e) {
    const msg = friendlyError(e.code);
    if (!msg) return { error: null };
    return { error: msg };
  }
}

/* ── GOOGLE SIGN-IN ───────────────────── */

/**
 * Sign in with Google (popup flow).
 * @returns {{ user: User } | { error: string }}
 */
export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, gProvider);
    await saveUserProfile(cred.user);
    return { user: cred.user };
  } catch (e) {
    const msg = friendlyError(e.code);
    if (!msg) return { error: null };
    return { error: msg };
  }
}

/* ── SIGN-OUT ─────────────────────────── */

/**
 * Sign the current user out.
 */
export async function logout() {
  await signOut(auth);
}

/* ── CURRENT USER ─────────────────────── */

/**
 * Returns the currently signed-in user, or null.
 * @returns {import("firebase/auth").User | null}
 */
export function currentUser() {
  return auth.currentUser;
}

/* ── RE-EXPORT APP/DB/AUTH for dashboard use ── */
export { app, auth, db };
