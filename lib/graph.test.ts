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
});
