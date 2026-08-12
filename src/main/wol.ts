/**
 * Wake-on-LAN support. Sends a UDP "magic packet" (6× 0xFF + the target MAC
 * repeated 16 times) to the LAN broadcast address, which wakes any device
 * that has WOL enabled. Only needs the device's MAC address — no credentials.
 */

import dgram from 'node:dgram'

/** Normalizes a MAC to uppercase, separator-free form (aa:bb:… → AABBCCDDEEFF). */
export function normalizeWolMac(mac: string): string {
  return mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/**
 * Sends a WOL magic packet for `mac` to the given broadcast address (default
 * 255.255.255.255, the limited broadcast that every LAN interface receives)
 * on the given port (default 9; 7 is the historic echo-day port some devices
 * also listen on). Resolves true when the packet was handed to the network.
 */
export function sendWakeOnLan(
  mac: string,
  options?: { broadcast?: string; port?: number }
): Promise<boolean> {
  return new Promise((resolve) => {
    const clean = normalizeWolMac(mac)
    if (clean.length !== 12) {
      resolve(false)
      return
    }

    const magic = Buffer.alloc(102)
    for (let i = 0; i < 6; i++) magic[i] = 0xff
    const macBuf = Buffer.from(clean, 'hex')
    for (let i = 6; i < magic.length; i++) magic[i] = macBuf[i % 6]

    const socket = dgram.createSocket('udp4')
    const finish = (ok: boolean): void => {
      try {
        socket.close()
      } catch {
        // ignore close errors
      }
      resolve(ok)
    }
    socket.on('error', () => finish(false))
    socket.on('listening', () => {
      try {
        socket.setBroadcast(true)
      } catch {
        // broadcast may be restricted; the send below reports the failure
      }
    })
    socket.send(
      magic,
      0,
      magic.length,
      options?.port ?? 9,
      options?.broadcast ?? '255.255.255.255',
      (err) => finish(!err)
    )
  })
}
