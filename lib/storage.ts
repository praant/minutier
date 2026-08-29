import type { Mep, MepDefinition } from './mep';

export const STORAGE_KEY = 'mep-timer-v2';
export const WORKSPACE_KEY = 'mep-timer-workspace-v3';

export interface MepTemplate { id: string; name: string; createdAt: string; definition: MepDefinition; }
export interface MepWorkspace { version: 3; selectedMepId: string; meps: Mep[]; templates: MepTemplate[]; }

export function createWorkspace(mep: Mep): MepWorkspace {
  return { version: 3, selectedMepId: mep.id, meps: [migrateMep(mep)], templates: [] };
}

export function loadWorkspace(storage: Pick<Storage, 'getItem'>, fallback: Mep): MepWorkspace {
  const raw = storage.getItem(WORKSPACE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MepWorkspace;
      const meps = parsed.meps.map(migrateMep);
      return { version: 3, meps, templates: parsed.templates ?? [], selectedMepId: meps.some((mep) => mep.id === parsed.selectedMepId) ? parsed.selectedMepId : meps[0]?.id ?? fallback.id };
    } catch { /* Fall through to the legacy record. */ }
  }
  return createWorkspace(loadMep(storage) ?? fallback);
}

export function saveWorkspace(storage: Pick<Storage, 'setItem'>, workspace: MepWorkspace): void {
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}

export function createMepFromDefinition(definition: MepDefinition, title?: string): Mep {
  const copy = structuredClone(definition);
  return { id: crypto.randomUUID(), status: 'draft', execution: null, definition: { ...copy, title: title?.trim() || copy.title } };
}

export function createTemplate(mep: Mep, now = new Date()): MepTemplate {
  if (mep.status !== 'completed') throw new Error('Seule une MEP exécutée peut devenir un modèle.');
  return { id: crypto.randomUUID(), name: mep.definition.title, createdAt: now.toISOString(), definition: structuredClone(mep.definition) };
}

export function loadMep(storage: Pick<Storage, 'getItem'>): Mep | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return migrateMep(JSON.parse(raw) as Mep); } catch { return null; }
}

export function saveMep(storage: Pick<Storage, 'setItem'>, mep: Mep): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(mep));
}

export function migrateMep(mep: Mep): Mep {
  const actors = mep.definition.actors;
  const fallbackActor = { id: 'actor-migration-non-affecte', name: 'Non affecté' };
  const now = new Date();
  return { ...mep, definition: { ...mep.definition,
    plannedStartAt: mep.definition.plannedStartAt || new Date(now.getTime() + 3600000).toISOString().slice(0, 16),
    plannedEndAt: mep.definition.plannedEndAt || new Date(now.getTime() + 7200000).toISOString().slice(0, 16),
    actors: Array.isArray(actors) && actors.length ? actors : [fallbackActor],
    tasks: mep.definition.tasks.map((task) => ({ ...task, actorId: task.actorId || fallbackActor.id })),
  } };
}
