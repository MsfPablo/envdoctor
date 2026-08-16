import { describe, expect, it } from "vitest";
import { generateEnvExample } from "../../src/generators/env-example.js";
import { buildModel } from "../helpers.js";
import type { InMemoryFile } from "../helpers.js";

describe("generateEnvExample", () => {
  it("includes used and defined variables, sorted into required/optional sections", () => {
    const files: InMemoryFile[] = [
      { path: "/p/.env", content: "PORT=3000\nLOG_LEVEL=info\n" },
      { path: "/p/src/index.ts", content: "const p = process.env.PORT;\n" },
      { path: "/p/docker-compose.yml", content: "services:\n  api:\n    environment:\n      COMPOSE_ONLY: x\n" },
    ];
    const out = generateEnvExample(buildModel(files));

    expect(out).toContain("# Required by the application");
    expect(out).toContain("# Optional / configuration knobs");
    expect(out).toContain("PORT=3000");
    expect(out).toContain("COMPOSE_ONLY=");
    expect(out).toContain("LOG_LEVEL=info");
  });

  it("never writes secret values and blanks secret-like variables", () => {
    const files: InMemoryFile[] = [
      {
        path: "/p/.env",
        content: "API_KEY=dev-key-123\nDATABASE_URL=postgres://localhost/db\n",
      },
      {
        path: "/p/.env.production",
        content: "API_KEY=prod-key-456\nJWT_SECRET=super-secret\n",
      },
      { path: "/p/src/index.ts", content: "const a = process.env.API_KEY;\nconst b = process.env.DATABASE_URL;\n" },
    ];
    const out = generateEnvExample(buildModel(files));

    expect(out).not.toContain("dev-key-123");
    expect(out).not.toContain("prod-key-456");
    expect(out).not.toContain("super-secret");
    // Secrets must be blank in the generated example.
    expect(out).toContain("API_KEY=");
    expect(out).toContain("JWT_SECRET=");
    // Non-secret values are only copied from the base .env, never production.
    expect(out).toContain("DATABASE_URL=postgres://localhost/db");
  });

  it("produces deterministic output", () => {
    const files: InMemoryFile[] = [{ path: "/p/.env", content: "B=2\nA=1\n" }];
    const a = generateEnvExample(buildModel(files));
    const b = generateEnvExample(buildModel(files));
    expect(a).toBe(b);
  });
});
