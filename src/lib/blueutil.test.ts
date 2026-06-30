import { describe, it, expect } from "vitest"
import { toDevice, dedupeByMac, type Device } from "./blueutil.js"

describe("toDevice", () => {
  it("normalises dash-separated addresses to colon form", () => {
    expect(
      toDevice({ address: "aa-bb-cc-dd-ee-ff", connected: false }, false),
    ).toEqual({
      mac: "aa:bb:cc:dd:ee:ff",
      name: "aa:bb:cc:dd:ee:ff",
      connected: false,
    })
  })

  it("falls back to the mac when no name is present", () => {
    const d = toDevice({ address: "aa:bb:cc:dd:ee:ff", connected: true }, true)
    expect(d.name).toBe("aa:bb:cc:dd:ee:ff")
  })

  it("uses the supplied connected flag, not the raw entry", () => {
    const d = toDevice(
      { address: "aa:bb", name: "Trackpad", connected: true },
      false,
    )
    expect(d).toEqual({ mac: "aa:bb", name: "Trackpad", connected: false })
  })
})

describe("dedupeByMac", () => {
  it("collapses duplicate macs into one entry", () => {
    const input: Device[] = [
      { mac: "aa:bb", name: "Trackpad", connected: false },
      { mac: "aa:bb", name: "Trackpad", connected: false },
    ]
    expect(dedupeByMac(input)).toHaveLength(1)
  })

  it("prefers a real name over a mac-as-name placeholder", () => {
    const input: Device[] = [
      { mac: "aa:bb", name: "aa:bb", connected: false },
      { mac: "aa:bb", name: "Magic Keyboard", connected: false },
    ]
    expect(dedupeByMac(input)[0]?.name).toBe("Magic Keyboard")
  })

  it("ORs the connected flag across duplicates", () => {
    const input: Device[] = [
      { mac: "aa:bb", name: "Trackpad", connected: false },
      { mac: "aa:bb", name: "Trackpad", connected: true },
    ]
    expect(dedupeByMac(input)[0]?.connected).toBe(true)
  })

  it("preserves distinct macs and their order", () => {
    const input: Device[] = [
      { mac: "aa:bb", name: "A", connected: false },
      { mac: "cc:dd", name: "B", connected: false },
    ]
    expect(dedupeByMac(input).map((d) => d.mac)).toEqual(["aa:bb", "cc:dd"])
  })
})
