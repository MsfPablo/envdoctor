package com.envdoctor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ScannerTest {

    @Test
    void detectsUsageAndIgnoresComments() {
        String src = """
            public class Config {
              // System.getenv("COMMENTED")
              String db = System.getenv("DB_URL");
              /* System.getenv("BLOCK_IGNORED") */
              String port = System.getenv("PORT");
            }
            """;
        Set<String> names = new TreeSet<>(Scanner.scanSource(src).keySet());
        assertEquals(Set.of("DB_URL", "PORT"), names);
        assertFalse(names.contains("COMMENTED"));
        assertFalse(names.contains("BLOCK_IGNORED"));
    }

    @Test
    void reconcilesMissingAndUnused(@TempDir Path dir) throws IOException {
        Files.writeString(dir.resolve(".env"), "DB_URL=x\nUNUSED_KEY=1\n");
        Files.writeString(dir.resolve("App.java"),
                "class App { void m(){ System.getenv(\"DB_URL\"); System.getenv(\"NEW_FLAG\"); } }");

        List<Scanner.Finding> findings = Scanner.scan(dir);
        Set<String> errors = new TreeSet<>();
        Set<String> warnings = new TreeSet<>();
        for (Scanner.Finding f : findings) {
            (f.severity().equals("error") ? errors : warnings).add(f.name());
        }
        assertTrue(errors.contains("NEW_FLAG"));
        assertTrue(warnings.contains("UNUSED_KEY"));
        assertFalse(errors.contains("DB_URL"));
        assertFalse(warnings.contains("DB_URL"));
    }

    @Test
    void detectsDuplicatesAndPublicPrefix(@TempDir Path dir) throws IOException {
        Files.writeString(dir.resolve(".env"),
                "DUP_KEY=1\nSINGLE_KEY=2\nDUP_KEY=3\n"
                        + "NEXT_PUBLIC_API_KEY=x\nPUBLIC_URL=y\nAPI_KEY=z\nPUBLIC_KEY=k\n");
        Files.writeString(dir.resolve("App.java"),
                "class App { void m(){ System.getenv(\"DUP_KEY\"); System.getenv(\"SINGLE_KEY\");"
                        + " System.getenv(\"NEXT_PUBLIC_API_KEY\"); System.getenv(\"PUBLIC_URL\");"
                        + " System.getenv(\"API_KEY\"); System.getenv(\"PUBLIC_KEY\"); } }");

        List<Scanner.Finding> findings = Scanner.scan(dir);
        Set<String> duplicates = new TreeSet<>();
        Set<String> publicPrefix = new TreeSet<>();
        String dupMessage = "";
        for (Scanner.Finding f : findings) {
            if (f.rule().equals("duplicates")) {
                duplicates.add(f.name());
                assertEquals("error", f.severity());
                if (f.name().equals("DUP_KEY")) {
                    dupMessage = f.message();
                }
            }
            if (f.rule().equals("public-prefix")) {
                publicPrefix.add(f.name());
                assertEquals("error", f.severity());
            }
        }
        assertTrue(duplicates.contains("DUP_KEY"));
        assertEquals("defined 2 times in the same file (lines 1, 3)", dupMessage);
        assertFalse(duplicates.contains("SINGLE_KEY"));

        assertTrue(publicPrefix.contains("NEXT_PUBLIC_API_KEY"));
        assertFalse(publicPrefix.contains("PUBLIC_URL"));
        assertFalse(publicPrefix.contains("API_KEY"));
        assertFalse(publicPrefix.contains("PUBLIC_KEY"));
    }

    @Test
    void duplicatedButUsedKeyNotReportedUnused(@TempDir Path dir) throws IOException {
        Files.writeString(dir.resolve(".env"), "DUP_KEY=1\nDUP_KEY=2\n");
        Files.writeString(dir.resolve("App.java"),
                "class App { void m(){ System.getenv(\"DUP_KEY\"); } }");

        List<Scanner.Finding> findings = Scanner.scan(dir);
        boolean unused = findings.stream()
                .anyMatch(f -> f.rule().equals("unused") && f.name().equals("DUP_KEY"));
        boolean undefined = findings.stream()
                .anyMatch(f -> f.rule().equals("undefined-in-source") && f.name().equals("DUP_KEY"));
        assertFalse(unused);
        assertFalse(undefined);
    }
}
