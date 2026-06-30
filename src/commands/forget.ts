import { defineCommand } from "citty"
import chalk from "chalk"
import { forget as bluetoothForget, isConnected } from "../lib/blueutil.js"
import { resolveMac } from "../lib/config.js"

export const forget = defineCommand({
  meta: {
    name: "forget",
    description: "Unpair a device so another Mac can claim it",
  },
  args: {
    name: {
      type: "positional",
      required: true,
      description: "Device name from config",
    },
  },
  run: async ({ args }) => {
    const mac = resolveMac(args.name)
    if (!mac) {
      process.stderr.write(
        chalk.red(
          `error: "${args.name}" not found in config. Run \`bt-switch add\` to register it.\n`,
        ),
      )
      process.exit(1)
    }

    const connected = await isConnected(mac)
    if (connected) {
      process.stdout.write(
        chalk.dim(`${args.name} is currently connected — unpairing...\n`),
      )
    } else {
      process.stdout.write(
        chalk.dim(`${args.name} is not connected — unpairing anyway...\n`),
      )
    }

    await bluetoothForget(mac)
    process.stdout.write(
      chalk.green(`✓ ${args.name} unpaired. Another Mac can now claim it.\n`),
    )
  },
})
