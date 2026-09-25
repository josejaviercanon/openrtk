import type { Plugin } from "@opencode/plugin"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { delimiter, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { rewrite } from "./rewrite.js"

const RTK_NAME = process.platform === "win32" ? "rtk.exe" : "rtk"

/** True when a binary exists and runs `--version` without error. */
function runs(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(bin, ["--version"], (error) => resolve(!error))
  })
}

/**
 * Locate the rtk binary: PATH first, then the copy bundled with the plugin
 * package (`bin/` next to the plugin files, or one level up for `src/`).
 * When only the bundled copy runs, its directory is prepended to this
 * process's PATH so the shells OpenCode spawns resolve `rtk` in rewritten
 * commands.
 */
async function resolveRtk(): Promise<string | null> {
  if (await runs("rtk")) return "rtk"

  const moduleDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(moduleDir, "bin", RTK_NAME), join(moduleDir, "..", "bin", RTK_NAME)]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    if (!(await runs(candidate))) continue
    process.env.PATH = `${dirname(candidate)}${delimiter}${process.env.PATH ?? ""}`
    return candidate
  }

  return null
}

async function setup(ctx: Plugin.Context): Promise<void> {
  if (!(await resolveRtk())) {
    console.warn("[openrtk] rtk binary not found in PATH or plugin bin/, plugin disabled")
    return
  }

  await ctx.shell.hook("create.before", (event) => {
    const rewritten = rewrite(event.command)
    if (rewritten) event.command = rewritten
  })
}

interface V1Shell {
  (strings: TemplateStringsArray, ...values: unknown[]): { quiet(): Promise<unknown> }
}

interface V1BeforeInput {
  tool?: string
}

interface V1BeforeOutput {
  args?: Record<string, unknown>
}

export const rtkPlugin = async (_ctx: { $: V1Shell }) => {
  if (!(await resolveRtk())) {
    console.warn("[openrtk] rtk binary not found in PATH or plugin bin/, plugin disabled")
    return {}
  }

  return {
    "tool.execute.before": async (input: V1BeforeInput, output: V1BeforeOutput) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "bash" && tool !== "shell") return

      const args = output?.args
      if (!args || typeof args !== "object") return

      const rewritten = rewrite(args.command)
      if (rewritten) args.command = rewritten
    },
  }
}

const v2 = {
  id: "openrtk",
  setup,
} satisfies Plugin.Plugin

export default {
  ...v2,

  // Entry point for OpenCode 1. Version 2 ignores it and uses id/setup above.
  server: rtkPlugin,
}
