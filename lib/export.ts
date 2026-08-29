import { getTaskView, type Mep, type TaskStatus } from './mep';

const statusLabels: Record<TaskStatus, string> = {
  blocked: 'Bloquée', ready: 'Prête', running: 'En cours', overdue: 'En dépassement', completed: 'Terminée',
};
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function createMepCsv(mep: Mep, now = new Date()): string {
  const header = ['MEP', 'Tâche', 'Acteur affecté', 'Statut', 'Durée prévue (min)', 'Temps écoulé (min)', 'Dépendances', 'Actions réalisées', 'Actions totales', 'Consignes', 'Liens', 'Début', 'Fin'];
  const rows = mep.definition.tasks.map((task) => {
    const view = getTaskView(mep, task.id, now);
    return [
      mep.definition.title,
      task.title,
      mep.definition.actors.find((actor) => actor.id === task.actorId)?.name ?? 'Non affecté',
      statusLabels[view.status],
      Math.ceil(task.plannedDurationSeconds / 60),
      Math.floor(view.elapsedSeconds / 60),
      task.dependsOn.map((id) => mep.definition.tasks.find((candidate) => candidate.id === id)?.title ?? id).join(' | '),
      task.actions.filter((action) => view.execution?.completedActionIds.includes(action.id)).map((action) => action.label).join(' | '),
      task.actions.length,
      task.description,
      task.links.map((link) => `${link.label}: ${link.url}`).join(' | '),
      view.execution?.startedAt ?? '',
      view.execution?.endedAt ?? '',
    ];
  });
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function downloadMepCsv(mep: Mep, now = new Date()): void {
  const blob = new Blob([createMepCsv(mep, now)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeTitle = mep.definition.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  anchor.href = url;
  anchor.download = `${safeTitle || 'minutier-mep'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
