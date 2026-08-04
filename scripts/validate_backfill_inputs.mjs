import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const maximumRangeDays = 31;

export class BackfillInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackfillInputError';
  }
}

function parseCalendarDate(value, label) {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new BackfillInputError(`${label} must be a YYYY-MM-DD calendar date`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BackfillInputError(`${label} must be a real calendar date`);
  }
  return date;
}

export function validateBackfillRange(startDate, endDate) {
  const start = parseCalendarDate(startDate, 'start_date');
  const end = parseCalendarDate(endDate, 'end_date');
  const days = (end.getTime() - start.getTime()) / millisecondsPerDay;

  if (days < 0) {
    throw new BackfillInputError('end_date must not precede start_date');
  }
  if (days > maximumRangeDays) {
    throw new BackfillInputError(`manual backfill range must not exceed ${maximumRangeDays} days`);
  }

  return Object.freeze({ start_date: startDate, end_date: endDate, days });
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--github-output') {
    throw new BackfillInputError('usage: validate_backfill_inputs.mjs --github-output');
  }
  if (!process.env.GITHUB_OUTPUT) {
    throw new BackfillInputError('GITHUB_OUTPUT is required for validated workflow handoff');
  }

  const range = validateBackfillRange(process.env.BACKFILL_START_DATE, process.env.BACKFILL_END_DATE);
  await appendFile(process.env.GITHUB_OUTPUT, `start_date=${range.start_date}\nend_date=${range.end_date}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'invalid manual backfill input';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
