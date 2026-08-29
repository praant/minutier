'use client';

import { useEffect, useMemo, useState } from 'react';
import { assignActor, completeTask, getTaskView, launchMep, startTask, toggleAction, type Actor, type Mep, type TaskDefinition, type TaskStatus } from '../lib/mep';
import { createSampleMep } from '../lib/sample';
import { loadMep, saveMep } from '../lib/storage';
import { downloadMepCsv } from '../lib/export';
import { buildTaskLevels } from '../lib/graph';

const statusText: Record<TaskStatus, string> = { blocked: 'Bloquée', ready: 'Prête', running: 'En cours', overdue: 'En dépassement', completed: 'Terminée' };
const formatTime = (seconds: number) => `${seconds < 0 ? '+' : ''}${Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.abs(seconds) % 60).toString().padStart(2, '0')}`;

export default function Home() {
  const [mep, setMep] = useState<Mep>(() => createSampleMep());
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>('preflight');
  const [error, setError] = useState('');

  useEffect(() => {
    // The browser is the source of truth after hydration; storage is unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMep(loadMep(window.localStorage) ?? createSampleMep());
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) saveMep(window.localStorage, mep); }, [hydrated, mep]);
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(interval); }, []);

  const taskViews = useMemo(() => mep.definition.tasks.map((task) => getTaskView(mep, task.id, now)), [mep, now]);
  const selected = mep.definition.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedView = selected ? getTaskView(mep, selected.id, now) : null;
  const completedCount = taskViews.filter((task) => task.status === 'completed').length;
  const progress = mep.definition.tasks.length ? (completedCount / mep.definition.tasks.length) * 100 : 0;

  const editDefinition = (updater: (draft: Mep['definition']) => void) => {
    if (mep.status !== 'draft') return;
    setMep((current) => { const definition = structuredClone(current.definition); updater(definition); return { ...current, definition }; });
  };
  const editTask = (taskId: string, updater: (task: TaskDefinition) => void) => editDefinition((definition) => { const task = definition.tasks.find((candidate) => candidate.id === taskId); if (task) updater(task); });
  const addTask = () => { const id = crypto.randomUUID(); editDefinition((definition) => definition.tasks.push({ id, title: 'Nouvelle tâche', description: '', actorId: definition.actors[0]?.id ?? '', plannedDurationSeconds: 300, dependsOn: [], actions: [], links: [] })); setSelectedTaskId(id); };
  const run = (operation: () => Mep) => { try { setMep(operation()); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Une erreur est survenue.'); } };
  const reset = () => { const fresh = createSampleMep(); setMep(fresh); setSelectedTaskId(fresh.definition.tasks[0].id); setError(''); };

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><div><strong>MEP Tempo</strong><span>Poste de commande</span></div></div><div className="top-actions"><span className={`mep-state mep-state--${mep.status}`}><i /> {mep.status === 'draft' ? 'Brouillon modifiable' : mep.status === 'running' ? 'MEP en cours' : 'MEP terminée'}</span><button className="button button--sheets" onClick={() => downloadMepCsv(mep, now)} title="Télécharger un CSV compatible avec Google Sheets">▦ Exporter Sheets</button><button className="button button--ghost" onClick={reset}>Réinitialiser</button>{mep.status === 'draft' && <button className="button button--primary" onClick={() => run(() => launchMep(mep))}>Lancer la MEP <span>→</span></button>}</div></header>
    <section className="hero"><div><p className="eyebrow">MISE EN PRODUCTION · {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>{mep.status === 'draft' ? <input className="title-input" aria-label="Titre de la MEP" value={mep.definition.title} onChange={(event) => editDefinition((definition) => { definition.title = event.target.value; })} /> : <h1>{mep.definition.title}</h1>}<p className="hero-copy">{mep.status === 'draft' ? 'Préparez le déroulé. Au lancement, cette définition sera figée.' : 'Suivez les opérations en temps réel. Les tâches prêtes peuvent être lancées en parallèle.'}</p></div><div className="progress-panel"><div><span>Progression globale</span><strong>{completedCount} / {mep.definition.tasks.length}</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)} % terminé</small></div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <MepGraph mep={mep} now={now} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
    <div className="workspace"><section className="task-list-panel"><div className="section-heading"><div><p className="eyebrow">DÉROULÉ</p><h2>{mep.definition.tasks.length} tâches</h2></div>{mep.status === 'draft' && <button className="icon-button" onClick={addTask} aria-label="Ajouter une tâche">＋</button>}</div><div className="task-list">{taskViews.map((task, index) => <button key={task.id} className={`task-row ${selectedTaskId === task.id ? 'task-row--selected' : ''}`} onClick={() => setSelectedTaskId(task.id)}><span className={`task-number task-number--${task.status}`}>{task.status === 'completed' ? '✓' : index + 1}</span><span className="task-row-copy"><strong>{task.title}</strong><small>{mep.definition.actors.find((actor) => actor.id === task.actorId)?.name ?? 'Non affecté'} · {statusText[task.status]} · {Math.ceil(task.plannedDurationSeconds / 60)} min</small></span>{(task.status === 'running' || task.status === 'overdue') && <b className={task.status === 'overdue' ? 'timer timer--late' : 'timer'}>{formatTime(task.remainingSeconds)}</b>}<span className="chevron">›</span></button>)}</div>{mep.status !== 'draft' && <div className="legend"><span><i className="dot dot--ready" />Prête</span><span><i className="dot dot--running" />En cours</span><span><i className="dot dot--blocked" />Bloquée</span></div>}</section>
      <section className="detail-panel">{!selected || !selectedView ? <div className="empty-state">Sélectionnez une tâche.</div> : mep.status === 'draft' ? <DraftEditor task={selected} actors={mep.definition.actors} allTasks={mep.definition.tasks} onAssignActor={(name) => editDefinition((definition) => assignActor(definition, selected.id, name))} onEdit={(updater) => editTask(selected.id, updater)} onDelete={() => { editDefinition((definition) => { definition.tasks = definition.tasks.filter((task) => task.id !== selected.id).map((task) => ({ ...task, dependsOn: task.dependsOn.filter((id) => id !== selected.id) })); }); setSelectedTaskId(mep.definition.tasks.find((task) => task.id !== selected.id)?.id ?? null); }} /> : <ExecutionPanel task={selectedView} mep={mep} onStart={() => run(() => startTask(mep, selected.id))} onComplete={() => run(() => completeTask(mep, selected.id))} onToggle={(actionId) => run(() => toggleAction(mep, selected.id, actionId))} />}</section>
    </div><footer><span>Les données restent sur cet appareil</span><span>•</span><span>Sauvegarde automatique</span></footer>
  </main>;
}

function MepGraph({ mep, now, selectedTaskId, onSelect }: { mep: Mep; now: Date; selectedTaskId: string | null; onSelect: (id: string) => void }) {
  const levels = buildTaskLevels(mep.definition.tasks);
  return <section className="graph-panel" aria-label="Graphe temps réel de la MEP"><div className="graph-header"><div><p className="eyebrow">VISION TEMPS RÉEL</p><h2>Arbre de la MEP</h2></div><div className="graph-legend"><span><i className="graph-dot graph-dot--idle" />Pas démarré</span><span><i className="graph-dot graph-dot--running" />En cours</span><span><i className="graph-dot graph-dot--done" />OK</span></div></div><div className="graph-scroll"><div className="graph-tree">{levels.map((level, levelIndex) => <div className="graph-stage" key={levelIndex}><small>ÉTAPE {levelIndex + 1}</small><div className="graph-stage-nodes">{level.map((task) => {
    const view = getTaskView(mep, task.id, now);
    const color = view.status === 'completed' ? 'done' : view.status === 'running' || view.status === 'overdue' ? 'running' : 'idle';
    const actor = mep.definition.actors.find((candidate) => candidate.id === task.actorId)?.name ?? 'Non affecté';
    return <button key={task.id} className={`graph-node graph-node--${color} ${selectedTaskId === task.id ? 'graph-node--selected' : ''}`} onClick={() => onSelect(task.id)}><span className="graph-node-status">{color === 'done' ? '✓ OK' : color === 'running' ? `● ${view.status === 'overdue' ? 'DÉPASSEMENT' : 'EN COURS'}` : '○ PAS DÉMARRÉ'}</span><strong>{task.title}</strong><small>{actor}</small>{color === 'running' && <b>{formatTime(view.remainingSeconds)}</b>}</button>;
  })}</div>{levelIndex < levels.length - 1 && <span className="graph-arrow" aria-hidden="true">→</span>}</div>)}</div></div></section>;
}

function DraftEditor({ task, actors, allTasks, onAssignActor, onEdit, onDelete }: { task: TaskDefinition; actors: Actor[]; allTasks: TaskDefinition[]; onAssignActor: (name: string) => void; onEdit: (updater: (task: TaskDefinition) => void) => void; onDelete: () => void }) {
  const actorName = actors.find((actor) => actor.id === task.actorId)?.name ?? '';
  return <div className="editor"><div className="detail-heading"><div><p className="eyebrow">DÉFINITION DE LA TÂCHE</p><h2>Préparer l’étape</h2></div><button className="danger-link" onClick={onDelete}>Supprimer</button></div><label>Titre<input value={task.title} onChange={(event) => onEdit((draft) => { draft.title = event.target.value; })} /></label><ActorField key={`${task.id}-${task.actorId}`} value={actorName} actors={actors} onCommit={onAssignActor} /><label>Consignes<textarea rows={4} value={task.description} onChange={(event) => onEdit((draft) => { draft.description = event.target.value; })} /></label><label>Durée prévue (minutes)<input type="number" min="1" value={Math.ceil(task.plannedDurationSeconds / 60)} onChange={(event) => onEdit((draft) => { draft.plannedDurationSeconds = Math.max(60, Number(event.target.value) * 60); })} /></label><fieldset><legend>Dépend de</legend><div className="choice-grid">{allTasks.filter((candidate) => candidate.id !== task.id).map((candidate) => <label className="check-choice" key={candidate.id}><input type="checkbox" checked={task.dependsOn.includes(candidate.id)} onChange={() => onEdit((draft) => { draft.dependsOn = draft.dependsOn.includes(candidate.id) ? draft.dependsOn.filter((id) => id !== candidate.id) : [...draft.dependsOn, candidate.id]; })} />{candidate.title}</label>)}{allTasks.length === 1 && <small>Aucune autre tâche disponible.</small>}</div></fieldset><ListEditor title="Actions à cocher" items={task.actions} onChange={(items) => onEdit((draft) => { draft.actions = items; })} /><LinkEditor task={task} onEdit={onEdit} /><div className="freeze-note"><strong>Définition modifiable</strong><span>Elle sera figée dès le lancement de la MEP.</span></div></div>;
}

function ActorField({ value, actors, onCommit }: { value: string; actors: Actor[]; onCommit: (name: string) => void }) {
  const [name, setName] = useState(value);
  return <label>Acteur affecté<input list="actor-list" value={name} placeholder="Nom de l’acteur" onChange={(event) => setName(event.target.value)} onBlur={() => onCommit(name)} /><datalist id="actor-list">{actors.map((actor) => <option key={actor.id} value={actor.name} />)}</datalist><small className="field-hint">Un nom inconnu sera automatiquement ajouté à la BDD.</small></label>;
}

function ListEditor({ title, items, onChange }: { title: string; items: { id: string; label: string }[]; onChange: (items: { id: string; label: string }[]) => void }) {
  return <fieldset><legend>{title}</legend><div className="editable-list">{items.map((item) => <div key={item.id}><input value={item.label} onChange={(event) => onChange(items.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate))} /><button onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}>×</button></div>)}<button className="add-link" onClick={() => onChange([...items, { id: crypto.randomUUID(), label: 'Nouvelle action' }])}>＋ Ajouter une action</button></div></fieldset>;
}

function LinkEditor({ task, onEdit }: { task: TaskDefinition; onEdit: (updater: (task: TaskDefinition) => void) => void }) {
  return <fieldset><legend>Liens utiles</legend><div className="editable-list">{task.links.map((link) => <div className="link-fields" key={link.id}><input value={link.label} aria-label="Libellé du lien" onChange={(event) => onEdit((draft) => { const target = draft.links.find((item) => item.id === link.id); if (target) target.label = event.target.value; })} /><input value={link.url} aria-label="URL" onChange={(event) => onEdit((draft) => { const target = draft.links.find((item) => item.id === link.id); if (target) target.url = event.target.value; })} /><button onClick={() => onEdit((draft) => { draft.links = draft.links.filter((item) => item.id !== link.id); })}>×</button></div>)}<button className="add-link" onClick={() => onEdit((draft) => { draft.links.push({ id: crypto.randomUUID(), label: 'Documentation', url: 'https://' }); })}>＋ Ajouter un lien</button></div></fieldset>;
}

function ExecutionPanel({ task, mep, onStart, onComplete, onToggle }: { task: ReturnType<typeof getTaskView>; mep: Mep; onStart: () => void; onComplete: () => void; onToggle: (id: string) => void }) {
  const doneActions = task.execution?.completedActionIds ?? [];
  const blockers = task.dependsOn.filter((id) => !mep.execution?.tasks[id]?.endedAt).map((id) => mep.definition.tasks.find((candidate) => candidate.id === id)?.title);
  return <div className="execution"><div className="detail-heading"><div><p className="eyebrow">TÂCHE SÉLECTIONNÉE</p><h2>{task.title}</h2></div><span className={`status-pill status-pill--${task.status}`}>{statusText[task.status]}</span></div><p className="instructions">{task.description || 'Aucune consigne particulière.'}</p>{(task.status === 'running' || task.status === 'overdue') && <div className={`big-timer ${task.status === 'overdue' ? 'big-timer--late' : ''}`}><span>{task.status === 'overdue' ? 'Dépassement' : 'Temps restant'}</span><strong>{formatTime(task.remainingSeconds)}</strong><small>Prévu : {Math.ceil(task.plannedDurationSeconds / 60)} minutes</small></div>}{task.status === 'blocked' && <div className="blocked-note"><strong>En attente</strong><span>Terminez d’abord : {blockers.join(', ')}</span></div>}{task.status === 'ready' && <button className="button button--primary button--wide" onClick={onStart}>Démarrer cette tâche</button>}{(task.status === 'running' || task.status === 'overdue') && <button className="button button--complete button--wide" onClick={onComplete}>✓ Terminer manuellement</button>}{task.status === 'completed' && <div className="completed-note"><strong>Tâche terminée</strong><span>Fin enregistrée à {task.execution?.endedAt ? new Date(task.execution.endedAt).toLocaleTimeString('fr-FR') : ''}</span></div>}<div className="execution-section"><div className="subheading"><h3>Checklist</h3><span>{doneActions.length}/{task.actions.length}</span></div>{task.actions.length ? task.actions.map((action) => <label className="action-item" key={action.id}><input type="checkbox" disabled={task.status === 'blocked'} checked={doneActions.includes(action.id)} onChange={() => onToggle(action.id)} /><span>{action.label}</span></label>) : <p className="muted">Aucune action définie.</p>}</div>{task.links.length > 0 && <div className="execution-section"><h3>Liens utiles</h3><div className="resource-links">{task.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>↗</span>{link.label}</a>)}</div></div>}</div>;
}
