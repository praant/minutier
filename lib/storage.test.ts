import { describe, expect, it } from 'vitest';
import { createSampleMep } from './sample';
import { loadMep, saveMep, STORAGE_KEY } from './storage';

describe('persistance locale', () => {
  it('enregistre et recharge une MEP', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const mep = createSampleMep();
    saveMep(storage, mep);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(loadMep(storage)).toEqual(mep);
  });

  it('ignore une sauvegarde corrompue', () => {
    expect(loadMep({ getItem: () => '{cassé' })).toBeNull();
  });
});
