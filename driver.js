#!/usr/bin/env node
"use strict";

const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");
const WebSocket = require("ws");

const CONFIG_DIR  = process.env.UC_CONFIG_HOME || ".";
const CONFIG_FILE = path.join(CONFIG_DIR, "hue_scenes_config.json");
const PORT        = parseInt(process.env.UC_INTEGRATION_HTTP_PORT || "9090", 10);

console.log("[hue] v2.1.0 start port=" + PORT + " config=" + CONFIG_DIR);

let hueConfig    = {};
const sceneMap   = {};
const entities   = {};
let deviceState  = "DISCONNECTED";

// ── Setup state (per-connection) ──────────────────────────────────────────────
// We track which step the setup flow is on so we know how to handle
// each incoming setup_driver message.
//   step 0: initial  -> run discovery, show bridge picker (or manual entry)
//   step 1: bridge selected -> show "press button" instruction page
//   step 2: user clicked Next after pressing button -> attempt key retrieval
let setupStep     = 0;
let setupBridgeIp = "";

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    const d = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (d.bridge_ip && d.api_key && !d.bridge_ip.includes("your_")) {
      hueConfig = d;
      console.log("[hue] config loaded bridge=" + hueConfig.bridge_ip);
      return true;
    }
  } catch (_) {}
  return false;
}

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(hueConfig, null, 2)); }
  catch (e) { console.error("[hue] save config failed: " + e.message); }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { rejectUnauthorized: false }, res => {
      let d = "";
      res.on("data", c => { d += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error("parse error: " + d.slice(0, 80))); }
      });
    });
    req.setTimeout(timeoutMs || 5000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

function huePost(ip, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: ip, port: 443, path: "/api", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      rejectUnauthorized: false,
    }, res => {
      let d = "";
      res.on("data", c => { d += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error("parse: " + d.slice(0, 80))); }
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function hueReq(method, ip, key, p, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "hue-application-key": key, "Content-Type": "application/json" };
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const req = https.request({
      hostname: ip, port: 443, path: "/clip/v2" + p, method,
      headers, rejectUnauthorized: false,
    }, res => {
      let d = "";
      res.on("data", c => { d += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error("parse error")); }
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Bridge discovery ──────────────────────────────────────────────────────────
// 1. Try Philips cloud discovery endpoint
// 2. Try local mDNS fallback via /api/config on common IPs (quick scan)

async function discoverBridges() {
  const bridges = [];

  // Method 1: Philips cloud discovery
  try {
    console.log("[hue] trying cloud discovery...");
    const results = await httpGet("https://discovery.meethue.com", 6000);
    if (Array.isArray(results)) {
      for (const b of results) {
        if (b.internalipaddress) {
          bridges.push({ ip: b.internalipaddress, name: "Hue Bridge (" + b.internalipaddress + ")" });
        }
      }
      console.log("[hue] cloud discovery found " + bridges.length + " bridge(s)");
    }
  } catch(e) {
    console.log("[hue] cloud discovery failed: " + e.message);
  }

  // Method 2: local subnet scan on common Hue addresses (if cloud found nothing)
  if (bridges.length === 0) {
    console.log("[hue] trying local scan...");
    // Scan .1, .2 on the first three common home subnets
    const candidates = [
      "192.168.1.2","192.168.1.100","192.168.0.2","192.168.0.100",
      "10.0.0.2","10.0.1.2","172.16.0.2"
    ];
    const checks = candidates.map(ip =>
      httpGet("http://" + ip + "/api/config", 1500)
        .then(d => {
          if (d && d.bridgeid) {
            bridges.push({ ip, name: (d.name || "Hue Bridge") + " (" + ip + ")" });
          }
        })
        .catch(() => {})
    );
    await Promise.all(checks);
    console.log("[hue] local scan found " + bridges.length + " bridge(s)");
  }

  return bridges;
}

// ── Hue API key retrieval (button press) ──────────────────────────────────────

async function requestApiKey(ip) {
  const result = await huePost(ip, {
    devicetype: "uc_hue_scenes#remote3",
    generateclientkey: true,
  });
  const arr = Array.isArray(result) ? result : [result];
  for (const item of arr) {
    if (item.success && item.success.username) {
      return item.success.username;
    }
    if (item.error) {
      throw new Error(item.error.description || "Bridge error " + item.error.type);
    }
  }
  throw new Error("Unexpected response: " + JSON.stringify(arr).slice(0, 100));
}

// ── Scene helpers ─────────────────────────────────────────────────────────────

async function fetchScenes(ip, key) {
  const [s, r, z] = await Promise.all([
    hueReq("GET", ip, key, "/resource/scene"),
    hueReq("GET", ip, key, "/resource/room"),
    hueReq("GET", ip, key, "/resource/zone"),
  ]);
  const groups = {};
  for (const g of [...(r.data||[]), ...(z.data||[])]) {
    groups[g.id] = (g.metadata && g.metadata.name) || "";
  }
  const scenes = (s.data||[]).map(sc => ({
    id: sc.id,
    name: (sc.metadata && sc.metadata.name) || "Scene",
    group: groups[(sc.group && sc.group.rid)] || "",
  }));
  scenes.sort((a,b) => (a.group+a.name).localeCompare(b.group+b.name));
  return scenes;
}

function buildEntities(scenes) {
  for (const k of Object.keys(entities)) delete entities[k];
  for (const k of Object.keys(sceneMap)) delete sceneMap[k];
  for (const sc of scenes) {
    const eid = "hue_" + sc.id.replace(/-/g, "_");
    sceneMap[eid] = sc.id;
    entities[eid] = {
      entity_id: eid,
      entity_type: "button",
      features: ["press"],
      name: { en: sc.group ? sc.group + " - " + sc.name : sc.name },
      area: sc.group || "Hue",
      attributes: { state: "AVAILABLE" },
    };
  }
  console.log("[hue] built " + scenes.length + " entities");
}

// ── WebSocket protocol ────────────────────────────────────────────────────────

function tx(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function resp(ws, rid, code, msg, data) {
  tx(ws, { kind: "resp", req_id: rid, code: code, msg: msg, msg_data: data || {} });
}

function sendEvent(ws, msg, data, cat) {
  tx(ws, { kind: "event", msg: msg, cat: cat || "DEVICE", msg_data: data || {} });
}

function setupProgress(ws) {
  sendEvent(ws, "driver_setup_change", { event_type: "SETUP", state: "SETUP" });
}

function setupUserInput(ws, title, settings) {
  sendEvent(ws, "driver_setup_change", {
    event_type: "SETUP",
    state: "WAIT_USER_ACTION",
    require_user_action: {
      input: { title: { en: title }, settings: settings },
    },
  });
}

function setupOk(ws) {
  sendEvent(ws, "driver_setup_change", { event_type: "STOP", state: "OK" });
}

function setupError(ws, msg) {
  sendEvent(ws, "driver_setup_change", {
    event_type: "STOP", state: "ERROR", error: "OTHER",
    error_msg: msg,
  });
}

// ── Setup flow ────────────────────────────────────────────────────────────────

async function handleSetup(ws, rid, setupData) {
  console.log("[hue] setup step=" + setupStep + " data=" + JSON.stringify(setupData));
  resp(ws, rid, 200, "result");

  // ── Step 0: discover bridges, show picker ─────────────────────────────────
  if (setupStep === 0) {
    setupProgress(ws);

    const bridges = await discoverBridges();

    if (bridges.length === 0) {
      // No bridges found — fall back to manual IP entry
      console.log("[hue] no bridges found, showing manual entry");
      setupStep = 1;
      setupUserInput(ws, "Bridge Not Found — Enter Manually", [
        {
          id: "bridge_ip",
          label: { en: "Hue Bridge IP Address" },
          field: { text: { value: "", placeholder: "192.168.1.x" } },
        },
      ]);
    } else if (bridges.length === 1) {
      // Exactly one bridge — skip the picker, go straight to button page
      setupBridgeIp = bridges[0].ip;
      console.log("[hue] single bridge found: " + setupBridgeIp);
      setupStep = 2;
      setupUserInput(ws, "Press the Link Button", [
        {
          id: "info",
          label: { en: "Instructions" },
          field: {
            label: {
              value: {
                en: "Bridge found at " + setupBridgeIp + ". Press the round link button on top of your Hue Bridge, then click Next.",
              },
            },
          },
        },
      ]);
    } else {
      // Multiple bridges — show dropdown
      console.log("[hue] multiple bridges found: " + bridges.length);
      setupStep = 1;
      setupUserInput(ws, "Select Your Hue Bridge", [
        {
          id: "bridge_ip",
          label: { en: "Hue Bridge" },
          field: {
            dropdown: {
              value: bridges[0].ip,
              items: bridges.map(b => ({ id: b.ip, label: { en: b.name } })),
            },
          },
        },
      ]);
    }
    return;
  }

  // ── Step 1: bridge IP confirmed (manual entry or dropdown) ────────────────
  if (setupStep === 1) {
    const ip = (setupData.bridge_ip || "").trim();
    if (!ip) {
      setupError(ws, "Please enter a valid bridge IP address.");
      setupStep = 0;
      return;
    }
    setupBridgeIp = ip;
    console.log("[hue] bridge ip set to " + setupBridgeIp);
    setupStep = 2;
    setupUserInput(ws, "Press the Link Button", [
      {
        id: "info",
        label: { en: "Instructions" },
        field: {
          label: {
            value: {
              en: "Press the round link button on top of your Hue Bridge at " + setupBridgeIp + ", then click Next.",
            },
          },
        },
      },
    ]);
    return;
  }

  // ── Step 2: attempt API key retrieval ─────────────────────────────────────
  if (setupStep === 2) {
    console.log("[hue] attempting key retrieval from " + setupBridgeIp);
    setupProgress(ws);

    let apiKey;
    try {
      apiKey = await requestApiKey(setupBridgeIp);
      console.log("[hue] got api key");
    } catch(e) {
      console.log("[hue] key retrieval failed: " + e.message);
      // Stay on step 2 so user can try again
      setupUserInput(ws, "Button Not Pressed — Try Again", [
        {
          id: "info",
          label: { en: "Instructions" },
          field: {
            label: {
              value: {
                en: "Could not get API key: " + e.message + ". Press the link button on your Hue Bridge, then click Next to try again.",
              },
            },
          },
        },
      ]);
      return;
    }

    // Key retrieved — now fetch scenes
    try {
      const scenes = await fetchScenes(setupBridgeIp, apiKey);
      hueConfig = { bridge_ip: setupBridgeIp, api_key: apiKey };
      saveConfig();
      buildEntities(scenes);
      deviceState = "CONNECTED";
      sendEvent(ws, "device_state", { state: "CONNECTED" });
      setupOk(ws);
      console.log("[hue] setup complete scenes=" + scenes.length);
    } catch(e) {
      console.error("[hue] scene fetch failed: " + e.message);
      setupError(ws, "Connected to bridge but could not fetch scenes: " + e.message);
      setupStep = 0;
    }
    return;
  }

  // Unexpected state — restart
  console.log("[hue] unexpected setup state, restarting");
  setupStep = 0;
  setupError(ws, "Unexpected error. Please try setup again.");
}

// ── Per-connection message handler ────────────────────────────────────────────

function handle(ws, raw) {
  let m;
  try { m = JSON.parse(raw); } catch(_) { return; }
  if (m.kind !== "req") return;

  const rid  = m.id || m.req_id;
  const type = m.msg;
  const d    = m.msg_data || {};

  console.log("[hue] REQ id=" + rid + " msg=" + type);

  switch (type) {

    case "get_driver_version":
      resp(ws, rid, 200, "driver_version", {
        name: "Philips Hue Scenes",
        version: { api: "0.20.0", driver: "2.1.0" },
      });
      break;

    case "get_device_state":
      resp(ws, rid, 200, "device_state", { state: deviceState });
      break;

    case "get_available_entities":
      resp(ws, rid, 200, "available_entities", {
        available_entities: Object.values(entities),
      });
      break;

    case "get_entity_states":
      resp(ws, rid, 200, "entity_states", {
        entity_states: Object.keys(sceneMap).map(eid => ({
          entity_id: eid, entity_type: "button",
          attributes: { state: "AVAILABLE" },
        })),
      });
      break;

    case "subscribe_events":
      resp(ws, rid, 200, "subscribe_events");
      sendEvent(ws, "device_state", { state: deviceState });
      break;

    case "unsubscribe_events":
      resp(ws, rid, 200, "unsubscribe_events");
      break;

    case "subscribe_entities":
      resp(ws, rid, 200, "subscribe_entities");
      break;

    case "unsubscribe_entities":
      resp(ws, rid, 200, "unsubscribe_entities");
      break;

    case "entity_command": {
      const eid = d.entity_id;
      const cmd = d.cmd_id;
      if (cmd !== "push") { resp(ws, rid, 404, "result"); return; }
      const sid = sceneMap[eid];
      if (!sid) { resp(ws, rid, 404, "result"); return; }
      hueReq("PUT", hueConfig.bridge_ip, hueConfig.api_key,
        "/resource/scene/" + sid, { recall: { action: "active" } })
        .then(() => resp(ws, rid, 200, "result"))
        .catch(e => {
          console.error("[hue] activate failed: " + e.message);
          resp(ws, rid, 500, "result");
        });
      break;
    }

    case "setup_driver":
      // Fresh setup or reconfigure - reset state
      setupStep = 0;
      setupBridgeIp = "";
      handleSetup(ws, rid, d.setup_data || {}).catch(e => {
        console.error("[hue] setup error: " + e.message);
        sendEvent(ws, "driver_setup_change", { event_type: "STOP", state: "ERROR" });
        setupStep = 0;
      });
      break;

    case "set_driver_user_data":
      // Sent by remote when user clicks Next on a WAIT_USER_ACTION page
      resp(ws, rid, 200, "result");
      handleSetup(ws, rid, d.input_values || {}).catch(e => {
        console.error("[hue] set_driver_user_data error: " + e.message);
        sendEvent(ws, "driver_setup_change", { event_type: "STOP", state: "ERROR" });
        setupStep = 0;
      });
      break;

    default:
      console.log("[hue] unknown: " + type);
      resp(ws, rid, 404, type);
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer();
const wss    = new WebSocket.Server({ server });

wss.on("connection", ws => {
  console.log("[hue] new connection - resetting setup state");
  setupStep     = 0;
  setupBridgeIp = "";
  tx(ws, { kind: "resp", req_id: 0, code: 200, msg: "authentication", msg_data: {} });
  ws.on("message", raw => handle(ws, raw.toString()));
  ws.on("error",   e   => console.error("[hue] ws error: " + e.message));
  ws.on("close",   ()  => console.log("[hue] connection closed"));
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log("[hue] listening on port " + PORT);
  if (loadConfig()) {
    try {
      const scenes = await fetchScenes(hueConfig.bridge_ip, hueConfig.api_key);
      buildEntities(scenes);
      deviceState = "CONNECTED";
      console.log("[hue] startup ready scenes=" + Object.keys(entities).length);
    } catch(e) {
      console.error("[hue] startup failed: " + e.message);
      deviceState = "ERROR";
    }
  } else {
    console.log("[hue] no config - awaiting setup");
  }
});
