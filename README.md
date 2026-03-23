# Philips Hue Scenes — Unfolded Circle Remote Integration

[![Discord](https://badgen.net/discord/online-members/zGVYf58)](https://discord.gg/zGVYf58)

Control your Philips Hue scenes directly from your Unfolded Circle Remote 2 or Remote 3. The UC native Hue integration only controls individual lights — this integration exposes every scene as a Button entity so you can trigger full room scenes from any activity or page.

---

## Features

- **Auto-discovers** your Hue Bridge on the local network — no IP address needed
- **Link-button pairing** — press the button on your bridge to authenticate, no API keys to copy/paste
- **All scenes exposed** as Button entities, grouped by room and zone
- **Works alongside** the native UC Hue integration — run both at the same time
- **Persists across reboots** — scenes reload automatically, no re-setup needed
- **Retry-friendly setup** — if you miss the button press window, just click Next to try again

---

## Requirements

- Unfolded Circle Remote 2 or Remote 3 with firmware >= 2.0.0
- Philips Hue Bridge v2 (square) on the same local network as your remote

---

## Installation

1. Download the latest `hue-scenes-intg.tar.gz` from the [Releases](https://github.com/SPLBendrix/uc-intg-hue-scenes/releases) page
2. Open your remote's web configurator at `http://<REMOTE_IP>`
3. Go to **Integrations → Add new → Install custom**
4. Upload the `.tar.gz` file

Or install via curl:

```bash
curl --location 'http://<REMOTE_IP>/api/intg/install' \
     --user 'web-configurator:<PIN>' \
     --form 'file=@"hue-scenes-intg.tar.gz"'
```

---

## Setup

After installation, click **Set up** on the Philips Hue Scenes integration in your web configurator.

### Step 1 — Bridge Discovery
The integration automatically scans your network for Hue bridges.

- **One bridge found** — moves straight to the pairing step
- **Multiple bridges found** — shows a dropdown to select which bridge to use
- **No bridge found** — falls back to a manual IP address entry field

### Step 2 — Link Button Pairing
Press the **round button on top of your Hue Bridge**, then click **Next** within 30 seconds.

If the window expires before you click Next, an error page will appear — just press the button again and click Next to retry. No need to restart setup.

### Step 3 — Done
The integration fetches all your scenes and registers them as Button entities. Setup takes about 15 seconds total.

---

## Usage

Once setup is complete, your Hue scenes appear as Button entities in the UC entity browser. Add them to any activity page, macro, or button mapping just like any other entity.

Scenes are named `<Room> - <Scene Name>` (e.g. `Living Room - Relax`) and grouped by area in the entity browser.

---

## Upgrading

> ⚠️ The remote does not support in-place driver upgrades. Follow these steps to upgrade without losing your entity configurations and page layouts.

```bash
# 1. Back up your remote config first
curl -s 'http://<REMOTE_IP>/api/cfg/backup' \
     --user 'web-configurator:<PIN>' \
     -o remote-backup.tar.gz

# 2. Delete the driver (NOT the integration instance)
curl -X DELETE 'http://<REMOTE_IP>/api/intg/drivers/hue-scenes-intg' \
     --user 'web-configurator:<PIN>'

# 3. Install the new version
curl --location 'http://<REMOTE_IP>/api/intg/install' \
     --user 'web-configurator:<PIN>' \
     --form 'file=@"hue-scenes-intg.tar.gz"'
```

Your existing entity configs, button mappings, and page layouts will survive the upgrade intact.

---

## Building from Source

Requires Node.js (v18+) and npm.

```bash
git clone https://github.com/SPLBendrix/uc-intg-hue-scenes.git
cd uc-intg-hue-scenes
chmod +x setup-and-build.sh
./setup-and-build.sh
```

This produces `hue-scenes-intg.tar.gz` in the current directory, ready to install.

---

## Troubleshooting

**Setup times out / no response**

Enable live logs on your remote and watch during setup:
```bash
curl -s -X PUT 'http://<REMOTE_IP>/api/system/logs/web' \
     --user 'web-configurator:<PIN>' \
     -H 'Content-Type: application/json' \
     -d '{"enabled": true}'
```
Then open `http://<REMOTE_IP>/log/` in your browser.

**Bridge not found during discovery**

If your bridge is on an unusual subnet, discovery may not find it. Enter the IP manually when prompted. You can find your bridge IP in the Philips Hue app under **Settings → Hue Bridges → (i)**.

**Link button error on pairing**

You have a 30-second window after pressing the bridge button. If you see an error, just press the button again and click Next — the setup flow stays on the pairing step and lets you retry without restarting.

**Scenes not updating after adding new scenes in Hue**

Re-run setup via the web configurator (click **Set up** on the integration again). Your existing entity configs will be preserved and new scenes will be added.

**Check installed driver version**

```bash
curl -s 'http://<REMOTE_IP>/api/intg/drivers/hue-scenes-intg' \
     --user 'web-configurator:<PIN>' | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])"
```

---

## License

MIT
