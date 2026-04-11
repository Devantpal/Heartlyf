const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// 🔑 YOUR VALUES
const TELEGRAM_TOKEN = "7716905769:AAH_wVqJjckFOVsGAdITYIdKH4aAKTmtP0M";
const CHAT_ID = "1594669605";

// Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// 🚨 SEND TELEGRAM MESSAGE
async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: CHAT_ID,
    text: message
  });
}

// 🔥 LISTEN TO ALERTS
alertsRef.on("child_added", async (snapshot) => {
  const alert = snapshot.val();

  if (alert.severity === "high") {

    const msg = `
🚨 HEARTLYF ALERT 🚨
Patient: patient_001
Type: ${alert.type}
Value: ${alert.value}
`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: "1594669605",
      text: msg
    });

    console.log("Alert sent!");
  }
});

// Server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});