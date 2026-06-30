import { execa } from "execa"

export type Device = {
  mac: string
  name: string
  connected: boolean
}

type BlueutilJsonEntry = {
  address: string
  name?: string
  connected: boolean
}

const dedupeByMac = (devices: Device[]): Device[] => {
  const byMac = new Map<string, Device>()
  for (const d of devices) {
    const existing = byMac.get(d.mac)
    if (!existing) {
      byMac.set(d.mac, d)
      continue
    }
    byMac.set(d.mac, {
      mac: d.mac,
      name: existing.name !== existing.mac ? existing.name : d.name,
      connected: existing.connected || d.connected,
    })
  }
  return [...byMac.values()]
}

const toDevice = (d: BlueutilJsonEntry, connected: boolean): Device => {
  const mac = d.address.replace(/-/g, ":")
  return { mac, name: d.name ?? mac, connected }
}

export const listPaired = async (): Promise<Device[]> => {
  const { stdout } = await execa("blueutil", ["--paired", "--format", "json"])
  const raw = JSON.parse(stdout) as BlueutilJsonEntry[]
  return dedupeByMac(raw.map((d) => toDevice(d, d.connected)))
}

export const runInquiry = async (seconds = 5): Promise<Device[]> => {
  const { stdout } = await execa("blueutil", [
    "--inquiry",
    String(seconds),
    "--format",
    "json",
  ])
  if (!stdout.trim()) return []
  const raw = JSON.parse(stdout) as BlueutilJsonEntry[]
  return raw.map((d) => toDevice(d, false))
}

export const isPaired = async (mac: string): Promise<boolean> => {
  const { stdout } = await execa(
    "blueutil",
    ["--info", mac, "--format", "json"],
    {
      reject: false,
    },
  )
  try {
    return (JSON.parse(stdout) as { paired?: boolean }).paired === true
  } catch {
    return false
  }
}

export const isConnected = async (mac: string): Promise<boolean> => {
  const { stdout } = await execa("blueutil", ["--is-connected", mac], {
    reject: false,
  })
  return stdout.trim() === "1"
}

export const connect = async (mac: string): Promise<void> => {
  await execa("blueutil", ["--connect", mac])
}

export const forget = async (mac: string): Promise<void> => {
  await execa("blueutil", ["--unpair", mac])
}

type ProgressCallback = (message: string) => void

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export const pairFlow = async (
  mac: string,
  onProgress: ProgressCallback = () => {},
  maxAttempts = 3,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress(
      `Scanning for devices (5s)... (attempt ${attempt}/${maxAttempts})`,
    )
    await execa("blueutil", ["--inquiry", "5"])
    onProgress("Sending pair request...")
    await execa("blueutil", ["--pair", mac], { reject: false })
    await sleep(1000)
    await execa("blueutil", ["--connect", mac], { reject: false })
    onProgress("Verifying connection...")
    if (await isConnected(mac)) return true
    onProgress("Device not detected.")
    if (attempt < maxAttempts) {
      onProgress("Retrying in 2s...")
      await sleep(2000)
    }
  }
  return false
}
