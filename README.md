# jsonl-check

A dependency-free Node.js CLI that validates [JSON Lines](https://jsonlines.org/) files before they enter a pipeline.

It checks every line independently and reports exact line numbers for:

- malformed JSON values;
- blank lines;
- a forbidden UTF-8 byte order mark (BOM);
- invalid UTF-8 bytes;
- non-object values when `--require-object` is enabled.

Diagnostics never repeat input content, so control characters from an untrusted file cannot alter the human-readable report.

## Requirements

- Node.js 20 or newer
- npm (included with Node.js)

## Quick start from a clone

```bash
git clone https://github.com/KamiBuilds/jsonl-check.git
cd jsonl-check
npm ci
node src/cli.js examples/valid.jsonl
```

No global installation is required.

## Usage

```text
jsonl-check [--json] [--require-object] [file]
```

Pass one file, or omit it to read standard input.

Validate a file:

```bash
node src/cli.js examples/valid.jsonl
```

Show structured output for automation:

```bash
node src/cli.js --json examples/invalid.jsonl
```

Require every parsed value to be a JSON object rather than an array, scalar, or `null`:

```bash
node src/cli.js --require-object data.jsonl
```

Read from standard input on Linux or macOS:

```bash
node src/cli.js < examples/valid.jsonl
```

### Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | Every record passed validation |
| 1 | One or more content or policy errors were found |
| 2 | Invalid arguments or the input file could not be read |

The `records` count is the number of lines that parsed as JSON. A parsed scalar that fails `--require-object` still counts as a parsed record and also produces an `OBJECT_REQUIRED` error. A BOM makes the first line invalid, but validation and record counting continue on later lines.

### Resource limits

The CLI accepts at most 10 MiB (10,485,760 bytes) from either a file or standard input. It checks a file's size before streaming its contents and stops collecting either source if it crosses the limit. Oversized input produces `INPUT_TOO_LARGE` and exits with code 1.

At most 100 line-level validation errors are retained. If more are found, one final `ERROR_LIMIT_REACHED` diagnostic reports that additional errors were omitted; parsing continues so the `records` count remains accurate.

## JSON report shape

```json
{
  "source": "examples/invalid.jsonl",
  "records": 1,
  "errors": [
    {
      "code": "BLANK_LINE",
      "line": 2,
      "message": "Blank lines are not valid JSON Lines records"
    },
    {
      "code": "INVALID_JSON",
      "line": 3,
      "message": "Invalid JSON value"
    }
  ]
}
```

Invalid UTF-8 cannot be assigned a reliable text line number, so that error uses `"line": null`.

## Development and tests

Install exactly the locked dependency set (currently empty) and run all checks:

```bash
npm ci
npm test
npm run check
```

Exercise the documented main flows:

```bash
node src/cli.js examples/valid.jsonl
node src/cli.js --json examples/invalid.jsonl > jsonl-check-report.json || test $? -eq 1
node src/cli.js --require-object examples/valid.jsonl
rm jsonl-check-report.json
```

## Update

From the cloned repository:

```bash
git pull --ff-only
npm ci
npm test
```

## Uninstall and cleanup

The tool creates no service, global package, or configuration outside its clone. Leave the repository and delete that cloned directory with your file manager. On Linux or macOS, run this prompt-before-removal command from the clone's parent directory:

```bash
rm -rI jsonl-check
```

## Platform support

| Platform | Status |
| --- | --- |
| Linux with Node.js 24 | Live-tested |
| Linux with Node.js 20 or 22 | Designed; not live-tested in this release |
| macOS with Node.js 20+ | Designed; not live-tested in this release |
| Windows with Node.js 20+ | Designed; not live-tested in this release |

The implementation uses only cross-platform Node.js APIs. Shell redirection and cleanup examples use POSIX syntax; direct file validation commands work the same in PowerShell and Command Prompt.

## License

MIT
