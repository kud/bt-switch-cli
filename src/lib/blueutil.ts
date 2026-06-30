import { execa } from "execa"

type BlueutilOptions = { reject?: boolean }

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

const BLUEUTIL_MISSING =
  "blueutil not found. Install it with:\n\n  brew install blueutil\n"

const isEnoent = (value: unknown): boolean =>
  !!value &&
  typeof value === "object" &&
  (value as { code?: string }).code === "ENOENT"

const assertPlatform = (): void => {
  if (process.platform !== "darwin") {
    throw new Error(
      "bt-switch only runs on macOS — it drives the blueutil binary.",
    )
  }
}

const runBlueutil = async (args: string[], options?: BlueutilOptions) => {
  assertPlatform()
  try {
    const result = await execa("blueutil", args, options)
    if ((result as { failed?: boolean }).failed && isEnoent(result)) {
      throw new Error(BLUEUTIL_MISSING)
    }
    return result
  } catch (error) {
    if (isEnoent(error)) throw new Error(BLUEUTIL_MISSING, { cause: error })
    throw error
  }
}

export const dedupeByMac = (devices: Device[]): Device[] => {
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

export const toDevice = (d: BlueutilJsonEntry, connected: boolean): Device => {
  const mac = d.address.replace(/-/g, ":")
  return { mac, name: d.name ?? mac, connected }
}

export const listPaired = async (): Promise<Device[]> => {
  const { stdout } = await runBlueutil(["--paired", "--format", "json"])
  const raw = JSON.parse(stdout) as BlueutilJsonEntry[]
  return dedupeByMac(raw.map((d) => toDevice(d, d.connected)))
}

export const runInquiry = async (seconds = 5): Promise<Device[]> => {
  const { stdout } = await runBlueutil([
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
  const { stdout } = await runBlueutil(["--info", mac, "--format", "json"], {
    reject: false,
  })
  try {
    return (JSON.parse(stdout) as { paired?: boolean }).paired === true
  } catch {
    return false
  }
}

export const isConnected = async (mac: string): Promise<boolean> => {
  const { stdout } = await runBlueutil(["--is-connected", mac], {
    reject: false,
  })
  return stdout.trim() === "1"
}

export const connect = async (mac: string, timeout = 5): Promise<void> => {
  await runBlueutil(["--connect", mac, "--wait-connect", mac, String(timeout)])
}

export const disconnect = async (mac: string, timeout = 5): Promise<void> => {
  await runBlueutil([
    "--disconnect",
    mac,
    "--wait-disconnect",
    mac,
    String(timeout),
  ])
}

export const forget = async (mac: string): Promise<void> => {
  await runBlueutil(["--unpair", mac])
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
    await runBlueutil(["--inquiry", "5"])
    onProgress("Sending pair request...")
    await runBlueutil(["--pair", mac], { reject: false })
    await sleep(1000)
    await runBlueutil(["--connect", mac], { reject: false })
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
