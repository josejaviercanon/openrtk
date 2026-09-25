# openrtk

OpenCode plugin for [RTK](https://github.com/rtk-ai/rtk) (Rust Token Killer). Reduces LLM token consumption by 60-90% on common dev commands by transparently routing them through RTK's output compression.

A lightweight OpenCode plugin that intercepts shell commands and pipes them through RTK for automatic output compression. The model sees full output while RTK handles token reduction behind the scenes — no changes needed to prompts or workflow.

## Prerequisites

Install RTK (note: `cargo install rtk` installs an unrelated crate):

```bash
cargo install --git https://github.com/rtk-ai/rtk
```

## Installation

The plugin supports OpenCode 2 (`setup`/`ctx.shell.hook("create.before")`) and falls back to OpenCode 1 (`server`/`tool.execute.before`). It has no runtime dependencies, so OpenCode loads `src/index.ts` directly — no build and no `npm install` on the target machine.

### Offline package (recommended for other local machines)

```bash
npm pack                     # produces openrtk-0.2.0.tgz
tar -xzf openrtk-0.2.0.tgz
node package/scripts/install-local.mjs
```

The script copies the plugin into `~/.config/opencode/plugins/openrtk/`, where OpenCode discovers it automatically for every project. Set `XDG_CONFIG_HOME` or `OPENCODE_CONFIG_DIR` to install somewhere else.

### Managed Git install

```bash
opencode plugin add github:josejaviercanon/openrtk
```

OpenCode installs and updates the plugin from the repository. Requires git and network access on the target machine.

### Manual copy

Copy this repository into `~/.config/opencode/plugins/openrtk/` (global) or `.opencode/plugins/openrtk/` (one project), then restart OpenCode.

Do not also list `openrtk` or `opencode-rtk` in the `plugins` array of `opencode.json(c)`: a second copy loads next to the local one and every command is processed twice. If the V1-only `opencode-rtk` package is present from an older setup, remove it — it fails to load on OpenCode 2.

## How it works

The plugin hooks into OpenCode's shell handling and rewrites commands to go through RTK before execution. On OpenCode 2 it uses the `shell create.before` hook; on OpenCode 1 it falls back to `tool.execute.before`. This is fully transparent to the model.

```
git status       ->  rtk git status       (72% savings)
cargo test       ->  rtk cargo test       (80% savings)
docker ps        ->  rtk docker ps        (65% savings)
```

### Supported commands

| Category | Commands |
|----------|----------|
| Git | status, diff, log, add, commit, push, pull, branch, fetch, stash, show |
| GitHub CLI | pr, issue, run, api, release |
| Rust | cargo test/build/clippy/check/install/fmt |
| File ops | cat, grep, rg, ls, tree, find, diff |
| JS/TS | vitest, npm test/run, tsc, eslint, prettier, playwright, prisma |
| Containers | docker (compose/ps/images/logs/run/build/exec), kubectl (get/logs/describe/apply) |
| Network | curl, wget |
| Python | pytest, ruff, pip, uv pip |
| Go | go test/build/vet, golangci-lint |
| Elixir | mix (test/compile/credo/format/dialyzer/ecto), iex |
| Packages | pnpm list/ls/outdated |

### System prompt

Copy `opencode.md` into your project or user config to teach the model about `rtk gain` and other meta commands.

## Development

```bash
npm install       # development dependencies
npm test          # compile with tsc and run node:test
npm run build     # emit lib/ with declarations (optional)
npm run bundle    # emit a single-file dist/openrtk.js with esbuild
```

`npm test` writes compiled test output to `test-lib/` and runs it with Node's built-in test runner, so no extra test framework is required.

## License

MIT
