import type { Mep } from './mep';

export type ManagementPeriod = 'past' | 'current' | 'upcoming';
export interface ActorMepSummary { mepId: string; title: string; status: Mep['status']; period: ManagementPeriod; plannedStartAt: string; plannedEndAt: string; actualStartAt: string | null; actualEndAt: string | null; taskCount: number; completedTaskCount: number; }
export interface ActorActionDetail { mepId: string; mepTitle: string; taskId: string; taskTitle: string; actionId: string; actionLabel: string; completed: boolean; startedAt: string | null; endedAt: string | null; }

const actorName = (mep: Mep, actorId: string) => mep.definition.actors.find((actor) => actor.id === actorId)?.name ?? '';
const sameActor = (left: string, right: string) => left.localeCompare(right, 'fr', { sensitivity: 'base' }) === 0;

export function listActorNames(meps: Mep[]): string[] {
  const names = meps.flatMap((mep) => mep.definition.actors.map((actor) => actor.name.trim())).filter(Boolean);
  return names.filter((name, index) => names.findIndex((candidate) => sameActor(candidate, name)) === index)
    .sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
}

export function getActorMepSummaries(meps: Mep[], name: string, now = new Date()): ActorMepSummary[] {
  return meps.flatMap((mep) => {
    const tasks = mep.definition.tasks.filter((task) => task.kind !== 'project' && sameActor(actorName(mep, task.actorId), name));
    if (!tasks.length) return [];
    const executions = tasks.map((task) => mep.execution?.tasks[task.id]).filter(Boolean);
    const starts = executions.flatMap((execution) => execution?.startedAt ? [execution.startedAt] : []);
    const ends = executions.flatMap((execution) => execution?.endedAt ? [execution.endedAt] : []);
    const plannedStart = new Date(mep.definition.plannedStartAt);
    const plannedEnd = new Date(mep.definition.plannedEndAt);
    const period: ManagementPeriod = mep.status === 'completed' || plannedEnd < now ? 'past' : plannedStart > now ? 'upcoming' : 'current';
    return [{ mepId: mep.id, title: mep.definition.title, status: mep.status, period, plannedStartAt: mep.definition.plannedStartAt, plannedEndAt: mep.definition.plannedEndAt, actualStartAt: starts.sort()[0] ?? null, actualEndAt: ends.sort().at(-1) ?? null, taskCount: tasks.length, completedTaskCount: executions.filter((execution) => execution?.endedAt).length }];
  }).sort((left, right) => new Date(right.plannedStartAt).getTime() - new Date(left.plannedStartAt).getTime());
}

export function getActorActionDetails(meps: Mep[], name: string): ActorActionDetail[] {
  return meps.flatMap((mep) => mep.definition.tasks.flatMap((task) => {
    if (task.kind === 'project') return [];
    if (!sameActor(actorName(mep, task.actorId), name)) return [];
    const execution = mep.execution?.tasks[task.id];
    return task.actions.map((action) => ({ mepId: mep.id, mepTitle: mep.definition.title, taskId: task.id, taskTitle: task.title, actionId: action.id, actionLabel: action.label, completed: execution?.completedActionIds.includes(action.id) ?? false, startedAt: execution?.startedAt ?? null, endedAt: execution?.endedAt ?? null }));
  }));
}
