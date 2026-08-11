/**
 * Best-effort device type classification (Phase 2). Runs entirely offline on
 * data already collected for each host: the resolved hostname, the OUI vendor
 * and whether the address is the default gateway. Hostname hints win because
 * they are unambiguous ("PS5", "SamsungTV", "DESKTOP-ABC"), then vendor
 * fingerprints, then the gateway heuristic, then "unknown".
 */

import type { DeviceTypeId } from '../shared/types'

export interface DeviceTypeInput {
  hostname: string | null
  vendor: string | null
  isGateway: boolean
}

type Rule = { type: DeviceTypeId; re: RegExp }

/**
 * Hostname rules, checked in order. Patterns are conservative: they key off
 * real device naming conventions (Windows "DESKTOP-", iPhones, model prefixes
 * like "SM-G", "GT-I") instead of loose substrings that would misfire.
 */
const HOSTNAME_RULES: Rule[] = [
  { type: 'router', re: /(fritz|router|gateway|modem|repeater|extender|wrt\d+|openwrt|totolink|tplink|netgear|d-link|linksys)/i },
  { type: 'printer', re: /(printer|print[-_. ]?server|inkjet|laserjet|deskjet|officejet|photosmart|\bbrother\b|\bcanon\b|\bepson\b|\bhp-)/i },
  { type: 'camera', re: /(camera|cctv|\bdvr\b|\bnvr\b|ipcam|cam[-_. ]?\d|hikvision|reolink|amcrest|wyze|nest-cam|axis-)/i },
  { type: 'nas', re: /(nas|synology|qnap|wdmycloud|mycloud|ready.?nas|\bstorage\b|diskstation|fileserver|file[-_. ]?server)/i },
  { type: 'server', re: /(server|proxmox|esxi|unraid|vcenter|docker|kube|hyper-?v|dedicated|mail[-_. ]|dns[-_. ]|web[-_. ])/i },
  { type: 'rpi', re: /(raspberry|raspberri|rpi|^pi[0-9][-_.]|^pigpio)/i },
  { type: 'console', re: /(xbox|playstation|\bps[45]\b|\bps5\b|\bns-|nintendo|steamdeck)/i },
  { type: 'tv', re: /(samsungtv|lg[ _-]?tv|hisense|bravia|\btv[-_. ]?\d|roku|firetv|fire-tv|chromecast|androidtv|android-tv|smarttv|\btelly\b)/i },
  { type: 'speaker', re: /(\becho[-_. ]|alexa|homepod|sonos|googlehome|google-home|nest-mini|nest-audio|soundbar)/i },
  { type: 'phone', re: /(^sm-[gjsamn]|^gt-i|^pixel[- ]|^nexus|iphone|^android[-_]|galaxy[ _-]?[a-z]|redmi|poco|oneplus|oppo|vivo)/i },
  { type: 'tablet', re: /(ipad|tab-s\d|tab-a\d|tabpro|fire[-_. ]?tablet|kindle|galaxy[ _-]?tab|matepad|surface-pro)/i },
  { type: 'laptop', re: /(laptop|latitude|inspiron|thinkpad|\bxps[- ]|macbook|surface-laptop|surface-[a-z0-9]|elitebook|probook|zenbook|vivobook)/i },
  { type: 'computer', re: /(desktop|^desktop-|^pc[-_.]|\bmsi\b|gaming[-_. ]?pc|workstation|mini[-_. ]?pc|intel-nuc|macmini|\bimac\b|mac-pro)/i },
  { type: 'switch', re: /(unifi-switch|unifi[_ -]?switch|smart-switch|poe-switch|netgear-switch)/i },
  { type: 'smart-device', re: /(thermostat|ecobee|nest[-_. ]|plug|bulb|smartplug|smart[-_. ]?(plug|bulb|switch|home)|irrigat|sprinkler|vacuum|robot|sensor|hub-|bridge|\badapter\b)/i }
]

/**
 * Vendor (OUI) rules, checked after hostnames. Only unambiguous single-purpose
 * vendors are typed precisely; consumer-electronics brands are left to the
 * generic "smart-device" bucket when the hostname gives no clue.
 */
const VENDOR_RULES: Rule[] = [
  { type: 'router', re: /avm|fritz|tplink|tp-link|netgear|asustek|asus|d-link|dlink|linksys|ubiquiti|mikrotik|zyxel|greenwave|eero|arcadyan|huawei technologies|zte|tenda/ },
  { type: 'printer', re: /hewlett|brother|lexmark|xerox|ricoh|kyocera|zebra technologies|\bhp\b|canon|epson/ },
  { type: 'nas', re: /synology|qnap|western digital|seagate|drobo/ },
  { type: 'camera', re: /hikvision|amcrest|dahua|reolink|axis communications|wyze/ },
  { type: 'switch', re: /cisco|arista|juniper|extreme networks|netgear pro/ },
  { type: 'console', re: /sony interactive|nintendo|microsoft corp/ },
  { type: 'rpi', re: /raspberry/ },
  { type: 'server', re: /vmware|qemu|parallels|virtualbox|oracle|microsoft|supermicro|dell|hewlett.?packard enterprise/ },
  { type: 'tv', re: /roku|hisense|tcl|vizio/ },
  { type: 'speaker', re: /sonos|amazon technologies|google|harman/ },
  { type: 'smart-device', re: /signify|philips|hue|ikea|tuya|espressif|silicon labs|silabs|texas instruments|garmin|fitbit|samsung/ },
  { type: 'computer', re: /intel|lenovo|msi|gigabyte|acer|medion|frameworx|apple/ },
  { type: 'phone', re: /xiaomi|motorola|oneplus|htc|oppo|vivo|huawei/ }
]

/**
 * Classifies a host. Order matters: hostname patterns are the most reliable
 * signal, then vendor fingerprints, then the default-gateway heuristic, with
 * "unknown" as the fallback.
 */
export function detectDeviceType(input: DeviceTypeInput): DeviceTypeId {
  const hostname = input.hostname?.toLowerCase() ?? ''
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
