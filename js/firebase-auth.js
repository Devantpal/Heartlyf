/**
 * HeartLyft – Firebase Authentication Module
 * Handles: signup, login, Google auth, email verification,
 *          route guards, toast notifications, loading overlay.
 */

/* ══════════════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
══════════════════════════════════════════════════ */
let _toastContainer = null;

function _getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.createElement('div');
  _toastContainer.id = 'hl-toast-container';
  _toastContainer.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:99999;
    display:flex;flex-direction:column;gap:10px;pointer-events:none;
  `;
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

function showToast(message, type = 'info', duration = 5000) {
  const container = _getToastContainer();
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const colors = {
    success: { bg:'#14532d', border:'#22c55e', text:'#bbf7d0', icon:'#4ade80' },
    error:   { bg:'#450a0a', border:'#ef4444', text:'#fecaca', icon:'#f87171' },
    warning: { bg:'#431407', border:'#f59e0b', text:'#fde68a', icon:'#fbbf24' },
    info:    { bg:'#0c1a3d', border:'#3b82f6', text:'#bfdbfe', icon:'#60a5fa' }
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    display:flex;align-items:flex-start;gap:12px;
    padding:14px 18px;border-radius:10px;
    min-width:300px;max-width:420px;
    background:${c.bg};border:1px solid ${c.border};
    color:${c.text};font-family:'DM Sans',sans-serif;
    font-size:0.87rem;font-weight:500;line-height:1.5;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    pointer-events:all;cursor:pointer;
    animation:hlToastIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards;
  `;
  toast.innerHTML = `
    <span style="font-size:1.1rem;flex-shrink:0;margin-top:1px">${icons[type]}</span>
    <div style="flex:1">${message}</div>
    <span onclick="this.parentElement.remove()" style="color:${c.icon};cursor:pointer;font-size:1rem;flex-shrink:0;opacity:0.7;margin-top:1px">✕</span>
  `;
  // Inject keyframes once
  if (!document.getElementById('hl-toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'hl-toast-keyframes';
    style.textContent = `
      @keyframes hlToastIn  { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
      @keyframes hlToastOut { from{opacity:1;transform:translateX(0)}    to{opacity:0;transform:translateX(110%)} }
    `;
    document.head.appendChild(style);
  }
  container.appendChild(toast);
  toast.addEventListener('click', () => dismissToast(toast));
  setTimeout(() => dismissToast(toast), duration);
  return toast;
}

function dismissToast(el) {
  if (!el || !el.parentElement) return;
  el.style.animation = 'hlToastOut 0.3s ease forwards';
  setTimeout(() => el.remove(), 300);
}

/* ══════════════════════════════════════════════════
   LOADING OVERLAY
══════════════════════════════════════════════════ */
let _loadingOverlay = null;

function showLoading(message = 'Please wait…') {
  if (!_loadingOverlay) {
    _loadingOverlay = document.createElement('div');
    _loadingOverlay.id = 'hl-loading';
    _loadingOverlay.style.cssText = `
      position:fixed;inset:0;background:rgba(8,9,26,0.88);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:50000;backdrop-filter:blur(4px);
      font-family:'DM Sans',sans-serif;
    `;
    _loadingOverlay.innerHTML = `
      <div style="width:42px;height:42px;border:3px solid rgba(229,62,62,0.3);
        border-top-color:#e53e3e;border-radius:50%;
        animation:hlSpinLoad 0.8s linear infinite;margin-bottom:16px"></div>
      <div id="hl-loading-msg" style="color:#94a3b8;font-size:0.9rem"></div>
      <style>@keyframes hlSpinLoad{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(_loadingOverlay);
  }
  document.getElementById('hl-loading-msg').textContent = message;
  _loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  if (_loadingOverlay) _loadingOverlay.style.display = 'none';
}

/* ══════════════════════════════════════════════════
   FIREBASE ERROR MESSAGES
══════════════════════════════════════════════════ */
function getFirebaseErrorMessage(code) {
  const map = {
    'auth/email-already-in-use':      '📧 This email is already registered. Try logging in instead.',
    'auth/weak-password':             '🔒 Password must be at least 6 characters.',
    'auth/invalid-email':             '📧 Invalid email address format.',
    'auth/user-not-found':            '🔍 No account found with this email.',
    'auth/wrong-password':            '🔒 Incorrect password. Please try again.',
    'auth/invalid-credential':        '🔒 Invalid email or password.',
    'auth/too-many-requests':         '⏳ Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed':    '🌐 Network error. Check your internet connection.',
    'auth/popup-closed-by-user':      'ℹ️ Google sign-in was cancelled.',
    'auth/popup-blocked':             '🚫 Popup was blocked. Please allow popups for this site.',
    'auth/account-exists-with-different-credential': '📧 An account already exists with this email using a different sign-in method.',
    'auth/user-disabled':             '🚫 This account has been disabled. Contact support.',
    'auth/requires-recent-login':     '🔒 Please log in again to complete this action.',
    'auth/email-not-verified':        '📧 Please verify your email before logging in.'
  };
  return map[code] || `Authentication error: ${code}`;
}

/* ══════════════════════════════════════════════════
   SIGN UP WITH EMAIL & PASSWORD
══════════════════════════════════════════════════ */
async function signUpWithEmail(name, email, password, role) {
  if (!name.trim())     { showToast('Please enter your full name.', 'warning'); return false; }
  if (!email.trim())    { showToast('Please enter your email.', 'warning'); return false; }
  if (password.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return false; }
  if (!role)            { showToast('Please select a role.', 'warning'); return false; }

  showLoading('Creating your account…');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
    const user  = cred.user;

    // Update Firebase profile displayName
    await user.updateProfile({ displayName: name.trim() });

    // Write user profile to Realtime DB
    await db.ref(`/users/${user.uid}`).set({
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      role:         role,
      createdAt:    SERVER_TIMESTAMP,
      emailVerified: false,
      active:       true,
      patientCode:  role === 'patient' ? generatePatientCode() : null
    });

    // Create role-specific record
    await _createRoleRecord(user.uid, name.trim(), email.trim(), role);

    // Send email verification
    await user.sendEmailVerification({
      url: window.location.origin + '/auth.html?verified=1'
    });

    hideLoading();
    showToast(`🎉 Account created! Check <strong>${email}</strong> for a verification link.`, 'success', 8000);
    return { success: true, uid: user.uid, role };
  } catch (err) {
    hideLoading();
    showToast(getFirebaseErrorMessage(err.code), 'error');
    return false;
  }
}

async function _createRoleRecord(uid, name, email, role) {
  const base = { name, email, createdAt: SERVER_TIMESTAMP };
  if (role === 'patient') {
    await db.ref(`/patients/${uid}`).set({
      ...base,
      patientCode: generatePatientCode(),
      age: null, bloodGroup: null, doctorUid: null,
      deviceConnected: false
    });
    // Seed initial vitals placeholder
    await db.ref(`/vitals/${uid}`).set({
      bpm: 72, spo2: 98, hrv: 42, bp_sys: 120, bp_dia: 80,
      rhythm: 'Normal Sinus Rhythm', risk: 'Low',
      deviceStatus: 'disconnected', signalQuality: 0, battery: 100,
      timestamp: SERVER_TIMESTAMP
    });
  } else if (role === 'doctor') {
    await db.ref(`/doctors/${uid}`).set({ ...base, specialization: '', license: '', hospital: '' });
  } else if (role === 'family') {
    await db.ref(`/family/${uid}`).set({ ...base, patientUid: null, relation: '' });
  } else if (role === 'researcher') {
    await db.ref(`/researchers/${uid}`).set({ ...base, institution: '', department: '' });
  }
}

/* ══════════════════════════════════════════════════
   SIGN IN WITH EMAIL & PASSWORD
══════════════════════════════════════════════════ */
async function signInWithEmail(email, password) {
  if (!email.trim() || !password) {
    showToast('Please enter your email and password.', 'warning');
    return false;
  }
  showLoading('Signing in…');
  try {
    const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
    const user  = cred.user;

    if (!user.emailVerified) {
      await auth.signOut();
      hideLoading();
      showToast('📧 Please verify your email first. Check your inbox for the verification link.', 'warning', 8000);
      // Show resend option
      setTimeout(() => showResendOption(email.trim()), 1000);
      return false;
    }

    // Update emailVerified flag in DB
    await db.ref(`/users/${user.uid}/emailVerified`).set(true);

    const role = await getUserRole(user.uid);
    hideLoading();
    showToast(`Welcome back, ${user.displayName || 'User'}! 👋`, 'success', 3000);
    setTimeout(() => redirectToDashboard(role), 1200);
    return { success: true, uid: user.uid, role };
  } catch (err) {
    hideLoading();
    showToast(getFirebaseErrorMessage(err.code), 'error');
    return false;
  }
}

/* ══════════════════════════════════════════════════
   GOOGLE SIGN-IN
══════════════════════════════════════════════════ */
async function signInWithGoogle(defaultRole = 'patient') {
  showLoading('Connecting to Google…');
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user   = result.user;
    const isNew  = result.additionalUserInfo?.isNewUser;

    if (isNew) {
      // Write new user profile
      const role = defaultRole;
      await db.ref(`/users/${user.uid}`).set({
        name:          user.displayName || 'User',
        email:         user.email.toLowerCase(),
        role,
        createdAt:     SERVER_TIMESTAMP,
        emailVerified: true,
        active:        true,
        patientCode:   role === 'patient' ? generatePatientCode() : null,
        photoURL:      user.photoURL || null
      });
      await _createRoleRecord(user.uid, user.displayName || 'User', user.email, role);
      hideLoading();
      showToast(`🎉 Welcome to Heartlyf, ${user.displayName}!`, 'success', 3000);
    } else {
      hideLoading();
      showToast(`Welcome back, ${user.displayName}! 👋`, 'success', 3000);
    }

    const role = await getUserRole(user.uid);
    setTimeout(() => redirectToDashboard(role), 1200);
    return { success: true, uid: user.uid, isNew };
  } catch (err) {
    hideLoading();
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast(getFirebaseErrorMessage(err.code), 'error');
    }
    return false;
  }
}

/* ══════════════════════════════════════════════════
   SIGN OUT
══════════════════════════════════════════════════ */
async function signOut() {
  showLoading('Signing out…');
  try {
    await auth.signOut();
    hideLoading();
    window.location.href = 'auth.html';
  } catch (err) {
    hideLoading();
    showToast('Error signing out. Please try again.', 'error');
  }
}

/* ══════════════════════════════════════════════════
   RESEND VERIFICATION EMAIL
══════════════════════════════════════════════════ */
async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) { showToast('Please log in first.', 'warning'); return; }
  showLoading('Sending verification email…');
  try {
    await user.sendEmailVerification({ url: window.location.origin + '/auth.html?verified=1' });
    hideLoading();
    showToast('✅ Verification email sent! Check your inbox.', 'success', 6000);
  } catch (err) {
    hideLoading();
    showToast(getFirebaseErrorMessage(err.code), 'error');
  }
}

function showResendOption(email) {
  const toast = showToast(
    `<div>Didn't get the email? <a id="resend-link" href="#" style="color:#fbbf24;font-weight:700;text-decoration:underline">Resend verification email</a></div>`,
    'warning', 10000
  );
  setTimeout(() => {
    const link = document.getElementById('resend-link');
    if (link) link.addEventListener('click', (e) => {
      e.preventDefault();
      resendVerificationEmailToAddr(email);
    });
  }, 100);
}

async function resendVerificationEmailToAddr(email) {
  // Sign in temporarily just to send verification
  showToast('ℹ️ Please enter your password in the login form to resend verification.', 'info', 5000);
}

/* ══════════════════════════════════════════════════
   GET USER ROLE FROM DB
══════════════════════════════════════════════════ */
async function getUserRole(uid) {
  try {
    const snap = await db.ref(`/users/${uid}/role`).once('value');
    return snap.val() || 'patient';
  } catch {
    return 'patient';
  }
}

/* ══════════════════════════════════════════════════
   REDIRECT TO DASHBOARD BASED ON ROLE
══════════════════════════════════════════════════ */
function redirectToDashboard(role) {
  const routes = {
    patient:    'patient-dashboard.html',
    doctor:     'doctor-dashboard.html',
    family:     'family-dashboard.html',
    researcher: 'researcher-dashboard.html'
  };
  window.location.href = routes[role] || 'patient-dashboard.html';
}

/* ══════════════════════════════════════════════════
   ROUTE GUARD — call at top of every dashboard
   Usage: hlGuard(['patient']) — redirects if wrong role
══════════════════════════════════════════════════ */
function hlGuard(allowedRoles = []) {
  return new Promise((resolve) => {
    showLoading('Authenticating…');
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (!user) {
        hideLoading();
        window.location.href = 'auth.html';
        return;
      }
      if (!user.emailVerified) {
        hideLoading();
        window.location.href = 'verify-email.html';
        return;
      }
      const role = await getUserRole(user.uid);
      if (allowedRoles.length && !allowedRoles.includes(role)) {
        hideLoading();
        showToast(`⚠️ Access denied. This dashboard requires role: ${allowedRoles.join(' or ')}.`, 'error');
        setTimeout(() => { auth.signOut(); window.location.href = 'auth.html'; }, 2000);
        return;
      }
      hideLoading();
      resolve({ user, role });
    });
  });
}

/* ══════════════════════════════════════════════════
   GET CURRENT USER PROFILE FROM DB
══════════════════════════════════════════════════ */
async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.ref(`/users/${user.uid}`).once('value');
  return { uid: user.uid, ...snap.val(), photoURL: user.photoURL };
}

/* ══════════════════════════════════════════════════
   UPDATE TOPBAR / SIDEBAR WITH USER INFO
══════════════════════════════════════════════════ */
function applyUserToUI(profile) {
  if (!profile) return;
  const name     = profile.name || 'User';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const roleMap  = { patient:'Patient', doctor:'Doctor', family:'Caretaker', researcher:'Researcher' };
  const roleLabel = roleMap[profile.role] || profile.role;

  // Elements that might exist on any dashboard
  [['topbar-name', name],
   ['topbar-user', name],
   ['sidebar-name', name],
   ['sidebar-email', profile.email || ''],
   ['sidebar-role', roleLabel],
   ['prof-name', name],
   ['pd-name', name],
   ['prof-email', profile.email || '']
  ].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // Avatars
  document.querySelectorAll('[id$="avatar"],[id="prof-avatar"]').forEach(el => {
    if (el.tagName !== 'IMG') el.textContent = initials;
  });

  // Role tags
  document.querySelectorAll('.sidebar-logo .role-tag, .profile-role').forEach(el => {
    el.textContent = roleLabel;
  });
}
