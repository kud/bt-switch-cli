import fs from "node:fs"
import path from "node:path"

const configDir = path.join(
  process.env["XDG_CONFIG_HOME"] ??
    path.join(process.env["HOME"] ?? "~", ".config"),
  "bt-switch",
)

const configPath = path.join(configDir, "devices.json")

type DeviceMap = Record<string, string>

export const readDevices = (): DeviceMap => {
  if (!fs.existsSync(configPath)) return {}
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as DeviceMap
}

const writeDevices = (devices: DeviceMap): void => {
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(devices, null, 2) + "\n")
}

export const writeDevice = (name: string, mac: string): void => {
  const devices = readDevices()
  devices[name] = mac
  writeDevices(devices)
}

export const removeDevice = (name: string): void => {
  const devices = readDevices()
  delete devices[name]
  writeDevices(devices)
}

export const resolveMac = (name: string): string | undefined =>
  readDevices()[name]
