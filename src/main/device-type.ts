/**
 * Best-effort device type classification. Runs entirely offline on data already
 * collected for each host: the resolved hostname, the OUI vendor and whether the
 * address is the default gateway. Hostname hints win because they are
 * unambiguous ("PS5", "Samsung TV", "DESKTOP-ABC"), then vendor fingerprints,
 * then the gateway heuristic, then "unknown".
 *
 * Hostnames arrive as full reverse-DNS names ("PS5-2681A0.fritz.box",
 * "DESKTOP-I93POOA.lan"), so only the first label (before the first dot) is
 * used for matching. Matching the whole string would let the router's DNS
 * suffix (e.g. ".fritz.box") or a shared ".lan" domain leak into every rule.
 *
 * Vendor fingerprints are deliberately narrow: only brands whose products are
 * overwhelmingly networking gear are typed as routers. Consumer-electronics
 * vendors that make everything from laptops to phones to smart plugs (ASUS,
 * TP-Link, Huawei, ZTE, Samsung, LG, Apple…) are excluded from the router
 * bucket so a WiFi card, phone or plug is never mislabelled; those devices are
 * expected to be caught by their hostname instead. Plain "Microsoft" is typed
 * as server because it is the OUI of Hyper-V virtual NICs; Xbox consoles are
 * caught by their hostname ("XBOX", "XboxOne", …) before that.
 */

import type { DeviceTypeId } from '../shared/types'

export interface DeviceTypeInput {
  hostname: string | null
  vendor: string | null
  isGateway: boolean
}

type Rule = { type: DeviceTypeId; re: RegExp }

/**
 * Hostname rules, checked in order. Patterns key off real device naming
 * conventions (Windows "DESKTOP-", iPhones, Samsung model prefixes like
 * "SM-G", game consoles, "BRAVIA", "NAS-…") instead of loose substrings that
 * would misfire. Network switches come first (before the router rule, which
 * also contains brands like "netgear") so a "netgear-switch" or "unifi-switch"
 * is never read as a router, and before the console rule so a "unifi-switch"
 * is never read as a game console, while a bare "switch" (Nintendo Switch)
 * still resolves to console.
 */
const HOSTNAME_RULES: Rule[] = [
  { type: 'switch', re: /(unifi-switch|unifi[_ -]?switch|poe-switch|netgear-switch|^switch\d|^es[-_.]?\d|^gs\d)/i },
  { type: 'router', re: /(fritz|router|gateway|modem|repeater|extender|wrt\d+|openwrt|totolink|tplinkrouter|tplinkwifi|netgear|d-link|linksys|^asus[-_.]|rt-ac\d|rt-n\d)/i },
  { type: 'printer', re: /(printer|print[-_. ]?server|inkjet|laserjet|deskjet|officejet|photosmart|\bbrother\b|\bcanon\b|\bepson\b|\bhp-)/i },
  { type: 'camera', re: /(camera|cctv|\bdvr\b|\bnvr\b|ipcam|cam[-_. ]?\d|hikvision|reolink|amcrest|wyze|nest[-_. ]cam|axis-)/i },
  { type: 'nas', re: /(nas|synology|qnap|wdmycloud|mycloud|ready.?nas|\bstorage\b|diskstation|fileserver|file[-_. ]?server)/i },
  { type: 'server', re: /(server|proxmox|esxi|unraid|vcenter|docker|kube|hyper-?v|dedicated|mail[-_. ]|dns[-_. ]|web[-_. ]|adguard|\b3cx\b|\bpbx\b|hv[-_. ]\d)/i },
  { type: 'rpi', re: /(raspberry|raspberri|rpi|^pi[0-9][-_.]|^pigpio)/i },
  { type: 'console', re: /(xbox|playstation|\bps\d\b|\bns-|nintendo|steamdeck|\bswitch\b)/i },
  { type: 'tv', re: /(samsung[ _-]?tv|lg[ _-]?tv|hisense|bravia|\btv[-_. ]?\d|roku|firetv|fire-tv|chromecast|androidtv|android-tv|smarttv|\btelly\b|appletv|apple-tv)/i },
  { type: 'speaker', re: /(\becho\b|alexa|homepod|sonos|googlehome|google-home|nest[-_. ]?(mini|audio|hub|display)|soundbar)/i },
  { type: 'phone', re: /(^sm-[gjnmafs]\d|^gt-i|^pixel[- ]|^nexus|iphone|^android[-_]|galaxy[ _-]?[a-z]|redmi|poco|honor|huawei|oneplus|oppo|vivo)/i },
  { type: 'tablet', re: /(ipad|^sm-[tx]\d|tab-s\d|tab-a\d|tabpro|fire[-_. ]?(tablet|hd|\d)|^fire$|kindle|galaxy[ _-]?tab|matepad|surface-pro)/i },
  { type: 'laptop', re: /(laptop|latitude|inspiron|thinkpad|\bxps[- ]|macbook|surface-laptop|surface-[a-z0-9]|elitebook|probook|zenbook|vivobook)/i },
  { type: 'computer', re: /(desktop|^desktop-|^pc[-_.]|\bmsi\b|gaming[-_. ]?pc|workstation|mini[-_. ]?pc|intel-nuc|macmini|\bimac\b|mac-pro|\bwks\b)/i },
  { type: 'smart-device', re: /(thermostat|ecobee|nest[-_. ]|^nest$|plug|bulb|smartplug|smart[-_. ]?(plug|bulb|switch|home)|irrigat|sprinkler|vacuum|robot|sensor|hub-|bridge|\badapter\b|kasa)/i }
]

/**
 * Vendor (OUI) rules, checked after hostnames. Only unambiguous single-purpose
 * vendors are typed precisely; multi-category brands (ASUS, Huawei, ZTE,
 * TP-Link, Samsung, LG, Apple…) are left to the generic buckets or untyped so
 * the "router" label is reserved for dedicated networking vendors. Sony is
 * treated as console here because almost every modern Sony OUI in the database
 * is a PlayStation ("Sony Interactive Entertainment", "Sony Computer
 * Entertainment" or plain "Sony" on older consoles), and TVs reliably announce
 * themselves via hostname ("BRAVIA", "Samsung TV") before this stage runs.
 */
const VENDOR_RULES: Rule[] = [
  { type: 'router', re: /avm|fritz|netgear|d-link|dlink|linksys|ubiquiti|mikrotik|zyxel|greenwave|eero|arcadyan|tenda|totolink/ },
  { type: 'printer', re: /hewlett|brother|lexmark|xerox|ricoh|kyocera|zebra technologies|\bhp\b|canon|epson/ },
  { type: 'nas', re: /synology|qnap|western digital|seagate|drobo/ },
  { type: 'camera', re: /hikvision|amcrest|dahua|reolink|axis communications|wyze|swann/ },
  { type: 'switch', re: /cisco|arista|juniper|extreme networks|brocade/ },
  { type: 'tv', re: /roku|hisense|tcl|vizio|sony visual|bravia|lg electronics/ },
  { type: 'console', re: /sony|nintendo|valve/ },
  { type: 'rpi', re: /raspberry/ },
  { type: 'server', re: /vmware|qemu|parallels|virtualbox|oracle|supermicro|dell|hewlett.?packard enterprise|microsoft/ },
  { type: 'speaker', re: /sonos|amazon technologies|google|harman/ },
  { type: 'smart-device', re: /signify|philips|hue|ikea|tuya|espressif|silicon labs|silabs|texas instruments|garmin|fitbit|samsung|lg/ },
  { type: 'computer', re: /intel|lenovo|msi|gigabyte|acer|medion|frameworx|apple/ },
  { type: 'phone', re: /xiaomi|motorola|oneplus|htc|oppo|vivo|huawei|zte|honor|realme|iqoo|meizu|infinix|tecno|poco|blackview|alcatel|nokia/ }
]

/**
 * Classifies a host. Order matters: hostname patterns are the most reliable
 * signal, then vendor fingerprints, then the default-gateway heuristic, with
 * "unknown" as the fallback.
 */
export function detectDeviceType(input: DeviceTypeInput): DeviceTypeId {
  // Reverse-DNS returns FQDNs ("PS5-2681A0.fritz.box"). Only the first label
  // is the device's own name; the domain suffix is the router's and must not
  // feed the rules (e.g. "fritz" in ".fritz.box" must not mean "router").
  const hostname = (input.hostname?.toLowerCase() ?? '').split('.')[0]
  const vendor = input.vendor?.toLowerCase() ?? ''
  for (const rule of HOSTNAME_RULES) {
    if (rule.re.test(hostname)) return rule.type
  }
  for (const rule of VENDOR_RULES) {
    if (rule.re.test(vendor)) return rule.type
  }
  if (input.isGateway) return 'router'
  return 'unknown'
}
