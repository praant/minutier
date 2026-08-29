import { describe, expect, it } from 'vitest';
import { getActorActionDetails, getActorMepSummaries, listActorNames } from './management';
import { createSampleMep } from './sample';

describe('vue management', () => {
  it('regroupe les acteurs sans doublons et par ordre alphabétique', () => {
    const first = createSampleMep();
    const second = structuredClone(first);
    second.definition.actors[0].name = first.definition.actors[0].name.toLowerCase();
    expect(listActorNames([first, second])).toEqual(['Équipe Backend', 'Équipe Frontend', 'Product owner', 'Release manager']);
  });

  it('calcule le premier démarrage et la dernière fin de l acteur', () => {
    const mep = createSampleMep();
    mep.status = 'completed';
    mep.execution = { launchedAt: '2026-08-29T08:00:00Z', tasks: Object.fromEntries(mep.definition.tasks.map((task, index) => [task.id, { startedAt: `2026-08-29T08:0${index}:00Z`, endedAt: `2026-08-29T08:1${index}:00Z`, completedActionIds: task.actions.map((action) => action.id) }])) };
    const summary = getActorMepSummaries([mep], 'Équipe Backend', new Date('2026-08-30'))[0];
    expect(summary.actualStartAt).toBeTruthy();
    expect(summary.actualEndAt).toBeTruthy();
    expect(summary.period).toBe('past');
  });

  it('liste les actions avec leur état d exécution', () => {
    const details = getActorActionDetails([createSampleMep()], 'Release manager');
    expect(details.length).toBeGreaterThan(0);
    expect(details.every((action) => !action.completed)).toBe(true);
  });
});
