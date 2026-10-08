#!/usr/bin/env node

import { open } from 'node:fs/promises';
import { checkJsonlBytes } from './check.js';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

function inputTooLargeResult() {
  return {
    records: 0,
    errors: [{
      code: 'INPUT_TOO_LARGE',
      line: null,
      message: `Input exceeds the ${MAX_INPUT_BYTES}-byte limit`,
    }],
  };
}

async function collectInput(stream) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (size + bytes.length > MAX_INPUT_BYTES) {
      stream.destroy();
      return null;
    }
    chunks.push(bytes);
    size += bytes.length;
  }
  return Buffer.concat(chunks, size);
}

async function readFileWithinLimit(file) {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    if (size > MAX_INPUT_BYTES) return null;
    return await collectInput(handle.createReadStream({ autoClose: false }));
  } finally {
    await handle.close();
  }
}

function usage() {
  return 'Usage: jsonl-check [--json] [--require-object] [file]\n';
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const requireObject = args.includes('--require-object');
const files = args.filter((arg) => !['--json', '--require-object'].includes(arg));
const hasUnknownFlag = files.some((arg) => arg.startsWith('-'));

if (args.length === 1 && args[0] === '--help') {
  process.stdout.write(usage());
} else if (files.length > 1 || hasUnknownFlag) {
  process.stderr.write(usage());
  process.exitCode = 2;
} else {
  const file = files[0];
  const source = file ?? 'stdin';
  try {
    let input;
    if (file) {
      input = await readFileWithinLimit(file);
    } else {
      input = await collectInput(process.stdin);
    }

    const result = input === null
      ? inputTooLargeResult()
      : checkJsonlBytes(input, { requireObject });
    if (json) {
      process.stdout.write(`${JSON.stringify({ source, ...result }, null, 2)}\n`);
    } else if (result.errors.length === 0) {
      process.stdout.write(`${file ? 'file' : 'stdin'}: ${result.records} records valid\n`);
    } else {
      for (const error of result.errors) {
        const location = error.line == null ? '' : `line ${error.line}: `;
        process.stdout.write(`[${error.code}] ${location}${error.message}\n`);
      }
      process.stdout.write(`${result.errors.length} error(s), ${result.records} parsed record(s)\n`);
    }
    process.exitCode = result.errors.length === 0 ? 0 : 1;
  } catch {
    process.stderr.write('jsonl-check: unable to read input file\n');
    process.exitCode = 2;
  }
}
