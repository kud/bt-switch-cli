import { defineCommand } from "citty"
import { render } from "ink"
import React from "react"
import { AddApp } from "../components/add-app.js"

export const add = defineCommand({
  meta: {
    name: "add",
    description:
      "Interactively discover and register Bluetooth devices by name",
  },
  run: async () => {
    const { waitUntilExit } = render(<AddApp />)
    await waitUntilExit()
  },
})
