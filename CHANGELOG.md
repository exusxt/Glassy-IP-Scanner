# Changelog

All notable changes to Glassy IP Scanner.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
