import { defineCommand } from "citty"
import chalk from "chalk"
import { isPaired, isConnected } from "../lib/blueutil.js"
import { readDevices } from "../lib/config.js"

export const list = defineCommand({
  meta: {
    name: "list",
    description: "List registered devices with live paired/connected status",
  },
  run: async () => {
    const devices = readDevices()
    const entries = Object.entries(devices)

    if (entries.length === 0) {
      process.stdout.write(
        chalk.dim(
          "No devices registered. Run `bt-switch add` to register one.\n",
        ),
      )
      return
    }

    const nameWidth = Math.max(...entries.map(([n]) => n.length), 4)
    const macWidth = Math.max(...entries.map(([, m]) => m.length), 3)

    const header =
      chalk.bold("NAME".padEnd(nameWidth)) +
      "  " +
      chalk.bold("MAC".padEnd(macWidth)) +
      "  " +
      chalk.bold("PAIRED") +
      "  " +
      chalk.bold("CONNECTED")
    process.stdout.write(header + "\n")
    process.stdout.write(
      chalk.dim("─".repeat(header.replace(/\x1b\[[0-9;]*m/g, "").length)) +
        "\n",
    )

    await Promise.all(
      entries.map(async ([name, mac]) => {
        const [paired, connected] = await Promise.all([
          isPaired(mac),
          isConnected(mac),
        ])
        const pairedLabel = paired ? chalk.green("yes") : chalk.dim("no ")
        const connectedLabel = connected ? chalk.green("yes") : chalk.dim("no ")
        process.stdout.write(
          name.padEnd(nameWidth) +
            "  " +
            chalk.dim(mac.padEnd(macWidth)) +
            "  " +
            pairedLabel +
            "     " +
            connectedLabel +
            "\n",
        )
      }),
    )
  },
})
