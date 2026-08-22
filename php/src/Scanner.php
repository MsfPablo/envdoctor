<?php

declare(strict_types=1);

namespace Envdoctor;

/**
 * Core scanner: reconcile environment access in PHP source against .env
 * definitions. Local-first — no network, values never printed.
 */
final class Scanner
{
    /** @var string[] Each pattern captures the variable name in group 1. */
    private const USAGE_PATTERNS = [
        '/\bgetenv\(\s*["\']([A-Za-z_]\w*)["\']/',
        '/\$_ENV\[\s*["\']([A-Za-z_]\w*)["\']\s*\]/',
        '/\$_SERVER\[\s*["\']([A-Za-z_]\w*)["\']\s*\]/',
    ];

    private const ENV_LINE = '/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/';

    /** @var string[] Public/client-bundle prefixes (case-sensitive). */
    private const PUBLIC_PREFIXES = [
        'NEXT_PUBLIC_', 'VITE_', 'REACT_APP_', 'EXPO_PUBLIC_',
        'GATSBY_', 'NUXT_PUBLIC_', 'VUE_APP_', 'PUBLIC_',
    ];

    private const SECRET_RE = '/SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH/i';

    private static function blank(string $s): string
    {
        return preg_replace('/[^\n]/', ' ', $s);
    }

    private static function stripNoise(string $code): string
    {
        // Block comments, then line comments (// and #).
        $code = preg_replace_callback('/\/\*.*?\*\//s', fn($m) => self::blank($m[0]), $code);
        $code = preg_replace_callback('/(?:\/\/|#)[^\n]*/', fn($m) => self::blank($m[0]), $code);

        return $code;
    }

    /** @return array<string, array{file: string, line: int}> */
    public static function scanSource(string $path, string $content): array
    {
        $text = self::stripNoise($content);
        $used = [];
        foreach (self::USAGE_PATTERNS as $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[1] as $m) {
                    $name = $m[0];
                    if (isset($used[$name])) {
                        continue;
                    }
                    $line = substr_count(substr($text, 0, $m[1]), "\n") + 1;
                    $used[$name] = ['file' => $path, 'line' => $line];
                }
            }
        }

        return $used;
    }

    /**
     * Returns all occurrences per key: name => list of {file, line}, in order.
     *
     * @return array<string, array<int, array{file: string, line: int}>>
     */
    public static function parseEnv(string $path, string $content): array
    {
        $defined = [];
        foreach (explode("\n", $content) as $i => $raw) {
            $trimmed = trim($raw);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            if (preg_match(self::ENV_LINE, $raw, $m)) {
                $defined[$m[1]][] = ['file' => $path, 'line' => $i + 1];
            }
        }

        return $defined;
    }

    private static function isPublicPrefix(string $name): bool
    {
        $hasPrefix = false;
        foreach (self::PUBLIC_PREFIXES as $p) {
            if (str_starts_with($name, $p)) {
                $hasPrefix = true;
                break;
            }
        }

        return $hasPrefix && preg_match(self::SECRET_RE, $name) === 1;
    }

    /** @return string[] */
    private static function discoverFiles(string $root, string $suffix, bool $envMode): array
    {
        $out = [];
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            $name = $file->getFilename();
            $skip = false;
            foreach (['.git', 'vendor', 'node_modules'] as $bad) {
                if (str_contains($file->getPathname(), DIRECTORY_SEPARATOR . $bad . DIRECTORY_SEPARATOR)) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) {
                continue;
            }
            if ($envMode) {
                $isEnv = $name === '.env' || (str_starts_with($name, '.env.') && !str_ends_with($name, '.example'));
                if ($isEnv) {
                    $out[] = $file->getPathname();
                }
            } elseif (str_ends_with($name, $suffix)) {
                $out[] = $file->getPathname();
            }
        }
        sort($out);

        return $out;
    }

    /** @return Finding[] */
    public static function scan(string $root): array
    {
        $root = rtrim($root, DIRECTORY_SEPARATOR);
        $defined = [];
        $dupFindings = [];
        foreach (self::discoverFiles($root, '', true) as $f) {
            $rel = self::rel($root, $f);
            foreach (self::parseEnv($rel, (string) file_get_contents($f)) as $k => $origins) {
                if (count($origins) >= 2) {
                    $lines = array_map(fn($o) => $o['line'], $origins);
                    $dupFindings[] = new Finding(
                        'duplicates',
                        'error',
                        $k,
                        'defined ' . count($origins) . ' times in the same file (lines '
                            . implode(', ', $lines) . ')',
                        $origins[0]
                    );
                }
                // First occurrence (first file wins) counts as the definition.
                $defined[$k] ??= $origins[0];
            }
        }

        $used = [];
        foreach (self::discoverFiles($root, '.php', false) as $f) {
            foreach (self::scanSource(self::rel($root, $f), (string) file_get_contents($f)) as $k => $v) {
                $used[$k] ??= $v;
            }
        }

        $findings = [];
        $usedNames = array_keys($used);
        sort($usedNames);
        foreach ($usedNames as $name) {
            if (!isset($defined[$name])) {
                $findings[] = new Finding(
                    'undefined-in-source',
                    'error',
                    $name,
                    'used in source code but not defined in any environment file',
                    $used[$name]
                );
            }
        }
        usort($dupFindings, fn($a, $b) => strcmp($a->name, $b->name));
        foreach ($dupFindings as $finding) {
            $findings[] = $finding;
        }
        $definedNames = array_keys($defined);
        sort($definedNames);
        foreach ($definedNames as $name) {
            if (self::isPublicPrefix($name)) {
                $findings[] = new Finding(
                    'public-prefix',
                    'error',
                    $name,
                    'secret-looking variable is exposed to client bundles via a public prefix',
                    $defined[$name]
                );
            }
        }
        foreach ($definedNames as $name) {
            if (!isset($used[$name])) {
                $findings[] = new Finding(
                    'unused',
                    'warning',
                    $name,
                    'defined but never referenced in source',
                    $defined[$name]
                );
            }
        }

        return $findings;
    }

    private static function rel(string $root, string $path): string
    {
        return ltrim(substr($path, strlen($root)), DIRECTORY_SEPARATOR);
    }
}

/** One reported issue. */
final class Finding
{
    /** @param array{file: string, line: int} $origin */
    public function __construct(
        public string $rule,
        public string $severity,
        public string $name,
        public string $message,
        public array $origin,
    ) {
    }
}
