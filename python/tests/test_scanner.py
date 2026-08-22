from pathlib import Path

from envdoctor.scanner import scan, scan_source_file


def _write(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return p


def test_detects_all_usage_forms(tmp_path):
    src = _write(
        tmp_path,
        "app.py",
        "import os\n"
        "from os import environ\n"
        "# os.getenv('COMMENTED')\n"
        "a = os.getenv('DB_URL')\n"
        "b = os.environ.get('PORT')\n"
        "c = os.environ['API_KEY']\n"
        "d = environ.get('HOST')\n"
        "e = environ['DB_USER']\n"
        '"""docstring os.getenv("DOC_IGNORED")"""\n',
    )
    used = scan_source_file(src)
    assert set(used) == {"DB_URL", "PORT", "API_KEY", "HOST", "DB_USER"}
    assert "COMMENTED" not in used
    assert "DOC_IGNORED" not in used


def test_missing_and_unused(tmp_path):
    _write(tmp_path, ".env", "DB_URL=postgres://x\nUNUSED_KEY=1\n")
    _write(tmp_path, "app.py", "import os\nos.getenv('DB_URL')\nos.getenv('NEW_FLAG')\n")

    result = scan(tmp_path)
    errors = {f.name for f in result.errors}
    warnings = {f.name for f in result.warnings}

    assert "NEW_FLAG" in errors  # used but not defined
    assert "UNUSED_KEY" in warnings  # defined but not used
    assert "DB_URL" not in errors and "DB_URL" not in warnings  # reconciled


def test_duplicates(tmp_path):
    _write(tmp_path, ".env", "DB_URL=a\nDB_URL=b\nSOLO=1\n")
    _write(tmp_path, "app.py", "import os\nos.getenv('DB_URL')\nos.getenv('SOLO')\n")

    result = scan(tmp_path)
    dups = [f for f in result.findings if f.rule == "duplicates"]
    assert len(dups) == 1
    assert dups[0].name == "DB_URL"
    assert dups[0].severity == "error"
    assert "lines 1, 2" in dups[0].message
    # Single-definition key is not reported as a duplicate.
    assert "SOLO" not in {f.name for f in dups}
    # First occurrence still reconciles: DB_URL is not undefined/unused.
    assert "DB_URL" not in {f.name for f in result.warnings}


def test_public_prefix(tmp_path):
    _write(
        tmp_path,
        ".env",
        "NEXT_PUBLIC_API_KEY=x\nPUBLIC_URL=x\nAPI_KEY=x\n",
    )
    result = scan(tmp_path)
    pp = [f for f in result.findings if f.rule == "public-prefix"]
    names = {f.name for f in pp}
    assert names == {"NEXT_PUBLIC_API_KEY"}
    assert pp[0].severity == "error"
    assert "PUBLIC_URL" not in names  # public prefix but not secret-like
    assert "API_KEY" not in names  # secret-like but no public prefix


def test_clean_project_has_no_findings(tmp_path):
    _write(tmp_path, ".env", "DB_URL=x\n")
    _write(tmp_path, "app.py", "import os\nos.getenv('DB_URL')\n")
    result = scan(tmp_path)
    assert result.findings == []
