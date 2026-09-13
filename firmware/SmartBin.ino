#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>

// Change these pins to match your kit.
const int TRIG_PIN = 5, ECHO_PIN = 18, SERVO_PIN = 19;
const int LED_GREEN = 25, LED_YELLOW = 26, LED_RED = 27;
const int BUZZER_PIN = 14, BUTTON_PIN = 13;
const float EMPTY_DISTANCE_CM = 35.0, FULL_DISTANCE_CM = 5.0;
const unsigned long TELEMETRY_INTERVAL_MS = 30000;
const char *API_KEY = "change-me";

Preferences prefs;
Servo lidServo;
String wifiSsid, wifiPassword, binId = "BIN-01", apiUrl;
bool lidOpen = false, lastCritical = false;
unsigned long lastTelemetry = 0;

#define SERVICE_UUID "d5f2b000-7e4a-4a5b-8a6b-000000000001"
#define CONFIG_UUID  "d5f2b000-7e4a-4a5b-8a6b-000000000002"
#define STATUS_UUID  "d5f2b000-7e4a-4a5b-8a6b-000000000003"
BLECharacteristic *statusCharacteristic;

void setStatus(const String &msg) {
  if (statusCharacteristic) { statusCharacteristic->setValue(msg.c_str()); statusCharacteristic->notify(); }
  Serial.println(msg);
}

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    String value = c->getValue().c_str();
    int a=value.indexOf('|'), b=value.indexOf('|',a+1), d=value.indexOf('|',b+1);
    if (a<1 || b<0 || d<0) { setStatus("FORMAT_ERROR"); return; }
    wifiSsid=value.substring(0,a); wifiPassword=value.substring(a+1,b);
    binId=value.substring(b+1,d); apiUrl=value.substring(d+1);
    prefs.putString("ssid",wifiSsid); prefs.putString("pass",wifiPassword);
    prefs.putString("bin",binId); prefs.putString("api",apiUrl);
    setStatus("SAVED_RESTARTING"); delay(500); ESP.restart();
  }
};

void startBluetooth() {
  BLEDevice::init(("SmartBin-" + binId).c_str());
  BLEServer *server=BLEDevice::createServer(); BLEService *service=server->createService(SERVICE_UUID);
  BLECharacteristic *config=service->createCharacteristic(CONFIG_UUID, BLECharacteristic::PROPERTY_WRITE);
  config->setCallbacks(new ConfigCallbacks());
  statusCharacteristic=service->createCharacteristic(STATUS_UUID, BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  statusCharacteristic->addDescriptor(new BLE2902()); statusCharacteristic->setValue("READY"); service->start();
  BLEAdvertising *ad=BLEDevice::getAdvertising(); ad->addServiceUUID(SERVICE_UUID); ad->start();
}

void connectWifi() {
  if (wifiSsid.isEmpty() || apiUrl.isEmpty()) { setStatus("BLUETOOTH_SETUP_REQUIRED"); return; }
  WiFi.mode(WIFI_STA); WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str()); setStatus("WIFI_CONNECTING");
  unsigned long start=millis(); while(WiFi.status()!=WL_CONNECTED && millis()-start<15000){delay(300); Serial.print('.');}
  setStatus(WiFi.status()==WL_CONNECTED ? "WIFI_CONNECTED" : "WIFI_FAILED");
}

float readFillPercent() {
  digitalWrite(TRIG_PIN,LOW); delayMicroseconds(2); digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN,LOW);
  unsigned long duration=pulseIn(ECHO_PIN,HIGH,30000); if(!duration) return -1;
  float distance=duration*0.0343/2.0; float fill=(EMPTY_DISTANCE_CM-distance)*100.0/(EMPTY_DISTANCE_CM-FULL_DISTANCE_CM);
  return constrain(fill,0,100);
}

void updateIndicators(float fill) {
  digitalWrite(LED_GREEN, fill>=0 && fill<50); digitalWrite(LED_YELLOW, fill>=50 && fill<80); digitalWrite(LED_RED, fill>=80);
  bool critical=fill>=90; if(critical && !lastCritical){tone(BUZZER_PIN,2200,500);} lastCritical=critical;
}

void setLid(bool open) { lidOpen=open; lidServo.write(open?100:10); }

void sendTelemetry(float fill) {
  if(WiFi.status()!=WL_CONNECTED || apiUrl.isEmpty() || fill<0) return;
  HTTPClient http; http.begin(apiUrl + "/api/telemetry"); http.addHeader("Content-Type","application/json");
  String body="{\"api_key\":\""+String(API_KEY)+"\",\"bin_id\":\""+binId+"\",\"fill_level\":"+String(fill,1)+",\"lid_open\":"+(lidOpen?"true":"false")+",\"wifi_rssi\":"+String(WiFi.RSSI())+"}";
  int code=http.POST(body); Serial.printf("Telemetry: %d\n",code); http.end();
}

void setup() {
  Serial.begin(115200); pinMode(TRIG_PIN,OUTPUT); pinMode(ECHO_PIN,INPUT); pinMode(BUTTON_PIN,INPUT_PULLUP);
  pinMode(LED_GREEN,OUTPUT); pinMode(LED_YELLOW,OUTPUT); pinMode(LED_RED,OUTPUT); pinMode(BUZZER_PIN,OUTPUT);
  lidServo.attach(SERVO_PIN); setLid(false); prefs.begin("smartbin",false);
  wifiSsid=prefs.getString("ssid",""); wifiPassword=prefs.getString("pass",""); binId=prefs.getString("bin","BIN-01"); apiUrl=prefs.getString("api","");
  startBluetooth(); connectWifi();
}

void loop() {
  float fill=readFillPercent(); updateIndicators(fill);
  if(digitalRead(BUTTON_PIN)==LOW){setLid(true); delay(1500);}
  if(lidOpen && digitalRead(BUTTON_PIN)==HIGH){delay(1200); setLid(false);}
  if(millis()-lastTelemetry>TELEMETRY_INTERVAL_MS){sendTelemetry(fill); lastTelemetry=millis();}
  delay(500);
}
