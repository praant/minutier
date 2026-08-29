import { describe, expect, it } from 'vitest';
import { buildTaskLevels } from './graph';
import { createSampleMep } from './sample';

describe('graphe de dépendances', () => {
  it('place les tâches parallèles au même niveau', () => {
    const levels = buildTaskLevels(createSampleMep().definition.tasks);
    expect(levels.map((level) => level.map((task) => task.id))).toEqual([['preflight'], ['api', 'web'], ['validation']]);
  });
  it('conserve les tâches sans dépendance à la racine', () => {
    const tasks = createSampleMep().definition.tasks;
    tasks[1].dependsOn = [];
    expect(buildTaskLevels(tasks)[0].map((task) => task.id)).toEqual(['preflight', 'api']);
  });
  it('place un projet après la première contrainte de ses sous-tâches', () => {
    const tasks = createSampleMep().definition.tasks;
    tasks.push({ id: 'deployments', kind: 'project', parentId: null, title: 'Déploiements', description: '', actorId: 'actor-release', plannedDurationSeconds: 60, dependsOn: [], actions: [], links: [] });
    tasks.find((task) => task.id === 'api')!.parentId = 'deployments';
    tasks.find((task) => task.id === 'web')!.parentId = 'deployments';
    const levels = buildTaskLevels(tasks).map((level) => level.map((task) => task.id));
    expect(levels[1]).toContain('deployments');
    expect(levels[0]).not.toContain('deployments');
  });
});
