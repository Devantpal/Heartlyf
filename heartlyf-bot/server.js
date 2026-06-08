const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

if (!TELEGRAM_TOKEN || !CHAT_ID || !FIREBASE_DATABASE_URL) {
  throw new Error(
    "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or FIREBASE_DATABASE_URL environment variable."
  );
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: FIREBASE_DATABASE_URL
});

const db = admin.database();
const alertsRef = db.ref("/alerts/esp32_001");

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: CHAT_ID,
    text: message
  });
}

alertsRef.on("child_added", async (snapshot) => {
  const alert = snapshot.val();

  if (alert.severity === "high") {
    const message = [
      "HEARTLYF ALERT",
      "Patient: patient_001",
      `Type: ${alert.type}`,
      `Value: ${alert.value}`
    ].join("\n");

    await sendTelegram(message);
    console.log("Alert sent!");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
