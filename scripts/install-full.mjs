#!/usr/bin/env node
/**
 * Full offline installer for openrtk.
 *
 * Run from the extracted full package (double-click install.cmd on Windows, or
 * `node scripts/install-full.mjs`). The installer:
 *
 *   1. Copies the plugin into the global OpenCode plugin directory, where
 *      OpenCode discovers it automatically for every project.
 *   2. Copies the bundled rtk binary into `bin/` next to the plugin files.
 *   3. Adds that `bin/` directory to the user PATH, so `rtk` is available in
 *      every shell.
 *
 * No downloads, no package manager, no admin rights: everything needed ships
 * inside this package.
 *
 * Override the OpenCode config directory with XDG_CONFIG_HOME or the
 * OPENCODE_CONFIG_DIR environment variable. Set OPENRTK_NO_PATH=1 to skip the
 * PATH update (used by tests).
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { copyFile, cp, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"
const exeName = isWindows ? "rtk.exe" : "rtk"

const configDir =
  process.env.OPENCODE_CONFIG_DIR ??
  (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode"))
const target = join(configDir, "plugins", "openrtk")
const targetBin = join(target, "bin")

/** Append `dir` to the persistent user PATH when it is not there yet. */
function addToUserPath(dir) {
  if (isWindows) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$dir = '${dir.replace(/'/g, "''")}'.TrimEnd('\\')`,
      "$cur = [Environment]::GetEnvironmentVariable('Path', 'User')",
      "if ([string]::IsNullOrEmpty($cur)) { $cur = '' }",
      "if ((($cur -split ';') | ForEach-Object { $_.TrimEnd('\\') }) -notcontains $dir) {",
      "  [Environment]::SetEnvironmentVariable('Path', ($cur.TrimEnd(';') + ';' + $dir).TrimStart(';'), 'User')",
      "  Write-Output 'added'",
      "} else { Write-Output 'present' }",
    ].join("\n")
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`could not update user PATH: ${result.stderr || result.stdout}`)
    return result.stdout.trim()
  }

  const profile = join(homedir(), ".profile")
  const line = `export PATH="${dir}:$PATH"`
  const current = existsSync(profile) ? readFileSync(profile, "utf8") : ""
  if (current.includes(line)) return "present"
  const sep = current === "" ? "" : current.endsWith("\n") ? "\n" : "\n\n"
  writeFileSync(profile, `${current}${sep}# added by openrtk installer\n${line}\n`)
  return "added"
}

// 1. Plugin files.
await mkdir(targetBin, { recursive: true })
for (const entry of ["index.ts", "src", "package.json", "opencode.md", "rtk-version.txt"]) {
  const source = join(root, entry)
  if (existsSync(source)) await cp(source, join(target, entry), { recursive: true })
}

// 2. Bundled rtk binary, kept next to the plugin so the plugin can fall back
// to it when PATH has not been refreshed in the current session.
const bundledRtk = join(root, "bin", exeName)
if (!existsSync(bundledRtk)) {
  console.error(`[openrtk] bundled rtk binary missing: ${bundledRtk}`)
  process.exit(1)
}
await copyFile(bundledRtk, join(targetBin, exeName))

// 3. User PATH.
let pathState = "skipped"
if (process.env.OPENRTK_NO_PATH !== "1") {
  try {
    pathState = addToUserPath(targetBin)
  } catch (error) {
    pathState = `failed (${error instanceof Error ? error.message : String(error)})`
  }
}

// 4. Verify.
const installedRtk = join(targetBin, exeName)
const version = spawnSync(installedRtk, ["--version"], { encoding: "utf8" })
const versionText = version.status === 0 ? version.stdout.trim() : "unknown"

console.log(`openrtk installed to ${target}`)
console.log(`bundled rtk installed to ${installedRtk} (${versionText})`)
console.log(`user PATH: ${pathState}`)
console.log("Open a new terminal for the PATH change to take effect.")
console.log("Restart OpenCode, or run: opencode service restart")
