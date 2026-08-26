/**
 * Structured logging (P7a). One JSON line per event to stdout/stderr -
 * identifiers only, never content. The field type restricts values to
 * primitives on purpose: there is no shape here for a post body, an intake
 * free-text answer, or any other prose - if a caller needs to log
 * something like that, that's the signal to log an id instead and look the
 * content up separately when actually needed.
 *
 * Covers: auth attempts, enrollment transitions, consent captures,
 * reminder sends, attendance commits, admin privileged actions - any
 * event a later session's code fires, not just what's demonstrated here.
 */

export type LogFields = Record<string, string | number | boolean | null>;

interface LogLine {
  level: "info" | "error";
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(level: LogLine["level"], event: string, fields: LogFields) {
  const line: LogLine = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const output = JSON.stringify(line);
  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export function log(event: string, fields: LogFields = {}): void {
  write("info", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  write("error", event, fields);
}
