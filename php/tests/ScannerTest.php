<?php

declare(strict_types=1);

// Dependency-free test runner (no PHPUnit needed): run `php tests/ScannerTest.php`.

require __DIR__ . '/../src/Scanner.php';

use Envdoctor\Scanner;

$failures = 0;
function check(bool $cond, string $label): void
{
    global $failures;
    if ($cond) {
        echo "  ok  $label\n";
    } else {
        echo "  FAIL $label\n";
        $failures++;
    }
}

// 1) usage detection + comment stripping
$src = <<<'PHP'
<?php
// getenv("COMMENTED")
# getenv("HASH_COMMENTED")
$db = getenv("DB_URL");
$port = $_ENV["PORT"];
$host = $_SERVER["HOST"];
/* getenv("BLOCK_IGNORED") */
PHP;
$used = Scanner::scanSource('config.php', $src);
$names = array_keys($used);
sort($names);
check($names === ['DB_URL', 'HOST', 'PORT'], 'detects getenv/$_ENV/$_SERVER, ignores comments');

// 2) reconcile missing + unused
$dir = sys_get_temp_dir() . '/envd_php_' . uniqid();
mkdir($dir);
file_put_contents("$dir/.env", "DB_URL=x\nUNUSED_KEY=1\n");
file_put_contents("$dir/app.php", "<?php\ngetenv(\"DB_URL\");\ngetenv(\"NEW_FLAG\");\n");
$findings = Scanner::scan($dir);
$errors = array_map(fn($f) => $f->name, array_filter($findings, fn($f) => $f->severity === 'error'));
$warnings = array_map(fn($f) => $f->name, array_filter($findings, fn($f) => $f->severity === 'warning'));
check(in_array('NEW_FLAG', $errors, true), 'NEW_FLAG reported as error');
check(in_array('UNUSED_KEY', $warnings, true), 'UNUSED_KEY reported as warning');
check(!in_array('DB_URL', $errors, true) && !in_array('DB_URL', $warnings, true), 'DB_URL reconciled');

// 3) duplicate keys within a single file
$dir = sys_get_temp_dir() . '/envd_php_' . uniqid();
mkdir($dir);
file_put_contents("$dir/.env", "DUP=a\nSOLO=1\nDUP=b\n");
file_put_contents("$dir/app.php", "<?php\ngetenv(\"DUP\");\ngetenv(\"SOLO\");\n");
$findings = Scanner::scan($dir);
$dup = null;
foreach ($findings as $f) {
    if ($f->rule === 'duplicates') {
        $dup = $f;
        break;
    }
}
check($dup !== null && $dup->name === 'DUP' && $dup->severity === 'error', 'DUP reported as duplicates error');
check($dup !== null && $dup->message === 'defined 2 times in the same file (lines 1, 3)', 'duplicates message correct');
$soloDup = array_filter($findings, fn($f) => $f->rule === 'duplicates' && $f->name === 'SOLO');
check(count($soloDup) === 0, 'single-definition SOLO not a duplicate');
$dupOther = array_filter($findings, fn($f) => $f->name === 'DUP' && in_array($f->rule, ['unused', 'undefined-in-source'], true));
check(count($dupOther) === 0, 'duplicated-but-used DUP not also unused/undefined');

// 4) public-prefix secret leaks
$dir = sys_get_temp_dir() . '/envd_php_' . uniqid();
mkdir($dir);
file_put_contents("$dir/.env", "NEXT_PUBLIC_API_KEY=x\nVITE_SECRET=y\nPUBLIC_URL=z\nAPI_KEY=w\nPUBLIC_KEY=k\n");
$findings = Scanner::scan($dir);
$flagged = array_map(fn($f) => $f->name, array_filter($findings, fn($f) => $f->rule === 'public-prefix'));
check(in_array('NEXT_PUBLIC_API_KEY', $flagged, true), 'NEXT_PUBLIC_API_KEY flagged');
check(in_array('VITE_SECRET', $flagged, true), 'VITE_SECRET flagged');
check(!in_array('PUBLIC_URL', $flagged, true), 'PUBLIC_URL not flagged');
check(!in_array('API_KEY', $flagged, true), 'bare API_KEY not flagged');
check(!in_array('PUBLIC_KEY', $flagged, true), 'PUBLIC_KEY not flagged');
$ppSev = array_filter($findings, fn($f) => $f->rule === 'public-prefix' && $f->severity !== 'error');
check(count($ppSev) === 0, 'public-prefix findings are errors');

echo $failures === 0 ? "\nAll tests passed\n" : "\n$failures test(s) failed\n";
exit($failures === 0 ? 0 : 1);
