import { defineCommand } from "citty"
import chalk from "chalk"
import readline from "node:readline"
import {
  isPaired,
  connect as bluetoothConnect,
  pairFlow,
} from "../lib/blueutil.js"
import { resolveMac } from "../lib/config.js"
import { withSpinner } from "../spinner.js"

const waitForEnter = () =>
  new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question("", () => {
      rl.close()
      resolve()
    })
  })

export const connect = defineCommand({
  meta: {
    name: "connect",
    description:
      "Connect a registered device (skips pairing if already bonded)",
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

    const paired = await isPaired(mac)
    if (paired) {
      await withSpinner(`Reconnecting ${args.name}...`, () =>
        bluetoothConnect(mac),
      )
      process.stdout.write(chalk.green(`✓ ${args.name} connected.\n`))
      return
    }

    process.stdout.write(
      chalk.yellow(
        `Hold the power button on ${args.name} until the LED blinks rapidly.\n`,
      ),
    )
    process.stdout.write(chalk.dim("Press Enter when ready... "))
    await waitForEnter()

    const success = await pairFlow(mac, (msg) =>
      process.stdout.write(chalk.dim(msg) + "\n"),
    )

    if (success) {
      process.stdout.write(chalk.green(`✓ ${args.name} connected.\n`))
    } else {
      process.stderr.write(
        chalk.red(`error: failed to connect ${args.name} after 3 attempts.\n`),
      )
      process.exit(1)
    }
  },
})
