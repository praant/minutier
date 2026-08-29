import { describe, expect, it } from 'vitest';
import { completeTask, getTaskStatus, launchMep, startTask, toggleAction, validateDefinition } from './mep';
import { createSampleMep } from './sample';

const at = (value: string) => new Date(value);

describe('moteur de MEP', () => {
  it('détecte les cycles de dépendances', () => {
    const mep = createSampleMep();
    mep.definition.tasks[0].dependsOn = ['validation'];
    expect(validateDefinition(mep.definition)).toContain('Les dépendances contiennent un cycle.');
  });

  it('fige une copie de la définition au lancement', () => {
    const draft = createSampleMep();
    const running = launchMep(draft, at('2026-08-28T19:00:00Z'));
    draft.definition.tasks[0].title = 'Modifié ensuite';
    expect(running.definition.tasks[0].title).toBe('Contrôles avant déploiement');
  });

  it('débloque plusieurs tâches en parallèle', () => {
    let mep = launchMep(createSampleMep(), at('2026-08-28T19:00:00Z'));
    mep = startTask(mep, 'preflight', at('2026-08-28T19:00:00Z'));
    mep = completeTask(mep, 'preflight', at('2026-08-28T19:03:00Z'));
    expect(getTaskStatus(mep, 'api', at('2026-08-28T19:03:00Z'))).toBe('ready');
    expect(getTaskStatus(mep, 'web', at('2026-08-28T19:03:00Z'))).toBe('ready');
  });

  it('signale le dépassement sans terminer automatiquement', () => {
    let mep = launchMep(createSampleMep(), at('2026-08-28T19:00:00Z'));
    mep = startTask(mep, 'preflight', at('2026-08-28T19:00:00Z'));
    expect(getTaskStatus(mep, 'preflight', at('2026-08-28T19:06:00Z'))).toBe('overdue');
    expect(mep.execution?.tasks.preflight.endedAt).toBeNull();
  });

  it('sépare la progression des actions de leur définition', () => {
    let mep = launchMep(createSampleMep());
    mep = toggleAction(mep, 'preflight', 'pipeline');
    expect(mep.execution?.tasks.preflight.completedActionIds).toEqual(['pipeline']);
    expect(mep.definition.tasks[0].actions[0]).toEqual({ id: 'pipeline', label: 'Pipeline au vert' });
  });
});

