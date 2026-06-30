import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { readDevices, writeDevice, removeDevice, resolveMac } from "./config.js"

let tmp: string
const original = process.env["XDG_CONFIG_HOME"]

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bt-switch-test-"))
  process.env["XDG_CONFIG_HOME"] = tmp
})

afterEach(() => {
  if (original === undefined) delete process.env["XDG_CONFIG_HOME"]
  else process.env["XDG_CONFIG_HOME"] = original
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe("config store", () => {
  it("returns an empty map when nothing is written yet", () => {
    expect(readDevices()).toEqual({})
    expect(resolveMac("trackpad")).toBeUndefined()
  })

  it("round-trips a written device through resolveMac", () => {
    writeDevice("trackpad", "aa:bb:cc:dd:ee:ff")
    expect(resolveMac("trackpad")).toBe("aa:bb:cc:dd:ee:ff")
    expect(readDevices()).toEqual({ trackpad: "aa:bb:cc:dd:ee:ff" })
  })

  it("overwrites the mac when the same name is written again", () => {
    writeDevice("kbd", "aa:bb")
    writeDevice("kbd", "cc:dd")
    expect(resolveMac("kbd")).toBe("cc:dd")
  })

  it("removes a device without disturbing the others", () => {
    writeDevice("kbd", "aa:bb")
    writeDevice("trackpad", "cc:dd")
    removeDevice("kbd")
    expect(readDevices()).toEqual({ trackpad: "cc:dd" })
  })

  it("persists the store as indented JSON with a trailing newline", () => {
    writeDevice("kbd", "aa:bb")
    const raw = fs.readFileSync(
      path.join(tmp, "bt-switch", "devices.json"),
      "utf8",
    )
    expect(raw).toBe('{\n  "kbd": "aa:bb"\n}\n')
  })
})
