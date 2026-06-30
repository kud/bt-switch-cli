#!/usr/bin/env node
import { defineCommand, runMain } from "citty"
import { add } from "./commands/add.js"
import { connect } from "./commands/connect.js"
import { switchCmd } from "./commands/switch.js"
import { forget } from "./commands/forget.js"
import { list } from "./commands/list.js"

const NAME = "bt-switch"

const subCommands = {
  add,
  connect,
  switch: switchCmd,
  forget,
  list,
  ls: list,
}

runMain(
  defineCommand({
    meta: {
      name: NAME,
      description:
        "Bluetooth device handoff CLI — switch Magic peripherals between Macs by name",
    },
    subCommands,
    run: ({ rawArgs }) => {
      if (rawArgs.some((arg) => arg in subCommands)) return
      process.stdout.write(
        `Usage: ${NAME} <command>\nRun \`${NAME} --help\` to list commands.\n`,
      )
    },
  }),
)
