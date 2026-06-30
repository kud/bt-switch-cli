import chalk from "chalk"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const INTERVAL_MS = 80

const HIDE_CURSOR = "[?25l"
const SHOW_CURSOR = "[?25h"
const CLEAR_LINE = "\r[K"

// Runs an async task while animating a spinner next to `label`.
// Falls back to a plain line when stdout is not a TTY (piped / CI),
// so logs stay clean and free of escape codes.
export const withSpinner = async <T>(
  label: string,
  task: () => Promise<T>,
): Promise<T> => {
  if (!process.stdout.isTTY) {
    process.stdout.write(chalk.dim(`${label}\n`))
    return task()
  }

  let frame = 0
  process.stdout.write(HIDE_CURSOR)
  const timer = setInterval(() => {
    frame = (frame + 1) % FRAMES.length
    process.stdout.write(`\r${chalk.cyan(FRAMES[frame])} ${chalk.dim(label)}`)
  }, INTERVAL_MS)

  try {
    return await task()
  } finally {
    clearInterval(timer)
    process.stdout.write(CLEAR_LINE + SHOW_CURSOR)
  }
}
