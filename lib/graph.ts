import type { TaskDefinition } from './mep';

export function buildTaskLevels(tasks: TaskDefinition[]): TaskDefinition[][] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const cache = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (task: TaskDefinition): number => {
    const cached = cache.get(task.id);
    if (cached !== undefined) return cached;
    if (visiting.has(task.id)) return 0;
    visiting.add(task.id);
    if (task.kind === 'project') {
      const children = tasks.filter((candidate) => candidate.parentId === task.id);
      const firstConstraints = children.flatMap((child) => child.dependsOn)
        .filter((id) => id !== task.id)
        .map((id) => byId.get(id))
        .filter((item): item is TaskDefinition => Boolean(item));
      const level = firstConstraints.length ? 1 + Math.min(...firstConstraints.map(levelOf)) : 0;
      visiting.delete(task.id);
      cache.set(task.id, level);
      return level;
    }
    const dependencies = task.dependsOn.map((id) => byId.get(id)).filter((item): item is TaskDefinition => Boolean(item));
    const level = dependencies.length ? 1 + Math.max(...dependencies.map(levelOf)) : 0;
    visiting.delete(task.id);
    cache.set(task.id, level);
    return level;
  };
  const levels: TaskDefinition[][] = [];
  tasks.forEach((task) => (levels[levelOf(task)] ??= []).push(task));
  return levels;
}
