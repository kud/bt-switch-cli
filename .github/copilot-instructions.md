# GitHub Copilot Instructions — bt-switch-cli

## Project context

`@kud/bt-switch-cli` is a macOS Bluetooth handoff CLI written in TypeScript (ESM only).
It switches Magic peripherals between Macs by name.

Stack: **citty** (command routing) · **ink + react** (interactive `add` TUI) · **execa** (shells out to the `blueutil` binary) · **chalk** (non-interactive output colouring).

Architecture layers:

- `src/lib/` — surface-agnostic logic. `blueutil.ts` wraps every `blueutil` invocation; `config.ts` manages the XDG-aware JSON store at `~/.config/bt-switch/devices.json`. These two files are the extraction boundary for a future `@kud/bt-switch` core package — keep them free of CLI / Ink / chalk concerns.
- `src/commands/` — thin citty command definitions. Each file exports one `defineCommand` object; heavy logic belongs in `src/lib/`, not here.
- `src/components/` — Ink/React components. Only the interactive `add` flow lives here; non-interactive commands stay chalk-only.
- `src/index.tsx` — entrypoint, registers subcommands and prints usage when called bare.

---

## Content rules

### Architecture

- `src/lib/` must stay surface-agnostic. Flag any import of `ink`, `chalk`, `citty`, `process.stdout`, or `process.stderr` appearing inside `src/lib/`.
- Commands must not call `blueutil` directly via execa. All `blueutil` interactions must go through `src/lib/blueutil.ts`.
- Config reads and writes must go through `src/lib/config.ts`. Flag any direct `fs` calls outside that file.

### TypeScript / ESM

- ESM only. Flag any `require()`, `module.exports`, or CommonJS patterns.
- All intra-package imports must use the `.js` extension (e.g. `../lib/blueutil.js`). Flag imports that use `.ts` or no extension.
- Arrow functions only. Flag `function` declarations (top-level or assigned).
- No classes. Flag `class` definitions; use plain functions and module-level exports instead.
- Prefer `const` over `let`. Flag `let` when a `const` + ternary or extracted `const` would be clearer.
- All dependencies must be exact-pinned in `package.json` (no `^` or `~`). Flag range specifiers on any new dependency.

### State (Ink component)

- `State` in `add-app.tsx` is a discriminated union on `phase`. Flag any attempt to replace this with a bag of optional fields or multiple boolean flags.
- Full state replacement only. Flag partial `setState` calls that mutate nested fields without spreading the rest of the state.
- `useCallback` required for handlers passed as `useEffect` dependencies. Flag handlers defined inline inside a `useEffect` dependency array when they trigger re-renders.

### Error handling

- Non-interactive commands: errors go to `process.stderr` with `chalk.red(...)`, then `process.exit(1)`. Flag errors printed to stdout or swallowed silently.
- Error messages must include a remediation hint (e.g. `"Run \`bt-switch add\` to register it."`). Flag bare error messages that leave the user without a next step.
- Execa calls that may legitimately fail must pass `{ reject: false }`. Flag calls that will throw on non-zero exit when failure is expected and handled.

### Output

- Non-interactive commands use `process.stdout.write()`, not `console.log`. This keeps trailing newlines explicit. Flag `console.log` / `console.error` in command files.
- Ink components own all interactive output. Flag any chalk or `process.stdout.write` inside `src/components/`.

### Naming

- File and folder names: kebab-case. Flag camelCase or PascalCase filenames.
- When a `blueutil` or `config` export name conflicts with a local variable, use an alias at the import site (e.g. `forget as bluetoothForget`). Flag shadowing without an alias.

---

## Suppression rules

Do not comment on the following — they are intentional:

- `waitForEnter` using a raw `readline.Interface` instead of a prompt library. This keeps the dependency tree minimal.
- `process.stdout.write` instead of `console.log`. Deliberate format control.
- Synchronous `fs.readFileSync` in `src/lib/config.ts`. Config is small and CLI startup latency is not a concern.
- The `dedupeByMac` loop in `blueutil.ts` using a `for...of` instead of `reduce`. Explicit loops are preferred over clever reducers here.
- The `slug`-based default name generated from a device's Bluetooth advertised name (e.g. splitting on `·`). The format is dictated by Apple's naming convention for Magic peripherals.
- `setTimeout(() => exit(), 100)` in `add-app.tsx` after `done` / `error` phases. The delay is required for Ink to flush its final render before the process exits.
- `ls` aliased to `list` in `src/index.tsx`. Intentional UX shortcut — not a duplication error.

---

## Review Format

Every Copilot review comment must follow this structure exactly:

```
<risk-label>: <one-line summary of the issue>

<motivation sentence — why this matters specifically in this codebase, not a generic rule citation>

<concrete suggestion — what to change or add, not just what is wrong>
```

### Risk labels

| Label       | Meaning                   | When to use                                                                                   |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `blocking:` | Must fix before merge     | Correctness bug, security issue, data integrity, broken ESM import, silent error swallow      |
| `concern:`  | Should fix, not a blocker | Reliability risk, lib/surface boundary leak, missing remediation hint, partial state mutation |
| `nitpick:`  | Optional improvement      | Naming, style, minor readability, preference                                                  |

### Examples

```
blocking: execa call in switch.ts will throw on non-zero exit but failure is expected here

The connect/forget flow legitimately receives non-zero exits when the device is out of range;
an unhandled throw will crash the process with an ugly stack trace instead of a clean error message.

Add `{ reject: false }` to this execa call and handle the non-zero case explicitly, as done in blueutil.ts line 57.
```

```
concern: chalk import inside src/lib/blueutil.ts leaks a CLI surface concern into the library layer

src/lib/ is the extraction boundary for a future @kud/bt-switch core package; chalk is a CLI-only
dependency and must not appear there.

Move the coloured output to the calling command, and have blueutil.ts return plain strings or throw
typed errors that the command layer can format.
```

```
nitpick: variable name `d` in the map callback is ambiguous given two device types in scope

Prefer `entry` or `raw` to distinguish the BlueutilJsonEntry shape from the Device type returned by toDevice.
```

### What not to flag

- Generic "this could throw" warnings with no specific error path identified.
- Comments that restate the TypeScript type already visible in the signature.
- Stylistic suggestions that conflict with items on the suppression list above.
