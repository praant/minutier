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

  it('migre une ancienne MEP sans acteurs', () => {
    const legacy = createSampleMep() as unknown as Record<string, unknown>;
    const definition = legacy.definition as Record<string, unknown>;
    delete definition.actors;
    definition.tasks = (definition.tasks as Array<Record<string, unknown>>).map((task) => {
      const copy = { ...task };
      delete copy.actorId;
      return copy;
    });
    const migrated = loadMep({ getItem: () => JSON.stringify(legacy) });
    expect(migrated?.definition.actors[0].name).toBe('Non affecté');
    expect(migrated?.definition.tasks.every((task) => task.actorId === 'actor-migration-non-affecte')).toBe(true);
  });
});
