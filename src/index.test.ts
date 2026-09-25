import assert from "node:assert/strict"
import { copyFileSync, chmodSync, linkSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { after, before, describe, test } from "node:test"
import pluginDefault, { rtkPlugin } from "./index.js"
import { rewrite } from "./rewrite.js"

const win32 = process.platform === "win32"

describe("rewrite", () => {
  describe("git commands", () => {
    test("rewrites git status", () => {
      assert.equal(rewrite("git status"), "rtk git status")
    })

    test("rewrites git status with flags", () => {
      assert.equal(rewrite("git status -s"), "rtk git status -s")
    })

    test("rewrites git diff", () => {
      assert.equal(rewrite("git diff"), "rtk git diff")
    })

    test("rewrites git log", () => {
      assert.equal(rewrite("git log --oneline -10"), "rtk git log --oneline -10")
    })

    test("rewrites git push", () => {
      assert.equal(rewrite("git push origin main"), "rtk git push origin main")
    })

    test("rewrites git commit", () => {
      assert.equal(rewrite('git commit -m "fix"'), 'rtk git commit -m "fix"')
    })

    test("rewrites git branch", () => {
      assert.equal(rewrite("git branch -a"), "rtk git branch -a")
    })

    test("rewrites git fetch", () => {
      assert.equal(rewrite("git fetch --all"), "rtk git fetch --all")
    })

    test("rewrites git stash", () => {
      assert.equal(rewrite("git stash pop"), "rtk git stash pop")
    })

    test("rewrites git show", () => {
      assert.equal(rewrite("git show HEAD"), "rtk git show HEAD")
    })
  })

  describe("github cli", () => {
    test("rewrites gh pr", () => {
      assert.equal(rewrite("gh pr list"), "rtk gh pr list")
    })

    test("rewrites gh issue", () => {
      assert.equal(rewrite("gh issue view 123"), "rtk gh issue view 123")
    })

    test("rewrites gh run", () => {
      assert.equal(rewrite("gh run list"), "rtk gh run list")
    })

    test("does not rewrite gh auth", () => {
      assert.equal(rewrite("gh auth login"), null)
    })
  })

  describe("cargo commands", () => {
    test("rewrites cargo test", () => {
      assert.equal(rewrite("cargo test"), "rtk cargo test")
    })

    test("rewrites cargo build", () => {
      assert.equal(rewrite("cargo build --release"), "rtk cargo build --release")
    })

    test("rewrites cargo clippy", () => {
      assert.equal(rewrite("cargo clippy"), "rtk cargo clippy")
    })
  })

  describe("file operations", () => {
    test("rewrites cat to rtk read", () => {
      assert.equal(rewrite("cat README.md"), "rtk read README.md")
    })

    test("rewrites grep", () => {
      assert.equal(rewrite("grep -r TODO src/"), "rtk grep -r TODO src/")
    })

    test("rewrites rg", () => {
      assert.equal(rewrite("rg pattern"), "rtk rg pattern")
    })

    test("rewrites ls on POSIX, leaves it untouched on Windows", () => {
      assert.equal(rewrite("ls -la"), win32 ? null : "rtk ls -la")
    })

    test("rewrites tree on POSIX, leaves it untouched on Windows", () => {
      assert.equal(rewrite("tree src/"), win32 ? null : "rtk tree src/")
    })

    test("rewrites find on POSIX, leaves it untouched on Windows", () => {
      assert.equal(rewrite("find . -name '*.ts'"), win32 ? null : "rtk find . -name '*.ts'")
    })

    test("rewrites diff on POSIX, leaves it untouched on Windows", () => {
      assert.equal(rewrite("diff a.txt b.txt"), win32 ? null : "rtk diff a.txt b.txt")
    })

    test("compound command keeps ls untouched on Windows but still rewrites git", () => {
      assert.equal(
        rewrite("git status && ls -la"),
        win32 ? "rtk git status && ls -la" : "rtk git status && rtk ls -la"
      )
    })
  })

  describe("js/ts tooling", () => {
    test("rewrites vitest", () => {
      assert.equal(rewrite("vitest run"), "rtk vitest run")
    })

    test("rewrites npx vitest", () => {
      assert.equal(rewrite("npx vitest"), "rtk vitest run")
    })

    test("rewrites npm test", () => {
      assert.equal(rewrite("npm test"), "rtk npm test")
    })

    test("rewrites npm run", () => {
      assert.equal(rewrite("npm run build"), "rtk npm build")
    })

    test("rewrites tsc", () => {
      assert.equal(rewrite("tsc --noEmit"), "rtk tsc --noEmit")
    })

    test("rewrites eslint", () => {
      assert.equal(rewrite("eslint src/"), "rtk lint src/")
    })

    test("rewrites playwright", () => {
      assert.equal(rewrite("npx playwright test"), "rtk playwright test")
    })
  })

  describe("containers", () => {
    test("rewrites docker compose", () => {
      assert.equal(rewrite("docker compose up"), "rtk docker compose up")
    })

    test("rewrites docker ps", () => {
      assert.equal(rewrite("docker ps"), "rtk docker ps")
    })

    test("rewrites kubectl get", () => {
      assert.equal(rewrite("kubectl get pods"), "rtk kubectl get pods")
    })
  })

  describe("python", () => {
    test("rewrites pytest", () => {
      assert.equal(rewrite("pytest tests/"), "rtk pytest tests/")
    })

    test("rewrites python -m pytest", () => {
      assert.equal(rewrite("python -m pytest"), "rtk pytest")
    })

    test("rewrites ruff check", () => {
      assert.equal(rewrite("ruff check ."), "rtk ruff check .")
    })
  })

  describe("go", () => {
    test("rewrites go test", () => {
      assert.equal(rewrite("go test ./..."), "rtk go test ./...")
    })

    test("rewrites go build", () => {
      assert.equal(rewrite("go build"), "rtk go build")
    })
  })

  describe("elixir / phoenix / ash", () => {
    test("rewrites mix phx.routes", () => {
      assert.equal(rewrite("mix phx.routes"), "rtk --cache mix phx.routes")
    })

    test("rewrites mix ash.info", () => {
      assert.equal(rewrite("mix ash.info MyResource"), "rtk --cache mix ash.info MyResource")
    })

    test("rewrites mix test", () => {
      assert.equal(rewrite("mix test"), "rtk test mix test")
    })

    test("rewrites mix compile", () => {
      assert.equal(rewrite("mix compile"), "rtk mix compile")
    })

    test("rewrites mix ecto.migrate", () => {
      assert.equal(rewrite("mix ecto.migrate"), "rtk mix ecto.migrate")
    })

    test("rewrites mix ecto.migrations", () => {
      assert.equal(rewrite("mix ecto.migrations"), "rtk mix ecto.migrations")
    })

    test("rewrites generic mix commands", () => {
      assert.equal(rewrite("mix deps.get"), "rtk mix deps.get")
    })

    test("rewrites iex sessions", () => {
      assert.equal(rewrite("iex -S mix"), "rtk iex -S mix")
    })

    test("rewrites mix help", () => {
      assert.equal(rewrite("mix help phx.gen.html"), "rtk --cache mix help phx.gen.html")
    })
  })

  describe("compound commands", () => {
    test("rewrites each && segment", () => {
      assert.equal(rewrite("git status && git diff"), "rtk git status && rtk git diff")
    })

    test("leaves unsupported segments untouched", () => {
      assert.equal(
        rewrite("git stash && nix flake check && git stash pop"),
        "rtk git stash && nix flake check && rtk git stash pop",
      )
    })

    test("supports ||, ; and pipes", () => {
      assert.equal(
        rewrite("git fetch || git pull; ls | grep foo"),
        win32
          ? "rtk git fetch || rtk git pull; ls | rtk grep foo"
          : "rtk git fetch || rtk git pull; rtk ls | rtk grep foo",
      )
    })

    test("does not split quoted separators", () => {
      assert.equal(rewrite('git commit -m "a && b"'), 'rtk git commit -m "a && b"')
    })

    test("honors backslash-escaped quotes", () => {
      assert.equal(
        rewrite('git commit -m "a \\" && b" && git status'),
        'rtk git commit -m "a \\" && b" && rtk git status',
      )
    })

    test("rewrites env-prefixed segments", () => {
      assert.equal(rewrite("CI=true cargo test && git status"), "CI=true rtk cargo test && rtk git status")
    })

    test("only skips the heredoc segment", () => {
      assert.equal(rewrite("git status && cat <<EOF"), "rtk git status && cat <<EOF")
    })

    test("skips segments already using rtk", () => {
      assert.equal(rewrite("rtk git status && git diff"), "rtk git status && rtk git diff")
    })

    test("returns null when no segment matches", () => {
      assert.equal(rewrite("echo hello && echo world"), null)
    })
  })

  describe("skip conditions", () => {
    test("skips commands already using rtk", () => {
      assert.equal(rewrite("rtk git status"), null)
    })

    test("skips commands with heredocs", () => {
      assert.equal(rewrite("cat <<EOF\nhello\nEOF"), null)
    })

    test("skips unrecognized commands", () => {
      assert.equal(rewrite("echo hello"), null)
    })
  })

  describe("env prefix handling", () => {
    test("preserves env vars and rewrites command", () => {
      assert.equal(rewrite("CI=true cargo test"), "CI=true rtk cargo test")
    })

    test("preserves multiple env vars", () => {
      assert.equal(rewrite("FOO=1 BAR=2 git status"), "FOO=1 BAR=2 rtk git status")
    })
  })
})

describe("plugin entry points", () => {
  // `setup` disables itself when `rtk` is missing from PATH, so provide a fake
  // binary for the hook tests. On Windows a hardlink to the running node
  // executable is used because `execFile` cannot resolve `.cmd` shims.
  let originalPath: string | undefined
  let fakeBinDir: string

  before(() => {
    fakeBinDir = mkdtempSync(join(tmpdir(), "openrtk-test-"))
    const binary = join(fakeBinDir, process.platform === "win32" ? "rtk.exe" : "rtk")
    if (process.platform === "win32") {
      try {
        linkSync(process.execPath, binary)
      } catch {
        copyFileSync(process.execPath, binary)
      }
    } else {
      writeFileSync(binary, "#!/bin/sh\nexit 0\n")
      chmodSync(binary, 0o755)
    }

    originalPath = process.env.PATH
    process.env.PATH = fakeBinDir + delimiter + (originalPath ?? "")
  })

  after(() => {
    process.env.PATH = originalPath
    rmSync(fakeBinDir, { recursive: true, force: true })
  })

  test("default export carries the openrtk id with v1 and v2 hooks", () => {
    assert.equal(pluginDefault.id, "openrtk")
    assert.equal(typeof pluginDefault.setup, "function")
    assert.equal(typeof pluginDefault.server, "function")
  })

  test("v2 setup rewrites shell commands", async () => {
    let handler: ((event: { command: string }) => void) | undefined
    await pluginDefault.setup({
      shell: {
        hook: async (_name: string, cb: (event: { command: string }) => void) => {
          handler = cb
        },
      },
    } as never)

    const event = { command: "git status && git diff" }
    await handler!(event)
    assert.equal(event.command, "rtk git status && rtk git diff")
  })

  test("v2 setup leaves unknown commands alone", async () => {
    let handler: ((event: { command: string }) => void) | undefined
    await pluginDefault.setup({
      shell: {
        hook: async (_name: string, cb: (event: { command: string }) => void) => {
          handler = cb
        },
      },
    } as never)

    const event = { command: "echo hello" }
    await handler!(event)
    assert.equal(event.command, "echo hello")
  })

  test("v2 setup stays quiet without the rtk binary", async () => {
    const path = process.env.PATH
    process.env.PATH = "/nonexistent"
    try {
      let registered = false
      await pluginDefault.setup({
        shell: {
          hook: async () => {
            registered = true
          },
        },
      } as never)
      assert.equal(registered, false)
    } finally {
      process.env.PATH = path
    }
  })

  test("v1 server rewrites bash tool commands", async () => {
    const fakeShell = () => ({ quiet: async () => {} })
    const hooks = (await rtkPlugin({ $: fakeShell as never })) as Record<
      string,
      (input: unknown, output: { args: Record<string, unknown> }) => Promise<void>
    >

    const output = { args: { command: "git status" } }
    await hooks["tool.execute.before"]({ tool: "bash" }, output)
    assert.equal(output.args.command, "rtk git status")
  })

  test("v1 server ignores other tools", async () => {
    const fakeShell = () => ({ quiet: async () => {} })
    const hooks = (await rtkPlugin({ $: fakeShell as never })) as Record<
      string,
      (input: unknown, output: { args: Record<string, unknown> }) => Promise<void>
    >

    const output = { args: { command: "git status" } }
    await hooks["tool.execute.before"]({ tool: "read" }, output)
    assert.equal(output.args.command, "git status")
  })
})
