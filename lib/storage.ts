import type { Mep } from './mep';

export const STORAGE_KEY = 'mep-timer-v2';

export function loadMep(storage: Pick<Storage, 'getItem'>): Mep | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Mep;
  } catch {
    return null;
  }
}

export function saveMep(storage: Pick<Storage, 'setItem'>, mep: Mep): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(mep));
}

