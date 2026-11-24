#!/usr/bin/env node
// React reads NODE_ENV when first loaded, so set it before importing the app.
// An explicit NODE_ENV (e.g. development) is honoured.
process.env.NODE_ENV ??= "production"

await import("./cli.js")

export {}
