# Changelog

All notable changes to this project will be documented here.

---

## [2.1.0] — 2026-03-23

### Added
- Auto-discovery of Hue bridges via Philips cloud endpoint with local subnet fallback
- Link-button pairing flow — no API key entry required
- Dropdown bridge selector when multiple bridges are found on the network
- Manual IP entry fallback if discovery finds no bridges
- Retry-friendly button press step — stays on pairing page on failure instead of aborting setup
- Multi-step setup flow using `setup_driver` + `set_driver_user_data` protocol messages

### Changed
- Setup no longer requires manually entering a bridge IP or API key
- Setup flow is now fully guided with no technical knowledge required

---

## [1.3.0] — 2026-03-23

### Added
- Initial working release
- Manual Hue Bridge IP and API key entry during setup
- All Hue scenes exposed as Button entities, grouped by room/zone
- Scene activation via Hue CLIP v2 API
- Config persists across remote reboots

### Technical
- Raw WebSocket implementation (no UC library dependency)
- Only requires `ws` npm package
- Correct UC integration protocol: `setup_driver` ACK + `driver_setup_change` events
- Valid `event_type` values: `SETUP` with `state: WAIT_USER_ACTION` for input forms, `STOP` with `state: OK/ERROR` to finish
