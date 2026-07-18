export function parseFirstCell(text: string): string {
  return text.split("\n", 1)[0].split("\t", 1)[0] ?? "";
}

export function serializeCell(value: unknown): string {
  return value == null ? "" : String(value);
}
