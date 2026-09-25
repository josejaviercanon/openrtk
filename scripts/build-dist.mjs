#!/usr/bin/env node
/**
 * Build the full, self-contained package in dist/.
 *
 * Steps:
 *   1. Bundle the plugin to dist/openrtk.js with esbuild.
 *   2. Locate the rtk executable used on this machine and read its version.
 *   3. Stage dist/openrtk-full-<version>-rtk<rtk-version>-<platform>/ with the
 *      plugin sources, install scripts, the rtk binary and rtk-version.txt.
 *   4. Zip the staged directory.
 *   5. Build the plugin-only npm tarball (openrtk-<version>.tgz).
 *
 * The resulting zip installs on a clean machine without Cargo, npm install or
 * network access: extract it and run install.cmd (Windows).
 *
 * Run with: npm run dist
 */
import { spawnSync } from "node:child_process"
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const isWindows = process.platform === "win32"
const exeName = isWindows ? "rtk.exe" : "rtk"

/**
 * Run npm through the current Node executable when `npm run dist` started
 * this script (`npm_execpath`), so no shell or `.cmd` shim is needed.
 */
function runNpm(args, options = {}) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args], options)
  }
  return run(isWindows ? "npm.cmd" : "npm", args, { shell: isWindows, ...options })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    console.error(`[dist] command failed (status ${result.status}): ${command} ${args.join(" ")}`)
    process.exit(1)
  }
  return result
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options })
  if (result.error || result.status !== 0) return null
  return result.stdout
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))

console.log("[dist] bundling plugin")
runNpm(["run", "bundle"])

const versionOutput = capture("rtk", ["--version"])
if (!versionOutput) {
  console.error("[dist] rtk not found in PATH; install it first: cargo install --git https://github.com/rtk-ai/rtk")
  process.exit(1)
}
const rtkVersion = versionOutput.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "unknown"

const located = capture(isWindows ? "where" : "which", ["rtk"])
const rtkBin = (located ?? "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && existsSync(line) && line.toLowerCase().endsWith(exeName))
  .at(0)
if (!rtkBin) {
  console.error("[dist] could not locate the rtk executable")
  process.exit(1)
}
console.log(`[dist] found rtk ${rtkVersion} at ${rtkBin}`)

const osName = isWindows ? "win" : process.platform === "darwin" ? "macos" : "linux"
const platform = `${osName}-${process.arch}`
const name = `openrtk-full-${pkg.version}-rtk${rtkVersion}-${platform}`
const stage = join(dist, name)
const zipPath = join(dist, `${name}.zip`)

console.log(`[dist] staging ${name}`)
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, "bin"), { recursive: true })
mkdirSync(join(stage, "scripts"), { recursive: true })

for (const entry of ["index.ts", "src", "package.json", "opencode.md", "README.md"]) {
  cpSync(join(root, entry), join(stage, entry), { recursive: true })
}
// Tests are not needed at install time.
rmSync(join(stage, "src", "index.test.ts"), { force: true })
copyFileSync(join(root, "scripts", "install.cmd"), join(stage, "install.cmd"))
copyFileSync(join(root, "scripts", "install-full.mjs"), join(stage, "scripts", "install-full.mjs"))
copyFileSync(rtkBin, join(stage, "bin", exeName))
writeFileSync(join(stage, "rtk-version.txt"), `${rtkVersion}\n`)

console.log(`[dist] creating ${zipPath}`)
rmSync(zipPath, { force: true })
if (isWindows) {
  const quote = (value) => value.replace(/'/g, "''")
  run("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Compress-Archive -Path '${quote(stage)}' -DestinationPath '${quote(zipPath)}' -Force`,
  ])
} else {
  run("zip", ["-r", zipPath, name], { cwd: dist })
}

console.log("[dist] building plugin-only npm tarball")
runNpm(["pack", "--pack-destination", dist])

console.log("[dist] done:")
console.log(`  full package:  ${zipPath}`)
console.log(`  staged copy:   ${stage}`)
console.log(`  bundled rtk:   rtk ${rtkVersion} (${exeName})`)
