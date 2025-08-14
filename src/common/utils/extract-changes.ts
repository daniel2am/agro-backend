// src/common/utils/extract-changes.ts
export function extractChanges<T extends object>(
  oldData: Partial<T>,
  newData: Partial<T>
): string[] {
  const changes: string[] = [];

  for (const key of Object.keys(newData) as (keyof T)[]) {
    const oldVal = oldData[key];
    const newVal = newData[key];

    // ignorar se não foi enviado no PATCH
    if (newVal === undefined) continue;

    // normalizar datas para string
    const oldNorm = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
    const newNorm = newVal instanceof Date ? newVal.toISOString() : newVal;

    if (oldNorm !== newNorm) {
      changes.push(String(key));
    }
  }

  return changes;
}