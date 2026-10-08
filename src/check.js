const MAX_VALIDATION_ERRORS = 100;

function appendError(errors, error) {
  if (errors.length < MAX_VALIDATION_ERRORS) {
    errors.push(error);
  } else if (errors.length === MAX_VALIDATION_ERRORS) {
    errors.push({
      code: 'ERROR_LIMIT_REACHED',
      line: null,
      message: `Validation error limit of ${MAX_VALIDATION_ERRORS} reached; additional errors were omitted`,
    });
  }
}

export function checkJsonl(source, { requireObject = false } = {}) {
  const lines = source.split('\n');
  if (lines.at(-1) === '') lines.pop();

  const errors = [];
  let records = 0;
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (index === 0 && line.startsWith('\uFEFF')) {
      appendError(errors, {
        code: 'BOM_FORBIDDEN',
        line: 1,
        message: 'JSON Lines must not start with a byte order mark',
      });
      continue;
    }
    if (line === '') {
      appendError(errors, {
        code: 'BLANK_LINE',
        line: index + 1,
        message: 'Blank lines are not valid JSON Lines records',
      });
      continue;
    }
    try {
      const value = JSON.parse(line);
      records += 1;
      if (requireObject && (value === null || Array.isArray(value) || typeof value !== 'object')) {
        appendError(errors, {
          code: 'OBJECT_REQUIRED',
          line: index + 1,
          message: 'Record must be a JSON object',
        });
      }
    } catch {
      appendError(errors, {
        code: 'INVALID_JSON',
        line: index + 1,
        message: 'Invalid JSON value',
      });
    }
  }
  return { records, errors };
}

export function checkJsonlBytes(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return {
      records: 0,
      errors: [{ code: 'INVALID_UTF8', line: null, message: 'Input is not valid UTF-8' }],
    };
  }
  return checkJsonl(source, options);
}
