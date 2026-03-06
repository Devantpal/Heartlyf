import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDf_eg6rmbvb_4sM_haZCRc0oOxtI7HqS8",
  authDomain: "myloginapp-4e769.firebaseapp.com",
  databaseURL: "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com",
  projectId: "myloginapp-4e769"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const heartRef = ref(db, "heartmonitor/device1");

onValue(heartRef, (snapshot) => {
  const data = snapshot.val();

  if (!data) return;

  document.getElementById("v-bpm").innerHTML =
    data.bpm + "<span class='vital-unit'> BPM</span>";

  document.getElementById("v-spo2").innerHTML =
    data.spo2 + "<span class='vital-unit'>%</span>";

  document.getElementById("v-hrv").innerHTML =
    data.hrv + "<span class='vital-unit'> ms</span>";
});

const gpsRef = ref(db, "gps");

onValue(gpsRef, (snapshot) => {
  const gps = snapshot.val();
  if (!gps) return;

  document.getElementById("gps-coords").innerText =
    gps.lat + " , " + gps.lng;
});