// Package scanner is the native Go implementation of envdoctor's core:
// reconcile environment variables used in Go source against those defined in
// .env files. Local-first — no network, values never printed.
package scanner

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Origin is where a variable was seen.
type Origin struct {
	File string
	Line int
}

// Finding is one reported issue.
type Finding struct {
	Rule     string
	Severity string // "error" | "warning"
	Name     string
	Message  string
	Origin   Origin
}

// Result holds all findings from a scan.
type Result struct {
	Findings []Finding
}

// Errors returns only error-severity findings.
func (r Result) Errors() []Finding { return r.filter("error") }

// Warnings returns only warning-severity findings.
func (r Result) Warnings() []Finding { return r.filter("warning") }

func (r Result) filter(sev string) []Finding {
	var out []Finding
	for _, f := range r.Findings {
		if f.Severity == sev {
			out = append(out, f)
		}
	}
	return out
}

var usagePatterns = []*regexp.Regexp{
	regexp.MustCompile(`\bos\.Getenv\(\s*"([A-Za-z_]\w*)"`),
	regexp.MustCompile(`\bos\.LookupEnv\(\s*"([A-Za-z_]\w*)"`),
}

var (
	lineComment  = regexp.MustCompile(`(?m)//[^\n]*`)
	blockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)
	envLine      = regexp.MustCompile(`^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=`)
)

// publicPrefixes are client-exposed env prefixes (case-sensitive, exact).
var publicPrefixes = []string{
	"NEXT_PUBLIC_",
	"VITE_",
	"REACT_APP_",
	"EXPO_PUBLIC_",
	"GATSBY_",
	"NUXT_PUBLIC_",
	"VUE_APP_",
	"PUBLIC_",
}

// secretName matches secret-looking variable names (case-insensitive).
var secretName = regexp.MustCompile(`(?i)SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH`)

func hasPublicPrefix(name string) bool {
	for _, p := range publicPrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// blankMatch replaces every non-newline rune with a space to preserve offsets.
func blankMatch(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r == '\n' {
			b.WriteRune('\n')
		} else {
			b.WriteByte(' ')
		}
	}
	return b.String()
}

func stripNoise(code string) string {
	code = blockComment.ReplaceAllStringFunc(code, blankMatch)
	code = lineComment.ReplaceAllStringFunc(code, blankMatch)
	return code
}

// ScanSource returns variable name -> first origin for env usage in Go source.
func ScanSource(path, content string) map[string]Origin {
	text := stripNoise(content)
	used := map[string]Origin{}
	for _, re := range usagePatterns {
		for _, m := range re.FindAllStringSubmatchIndex(text, -1) {
			name := text[m[2]:m[3]]
			if _, ok := used[name]; ok {
				continue
			}
			line := strings.Count(text[:m[0]], "\n") + 1
			used[name] = Origin{File: path, Line: line}
		}
	}
	return used
}

// ParseEnv returns variable name -> all origins (in file order) for the
// definitions in a dotenv file. Collecting every occurrence lets callers both
// reconcile against the first origin and detect in-file duplicates.
func ParseEnv(path, content string) map[string][]Origin {
	defined := map[string][]Origin{}
	for i, raw := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if m := envLine.FindStringSubmatch(raw); m != nil {
			defined[m[1]] = append(defined[m[1]], Origin{File: path, Line: i + 1})
		}
	}
	return defined
}

func skipDir(name string) bool {
	switch name {
	case ".git", "vendor", "node_modules":
		return true
	}
	return false
}

// Scan reconciles .env definitions against .go source usage under root.
func Scan(root string) (Result, error) {
	defined := map[string]Origin{}
	used := map[string]Origin{}
	var duplicates []Finding

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if skipDir(info.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		base := info.Name()
		isEnv := base == ".env" || (strings.HasPrefix(base, ".env.") && !strings.HasSuffix(base, ".example"))
		isGo := strings.HasSuffix(base, ".go")
		if !isEnv && !isGo {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		rel, _ := filepath.Rel(root, path)
		if isEnv {
			for k, origins := range ParseEnv(rel, string(data)) {
				// First occurrence (across all files) is the definition.
				if _, ok := defined[k]; !ok {
					defined[k] = origins[0]
				}
				// Duplicate within a single file: 2+ occurrences of a key.
				if len(origins) >= 2 {
					lines := make([]string, len(origins))
					for i, o := range origins {
						lines[i] = strconv.Itoa(o.Line)
					}
					duplicates = append(duplicates, Finding{
						Rule: "duplicates", Severity: "error", Name: k,
						Message: fmt.Sprintf("defined %d times in the same file (lines %s)",
							len(origins), strings.Join(lines, ", ")),
						Origin: origins[0],
					})
				}
			}
		} else {
			for k, v := range ScanSource(rel, string(data)) {
				if _, ok := used[k]; !ok {
					used[k] = v
				}
			}
		}
		return nil
	})
	if err != nil {
		return Result{}, err
	}

	var res Result
	usedNames := sortedKeys(used)
	for _, name := range usedNames {
		if _, ok := defined[name]; !ok {
			res.Findings = append(res.Findings, Finding{
				Rule: "undefined-in-source", Severity: "error", Name: name,
				Message: "used in source code but not defined in any environment file",
				Origin:  used[name],
			})
		}
	}
	sort.Slice(duplicates, func(i, j int) bool { return duplicates[i].Name < duplicates[j].Name })
	res.Findings = append(res.Findings, duplicates...)
	for _, name := range sortedKeys(defined) {
		if hasPublicPrefix(name) && secretName.MatchString(name) {
			res.Findings = append(res.Findings, Finding{
				Rule: "public-prefix", Severity: "error", Name: name,
				Message: "secret-looking variable is exposed to client bundles via a public prefix",
				Origin:  defined[name],
			})
		}
	}
	for _, name := range sortedKeys(defined) {
		if _, ok := used[name]; !ok {
			res.Findings = append(res.Findings, Finding{
				Rule: "unused", Severity: "warning", Name: name,
				Message: "defined but never referenced in source",
				Origin:  defined[name],
			})
		}
	}
	return res, nil
}

func sortedKeys(m map[string]Origin) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
