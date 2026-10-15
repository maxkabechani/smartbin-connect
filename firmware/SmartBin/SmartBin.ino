#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include "secrets.h"

const char *BIN_ID = "BIN-01";
const char *API_URL = "https://smartbin.maxkabechani.dev";
const int TRIG = 5, ECHO = 18, GREEN = 25, YELLOW = 26, RED = 27;
const int BUTTON = 13, SERVO_PIN = 19;
const float EMPTY_CM = 35, FULL_CM = 5;
const unsigned long SEND_EVERY = 30000;

Servo lid;
bool lidOpen = false, wasPressed = false;
unsigned long lastSend = 0, lastWifiTry = 0;

float readFill() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  unsigned long pulse = pulseIn(ECHO, HIGH, 30000);
  if (!pulse) return -1;
  float cm = pulse * 0.0343 / 2;
  return constrain((EMPTY_CM - cm) * 100 / (EMPTY_CM - FULL_CM), 0.0f, 100.0f);
}

void sendReading(float fill) {
  if (WiFi.status() != WL_CONNECTED || fill < 0) return;
  HTTPClient http;
  http.begin(String(API_URL) + "/api/telemetry");
  http.addHeader("Content-Type", "application/json");
  String body = "{\"api_key\":\"" + String(API_KEY) + "\",\"bin_id\":\"" + String(BIN_ID) + "\",\"fill_level\":" + String(fill, 1) + ",\"lid_open\":" + (lidOpen ? "true" : "false") + ",\"wifi_rssi\":" + String(WiFi.RSSI()) + "}";
  Serial.printf("Telemetry: %d\n", http.POST(body));
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(GREEN, OUTPUT); pinMode(YELLOW, OUTPUT); pinMode(RED, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  lid.attach(SERVO_PIN); lid.write(0);
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > 10000) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD); lastWifiTry = millis();
  }
  float fill = readFill();
  digitalWrite(GREEN, fill >= 0 && fill < 50);
  digitalWrite(YELLOW, fill >= 50 && fill < 80);
  digitalWrite(RED, fill >= 80);
  bool pressed = digitalRead(BUTTON) == LOW;
  if (pressed && !wasPressed) { lidOpen = !lidOpen; lid.write(lidOpen ? 90 : 0); sendReading(fill); }
  wasPressed = pressed;
  if (millis() - lastSend >= SEND_EVERY) { sendReading(fill); lastSend = millis(); }
  delay(50);
}
