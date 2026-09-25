#!/usr/bin/env node
/**
 * Install openrtk into the global OpenCode plugin directory.
 *
 * Works from a repository checkout or from an extracted npm tarball. The
 * plugin has no runtime dependencies, so nothing is installed or compiled:
 * OpenCode loads `src/index.ts` directly.
 *
 * Usage:
 *   node scripts/install-local.mjs
 *
 * Override the OpenCode config directory with XDG_CONFIG_HOME or the
 * OPENCODE_CONFIG_DIR environment variable.
 */
import { cp, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const configDir =
  process.env.OPENCODE_CONFIG_DIR ??
  (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode"))
const target = join(configDir, "plugins", "openrtk")

await mkdir(target, { recursive: true })
for (const entry of ["index.ts", "src", "package.json", "opencode.md"]) {
  await cp(join(root, entry), join(target, entry), { recursive: true })
}

console.log(`openrtk installed to ${target}`)
console.log("Restart OpenCode, or run: opencode service restart")
