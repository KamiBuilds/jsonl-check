import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, ftruncateSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

function run(args, input) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
  });
}

test('CLI validates standard input and exits zero', () => {
  const result = run([], '{"id":1}\n{"id":2}\n');

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /2 records valid/);
});

test('CLI stops collecting standard input at the byte limit', () => {
  const result = run(['--json'], Buffer.alloc(MAX_INPUT_BYTES + 1));

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.source, 'stdin');
  assert.equal(report.records, 0);
  assert.deepEqual(report.errors, [{
    code: 'INPUT_TOO_LARGE',
    line: null,
    message: 'Input exceeds the 10485760-byte limit',
  }]);
});

test('CLI emits structured JSON for an invalid file', () => {
  const result = run(['--json', 'examples/invalid.jsonl']);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.source, 'examples/invalid.jsonl');
  assert.equal(report.records, 1);
  assert.deepEqual(report.errors.map(({ code, line }) => ({ code, line })), [
    { code: 'BLANK_LINE', line: 2 },
    { code: 'INVALID_JSON', line: 3 },
  ]);
});

test('CLI rejects an oversized file before validation', (t) => {
  const directory = mkdtempSync(path.join(root, '.tmp-jsonl-check-'));
  const file = path.join(directory, 'oversized.jsonl');
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const descriptor = openSync(file, 'w');
  try {
    ftruncateSync(descriptor, MAX_INPUT_BYTES + 1);
  } finally {
    closeSync(descriptor);
  }

  const result = run(['--json', file]);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.records, 0);
  assert.deepEqual(report.errors, [{
    code: 'INPUT_TOO_LARGE',
    line: null,
    message: 'Input exceeds the 10485760-byte limit',
  }]);
});

test('CLI prints help without reading standard input', () => {
  const result = run(['--help']);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /^Usage: jsonl-check/);
});
