# Philips Hue Scenes — Unfolded Circle Remote Integration

## ⚠️ Deprecated — Use the Native Hue Integration Instead

Unfolded Circle's official Hue integration now supports scenes natively. Since that was the whole reason this project existed, I'd recommend switching over — it's more stable and doesn't depend on a third-party driver.

**What this means:**
- The native UC Hue integration can now expose and trigger your Hue scenes directly — no need for this add-on anymore.
- This repo is no longer actively maintained. It'll stay up for reference and for anyone who needs it, but I won't be adding features or fixing bugs going forward.
- If you're currently using it, I'd suggest migrating to the native integration when you get a chance.

**Thank you** to everyone who used this, opened issues, tested builds, and reported bugs — it filled a real gap while native scene support wasn't there, and your feedback shaped it. I appreciate it.

---

## Original README

[![Discord](https://camo.githubusercontent.com/0bbcbfb027f544e8176261b4abdb6a627dc1697feb2aeb08b221b1a3477e0ce9/68747470733a2f2f62616467656e2e6e65742f646973636f72642f6f6e6c696e652d6d656d626572732f7a475659663538)](https://discord.gg/zGVYf58)

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

```
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

```
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

```
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

```
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

```
curl -s 'http://<REMOTE_IP>/api/intg/drivers/hue-scenes-intg' \
     --user 'web-configurator:<PIN>' | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])"
```

---

## License

MIT
