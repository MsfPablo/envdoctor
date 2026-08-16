import { isSecretName } from "../models/environment-variable.js";
import { makeFinding, type Detector } from "./detector.js";

/**
 * Public-prefix leak: variables whose names match the secret heuristic but
 * use a framework prefix that exposes them to client-side bundles.
 *
 * Examples: NEXT_PUBLIC_API_KEY, VITE_JWT_SECRET, REACT_APP_PASSWORD.
 */

const PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "PUBLIC_",
  "REACT_APP_",
  "GATSBY_",
  "EXPO_PUBLIC_",
  "NUXT_PUBLIC_",
  "ASTRO_PUBLIC_",
];

function findPublicPrefix(name: string): string | undefined {
  return PUBLIC_PREFIXES.find((prefix) => name.startsWith(prefix));
}

export const publicPrefixDetector: Detector = {
  id: "public-prefix",
  name: "public-prefix",
  description:
    "A secret-looking variable uses a public framework prefix and will be exposed to client bundles.",
  detect(index) {
    const findings = [];
    for (const [name, defs] of index.envDefinitions) {
      const prefix = findPublicPrefix(name);
      if (!prefix) continue;
      if (!isSecretName(name)) continue;
      findings.push(
        makeFinding(
          "public-prefix",
          "error",
          name,
          `${name} uses public prefix "${prefix}"; secret-looking variables with this prefix are exposed to client bundles`,
          defs.map((d) => d.origin),
        ),
      );
    }
    return findings;
  },
};
