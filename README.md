[![Discord](https://badgen.net/discord/online-members/zGVYf58)](https://discord.gg/zGVYf58)


# Phillips Hue Scene Integration for Unfolded Circle Remotes

Easily control your Phillips Hue scenes directly from your Unfolded Circle Remote. Scenes are not yet supported via the native UC Hue integration, so running this integration side by side with UC's will give you full flexibility. 

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Setup & Configuration](#setup--configuration)

---

## Features

- **Scenes:**  
  - Trigger Hue scenes from your remote


---

## Installation

1. **Download** the latest `.tar.gz` release from the [Releases](https://github.com/SPLBendrix/uc-intg-hue-scenes/releases) page.
2. **Upload** the file via the Integrations tab in your remote’s web configurator (requires firmware >= 2.0.0)

---

## Setup & Configuration

After installation, open the integration in your remote’s web interface:

1. **Hue Bridge IP Entry:** The integration will prompt for the IP address of your Hue Bridge.
2. **Huge Bridge API Key:** The integration will prompt for the API of your Hue Bridge.
3. **Pairing:** Press the button on the top of your hub, then Get your Hue API key (Scan for Hub and auto API key retrevial coming soon.)
Run this curl:
```sh
curl -X POST http://<BRIDGE_IP>/api -d '{"devicetype":"a"}'
  ```

The username value in the response is your API key.

4. **Scene Selection:** Your configured Hue Scenes are now exposed as Entities that can be added to any activity. 
