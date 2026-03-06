import { app, onAuthChange, logout } from "./firebase-auth.js";

import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const db = getDatabase(app);


/* AUTH GUARD */

onAuthChange((user)=>{

  const guard = document.getElementById("auth-guard");

  if(!user){
    window.location.href="index.html";
    return;
  }

  guard.classList.add("hidden");

  const name = user.displayName || "User";

  document.getElementById("sb-name").textContent = name;

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0,2);

  document.getElementById("sb-avatar").textContent = initials;

});


/* LOGOUT BUTTON */

window.handleLogout = async ()=>{

  await logout();
  window.location.href="index.html";

};


/* REALTIME HEART DATA */

const heartRef = ref(db,"heartmonitor/device1");

onValue(heartRef,(snapshot)=>{

  const data = snapshot.val();
  if(!data) return;

  document.getElementById("v-bpm").innerHTML =
    data.bpm + "<span class='vital-unit'> BPM</span>";

  document.getElementById("v-spo2").innerHTML =
    data.spo2 + "<span class='vital-unit'>%</span>";

  document.getElementById("v-hrv").innerHTML =
    data.hrv + "<span class='vital-unit'> ms</span>";

});


/* GPS */

const gpsRef = ref(db,"gps");

onValue(gpsRef,(snapshot)=>{

  const gps = snapshot.val();
  if(!gps) return;

  document.getElementById("gps-coords").innerText =
    gps.lat + " , " + gps.lng;

});