# Glassy IP Scanner

**Glassy IP Scanner** is a modern, fast, and lightweight network discovery tool designed to help users scan, visualize, and understand devices connected to their local networks.

Built with simplicity and performance in mind, Glassy IP Scanner makes network discovery accessible to everyone—from home users troubleshooting their Wi-Fi to IT professionals managing larger networks.

> **Discover your network. Understand your devices. Stay in control.**

## ✨ Features

> **Status icons:** ✅ fully implemented · 🟡 partially implemented · ❌ not implemented yet

### 🔎 Fast Network Scanning

* 🟡 Scan local IPv4 and IPv6 networks (IPv4 only)
* ✅ Automatically detect local network interfaces and subnets
* ✅ Custom IP range scanning
* ✅ CIDR notation support
* ✅ Configurable scan speed and timeout
* ✅ Multi-threaded/asynchronous scanning
* ✅ Pause, resume, and cancel scans
* ✅ Real-time scan progress
* ✅ Intelligent retry handling
* ✅ Lightweight resource usage

### 🖥️ Device Discovery

Automatically identify devices on your network and display:

* ✅ IP address
* ❌ IPv6 address
* ✅ Hostname
* ✅ MAC address
* ✅ MAC vendor / manufacturer
* ✅ Device status
* ✅ Response time / latency
* 🟡 Open ports (shown after running the built-in port scanner)
* ❌ Operating system hints
* ✅ Network interface information
* 🟡 First-seen and last-seen timestamps (recorded; shown in the monitoring activity feed)

### 🌐 Network Discovery Methods

Use multiple discovery techniques to improve device detection:

* ✅ ICMP ping
* ✅ ARP discovery
* ✅ TCP probing
* ❌ UDP discovery
* ✅ DNS resolution
* 🟡 mDNS / Bonjour (hostname resolution only)
* 🟡 NetBIOS discovery (hostname resolution only)
* 🟡 SNMP support (switch MAC-table discovery over SNMPv2c for map topology)
* ❌ IPv6 Neighbor Discovery

The scanner should intelligently select appropriate discovery methods depending on the network and platform. 🟡 (methods are user-selected)

### 🔌 Port Scanner

Built-in port scanning for quickly identifying network services.

* ✅ Common-port presets
* ✅ Custom port ranges
* ✅ TCP connect scanning
* ❌ Optional UDP scanning
* ✅ Service detection (well-known port → service names)
* 🟡 Port state detection (open vs closed; no "filtered" state)
* ✅ Configurable timeouts
* ✅ Concurrent scanning
* ✅ Custom port lists (TCP probe ports + custom ranges)
* ❌ Service banners where appropriate

Example:

```text
192.168.1.25
├── 22   SSH
├── 80   HTTP
├── 443  HTTPS
└── 3389 RDP
```

### 🧠 Device Identification

Make raw network information understandable.

* ✅ Vendor lookup from MAC address
* ✅ Hostname resolution
* 🟡 Service identification (well-known port → service names, no fingerprinting)
* ✅ Device type classification (heuristic from vendor, hostname and gateway)
* ✅ Custom device names
* ✅ User-defined tags
* ✅ Favorites
* ✅ Notes
* ❌ Custom icons

Example:

```text
192.168.1.20
Samsung Electronics
Living Room TV
📺 Smart TV
```

### 📊 Modern Network Dashboard

Provide a clean overview of the network.

* ✅ Total devices discovered
* ✅ Online/offline devices
* ✅ New devices
* ✅ Device categories
* 🟡 Open services (shown per-device in the device detail dialog)
* 🟡 Network latency (per-device latency, no aggregate)
* ✅ Scan duration
* ❌ Network utilization statistics
* ✅ Recently discovered devices
* ✅ New-device / online / offline activity feed

### 🗺️ Network Map

Visualize discovered devices instead of displaying only a table.

* ✅ Router/gateway detection
* ✅ Device relationships (switch-link detection via SNMP MAC tables + manual device→switch bindings)
* ✅ Network topology (multi-hop radial tree; cascaded switches and virtual switches render correctly)
* ✅ Device grouping (colored and grouped by device type)
* ✅ Interactive network graph
* ✅ Zoom and pan
* ✅ Device details on selection
* ✅ Offline devices (previously-detected devices shown dimmed with a dashed outline)
* ✅ Export as SVG (vector) or PNG (1024 / 2048 / 4096 px)
* ✅ Backup/restore of map settings (bindings + cached SNMP tables, as versioned JSON)

### 🔔 Device Monitoring

Turn Glassy IP Scanner into a lightweight network monitoring tool.

* ❌ Continuous scanning
* ✅ Device online/offline detection (per-scan reconciliation)
* ✅ New-device notifications
* ✅ Device disappearance alerts
* ✅ Offline persistence (previously-detected devices keep showing up marked offline when they don't answer a scan)
* ❌ Configurable scan intervals
* 🟡 Availability history (first/last-seen ledger; per-scan snapshots in scan history)
* ❌ Response-time history

Optional integrations:

* ❌ Desktop notifications
* ❌ Webhooks
* ❌ Discord
* ❌ Slack
* ❌ Email

### 📜 Scan History

Keep track of what has changed on the network.

* ✅ Previous scan results
* ✅ Compare scans
* ✅ New devices
* ✅ Removed devices
* ✅ Changed IP addresses
* 🟡 Changed MAC addresses (a MAC change is reported as removed + added)
* ✅ Changed hostnames
* ✅ Changed open ports
* 🟡 Historical device information (device snapshot per scan, no standalone device timeline)

### 📤 Export & Reporting

Make results easy to share.

Supported formats:

* ✅ Network map as PNG (1024 / 2048 / 4096 px)
* ✅ Network map as SVG (vector)
* ❌ CSV
* ❌ JSON (scan results)
* ❌ XML
* ❌ HTML
* ❌ Markdown
* ❌ PDF reports

Allow users to export:

* ✅ Network map (current topology)
* ❌ Complete scan results
* ❌ Selected devices
* ❌ Port information
* ❌ Device history
* ❌ Network summaries

### 💾 Backup & Restore

Move your data between machines, or keep a safety copy.

* ✅ Full data backup (single JSON file with app settings, device profiles, map topology, the known-device ledger and scan history)
* ✅ Full data restore (replaces every local store; accepts legacy map-only backups too)
* ✅ Map-only backup/restore (from the Network Map screen)
* ✅ Versioned backup format (future format changes are detected cleanly, not misinterpreted)

### 🔍 Powerful Search & Filtering

Quickly find exactly what you're looking for.

Search by:

* ✅ IP address
* ✅ Hostname
* ✅ MAC address
* ✅ Vendor
* ❌ Port
* ❌ Service
* ✅ Device type
* ✅ Tags
* ✅ Status

Advanced filters could support queries such as:

```text
status:online
port:443
vendor:Apple
ip:192.168.1.*
```

### ⭐ Favorites & Device Profiles

Allow users to build their own network inventory.

* ✅ Favorite devices
* ✅ Custom names
* ✅ Notes
* ✅ Tags
* ❌ Device icons
* 🟡 Static metadata (name, notes, tags, favorite)
* ❌ Custom groups
* 🟡 Known-device database (profiles persist per MAC across scans)

### 🔐 Privacy First

Glassy IP Scanner should be designed with privacy as a core principle.

* ✅ No mandatory account
* ✅ No cloud dependency for basic scanning
* ✅ No unnecessary telemetry
* ✅ Local-first architecture
* ✅ Network data stays on the user's machine by default
* ✅ Transparent permissions
* ✅ Open-source codebase

### ⚡ Performance

Designed to handle everything from a small home network to large enterprise subnets.

* ✅ Async/multi-threaded scanning
* ✅ Efficient socket management
* ✅ Configurable concurrency
* ✅ Low memory usage
* ✅ Streaming scan results
* ✅ Responsive UI during large scans
* 🟡 Intelligent rate limiting (concurrency limits only)

### 🎨 Modern Interface

A polished interface can be one of Glassy's biggest advantages.

* ✅ Clean modern UI
* ✅ Light and dark themes
* ❌ Customizable columns
* ✅ Responsive tables
* ✅ Sortable results
* ❌ Keyboard shortcuts
* ❌ Context menus
* ❌ Device icons
* 🟡 Smooth animations (CSS transitions)
* 🟡 Accessible color schemes

---

# 🚀 Planned Features

> **Checkbox icons:** `[x]` fully implemented · `[~]` partially implemented · `[ ]` not implemented yet

### Phase 1 — Core Scanner

* [x] Local network detection
* [x] IPv4 scanning
* [x] ICMP discovery
* [x] ARP discovery
* [x] Hostname resolution
* [x] MAC address detection
* [x] MAC vendor lookup
* [x] Multi-threaded scanning
* [x] Scan cancellation
* [x] Real-time results

### Phase 2 — Device Intelligence

* [x] Device type detection
* [x] Custom device names
* [x] Tags and favorites
* [x] Device notes
* [x] Service detection
* [x] Port scanning
* [x] Search and filtering

### Phase 3 — Network Management

* [x] Scan history
* [x] Scan comparison
* [x] Device monitoring
* [x] New-device detection
* [x] Online/offline alerts
* [x] Network dashboard
* [x] Network map

### Phase 4 — Advanced Networking

* [ ] IPv6 support
* [ ] UDP scanning
* [~] SNMP discovery (switch MAC-table discovery over SNMPv2c for map topology)
* [~] mDNS discovery (hostname resolution only)
* [~] NetBIOS discovery (hostname resolution only)
* [ ] OS fingerprinting
* [ ] Service fingerprinting
* [ ] Custom discovery plugins

### Phase 5 — Power User Features

* [ ] Scheduled scans
* [ ] Advanced filtering
* [ ] Custom scan profiles
* [ ] API
* [ ] Webhooks
* [ ] Automation
* [ ] CLI
* [ ] Remote scanning
* [ ] Multiple network profiles

---

# 🎯 What Makes Glassy Different?

Glassy IP Scanner isn't intended to be just another ping scanner.

The goal is to combine the simplicity of traditional IP scanners with the capabilities users expect from modern network-management software.

### Glassy should be:

**Fast**
Scan thousands of addresses without making the application feel sluggish.

**Simple**
A beginner should be able to open the application and immediately discover their network.

**Powerful**
Advanced users should have control over discovery methods, ports, protocols, filters, and scan profiles.

**Beautiful**
Network tools don't have to look like they were designed twenty years ago.

**Private**
Network information should remain under the user's control.

**Open**
The project should be transparent, extensible, and community-driven.

---

## 🛠️ Built for Everyone

Glassy IP Scanner can be useful for:

* 🏠 Home users
* 🧑‍💻 Developers
* 🔧 IT technicians
* 🖥️ System administrators
* 🌐 Network administrators
* 🔐 Security professionals
* 🏢 Small businesses
* 🎓 Students and educators

---

## ⚠️ Responsible Use

Glassy IP Scanner is intended for network discovery and administration on networks you own or are authorized to test.

Users are responsible for complying with applicable laws, organizational policies, and network-access rules.

---

## 📌 Project Goals

The long-term goal of Glassy IP Scanner is to become a **modern, open-source network discovery and monitoring platform** that is:

> **Fast enough for professionals.
> Simple enough for everyone.
> Beautiful enough to enjoy using.**

Contributions, feature requests, bug reports, and ideas are welcome.

⭐ If Glassy IP Scanner is useful to you, consider starring the repository and sharing it with others.
