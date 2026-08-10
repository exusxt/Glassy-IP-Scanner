# Changelog

All notable changes to Glassy IP Scanner.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
