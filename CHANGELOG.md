# Changelog

All notable changes to Glassy IP Scanner.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.13] - 2026-08-11

### Added

- Device type classification: every host is labelled (Router, Printer, NAS, Camera, TV, Speaker, Phone, Tablet, Laptop, Computer, Console, Raspberry Pi, Server, Smart device…) from hostname patterns, vendor fingerprints and the default-gateway heuristic, shown with an icon in the results table and overview
- Built-in TCP port scanner: scan the online devices for open ports with Common / Web / File sharing / Gaming presets or a custom port range, with live progress and per-port service names
- Device profiles: click any row to open a detail dialog where you can give a device a custom name, notes, tags and mark it as a favorite. Profiles persist per MAC across scans (stored in `devices.json` in the user data directory)
- Search & filtering: free-text search across IP, hostname, vendor, MAC, custom name and tags, plus status, device-type and favorites-only filters
- Service identification: well-known TCP ports are labelled with their service (SSH, HTTP, SMB…) in the results and device detail

### Fixed

- The app version shown in the title bar no longer falls back to Electron's version (e.g. "43.3.0") when the built main bundle is launched directly: the package version is now baked into the bundle at build time, so the correct version is always reported

## [v0.1.12] - 2026-08-11

### Fixed

- MAC vendor lookup finally works again in the released installers: the bundled OUI data is parsed line by line, and on Windows build hosts the data file is checked out with CRLF line endings, so every line ended in a stray `\r` that the parser's regex rejected. Almost no vendor was displayed even though the database was shipped intact. The parser now splits on LF and CRLF alike, and `.gitattributes` pins the data file to LF so Windows and CI checkouts stay consistent

## [v0.1.11] - 2026-08-11

### Fixed

- MAC vendor lookup no longer shows "Locally administered"/"Multicast" for real devices: prefixes in the OUI database that legitimately have the multicast/local bit set (e.g. QEMU's 52:54:00, Digital Equipment's AA:00:00, PearPC's DE:AD:CA) are matched again, and the classification is only applied when no database entry exists

### Added

- Windows arm64 support: the NSIS installer is now combined (x64 + arm64 in one setup, so installed auto-updates keep working) and the portable build is split into separate x64 and arm64 executables instead of one double-sized combined file

### Changed

- Portable self-update downloads the arch-specific portable exe (…-x64.exe / …-arm64.exe) instead of an un-suffixed name

### Fixed

- Portable update downloads no longer fail with HTTP 404: the artifact name was built from the release tag (with the "v" prefix), but electron-builder names the portable exe after the plain version — the URL is now constructed with the version only

## [v0.1.9] - 2026-08-11

### Added

- Reverse-DNS lookups now also query the default gateway (the router), which holds the PTR records for every DHCP client on home/office LANs. Many more hostnames are resolved — on a typical fritz.box network nearly every device shows its DNS name (e.g. "exus-nas.fritz.box") instead of being listed by MAC/vendor only

### Fixed

- Reverse-DNS no longer silently fails when the system DNS points at a loopback filter such as AdGuard/pi-hole on 127.0.0.1, which answers NXDOMAIN for local PTR queries

## [v0.1.8] - 2026-08-11

### Fixed

- Update check now works again: it reads the latest release tag from the GitHub Atom feed instead of following the /releases/latest redirect, which Electron's net.fetch cannot resolve (the response URL was always empty, so the app incorrectly reported "up to date")
- The updater picks the highest version in the feed, so an out-of-order publish can never offer a downgrade

## [v0.1.7] - 2026-08-11

### Fixed

- Hostname resolution no longer shows placeholder mDNS names ("none", "none-3", "localhost") that Amazon/Fire TV and other devices advertise when their hostname was never set — those rows show the vendor name again instead
- NetBIOS names now take priority over mDNS on Windows, so a device like the NAS shows its clean NetBIOS name (e.g. "EXUS-NAS") instead of the mDNS variant (e.g. "exus-nas-3")

## [v0.1.6] - 2026-08-11

### Fixed

- Portable self-update now works exactly like the SC64 SD Card Builder: the update check goes through the github.com web redirect (no GitHub API rate limit), the new exe downloads to the temp folder, and it is swapped over the running exe by a hidden helper — no console window flashes and the app's own folder no longer needs to be writable while running
- Portable update install no longer deletes the old exe first; it moves the new build in place with a retry loop, then relaunches

## [v0.1.5] - 2026-08-10

### Added

- mDNS reverse (PTR) lookup for hostnames on Windows/macOS — names now appear for devices that never answer NetBIOS or classic reverse DNS (NAS, smart-home, Apple and similar gear)
- The scanner now shows the local machine's own MAC address
- Fresh ARP lookup per host, so MACs appear for devices that only enter the ARP cache during the scan

## [v0.1.4] - 2026-08-10

### Fixed

- Portable build now fully supports in-app updates: it downloads the matching portable exe from the latest GitHub release and swaps it in on restart, instead of downloading and running the NSIS installer

## [v0.1.3] - 2026-08-10

### Fixed

- Windows taskbar/window icon now renders fully instead of showing a black area (multi-size ICO, explicit window icon and AppUserModelId)

## [v0.1.2] - 2026-08-10

### Added

- Built-in updater backed by GitHub Releases — checks on launch and lets you download, install later, or skip each version
- Settings screen with an automatic-updates toggle and a manual "Check for updates" button

### Infra

- Release notes are now sourced from this changelog instead of auto-generated summaries

## [v0.1.1] - 2026-08-10

### Improved

- MAC vendor lookup now matches IEEE MA-L/MA-M/MA-S prefixes (6/7/9 hex digits) and classifies broadcast, multicast and locally administered addresses

### Added

- 7 more gallery backgrounds (9 total) for the random glass theme picker

## [v0.1.0] - 2026-08-10

### Added

- Initial release: network scanner with ICMP, TCP and ARP discovery, ARP-table and interface detection
- Offline MAC vendor database (~39k IEEE prefixes) bundled with the app — no network needed
- Glassmorphic themes with random gallery backgrounds
- Cross-platform installers built and published from CI on every version tag
