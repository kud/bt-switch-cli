import React, { useState, useEffect, useCallback } from "react"
import { Box, Text, useInput, useApp } from "ink"
import Spinner from "ink-spinner"
import { listPaired, runInquiry, type Device } from "../lib/blueutil.js"
import { writeDevice, readDevices } from "../lib/config.js"

type State =
  | { phase: "scanning" }
  | { phase: "ask-inquiry"; paired: Device[] }
  | { phase: "inquiring"; paired: Device[] }
  | {
      phase: "selecting"
      devices: Device[]
      cursor: number
      selected: Set<string>
    }
  | {
      phase: "naming"
      queue: Device[]
      named: Array<{ name: string; mac: string }>
      input: string
    }
  | { phase: "done"; count: number }
  | { phase: "error"; message: string }

const mergeDevices = (a: Device[], b: Device[]): Device[] => {
  const seen = new Set(a.map((d) => d.mac))
  return [...a, ...b.filter((d) => !seen.has(d.mac))]
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const defaultName = (deviceName: string): string => {
  const parts = deviceName.split("·").map((p) => p.trim())
  const candidate = parts.length > 1 ? (parts[1] ?? "") : deviceName
  return slugify(candidate) || slugify(deviceName)
}

const uniqueName = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export const AddApp = () => {
  const { exit } = useApp()
  const [state, setState] = useState<State>({ phase: "scanning" })

  useEffect(() => {
    if (state.phase !== "scanning") return
    listPaired()
      .then((paired) => setState({ phase: "ask-inquiry", paired }))
      .catch((err: unknown) =>
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      )
  }, [state.phase])

  const startSelecting = useCallback((devices: Device[]) => {
    const existing = readDevices()
    const withStatus = devices.map((d) => ({
      ...d,
      name: d.name,
      alreadySaved: Object.values(existing).includes(d.mac),
    }))
    if (withStatus.length === 0) {
      setState({ phase: "done", count: 0 })
      return
    }
    setState({
      phase: "selecting",
      devices: withStatus,
      cursor: 0,
      selected: new Set(),
    })
  }, [])

  useInput(
    (input, key) => {
      if (state.phase === "ask-inquiry") {
        if (input === "y" || input === "Y") {
          setState({ phase: "inquiring", paired: state.paired })
        } else if (input === "n" || input === "N") {
          startSelecting(state.paired)
        }
        return
      }

      if (state.phase === "selecting") {
        const { devices, cursor, selected } = state
        if (key.upArrow) {
          setState({ ...state, cursor: Math.max(0, cursor - 1) })
        } else if (key.downArrow) {
          setState({
            ...state,
            cursor: Math.min(devices.length - 1, cursor + 1),
          })
        } else if (input === " ") {
          const mac = devices[cursor]?.mac
          if (!mac) return
          const next = new Set(selected)
          if (next.has(mac)) next.delete(mac)
          else next.add(mac)
          setState({ ...state, selected: next })
        } else if (key.return) {
          const queue = devices.filter((d) => selected.has(d.mac))
          if (queue.length === 0) {
            setState({ phase: "done", count: 0 })
            return
          }
          setState({
            phase: "naming",
            queue,
            named: [],
            input: defaultName(queue[0]?.name ?? ""),
          })
        } else if (key.escape) {
          exit()
        }
        return
      }

      if (state.phase === "naming") {
        const { queue, named, input: currentInput } = state
        const advance = (collected: Array<{ name: string; mac: string }>) => {
          const nextQueue = queue.slice(1)
          if (nextQueue.length === 0) {
            collected.forEach(({ name, mac }) => writeDevice(name, mac))
            setState({ phase: "done", count: collected.length })
          } else {
            setState({
              phase: "naming",
              queue: nextQueue,
              named: collected,
              input: defaultName(nextQueue[0]?.name ?? ""),
            })
          }
        }
        const submit = (value: string) => {
          const trimmed = value.trim()
          const current = queue[0]
          if (!trimmed || !current) return
          const taken = new Set([
            ...Object.keys(readDevices()),
            ...named.map((n) => n.name),
          ])
          advance([
            ...named,
            { name: uniqueName(trimmed, taken), mac: current.mac },
          ])
        }
        if (key.escape) {
          named.forEach(({ name, mac }) => writeDevice(name, mac))
          setState({ phase: "done", count: named.length })
        } else if (key.backspace || key.delete) {
          setState({ ...state, input: currentInput.slice(0, -1) })
        } else if (key.return || /[\r\n]/.test(input)) {
          submit(currentInput + input.replace(/[\r\n]/g, ""))
        } else if (!key.ctrl && !key.meta && input) {
          setState({ ...state, input: currentInput + input })
        }
        return
      }
    },
    {
      isActive:
        state.phase === "ask-inquiry" ||
        state.phase === "selecting" ||
        state.phase === "naming",
    },
  )

  useEffect(() => {
    if (state.phase === "inquiring") {
      runInquiry(5)
        .then((found) => {
          const merged = mergeDevices(state.paired, found)
          startSelecting(merged)
        })
        .catch((err: unknown) =>
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        )
    }
  }, [
    state.phase,
    state.phase === "inquiring" ? state.paired : null,
    startSelecting,
  ])

  useEffect(() => {
    if (state.phase === "done" || state.phase === "error") {
      setTimeout(() => exit(), 100)
    }
  }, [state.phase, exit])

  if (state.phase === "scanning") {
    return (
      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> Scanning paired devices...</Text>
      </Box>
    )
  }

  if (state.phase === "ask-inquiry") {
    return (
      <Box flexDirection="column">
        <Text>
          Found <Text color="cyan">{state.paired.length}</Text> paired device
          {state.paired.length !== 1 ? "s" : ""}.
        </Text>
        <Text>
          Scan for nearby unpaired devices too? <Text dimColor>(y/n)</Text>
        </Text>
      </Box>
    )
  }

  if (state.phase === "inquiring") {
    return (
      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> Discovering nearby devices (5s)...</Text>
      </Box>
    )
  }

  if (state.phase === "selecting") {
    const { devices, cursor, selected } = state
    return (
      <Box flexDirection="column">
        <Text bold>Select devices to register:</Text>
        <Text dimColor>
          ↑↓ navigate · space toggle · enter confirm · esc cancel
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {devices.map((d, i) => {
            const isSelected = selected.has(d.mac)
            const isCursor = i === cursor
            return (
              <Box key={d.mac}>
                <Text color={isCursor ? "cyan" : undefined}>
                  {isSelected ? "[x] " : "[ ] "}
                  {d.name}
                  <Text dimColor> {d.mac}</Text>
                </Text>
              </Box>
            )
          })}
        </Box>
        {selected.size > 0 && (
          <Box marginTop={1}>
            <Text dimColor>{selected.size} selected</Text>
          </Box>
        )}
      </Box>
    )
  }

  if (state.phase === "naming") {
    const current = state.queue[0]
    const total = state.named.length + state.queue.length
    const position = state.named.length + 1
    return (
      <Box flexDirection="column">
        <Text dimColor>
          Naming {position} of {total} · ↵ accept · type to rename · esc skip
        </Text>
        <Text dimColor>
          {current?.name ?? current?.mac} ({current?.mac})
        </Text>
        <Box>
          <Text>Name: </Text>
          <Text color="green">{state.input}</Text>
          <Text color="cyan">▌</Text>
        </Box>
        {state.named.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {state.named.map(({ name, mac }) => (
              <Text key={mac} dimColor>
                ✓ {name} → {mac}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  if (state.phase === "done") {
    return state.count === 0 ? (
      <Text dimColor>No devices selected.</Text>
    ) : (
      <Text color="green">
        ✓ Saved {state.count} device{state.count !== 1 ? "s" : ""} to config.
      </Text>
    )
  }

  if (state.phase === "error") {
    return <Text color="red">error: {state.message}</Text>
  }

  return null
}
