import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzVspRaeqMm6uab3DzvGNLJUkQrgJ60IE",
  authDomain: "heartmonitorproject-ba398.firebaseapp.com",
  databaseURL: "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com",
  projectId: "heartmonitorproject-ba398",
  storageBucket: "heartmonitorproject-ba398.firebasestorage.app",
  messagingSenderId: "509942804692",
  appId: "1:509942804692:web:c2248b8a87205ff1974b41",
  measurementId: "G-HPP83R4R5G"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);
const auth = getAuth(app);


/* AUTH GUARD */
/* AUTH GUARD */

onAuthStateChanged(auth,(user)=>{

  const guard = document.getElementById("auth-guard");
  const main  = document.getElementById("dashboard-main");

  if(!user){

    window.location.href="index.html";
    return;

  }

  if(guard) guard.style.display="none";
  if(main) main.style.display="block";

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