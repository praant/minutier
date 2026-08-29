export type MepStatus = 'draft' | 'running' | 'completed';
export type TaskStatus = 'blocked' | 'ready' | 'running' | 'overdue' | 'completed';

export interface TaskActionDefinition {
  id: string;
  label: string;
}

export interface TaskLink {
  id: string;
  label: string;
  url: string;
}

export interface Actor {
  id: string;
  name: string;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  actorId: string;
  plannedDurationSeconds: number;
  dependsOn: string[];
  actions: TaskActionDefinition[];
  links: TaskLink[];
}

export interface MepDefinition {
  title: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actors: Actor[];
  tasks: TaskDefinition[];
}

export interface TaskExecution {
  startedAt: string | null;
  endedAt: string | null;
  completedActionIds: string[];
}

export interface MepExecution {
  launchedAt: string;
  tasks: Record<string, TaskExecution>;
}

export interface Mep {
  id: string;
  status: MepStatus;
  definition: MepDefinition;
  execution: MepExecution | null;
}

export interface TaskView extends TaskDefinition {
  status: TaskStatus;
  execution: TaskExecution | null;
  elapsedSeconds: number;
  remainingSeconds: number;
}

const emptyExecution = (): TaskExecution => ({
  startedAt: null,
  endedAt: null,
  completedActionIds: [],
});

export function validateDefinition(definition: MepDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set(definition.tasks.map((task) => task.id));
  const actorIds = new Set(definition.actors.map((actor) => actor.id));

  if (!definition.title.trim()) errors.push('Le titre de la MEP est obligatoire.');
  if (!definition.plannedStartAt || !definition.plannedEndAt) errors.push('Les dates théoriques de début et de fin sont obligatoires.');
  if (definition.plannedStartAt && definition.plannedEndAt && new Date(definition.plannedEndAt) <= new Date(definition.plannedStartAt)) errors.push('La fin théorique doit être postérieure au début.');
  if (definition.tasks.length === 0) errors.push('Ajoutez au moins une tâche.');
  if (ids.size !== definition.tasks.length) errors.push('Chaque tâche doit avoir un identifiant unique.');
  if (actorIds.size !== definition.actors.length) errors.push('Chaque acteur doit avoir un identifiant unique.');
  if (definition.actors.some((actor) => !actor.name.trim())) errors.push('Chaque acteur doit avoir un nom.');

  definition.tasks.forEach((task) => {
    if (!task.title.trim()) errors.push(`La tâche ${task.id} doit avoir un titre.`);
    if (!task.actorId || !actorIds.has(task.actorId)) errors.push(`${task.title} doit avoir un acteur affecté présent dans la BDD.`);
    if (task.plannedDurationSeconds <= 0) errors.push(`${task.title} doit avoir une durée positive.`);
    task.dependsOn.forEach((dependencyId) => {
      if (!ids.has(dependencyId)) errors.push(`${task.title} dépend d'une tâche inexistante.`);
      if (dependencyId === task.id) errors.push(`${task.title} ne peut pas dépendre d'elle-même.`);
    });
  });

  if (hasDependencyCycle(definition.tasks)) errors.push('Les dépendances contiennent un cycle.');
  return [...new Set(errors)];
}

export function assignActor(definition: MepDefinition, taskId: string, actorName: string): void {
  const task = definition.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error('Tâche introuvable.');
  const normalizedName = actorName.trim();
  if (!normalizedName) { task.actorId = ''; return; }
  let actor = definition.actors.find((candidate) => candidate.name.localeCompare(normalizedName, 'fr', { sensitivity: 'base' }) === 0);
  if (!actor) {
    actor = { id: crypto.randomUUID(), name: normalizedName };
    definition.actors.push(actor);
  }
  task.actorId = actor.id;
}

export function hasDependencyCycle(tasks: TaskDefinition[]): boolean {
  const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependencyId of graph.get(id) ?? []) {
      if (graph.has(dependencyId) && visit(dependencyId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return tasks.some((task) => visit(task.id));
}

export function launchMep(mep: Mep, now = new Date()): Mep {
  if (mep.status !== 'draft') throw new Error('Seule une MEP en brouillon peut être lancée.');
  const errors = validateDefinition(mep.definition);
  if (errors.length) throw new Error(errors.join(' '));

  const definition = structuredClone(mep.definition);
  const tasks = Object.fromEntries(definition.tasks.map((task) => [task.id, emptyExecution()]));
  return {
    ...mep,
    status: 'running',
    definition,
    execution: { launchedAt: now.toISOString(), tasks },
  };
}

export function getTaskStatus(mep: Mep, taskId: string, now = new Date()): TaskStatus {
  const task = mep.definition.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error('Tâche introuvable.');
  if (!mep.execution) return task.dependsOn.length ? 'blocked' : 'ready';

  const execution = mep.execution.tasks[taskId];
  if (execution.endedAt) return 'completed';
  const allDependenciesDone = task.dependsOn.every(
    (dependencyId) => Boolean(mep.execution?.tasks[dependencyId]?.endedAt),
  );
  if (!allDependenciesDone) return 'blocked';
  if (!execution.startedAt) return 'ready';
  const elapsed = Math.floor((now.getTime() - new Date(execution.startedAt).getTime()) / 1000);
  return elapsed > task.plannedDurationSeconds ? 'overdue' : 'running';
}

export function getTaskView(mep: Mep, taskId: string, now = new Date()): TaskView {
  const task = mep.definition.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error('Tâche introuvable.');
  const execution = mep.execution?.tasks[taskId] ?? null;
  const end = execution?.endedAt ? new Date(execution.endedAt) : now;
  const elapsedSeconds = execution?.startedAt
    ? Math.max(0, Math.floor((end.getTime() - new Date(execution.startedAt).getTime()) / 1000))
    : 0;
  return {
    ...task,
    execution,
    status: getTaskStatus(mep, taskId, now),
    elapsedSeconds,
    remainingSeconds: task.plannedDurationSeconds - elapsedSeconds,
  };
}

export function startTask(mep: Mep, taskId: string, now = new Date()): Mep {
  if (mep.status !== 'running' || !mep.execution) throw new Error('La MEP doit être en cours.');
  if (getTaskStatus(mep, taskId, now) !== 'ready') throw new Error("Cette tâche n'est pas prête.");
  return updateExecution(mep, taskId, (execution) => ({ ...execution, startedAt: now.toISOString() }));
}

export function toggleAction(mep: Mep, taskId: string, actionId: string): Mep {
  if (!mep.execution) throw new Error('La MEP doit être lancée.');
  const task = mep.definition.tasks.find((candidate) => candidate.id === taskId);
  if (!task?.actions.some((action) => action.id === actionId)) throw new Error('Action introuvable.');
  return updateExecution(mep, taskId, (execution) => ({
    ...execution,
    completedActionIds: execution.completedActionIds.includes(actionId)
      ? execution.completedActionIds.filter((id) => id !== actionId)
      : [...execution.completedActionIds, actionId],
  }));
}

export function completeTask(mep: Mep, taskId: string, now = new Date()): Mep {
  if (!mep.execution) throw new Error('La MEP doit être lancée.');
  const status = getTaskStatus(mep, taskId, now);
  if (status !== 'running' && status !== 'overdue') throw new Error('Seule une tâche démarrée peut être terminée.');
  const updated = updateExecution(mep, taskId, (execution) => ({ ...execution, endedAt: now.toISOString() }));
  const allDone = updated.definition.tasks.every((task) => updated.execution?.tasks[task.id].endedAt);
  return allDone ? { ...updated, status: 'completed' } : updated;
}

function updateExecution(mep: Mep, taskId: string, updater: (task: TaskExecution) => TaskExecution): Mep {
  if (!mep.execution?.tasks[taskId]) throw new Error('Exécution de tâche introuvable.');
  return {
    ...mep,
    execution: {
      ...mep.execution,
      tasks: { ...mep.execution.tasks, [taskId]: updater(mep.execution.tasks[taskId]) },
    },
  };
}
