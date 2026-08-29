import { describe, expect, it } from 'vitest';
import { assignActor, completeTask, getTaskStatus, launchMep, startTask, toggleAction, validateDefinition } from './mep';
import { createSampleMep } from './sample';

const at = (value: string) => new Date(value);

describe('moteur de MEP', () => {
  it('détecte les cycles de dépendances', () => {
    const mep = createSampleMep();
    mep.definition.tasks[0].dependsOn = ['validation'];
    expect(validateDefinition(mep.definition)).toContain('Les dépendances contiennent un cycle.');
  });

  it('valide la chronologie théorique', () => {
    const mep = createSampleMep();
    mep.definition.plannedEndAt = mep.definition.plannedStartAt;
    expect(validateDefinition(mep.definition)).toContain('La fin théorique doit être postérieure au début.');
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

  it('exige un acteur référencé pour chaque tâche', () => {
    const mep = createSampleMep();
    mep.definition.tasks[0].actorId = 'acteur-inconnu';
    expect(validateDefinition(mep.definition)).toContain('Contrôles avant déploiement doit avoir un acteur affecté présent dans la BDD.');
  });

  it('réutilise un acteur existant ou le crée dans la BDD', () => {
    const mep = createSampleMep();
    assignActor(mep.definition, 'preflight', 'équipe backend');
    expect(mep.definition.tasks[0].actorId).toBe('actor-backend');
    const before = mep.definition.actors.length;
    assignActor(mep.definition, 'preflight', 'SRE de garde');
    expect(mep.definition.actors).toHaveLength(before + 1);
    expect(mep.definition.actors.find((actor) => actor.name === 'SRE de garde')?.id).toBe(mep.definition.tasks[0].actorId);
  });

  it('calcule le statut d un projet depuis ses sous-tâches', () => {
    const draft = createSampleMep();
    draft.definition.tasks.push({ id: 'deployments', kind: 'project', parentId: null, title: 'Déploiements', description: '', actorId: 'actor-release', plannedDurationSeconds: 60, dependsOn: [], actions: [], links: [] });
    draft.definition.tasks.find((task) => task.id === 'api')!.parentId = 'deployments';
    draft.definition.tasks.find((task) => task.id === 'web')!.parentId = 'deployments';
    let mep = launchMep(draft, at('2026-08-28T19:00:00Z'));
    expect(mep.execution?.tasks.deployments).toBeUndefined();
    expect(getTaskStatus(mep, 'deployments')).toBe('blocked');
    mep = startTask(mep, 'preflight', at('2026-08-28T19:00:00Z'));
    mep = completeTask(mep, 'preflight', at('2026-08-28T19:03:00Z'));
    expect(getTaskStatus(mep, 'deployments', at('2026-08-28T19:03:00Z'))).toBe('ready');
  });
});
