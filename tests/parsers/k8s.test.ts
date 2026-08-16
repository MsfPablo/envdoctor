import { describe, expect, it } from "vitest";
import { k8sParser } from "../../src/parsers/k8s.js";

describe("k8sParser", () => {
  it("extracts container env definitions", () => {
    const content = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: PORT
              value: "3000"
            - name: DEBUG
              value: "true"
            - name: SECRET_TOKEN
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: token
`;
    const file = k8sParser.parse(content, "/p/k8s/deployment.yaml");
    expect(file.format).toBe("kubernetes");
    const defined = new Set(file.variables.map((v) => v.name));
    expect(defined).toContain("PORT");
    expect(defined).toContain("DEBUG");
    expect(defined).not.toContain("SECRET_TOKEN");

    const used = new Set(file.usages.map((v) => v.name));
    expect(used).toContain("SECRET_TOKEN");
  });

  it("extracts ${VAR} interpolations from command/args", () => {
    const content = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: app
          command: ["sh", "-c", "echo \${MESSAGE}"]
          args: ["--port", "\${PORT}"]
`;
    const file = k8sParser.parse(content, "/p/k8s/deployment.yaml");
    const used = new Set(file.usages.map((v) => v.name));
    expect(used).toContain("MESSAGE");
    expect(used).toContain("PORT");
  });

  it("extracts ConfigMap data keys as definitions", () => {
    const content = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: debug
  FEATURE_FLAG: "true"
`;
    const file = k8sParser.parse(content, "/p/k8s/configmap.yaml");
    const defined = new Map(file.variables.map((v) => [v.name, v.value]));
    expect(defined.get("LOG_LEVEL")).toBe("debug");
    expect(defined.get("FEATURE_FLAG")).toBe("true");
  });

  it("ignores non-Kubernetes YAML", () => {
    const content = `
name: some-random-file
value: 123
`;
    const file = k8sParser.parse(content, "/p/other.yaml");
    expect(file.variables).toHaveLength(0);
    expect(file.usages).toHaveLength(0);
  });
});
