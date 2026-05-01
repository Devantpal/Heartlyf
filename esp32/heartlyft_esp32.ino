/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           HeartLyft – ESP32 Firmware v2.0                  ║
 * ║   Real-time Cardiac Monitoring IoT System                  ║
 * ║   GNIOT, Greater Noida — CSE-IoT 2025-26                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Hardware:                                                  ║
 * ║   • ESP32-WROOM-32                                          ║
 * ║   • MAX30102 — Heart Rate + SpO2 (I2C: GPIO 21/22)         ║
 * ║   • AD8232   — ECG (Analog: GPIO 34)                       ║
 * ║   • OLED 0.96" SSD1306 (I2C: GPIO 21/22, addr 0x3C)       ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Required Libraries (install via Arduino Library Manager): ║
 * ║   • Firebase ESP32 Client — mobizt (v4.4.x)               ║
 * ║   • MAX30105 — SparkFun                                     ║
 * ║   • U8g2 — olikraus                                        ║
 * ║   • ArduinoJson — Benoit Blanchon                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/* ───────────────────────────────────────────
   LIBRARIES
─────────────────────────────────────────── */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <FirebaseESP32.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <Wire.h>
#include <U8g2lib.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"
#include <ArduinoJson.h>

/* ───────────────────────────────────────────
   CONFIGURATION — EDIT THESE VALUES
─────────────────────────────────────────── */

// ── WiFi ──
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// ── Firebase ──
#define FIREBASE_HOST   "heartmonitorproject-ba398-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH   "YOUR_FIREBASE_DATABASE_SECRET"
// OR use API Key + Email/Password auth:
#define API_KEY         "AIzaSyCzVspRaeqMm6uab3DzvGNLJUkQrgJ60IE"
#define USER_EMAIL      "device@heartlyft.ai"
#define USER_PASSWORD   "device_secure_password_123"

// ── Device Identity ──
#define DEVICE_ID       "esp32_001"
#define PATIENT_ID      "user_001"
#define PATIENT_NAME    "Devant Kumar"
#define FIRMWARE_VER    "v1.0"

// ── Firebase Paths ──
#define PATH_VITALS_LATEST    "/vitals/" DEVICE_ID "/latest"
#define PATH_VITALS_HISTORY   "/vitals/" DEVICE_ID "/history"
#define PATH_ECG_DATA         "/ecg_data/" DEVICE_ID
#define PATH_ML_LATEST        "/ml_prediction/" DEVICE_ID "/latest"
#define PATH_ML_HISTORY       "/ml_prediction/" DEVICE_ID "/history"
#define PATH_ALERTS           "/alerts/" DEVICE_ID
#define PATH_DEVICE           "/devices/" DEVICE_ID
#define PATH_SETTINGS         "/settings/" DEVICE_ID
#define PATH_LOGS             "/logs/" DEVICE_ID

// ── Pin Definitions ──
#define ECG_PIN         34      // AD8232 analog output → GPIO34 (ADC)
#define ECG_LO_PLUS     32      // AD8232 LO+ (lead-off detection)
#define ECG_LO_MINUS    33      // AD8232 LO- (lead-off detection)
#define LED_BUILTIN_PIN 2       // onboard blue LED

// ── Thresholds ──
#define BPM_HIGH        100
#define BPM_LOW         50
#define SPO2_LOW        94

// ── Timing (milliseconds) ──
#define VITALS_INTERVAL   2000   // upload vitals every 2s
#define ECG_INTERVAL      10     // sample ECG every 10ms (100Hz upload)
#define DISPLAY_INTERVAL  1000   // refresh OLED every 1s
#define HEARTBEAT_INTERVAL 30000 // device heartbeat every 30s
#define RECONNECT_INTERVAL 10000 // WiFi reconnect attempt
#define ALERT_COOLDOWN     60000 // min 60s between same alert type

/* ───────────────────────────────────────────
   GLOBAL OBJECTS
─────────────────────────────────────────── */
FirebaseData  fbData;
FirebaseData  fbStream;
FirebaseAuth  fbAuth;
FirebaseConfig fbConfig;

MAX30105 particleSensor;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE);

/* ───────────────────────────────────────────
   GLOBAL STATE
─────────────────────────────────────────── */
struct Vitals {
  float   bpm     = 0;
  float   spo2    = 0;
  int     ecg     = 0;
  float   hrv     = 0;
  int     battery = 100;
  String  rhythm  = "Initializing";
  bool    leadOff = false;
  unsigned long timestamp = 0;
};

struct AlertState {
  unsigned long lastTachycardia  = 0;
  unsigned long lastBradycardia  = 0;
  unsigned long lastLowSpo2      = 0;
  int alertCounter = 0;
};

Vitals      currentVitals;
AlertState  alertState;

// MAX30102 buffers (SpO2 algorithm needs 100 samples)
#define BUFFER_LENGTH 100
uint32_t irBuffer[BUFFER_LENGTH];
uint32_t redBuffer[BUFFER_LENGTH];
int32_t  spo2_value;
int8_t   spo2Valid;
int32_t  heartRate_value;
int8_t   hrValid;

// BPM calculation (heartRate.h)
const byte RATE_SIZE = 8;
byte   rates[RATE_SIZE];
byte   rateSpot = 0;
long   lastBeat = 0;
float  beatsPerMinute = 0;
int    beatAvg        = 0;

// Timing
unsigned long lastVitalsUpload   = 0;
unsigned long lastECGUpload      = 0;
unsigned long lastDisplayRefresh = 0;
unsigned long lastHeartbeat      = 0;
unsigned long lastWiFiCheck      = 0;

// ECG batch
int ecgBatch[20];
int ecgBatchIdx = 0;

bool  firebaseReady = false;
bool  sensorsReady  = false;
bool  settingsLoaded = false;

// Settings loaded from Firebase
struct Settings {
  int  bpmHigh     = BPM_HIGH;
  int  bpmLow      = BPM_LOW;
  int  spo2Low     = SPO2_LOW;
  bool telegram    = true;
  bool smsAlert    = false;
};
Settings settings;

/* ───────────────────────────────────────────
   FUNCTION PROTOTYPES
─────────────────────────────────────────── */
void setupWiFi();
void setupFirebase();
void setupMAX30102();
void setupAD8232();
void setupDisplay();
bool reconnectWiFi();
void readMAX30102();
void readAD8232();
void uploadVitals();
void uploadECG(int value);
void uploadMLPrediction(float bpm, float spo2);
void triggerAlert(String type, String severity, float value, String message);
void sendDeviceHeartbeat();
void loadSettings();
void logEvent(String event);
void refreshDisplay();
void displaySplash();
void displayError(String msg);
String getRhythm(float bpm);
String generateAlertId();
unsigned long getEpochTime();

/* ╔══════════════════════════════════════════
   SETUP
══════════════════════════════════════════╝ */
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n\n╔══════════════════════════════════╗"));
  Serial.println(F("║       HeartLyft v2.0 Boot       ║"));
  Serial.println(F("║   GNIOT IoT Cardiac Monitor     ║"));
  Serial.println(F("╚══════════════════════════════════╝\n"));

  // LED
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  digitalWrite(LED_BUILTIN_PIN, HIGH);

  // ECG lead-off pins
  pinMode(ECG_LO_PLUS,  INPUT);
  pinMode(ECG_LO_MINUS, INPUT);

  // ── Display first ──
  setupDisplay();
  displaySplash();

  // ── WiFi ──
  setupWiFi();

  // ── Sensors ──
  setupMAX30102();
  setupAD8232();

  // ── Firebase ──
  setupFirebase();

  // ── Load settings from Firebase ──
  loadSettings();

  // ── Log startup ──
  logEvent("device_started");

  Serial.println(F("\n✅ HeartLyft ready — monitoring started\n"));
  digitalWrite(LED_BUILTIN_PIN, LOW);
}

/* ╔══════════════════════════════════════════
   MAIN LOOP
══════════════════════════════════════════╝ */
void loop() {
  unsigned long now = millis();

  // ── WiFi watchdog ──
  if (now - lastWiFiCheck > RECONNECT_INTERVAL) {
    lastWiFiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("⚠️ WiFi lost — reconnecting..."));
      reconnectWiFi();
    }
  }

  // ── Read sensors ──
  readMAX30102();
  readAD8232();

  // ── Upload ECG batch ──
  if (now - lastECGUpload > ECG_INTERVAL) {
    lastECGUpload = now;
    if (!currentVitals.leadOff) {
      uploadECG(currentVitals.ecg);
    }
  }

  // ── Upload vitals ──
  if (now - lastVitalsUpload > VITALS_INTERVAL) {
    lastVitalsUpload = now;
    if (currentVitals.bpm > 0) {
      uploadVitals();
      uploadMLPrediction(currentVitals.bpm, currentVitals.spo2);
      checkAlerts();
    }
  }

  // ── Refresh display ──
  if (now - lastDisplayRefresh > DISPLAY_INTERVAL) {
    lastDisplayRefresh = now;
    refreshDisplay();
  }

  // ── Device heartbeat ──
  if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    sendDeviceHeartbeat();
  }

  // Process any Firebase callbacks
  if (Firebase.ready()) {
    Firebase.readData(fbData);
  }
}

/* ───────────────────────────────────────────
   SETUP FUNCTIONS
─────────────────────────────────────────── */
void setupDisplay() {
  Serial.print(F("🖥️  Initializing OLED... "));
  Wire.begin(21, 22); // SDA=21, SCL=22
  if (!display.begin()) {
    Serial.println(F("FAILED"));
    return;
  }
  display.clearBuffer();
  display.setFont(u8g2_font_ncenB08_tr);
  display.drawStr(20, 20, "HeartLyft");
  display.drawStr(10, 36, "Initializing...");
  display.sendBuffer();
  Serial.println(F("OK"));
}

void displaySplash() {
  display.clearBuffer();
  // Logo area
  display.setFont(u8g2_font_ncenB12_tr);
  display.drawStr(14, 20, "HeartLyft");
  // Separator line
  display.drawHLine(0, 25, 128);
  // Subtitle
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(8, 38, "IoT Cardiac Monitor");
  display.drawStr(4, 50, "GNIOT IoT Lab 2025-26");
  display.drawStr(20, 62, "Booting...");
  display.sendBuffer();
  delay(2000);
}

void displayError(String msg) {
  display.clearBuffer();
  display.setFont(u8g2_font_ncenB08_tr);
  display.drawStr(0, 14, "ERROR:");
  display.setFont(u8g2_font_5x7_tr);
  // Word-wrap at 25 chars
  display.drawStr(0, 28, msg.substring(0, 25).c_str());
  if (msg.length() > 25)
    display.drawStr(0, 40, msg.substring(25, 50).c_str());
  display.sendBuffer();
}

void setupWiFi() {
  Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(0, 14, "Connecting WiFi...");
  display.drawStr(0, 28, WIFI_SSID);
  display.sendBuffer();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(F("."));
    attempts++;
    // Progress bar
    display.drawBox(0, 50, attempts * 4, 8);
    display.sendBuffer();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    display.clearBuffer();
    display.setFont(u8g2_font_5x7_tr);
    display.drawStr(0, 14, "WiFi Connected!");
    display.drawStr(0, 28, WiFi.localIP().toString().c_str());
    display.drawStr(0, 42, "RSSI:");
    char rssi[12];
    sprintf(rssi, "%d dBm", WiFi.RSSI());
    display.drawStr(36, 42, rssi);
    display.sendBuffer();
    delay(1500);
  } else {
    Serial.println(F("\n❌ WiFi failed — running offline"));
    displayError("WiFi FAILED. Running offline.");
    delay(2000);
  }
}

bool reconnectWiFi() {
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    logEvent("wifi_reconnect");
    return true;
  }
  return false;
}

void setupFirebase() {
  Serial.print(F("🔥 Connecting to Firebase... "));
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(0, 14, "Firebase...");
  display.sendBuffer();

  // Configuration
  fbConfig.host                 = FIREBASE_HOST;
  fbConfig.api_key              = API_KEY;
  fbConfig.database_url         = "https://" FIREBASE_HOST;
  fbAuth.user.email             = USER_EMAIL;
  fbAuth.user.password          = USER_PASSWORD;
  fbConfig.token_status_callback = tokenStatusCallback;

  // Legacy auth (simpler for embedded)
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.reconnectWiFi(true);
  fbData.setResponseSize(4096);

  // Test connection
  if (Firebase.setString(fbData, PATH_DEVICE "/status", "online")) {
    firebaseReady = true;
    Serial.println(F("OK"));
    display.drawStr(0, 28, "Firebase: OK");
    display.sendBuffer();
  } else {
    Serial.printf("FAILED: %s\n", fbData.errorReason().c_str());
    display.drawStr(0, 28, "Firebase: FAILED");
    display.sendBuffer();
    delay(1000);
  }
  delay(500);
}

void setupMAX30102() {
  Serial.print(F("💓 Initializing MAX30102... "));
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(0, 14, "MAX30102 Init...");
  display.sendBuffer();

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println(F("FAILED — check wiring"));
    displayError("MAX30102 not found! Check I2C wiring.");
    sensorsReady = false;
    delay(2000);
    return;
  }

  // Configure MAX30102
  byte ledBrightness = 60;    // 0=Off to 255=50mA
  byte sampleAverage = 4;     // 1, 2, 4, 8, 16, 32
  byte ledMode       = 2;     // 1=Red only, 2=Red+IR
  byte sampleRate    = 100;   // 50, 100, 200, 400, 800, 1000, 1600, 3200
  int  pulseWidth    = 411;   // 69, 118, 215, 411
  int  adcRange      = 4096;  // 2048, 4096, 8192, 16384

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);

  // Fill initial buffer
  Serial.print(F("filling SPO2 buffer "));
  for (int i = 0; i < BUFFER_LENGTH; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();
    if (i % 25 == 0) Serial.print(F("."));
  }
  maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_LENGTH, redBuffer,
                                          &spo2_value, &spo2Valid,
                                          &heartRate_value, &hrValid);
  sensorsReady = true;
  Serial.println(F(" OK"));
  display.drawStr(0, 28, "MAX30102: OK");
  display.sendBuffer();
  delay(500);
}

void setupAD8232() {
  Serial.println(F("⚡ AD8232 ECG ready (ADC GPIO34)"));
  analogReadResolution(12); // 12-bit ADC: 0-4095
  analogSetAttenuation(ADC_11db); // 0-3.3V range
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(0, 14, "AD8232: OK");
  display.drawStr(0, 28, "All sensors ready!");
  display.sendBuffer();
  delay(800);
}

/* ───────────────────────────────────────────
   SENSOR READING FUNCTIONS
─────────────────────────────────────────── */
void readMAX30102() {
  if (!sensorsReady) return;

  // Shift buffer left, add new samples at end
  for (int i = 25; i < BUFFER_LENGTH; i++) {
    redBuffer[i - 25] = redBuffer[i];
    irBuffer[i - 25]  = irBuffer[i];
  }
  // Read 25 new samples
  for (int i = BUFFER_LENGTH - 25; i < BUFFER_LENGTH; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();

    // Beat detection with heartRate.h
    long irValue = irBuffer[i];
    if (checkForBeat(irValue)) {
      long delta = millis() - lastBeat;
      lastBeat   = millis();
      beatsPerMinute = 60.0 / (delta / 1000.0);
      if (beatsPerMinute < 20 || beatsPerMinute > 255) return;
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      beatAvg = 0;
      for (int j = 0; j < RATE_SIZE; j++) beatAvg += rates[j];
      beatAvg /= RATE_SIZE;
    }
  }

  // Calculate SpO2
  maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_LENGTH, redBuffer,
                                          &spo2_value, &spo2Valid,
                                          &heartRate_value, &hrValid);

  // Update vitals
  if (hrValid && heartRate_value > 0 && heartRate_value < 250) {
    currentVitals.bpm = (beatAvg > 0) ? (float)beatAvg : (float)heartRate_value;
  }
  if (spo2Valid && spo2_value > 70 && spo2_value <= 100) {
    currentVitals.spo2 = (float)spo2_value;
  }

  currentVitals.rhythm = getRhythm(currentVitals.bpm);
  currentVitals.timestamp = millis();
}

void readAD8232() {
  // Check lead-off detection pins
  currentVitals.leadOff = (digitalRead(ECG_LO_PLUS) || digitalRead(ECG_LO_MINUS));

  if (!currentVitals.leadOff) {
    int rawEcg = analogRead(ECG_PIN);
    currentVitals.ecg = rawEcg;
  } else {
    currentVitals.ecg = 0;
  }
}

/* ───────────────────────────────────────────
   FIREBASE UPLOAD FUNCTIONS
─────────────────────────────────────────── */
void uploadVitals() {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;

  unsigned long ts = getEpochTime();

  // ── Upload to /vitals/{deviceId}/latest ──
  FirebaseJson vitalsJson;
  vitalsJson.set("bpm",       currentVitals.bpm);
  vitalsJson.set("spo2",      currentVitals.spo2);
  vitalsJson.set("ecg",       currentVitals.ecg);
  vitalsJson.set("rhythm",    currentVitals.rhythm);
  vitalsJson.set("timestamp", (int)ts);
  vitalsJson.set("leadOff",   currentVitals.leadOff);

  if (!Firebase.setJSON(fbData, PATH_VITALS_LATEST, vitalsJson)) {
    Serial.printf("❌ Vitals upload failed: %s\n", fbData.errorReason().c_str());
    return;
  }

  // ── Append to /vitals/{deviceId}/history/{timestamp} ──
  String histPath = String(PATH_VITALS_HISTORY) + "/" + String(ts);
  FirebaseJson histJson;
  histJson.set("bpm",       currentVitals.bpm);
  histJson.set("spo2",      currentVitals.spo2);
  histJson.set("ecg",       currentVitals.ecg);
  histJson.set("timestamp", (int)ts);
  Firebase.setJSON(fbData, histPath.c_str(), histJson);

  Serial.printf("✅ Vitals uploaded — BPM: %.0f | SpO2: %.0f%% | ECG: %d\n",
                currentVitals.bpm, currentVitals.spo2, currentVitals.ecg);
}

void uploadECG(int value) {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;
  if (currentVitals.leadOff) return;

  unsigned long ts = millis(); // high-frequency, use millis
  String path = String(PATH_ECG_DATA) + "/" + String(ts);
  FirebaseJson ecgJson;
  ecgJson.set("value", value);
  Firebase.setJSON(fbData, path.c_str(), ecgJson);
}

void uploadMLPrediction(float bpm, float spo2) {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;

  // Simple rule-based ML prediction
  // Replace with actual TinyML model output if available
  String risk = "low";
  int    confidence = 85;

  if (bpm > 120 || spo2 < 90) {
    risk = "high";       confidence = 92;
  } else if (bpm > 100 || (bpm < 55 && bpm > 0)) {
    risk = "moderate";   confidence = 80;
  } else if (bpm > 80 && spo2 >= 95) {
    risk = "low";        confidence = 90;
  } else if (bpm > 0) {
    risk = "low";        confidence = 85;
  }

  unsigned long ts = getEpochTime();

  // ── /ml_prediction/{deviceId}/latest ──
  FirebaseJson mlJson;
  mlJson.set("risk",           risk);
  mlJson.set("confidence",     confidence);
  mlJson.set("classification", currentVitals.rhythm);
  mlJson.set("bpmInput",       bpm);
  mlJson.set("spo2Input",      spo2);
  mlJson.set("modelVersion",   "TinyML-v2.4");
  mlJson.set("timestamp",      (int)ts);

  if (!Firebase.setJSON(fbData, PATH_ML_LATEST, mlJson)) {
    Serial.printf("❌ ML upload failed: %s\n", fbData.errorReason().c_str());
    return;
  }

  // ── History ──
  String histPath = String(PATH_ML_HISTORY) + "/" + String(ts);
  FirebaseJson mlHist;
  mlHist.set("risk",       risk);
  mlHist.set("confidence", confidence);
  mlHist.set("timestamp",  (int)ts);
  Firebase.setJSON(fbData, histPath.c_str(), mlHist);

  Serial.printf("🤖 ML: risk=%s conf=%d%%\n", risk.c_str(), confidence);
}

void triggerAlert(String type, String severity, float value, String message) {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;

  String alertId = generateAlertId();
  String path    = String(PATH_ALERTS) + "/" + alertId;

  FirebaseJson alertJson;
  alertJson.set("type",             type);
  alertJson.set("severity",         severity);
  alertJson.set("value",            value);
  alertJson.set("message",          message);
  alertJson.set("deviceId",         DEVICE_ID);
  alertJson.set("patientId",        PATIENT_ID);
  alertJson.set("patientName",      PATIENT_NAME);
  alertJson.set("timestamp",        (int)getEpochTime());
  alertJson.set("resolved",         false);
  alertJson.set("notificationSent", false);
  alertJson.set("telegramSent",     false);

  if (Firebase.setJSON(fbData, path.c_str(), alertJson)) {
    Serial.printf("🚨 Alert triggered: %s (%.0f) — %s\n",
                  type.c_str(), value, severity.c_str());
  }
}

void checkAlerts() {
  unsigned long now = millis();
  float bpm  = currentVitals.bpm;
  float spo2 = currentVitals.spo2;

  // Tachycardia
  if (bpm > settings.bpmHigh && (now - alertState.lastTachycardia > ALERT_COOLDOWN)) {
    alertState.lastTachycardia = now;
    String msg = "High heart rate detected — BPM: " + String((int)bpm);
    triggerAlert("tachycardia", "high", bpm, msg);
  }
  // Bradycardia
  if (bpm > 0 && bpm < settings.bpmLow && (now - alertState.lastBradycardia > ALERT_COOLDOWN)) {
    alertState.lastBradycardia = now;
    String msg = "Low heart rate detected — BPM: " + String((int)bpm);
    triggerAlert("bradycardia", "medium", bpm, msg);
  }
  // Low SpO2
  if (spo2 > 0 && spo2 < settings.spo2Low && (now - alertState.lastLowSpo2 > ALERT_COOLDOWN)) {
    alertState.lastLowSpo2 = now;
    String msg = "Low SpO2 detected — SpO2: " + String((int)spo2) + "%";
    triggerAlert("low_spo2", "high", spo2, msg);
  }
}

void sendDeviceHeartbeat() {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;

  unsigned long ts = getEpochTime();
  FirebaseJson hb;
  hb.set("status",    "online");
  hb.set("lastSeen",  (int)ts);
  hb.set("battery",   currentVitals.battery);
  hb.set("wifiRSSI",  WiFi.RSSI());
  hb.set("freeHeap",  (int)ESP.getFreeHeap());
  hb.set("uptime",    (int)(millis() / 1000));
  Firebase.setJSON(fbData, PATH_DEVICE, hb);
}

void loadSettings() {
  if (!firebaseReady) return;
  Serial.print(F("⚙️  Loading settings from Firebase..."));

  if (Firebase.getInt(fbData, PATH_SETTINGS "/thresholds/bpmHigh")) {
    settings.bpmHigh = fbData.intData();
  }
  if (Firebase.getInt(fbData, PATH_SETTINGS "/thresholds/bpmLow")) {
    settings.bpmLow = fbData.intData();
  }
  if (Firebase.getInt(fbData, PATH_SETTINGS "/thresholds/spo2Low")) {
    settings.spo2Low = fbData.intData();
  }
  if (Firebase.getBool(fbData, PATH_SETTINGS "/notifications/telegram")) {
    settings.telegram = fbData.boolData();
  }
  settingsLoaded = true;
  Serial.printf(" BPM_HIGH=%d BPM_LOW=%d SPO2_LOW=%d\n",
                settings.bpmHigh, settings.bpmLow, settings.spo2Low);
}

void logEvent(String event) {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;
  String path = String(PATH_LOGS) + "/" + String(getEpochTime());
  FirebaseJson logJson;
  logJson.set("event",    event);
  logJson.set("firmware", FIRMWARE_VER);
  logJson.set("uptime",   (int)(millis() / 1000));
  Firebase.setJSON(fbData, path.c_str(), logJson);
}

/* ───────────────────────────────────────────
   OLED DISPLAY
─────────────────────────────────────────── */
void refreshDisplay() {
  display.clearBuffer();

  if (currentVitals.leadOff) {
    // ── Lead-off warning ──
    display.setFont(u8g2_font_ncenB08_tr);
    display.drawStr(10, 20, "LEAD OFF!");
    display.setFont(u8g2_font_5x7_tr);
    display.drawStr(8, 35, "Check electrodes");
    display.drawStr(0, 50, "& sensor placement");
    display.sendBuffer();
    return;
  }

  // ── Header bar ──
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(0, 8, "HeartLyft");

  // WiFi + Firebase icons
  String status = WiFi.status() == WL_CONNECTED ?
    (firebaseReady ? "W+F" : "W-F") : "OFF";
  display.drawStr(90, 8, status.c_str());

  // Separator
  display.drawHLine(0, 10, 128);

  // ── BPM ──
  display.setFont(u8g2_font_ncenB14_tr);
  char bpmStr[8];
  if (currentVitals.bpm > 0) {
    sprintf(bpmStr, "%d", (int)currentVitals.bpm);
  } else {
    strcpy(bpmStr, "--");
  }
  display.drawStr(2, 32, bpmStr);

  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(2, 42, "BPM");

  // ── SpO2 ──
  display.setFont(u8g2_font_ncenB14_tr);
  char spo2Str[8];
  if (currentVitals.spo2 > 0) {
    sprintf(spo2Str, "%d%%", (int)currentVitals.spo2);
  } else {
    strcpy(spo2Str, "--%");
  }
  display.drawStr(52, 32, spo2Str);
  display.setFont(u8g2_font_5x7_tr);
  display.drawStr(52, 42, "SpO2");

  // ── ECG value ──
  char ecgStr[12];
  sprintf(ecgStr, "ECG:%d", currentVitals.ecg);
  display.drawStr(0, 54, ecgStr);

  // ── Rhythm ──
  String rh = currentVitals.rhythm.length() > 14
    ? currentVitals.rhythm.substring(0, 14)
    : currentVitals.rhythm;
  display.drawStr(0, 63, rh.c_str());

  display.sendBuffer();
}

/* ───────────────────────────────────────────
   UTILITY FUNCTIONS
─────────────────────────────────────────── */
String getRhythm(float bpm) {
  if (bpm <= 0)   return "No Signal";
  if (bpm > 150)  return "V-Tachycardia";
  if (bpm > 100)  return "Tachycardia";
  if (bpm < 50 && bpm > 0) return "Bradycardia";
  if (bpm >= 60 && bpm <= 100) return "Normal Sinus";
  return "Irregular";
}

String generateAlertId() {
  alertState.alertCounter++;
  char id[20];
  sprintf(id, "alert_%03d", alertState.alertCounter);
  return String(id);
}

unsigned long getEpochTime() {
  // Use NTP time if available, fallback to millis()
  // For production: #include <time.h> and configTime()
  // Simple approximation using a base offset:
  return (unsigned long)(1710000000 + millis() / 1000);
}

/* ───────────────────────────────────────────
   TOKEN CALLBACK (required by Firebase lib)
─────────────────────────────────────────── */
void tokenStatusCallback(TokenInfo info) {
  if (info.status == token_status_error) {
    Serial.printf("🔐 Token error: %s\n",
                  getTokenError(info).c_str());
  }
}
