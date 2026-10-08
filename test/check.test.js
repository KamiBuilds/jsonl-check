import assert from 'node:assert/strict';
import test from 'node:test';

import { checkJsonl, checkJsonlBytes } from '../src/check.js';

test('accepts one JSON value per line', () => {
  const result = checkJsonl('{"id":1}\n[2,3]\ntrue\n');

  assert.equal(result.records, 3);
  assert.deepEqual(result.errors, []);
});

test('reports malformed JSON with its line number', () => {
  const result = checkJsonl('{"ok":true}\n{"broken":}\n');

  assert.equal(result.records, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, 'INVALID_JSON');
  assert.equal(result.errors[0].line, 2);
});

test('rejects blank lines instead of skipping them', () => {
  const result = checkJsonl('{"first":1}\n\n{"third":3}');

  assert.equal(result.records, 2);
  assert.deepEqual(result.errors, [
    { code: 'BLANK_LINE', line: 2, message: 'Blank lines are not valid JSON Lines records' },
  ]);
});

test('optionally requires each record to be a JSON object', () => {
  const result = checkJsonl('{"ok":true}\n[1,2]\nnull\n', { requireObject: true });

  assert.equal(result.records, 3);
  assert.deepEqual(result.errors.map(({ code, line }) => ({ code, line })), [
    { code: 'OBJECT_REQUIRED', line: 2 },
    { code: 'OBJECT_REQUIRED', line: 3 },
  ]);
});

test('caps accumulated validation errors and reports omitted findings', () => {
  const result = checkJsonl('\n'.repeat(102));

  assert.equal(result.records, 0);
  assert.equal(result.errors.length, 101);
  assert.deepEqual(result.errors.at(-1), {
    code: 'ERROR_LIMIT_REACHED',
    line: null,
    message: 'Validation error limit of 100 reached; additional errors were omitted',
  });
});

test('rejects a UTF-8 byte order mark', () => {
  const result = checkJsonl('\uFEFF{"id":1}\n');

  assert.equal(result.records, 0);
  assert.deepEqual(result.errors, [
    { code: 'BOM_FORBIDDEN', line: 1, message: 'JSON Lines must not start with a byte order mark' },
  ]);
});

test('byte decoding reports a BOM and continues with later records', () => {
  const result = checkJsonlBytes(Buffer.from(
    '\uFEFF{"skipped":true}\n{"valid":true}\n{"invalid":}\n',
    'utf8',
  ));

  assert.equal(result.records, 1);
  assert.deepEqual(result.errors, [
    { code: 'BOM_FORBIDDEN', line: 1, message: 'JSON Lines must not start with a byte order mark' },
    { code: 'INVALID_JSON', line: 3, message: 'Invalid JSON value' },
  ]);
});

test('rejects invalid UTF-8 without replacement decoding', () => {
  const result = checkJsonlBytes(Buffer.from([0x7b, 0xff, 0x7d, 0x0a]));

  assert.equal(result.records, 0);
  assert.deepEqual(result.errors, [
    { code: 'INVALID_UTF8', line: null, message: 'Input is not valid UTF-8' },
  ]);
});
