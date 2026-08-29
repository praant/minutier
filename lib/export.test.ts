import { describe, expect, it } from 'vitest';
import { createMepCsv } from './export';
import { completeTask, launchMep, startTask, toggleAction } from './mep';
import { createSampleMep } from './sample';

describe('export Google Sheets', () => {
  it('génère un CSV UTF-8 avec toutes les tâches', () => {
    const csv = createMepCsv(createSampleMep(), new Date('2026-08-29T08:00:00Z'));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain('"Durée prévue (min)"');
    expect(csv).toContain('"Contrôles avant déploiement"');
  });
  it('exporte les états et les actions réalisées', () => {
    const start = new Date('2026-08-29T08:00:00Z');
    let mep = launchMep(createSampleMep(), start);
    mep = startTask(mep, 'preflight', start);
    mep = toggleAction(mep, 'preflight', 'pipeline');
    mep = completeTask(mep, 'preflight', new Date('2026-08-29T08:03:00Z'));
    const csv = createMepCsv(mep, new Date('2026-08-29T08:04:00Z'));
    expect(csv).toContain('"Terminée"');
    expect(csv).toContain('"Pipeline au vert"');
    expect(csv).toContain('"Prête"');
  });
  it('échappe les guillemets', () => {
    const mep = createSampleMep();
    mep.definition.tasks[0].description = 'Vérifier le message "OK"';
    expect(createMepCsv(mep)).toContain('"Vérifier le message ""OK"""');
  });
});
