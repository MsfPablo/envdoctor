package scanner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanSourceDetectsUsage(t *testing.T) {
	src := `package main
import "os"
// os.Getenv("COMMENTED")
func main() {
	_ = os.Getenv("DB_URL")
	_, _ = os.LookupEnv("PORT")
	/* os.Getenv("BLOCK_IGNORED") */
}
`
	used := ScanSource("main.go", src)
	if _, ok := used["DB_URL"]; !ok {
		t.Fatal("expected DB_URL")
	}
	if _, ok := used["PORT"]; !ok {
		t.Fatal("expected PORT")
	}
	if _, ok := used["COMMENTED"]; ok {
		t.Fatal("COMMENTED should be ignored (line comment)")
	}
	if _, ok := used["BLOCK_IGNORED"]; ok {
		t.Fatal("BLOCK_IGNORED should be ignored (block comment)")
	}
}

func TestScanReconciles(t *testing.T) {
	dir := t.TempDir()
	must(t, filepath.Join(dir, ".env"), "DB_URL=x\nUNUSED_KEY=1\n")
	must(t, filepath.Join(dir, "main.go"), "package main\nimport \"os\"\nfunc main(){ os.Getenv(\"DB_URL\"); os.Getenv(\"NEW_FLAG\") }\n")

	res, err := Scan(dir)
	if err != nil {
		t.Fatal(err)
	}
	errs := names(res.Errors())
	warns := names(res.Warnings())
	if !errs["NEW_FLAG"] {
		t.Fatalf("expected NEW_FLAG error, got %v", errs)
	}
	if !warns["UNUSED_KEY"] {
		t.Fatalf("expected UNUSED_KEY warning, got %v", warns)
	}
	if errs["DB_URL"] || warns["DB_URL"] {
		t.Fatal("DB_URL should be reconciled")
	}
}

func TestDuplicates(t *testing.T) {
	dir := t.TempDir()
	must(t, filepath.Join(dir, ".env"), "DB_URL=a\nDB_URL=b\nSOLO=1\n")
	must(t, filepath.Join(dir, "main.go"), "package main\nimport \"os\"\nfunc main(){ os.Getenv(\"DB_URL\"); os.Getenv(\"SOLO\") }\n")

	res, err := Scan(dir)
	if err != nil {
		t.Fatal(err)
	}
	var dups []Finding
	for _, f := range res.Findings {
		if f.Rule == "duplicates" {
			dups = append(dups, f)
		}
	}
	if len(dups) != 1 {
		t.Fatalf("expected 1 duplicate finding, got %d: %v", len(dups), dups)
	}
	if dups[0].Name != "DB_URL" || dups[0].Severity != "error" {
		t.Fatalf("unexpected duplicate finding: %+v", dups[0])
	}
	if want := "lines 1, 2"; !contains(dups[0].Message, want) {
		t.Fatalf("message %q should contain %q", dups[0].Message, want)
	}
	// First occurrence reconciles: DB_URL is neither undefined nor unused.
	if warns := names(res.Warnings()); warns["DB_URL"] {
		t.Fatal("DB_URL should be reconciled, not unused")
	}
}

func TestPublicPrefix(t *testing.T) {
	dir := t.TempDir()
	must(t, filepath.Join(dir, ".env"), "NEXT_PUBLIC_API_KEY=x\nPUBLIC_URL=x\nAPI_KEY=x\n")
	must(t, filepath.Join(dir, "main.go"), "package main\nfunc main(){}\n")

	res, err := Scan(dir)
	if err != nil {
		t.Fatal(err)
	}
	pp := map[string]bool{}
	for _, f := range res.Findings {
		if f.Rule == "public-prefix" {
			if f.Severity != "error" {
				t.Fatalf("public-prefix should be error, got %s", f.Severity)
			}
			pp[f.Name] = true
		}
	}
	if !pp["NEXT_PUBLIC_API_KEY"] {
		t.Fatalf("expected NEXT_PUBLIC_API_KEY flagged, got %v", pp)
	}
	if pp["PUBLIC_URL"] {
		t.Fatal("PUBLIC_URL should not be flagged (not secret-like)")
	}
	if pp["API_KEY"] {
		t.Fatal("API_KEY should not be flagged (no public prefix)")
	}
}

func contains(s, sub string) bool { return strings.Contains(s, sub) }

func must(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func names(fs []Finding) map[string]bool {
	m := map[string]bool{}
	for _, f := range fs {
		m[f.Name] = true
	}
	return m
}
