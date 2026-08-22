package com.envdoctor;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Core scanner: reconcile {@code System.getenv("X")} usage in Java source
 * against {@code .env} definitions. Local-first — no network, values never
 * printed.
 */
public final class Scanner {

    private static final Pattern USAGE =
            Pattern.compile("\\bSystem\\.getenv\\(\\s*\"([A-Za-z_]\\w*)\"");
    private static final Pattern LINE_COMMENT = Pattern.compile("//[^\\n]*");
    private static final Pattern BLOCK_COMMENT = Pattern.compile("(?s)/\\*.*?\\*/");
    private static final Pattern ENV_LINE =
            Pattern.compile("^\\s*(?:export\\s+)?([A-Za-z_]\\w*)\\s*=");

    private Scanner() {}

    /** One reported issue. */
    public record Finding(String rule, String severity, String name, String message,
                          String file, int line) {}

    private static String blank(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            b.append(c == '\n' ? '\n' : ' ');
        }
        return b.toString();
    }

    private static String stripNoise(String code) {
        code = replaceAll(BLOCK_COMMENT, code);
        code = replaceAll(LINE_COMMENT, code);
        return code;
    }

    private static String replaceAll(Pattern p, String code) {
        Matcher m = p.matcher(code);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(out, Matcher.quoteReplacement(blank(m.group())));
        }
        m.appendTail(out);
        return out.toString();
    }

    /** Map of variable name to first origin for env usage in Java source. */
    public static Map<String, int[]> scanSource(String content) {
        String text = stripNoise(content);
        Map<String, int[]> used = new LinkedHashMap<>();
        Matcher m = USAGE.matcher(text);
        while (m.find()) {
            String name = m.group(1);
            if (used.containsKey(name)) {
                continue;
            }
            int line = (int) text.substring(0, m.start()).chars().filter(c -> c == '\n').count() + 1;
            used.put(name, new int[] {line});
        }
        return used;
    }

    private static final String[] PUBLIC_PREFIXES = {
        "NEXT_PUBLIC_", "VITE_", "REACT_APP_", "EXPO_PUBLIC_",
        "GATSBY_", "NUXT_PUBLIC_", "VUE_APP_", "PUBLIC_"
    };
    private static final Pattern SECRET_NAME = Pattern.compile(
            "SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH",
            Pattern.CASE_INSENSITIVE);

    private static boolean isPublicSecret(String name) {
        boolean hasPrefix = false;
        for (String p : PUBLIC_PREFIXES) {
            if (name.startsWith(p)) {
                hasPrefix = true;
                break;
            }
        }
        return hasPrefix && SECRET_NAME.matcher(name).find();
    }

    /**
     * Collect ALL occurrences per key within a single dotenv file, in order.
     * Map of variable name to the list of line numbers where it is defined.
     */
    public static Map<String, List<Integer>> parseEnv(String content) {
        Map<String, List<Integer>> defined = new LinkedHashMap<>();
        String[] lines = content.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            String trimmed = lines[i].strip();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            Matcher m = ENV_LINE.matcher(lines[i]);
            if (m.find()) {
                defined.computeIfAbsent(m.group(1), k -> new ArrayList<>()).add(i + 1);
            }
        }
        return defined;
    }

    /** Reconcile {@code .env} definitions against {@code .java} usage under root. */
    public static List<Finding> scan(Path root) {
        Map<String, String> definedFile = new LinkedHashMap<>();
        Map<String, Integer> definedLine = new LinkedHashMap<>();
        Map<String, String> usedFile = new LinkedHashMap<>();
        Map<String, Integer> usedLine = new LinkedHashMap<>();
        List<Finding> duplicates = new ArrayList<>();

        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile)
                .filter(Scanner::notIgnored)
                .sorted()
                .forEach(path -> {
                    String name = path.getFileName().toString();
                    boolean isEnv = name.equals(".env")
                            || (name.startsWith(".env.") && !name.endsWith(".example"));
                    boolean isJava = name.endsWith(".java");
                    if (!isEnv && !isJava) {
                        return;
                    }
                    String content = read(path);
                    String rel = root.relativize(path).toString();
                    if (isEnv) {
                        parseEnv(content).forEach((k, lns) -> {
                            // First occurrence counts as the definition.
                            definedFile.putIfAbsent(k, rel);
                            definedLine.putIfAbsent(k, lns.get(0));
                            if (lns.size() >= 2) {
                                String joined = lns.stream().map(String::valueOf)
                                        .collect(java.util.stream.Collectors.joining(", "));
                                duplicates.add(new Finding("duplicates", "error", k,
                                        "defined " + lns.size()
                                                + " times in the same file (lines " + joined + ")",
                                        rel, lns.get(0)));
                            }
                        });
                    } else {
                        scanSource(content).forEach((k, ln) -> {
                            usedFile.putIfAbsent(k, rel);
                            usedLine.putIfAbsent(k, ln[0]);
                        });
                    }
                });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        List<Finding> findings = new ArrayList<>();
        for (String name : new TreeSet<>(usedFile.keySet())) {
            if (!definedFile.containsKey(name)) {
                findings.add(new Finding("undefined-in-source", "error", name,
                        "used in source code but not defined in any environment file",
                        usedFile.get(name), usedLine.get(name)));
            }
        }
        duplicates.sort((a, b) -> a.name().compareTo(b.name()));
        findings.addAll(duplicates);
        for (String name : new TreeSet<>(definedFile.keySet())) {
            if (isPublicSecret(name)) {
                findings.add(new Finding("public-prefix", "error", name,
                        "secret-looking variable is exposed to client bundles via a public prefix",
                        definedFile.get(name), definedLine.get(name)));
            }
        }
        for (String name : new TreeSet<>(definedFile.keySet())) {
            if (!usedFile.containsKey(name)) {
                findings.add(new Finding("unused", "warning", name,
                        "defined but never referenced in source",
                        definedFile.get(name), definedLine.get(name)));
            }
        }
        return findings;
    }

    private static boolean notIgnored(Path path) {
        for (Path part : path) {
            String s = part.toString();
            if (s.equals(".git") || s.equals("target") || s.equals("node_modules")) {
                return false;
            }
        }
        return true;
    }

    private static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
