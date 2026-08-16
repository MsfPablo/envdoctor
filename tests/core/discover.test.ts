import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverFiles } from "../../src/core/discover.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";
import { defaultRegistry } from "../../src/parsers/registry.js";

const registry = defaultRegistry({ sourceExtensions: DEFAULT_CONFIG.sourceExtensions });
const created: string[] = [];

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envdoctor-discover-"));
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created.splice(0)) {
    // Restore permissions so cleanup can remove the tree.
    try {
      fs.chmodSync(path.join(dir, "secret"), 0o755);
    } catch {
      // ignore
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("discoverFiles", () => {
  it("skips unreadable directories instead of throwing EPERM/EACCES", async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, ".env"), "API_KEY=abc\n");

    // A directory the current user cannot read/scan (mode 000).
    const locked = path.join(root, "secret");
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, ".env.local"), "X=1\n");
    fs.chmodSync(locked, 0o000);

    const discovered = await discoverFiles(root, DEFAULT_CONFIG, registry);

    // Should not throw, and should still find the readable .env at the root.
    expect(discovered.some((f) => f.filePath.endsWith(".env"))).toBe(true);
  });

  it("respects --staged git filter", async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, ".env"), "A=1\n");
    fs.writeFileSync(path.join(root, ".env.local"), "B=2\n");

    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    execFileSync("git", ["add", ".env.local"], { cwd: root });

    const discovered = await discoverFiles(root, DEFAULT_CONFIG, registry, { gitFilter: { staged: true } });
    const paths = discovered.map((f) => path.basename(f.filePath));
    expect(paths).toEqual([".env.local"]);
  });

  it("respects --since git filter", async () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, ".env"), "A=1\n");

    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    execFileSync("git", ["add", ".env"], { cwd: root });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: root });

    fs.writeFileSync(path.join(root, ".env.local"), "B=2\n");

    const discovered = await discoverFiles(root, DEFAULT_CONFIG, registry, { gitFilter: { since: "HEAD" } });
    const paths = discovered.map((f) => path.basename(f.filePath));
    expect(paths).toEqual([".env.local"]);
  });
});
