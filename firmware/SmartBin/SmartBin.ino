#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// Enter your details between the quotation marks.
// ESP32 boards connect to 2.4 GHz Wi-Fi networks.
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *API_KEY = "YOUR_DOKPLOY_API_KEY";

const char *BIN_ID = "BIN-01";
const char *API_URL = "https://smartbin.maxkabechani.dev/api/telemetry";

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int GREEN_LED_PIN = 25;
const int YELLOW_LED_PIN = 26;
const int RED_LED_PIN = 27;
const int BUTTON_PIN = 13;
const int SERVO_PIN = 19;

const float EMPTY_CM = 35.0f;
const float FULL_CM = 5.0f;
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long SEND_EVERY_MS = 30000;

Servo lidServo;
bool lidOpen = false;
bool buttonWasPressed = false;
bool wifiWasConnected = false;
unsigned long lastWifiAttempt = 0;
unsigned long lastTelemetry = 0;

float readFillPercent() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long echoMicros = pulseIn(ECHO_PIN, HIGH, 30000);
  if (echoMicros == 0) return -1.0f;

  const float distanceCm = echoMicros * 0.0343f / 2.0f;
  return constrain((EMPTY_CM - distanceCm) * 100.0f / (EMPTY_CM - FULL_CM), 0.0f, 100.0f);
}

void startWiFi() {
  Serial.printf("[Wi-Fi] Connecting to '%s'...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();
}

void sendTelemetry(float fillPercent) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Web] Skipped: Wi-Fi is not connected.");
    return;
  }
  if (fillPercent < 0.0f) {
    Serial.println("[Web] Skipped: ultrasonic sensor returned no echo.");
    return;
  }

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(8000);

  if (!http.begin(API_URL)) {
    Serial.println("[Web] Could not start the HTTPS request.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  String body = "{\"api_key\":\"";
  body += API_KEY;
  body += "\",\"bin_id\":\"";
  body += BIN_ID;
  body += "\",\"fill_level\":";
  body += String(fillPercent, 1);
  body += ",\"lid_open\":";
  body += lidOpen ? "true" : "false";
  body += ",\"wifi_rssi\":";
  body += String(WiFi.RSSI());
  body += "}";

  Serial.printf("[Web] Posting %.1f%% fill to %s\n", fillPercent, API_URL);
  const int status = http.POST(body);
  if (status > 0) {
    Serial.printf("[Web] HTTP %d\n", status);
    Serial.println(http.getString());
  } else {
    Serial.printf("[Web] Request failed: %s (%d)\n", http.errorToString(status).c_str(), status);
  }

  http.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  lidServo.attach(SERVO_PIN);
  lidServo.write(0);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  startWiFi();

  Serial.println("SmartBin started. Open Serial Monitor at 115200 baud.");
}

void loop() {
  const float fillPercent = readFillPercent();

  digitalWrite(GREEN_LED_PIN, fillPercent >= 0.0f && fillPercent < 50.0f);
  digitalWrite(YELLOW_LED_PIN, fillPercent >= 50.0f && fillPercent < 80.0f);
  digitalWrite(RED_LED_PIN, fillPercent >= 80.0f);

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.printf("[Wi-Fi] Connected. IP: %s | RSSI: %d dBm\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
      sendTelemetry(fillPercent);
      lastTelemetry = millis();
    }
  } else {
    if (wifiWasConnected) {
      Serial.println("[Wi-Fi] Disconnected.");
      wifiWasConnected = false;
    }
    if (millis() - lastWifiAttempt >= WIFI_RETRY_MS) {
      startWiFi();
    }
  }

  const bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);
  if (buttonPressed && !buttonWasPressed) {
    lidOpen = !lidOpen;
    lidServo.write(lidOpen ? 90 : 0);
    Serial.printf("[Lid] %s\n", lidOpen ? "open" : "closed");
    sendTelemetry(fillPercent);
    lastTelemetry = millis();
  }
  buttonWasPressed = buttonPressed;

  if (WiFi.status() == WL_CONNECTED && millis() - lastTelemetry >= SEND_EVERY_MS) {
    sendTelemetry(fillPercent);
    lastTelemetry = millis();
  }

  delay(50);
}
