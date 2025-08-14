// src/common/utils/change-log.ts
export function buildChanges<T extends Record<string, any>>(before: T, after: Partial<T>, keys: (keyof T)[]): string[] {
  const changed: string[] = [];
  for (const k of keys) {
    if (k in after && before?.[k] !== after[k]) {
      changed.push(String(k));
    }
  }
  return changed;
}

export function stringifyChanges(changes: string[]) {
  return changes.join(',');
}