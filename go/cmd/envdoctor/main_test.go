package main

import (
	"encoding/json"
	"testing"

	"github.com/arun-skg/envdoctor/go/internal/scanner"
)

func TestToJSONShape(t *testing.T) {
	findings := []scanner.Finding{
		{Rule: "unused", Severity: "warning", Name: "FOO",
			Message: "defined but never referenced in source",
			Origin:  scanner.Origin{File: ".env", Line: 3}},
		{Rule: "typo", Severity: "warning", Name: "BAR",
			Message: "x", Origin: scanner.Origin{}},
	}
	data, err := json.Marshal(toJSON(findings))
	if err != nil {
		t.Fatal(err)
	}
	var arr []map[string]interface{}
	if err := json.Unmarshal(data, &arr); err != nil {
		t.Fatal(err)
	}
	if len(arr) != 2 {
		t.Fatalf("expected 2 objects, got %d", len(arr))
	}
	wantKeys := []string{"rule", "severity", "name", "message", "file", "line"}
	for _, obj := range arr {
		if len(obj) != len(wantKeys) {
			t.Fatalf("unexpected keys: %v", obj)
		}
		for _, k := range wantKeys {
			if _, ok := obj[k]; !ok {
				t.Fatalf("missing key %q in %v", k, obj)
			}
		}
	}
	// First finding has a real file; second has null file/line.
	if arr[0]["file"] != ".env" {
		t.Fatalf("expected file .env, got %v", arr[0]["file"])
	}
	if arr[1]["file"] != nil || arr[1]["line"] != nil {
		t.Fatal("expected null file/line for empty origin")
	}
}
