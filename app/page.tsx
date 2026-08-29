'use client';

import { useEffect, useMemo, useState } from 'react';
import { addExecutionNote, assignActor, completeTask, getTaskView, launchMep, startTask, toggleAction, type Actor, type Mep, type TaskDefinition, type TaskStatus } from '../lib/mep';
import { createSampleMep } from '../lib/sample';
import { createMepFromDefinition, createTemplate, createWorkspace, type MepTemplate } from '../lib/storage';
import { downloadMepCsv } from '../lib/export';
import { buildTaskLevels } from '../lib/graph';
import { getActorActionDetails, getActorMepSummaries, listActorNames } from '../lib/management';
import { can, roleLabel, type Profile } from '../lib/auth';
import { createClient } from '../lib/supabase/client';

const statusText: Record<TaskStatus, string> = { blocked: 'Bloquée', ready: 'Prête', running: 'En cours', overdue: 'En dépassement', completed: 'Terminée' };
const formatTime = (seconds: number) => `${seconds < 0 ? '+' : ''}${Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.abs(seconds) % 60).toString().padStart(2, '0')}`;

export default function Home() {
  const [workspace, setWorkspace] = useState(() => createWorkspace(createSampleMep()));
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>('preflight');
  const [error, setError] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [screen, setScreen] = useState<'operations' | 'management'>('operations');
  const mep = workspace.meps.find((candidate) => candidate.id === workspace.selectedMepId) ?? workspace.meps[0];
  const setMep = (next: Mep | ((current: Mep) => Mep)) => setWorkspace((current) => ({ ...current, meps: current.meps.map((item) => item.id === current.selectedMepId ? (typeof next === 'function' ? next(item) : next) : item) }));

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const [{ data: actor }, { data: rows }, { data: templateRows }] = await Promise.all([supabase.from('profiles').select('*').eq('id', user.id).single(), supabase.from('meps').select('*').order('created_at'), supabase.from('mep_templates').select('*').order('created_at')]);
      if (actor) setProfile(actor as Profile);
      if (rows?.length) { const loaded = rows.map((row) => ({ id: row.id, status: row.status, definition: row.definition, execution: row.execution })) as Mep[]; setWorkspace({ version: 3, selectedMepId: loaded[0].id, meps: loaded, templates: (templateRows ?? []).map((row) => ({ id: row.id, name: row.name, definition: row.definition, createdAt: row.created_at })) }); }
      else if (actor && can((actor as Profile).role, 'create_mep')) { const seed = createSampleMep(); setWorkspace(createWorkspace(seed)); await supabase.from('meps').insert({ id: seed.id, status: seed.status, definition: seed.definition, execution: seed.execution, created_by: user.id }); }
      setHydrated(true);
    };
    void load();
  }, []);
  useEffect(() => { if (hydrated && profile) workspace.meps.forEach((item) => { void createClient().from('meps').update({ status: item.status, definition: item.definition, execution: item.execution }).eq('id', item.id); }); }, [hydrated, profile, workspace.meps]);
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(interval); }, []);

  const taskViews = useMemo(() => mep.definition.tasks.map((task) => getTaskView(mep, task.id, now)), [mep, now]);
  const selected = mep.definition.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedView = selected ? getTaskView(mep, selected.id, now) : null;
  const executableViews = taskViews.filter((task) => task.kind !== 'project');
  const completedCount = executableViews.filter((task) => task.status === 'completed').length;
  const progress = executableViews.length ? (completedCount / executableViews.length) * 100 : 0;

  const editDefinition = (updater: (draft: Mep['definition']) => void) => {
    if (mep.status !== 'draft' || !can(profile?.role ?? null, 'create_mep')) return;
    setMep((current) => { const definition = structuredClone(current.definition); updater(definition); return { ...current, definition }; });
  };
  const editTask = (taskId: string, updater: (task: TaskDefinition) => void) => editDefinition((definition) => { const task = definition.tasks.find((candidate) => candidate.id === taskId); if (task) updater(task); });
  const addTask = (parentId: string | null = null) => { const id = crypto.randomUUID(); editDefinition((definition) => definition.tasks.push({ id, kind: 'task', parentId, title: parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche', description: '', actorId: definition.actors[0]?.id ?? '', plannedDurationSeconds: 300, dependsOn: [], actions: [], links: [] })); setSelectedTaskId(id); };
  const addProject = () => { const id = crypto.randomUUID(); editDefinition((definition) => definition.tasks.push({ id, kind: 'project', parentId: null, title: 'Nouveau projet / étape', description: '', actorId: definition.actors[0]?.id ?? '', plannedDurationSeconds: 60, dependsOn: [], actions: [], links: [] })); setSelectedTaskId(id); };
  const run = (operation: () => Mep) => { try { setMep(operation()); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Une erreur est survenue.'); } };
  const reset = () => { const fresh = { ...createSampleMep(), id: mep.id }; setMep(fresh); setSelectedTaskId(fresh.definition.tasks[0].id); setError(''); };
  const selectMep = (id: string) => { setWorkspace((current) => ({ ...current, selectedMepId: id })); const target = workspace.meps.find((item) => item.id === id); setSelectedTaskId(target?.definition.tasks[0]?.id ?? null); setError(''); };
  const addMep = (title: string, start: string, end: string, template?: MepTemplate) => {
    if (!can(profile?.role ?? null, 'create_mep')) { setError('Rôle Release Manager requis.'); return; }
    const base = template?.definition ?? createSampleMep().definition;
    const created = createMepFromDefinition({ ...structuredClone(base), plannedStartAt: start, plannedEndAt: end }, title);
    setWorkspace((current) => ({ ...current, selectedMepId: created.id, meps: [...current.meps, created] }));
    void createClient().from('meps').insert({ id: created.id, status: created.status, definition: created.definition, execution: created.execution, created_by: profile!.id });
    setSelectedTaskId(created.definition.tasks[0]?.id ?? null);
    setShowCreator(false);
  };
  const saveAsTemplate = () => { try { const template = createTemplate(mep); setWorkspace((current) => ({ ...current, templates: [...current.templates, template] })); void createClient().from('mep_templates').insert({ id: template.id, name: template.name, definition: template.definition, created_by: profile!.id }); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de créer le modèle.'); } };

  if (!hydrated || !profile) return <main className="auth-page"><p>Chargement de votre espace sécurisé…</p></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><div><strong>MEP Tempo</strong><span>{profile.display_name || profile.email} · {roleLabel[profile.role]}</span></div></div><div className="mep-switcher"><select aria-label="Minutier actif" value={mep.id} onChange={(event) => selectMep(event.target.value)}>{workspace.meps.map((item) => <option key={item.id} value={item.id}>{item.definition.title} · {item.status === 'draft' ? 'Brouillon' : item.status === 'running' ? 'En cours' : 'Terminée'}</option>)}</select>{can(profile.role, 'create_mep') && <button className="button button--new" onClick={() => setShowCreator(true)}>＋ Nouveau minutier</button>}</div><div className="top-actions">{can(profile.role, 'manage_users') && <a className="button button--new" href="/users">Utilisateurs</a>}<button className={`button button--management ${screen === 'management' ? 'button--active' : ''}`} onClick={() => setScreen(screen === 'management' ? 'operations' : 'management')}>{screen === 'management' ? '← Opérations' : '▥ Management'}</button>{screen === 'operations' && <><span className={`mep-state mep-state--${mep.status}`}><i /> {mep.status === 'draft' ? 'Brouillon modifiable' : mep.status === 'running' ? 'MEP en cours' : 'MEP terminée'}</span><button className="button button--sheets" onClick={() => downloadMepCsv(mep, now)}>▦ Exporter Sheets</button>{mep.status === 'completed' && can(profile.role, 'create_mep') && <button className="button button--template" onClick={saveAsTemplate}>☆ Enregistrer comme modèle</button>}{can(profile.role, 'create_mep') && <button className="button button--ghost" onClick={reset}>Réinitialiser</button>}{mep.status === 'draft' && can(profile.role, 'launch_mep') && <button className="button button--primary" onClick={() => run(() => launchMep(mep))}>Lancer la MEP <span>→</span></button>}</>}</div></header>
    {screen === 'management' ? <ManagementView meps={workspace.meps} now={now} onOpenMep={(id) => { selectMep(id); setScreen('operations'); }} /> : <>
    <section className="hero"><div><p className="eyebrow">MISE EN PRODUCTION · {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>{mep.status === 'draft' ? <input className="title-input" aria-label="Titre de la MEP" value={mep.definition.title} onChange={(event) => editDefinition((definition) => { definition.title = event.target.value; })} /> : <h1>{mep.definition.title}</h1>}<p className="hero-copy">{mep.status === 'draft' ? 'Préparez le déroulé. Au lancement, cette définition sera figée.' : 'Suivez les opérations en temps réel. Les tâches prêtes peuvent être lancées en parallèle.'}</p></div><div className="progress-panel"><div><span>Progression globale</span><strong>{completedCount} / {executableViews.length}</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{Math.round(progress)} % terminé</small></div></section>
    <section className="schedule-bar"><div><span>Début théorique</span>{mep.status === 'draft' ? <input type="datetime-local" value={mep.definition.plannedStartAt} onChange={(event) => editDefinition((definition) => { definition.plannedStartAt = event.target.value; })} /> : <strong>{new Date(mep.definition.plannedStartAt).toLocaleString('fr-FR')}</strong>}</div><i>→</i><div><span>Fin théorique</span>{mep.status === 'draft' ? <input type="datetime-local" value={mep.definition.plannedEndAt} min={mep.definition.plannedStartAt} onChange={(event) => editDefinition((definition) => { definition.plannedEndAt = event.target.value; })} /> : <strong>{new Date(mep.definition.plannedEndAt).toLocaleString('fr-FR')}</strong>}</div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <MepGraph mep={mep} now={now} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
    <div className="workspace"><section className="task-list-panel"><div className="section-heading"><div><p className="eyebrow">DÉROULÉ</p><h2>{executableViews.length} tâches · {taskViews.filter((task) => task.kind === 'project').length} projets</h2></div>{mep.status === 'draft' && <div className="add-buttons"><button className="icon-button" onClick={() => addTask()} aria-label="Ajouter une tâche">＋ Tâche</button><button className="icon-button" onClick={addProject} aria-label="Ajouter un projet">＋ Projet</button></div>}</div><div className="task-list">{taskViews.map((task, index) => <button key={task.id} className={`task-row ${task.kind === 'project' ? 'task-row--project' : ''} ${task.parentId ? 'task-row--child' : ''} ${selectedTaskId === task.id ? 'task-row--selected' : ''}`} onClick={() => setSelectedTaskId(task.id)}><span className={`task-number task-number--${task.status}`}>{task.kind === 'project' ? '▣' : task.status === 'completed' ? '✓' : index + 1}</span><span className="task-row-copy"><strong>{task.title}</strong><small>{task.kind === 'project' ? `${mep.definition.tasks.filter((item) => item.parentId === task.id).length} sous-tâches` : `${mep.definition.actors.find((actor) => actor.id === task.actorId)?.name ?? 'Non affecté'} · ${statusText[task.status]} · ${Math.ceil(task.plannedDurationSeconds / 60)} min`}</small></span>{(task.status === 'running' || task.status === 'overdue') && task.kind !== 'project' && <b className={task.status === 'overdue' ? 'timer timer--late' : 'timer'}>{formatTime(task.remainingSeconds)}</b>}<span className="chevron">›</span></button>)}</div>{mep.status !== 'draft' && <div className="legend"><span><i className="dot dot--ready" />Prête</span><span><i className="dot dot--running" />En cours</span><span><i className="dot dot--blocked" />Bloquée</span></div>}</section>
      <section className="detail-panel">{!selected || !selectedView ? <div className="empty-state">Sélectionnez une tâche.</div> : mep.status === 'draft' ? <DraftEditor task={selected} actors={mep.definition.actors} allTasks={mep.definition.tasks} onAddChild={() => addTask(selected.id)} onAssignActor={(name) => editDefinition((definition) => assignActor(definition, selected.id, name))} onEdit={(updater) => editTask(selected.id, updater)} onDelete={() => { editDefinition((definition) => { const removedIds = new Set([selected.id, ...definition.tasks.filter((task) => task.parentId === selected.id).map((task) => task.id)]); definition.tasks = definition.tasks.filter((task) => !removedIds.has(task.id)).map((task) => ({ ...task, dependsOn: task.dependsOn.filter((id) => !removedIds.has(id)) })); }); setSelectedTaskId(mep.definition.tasks.find((task) => task.id !== selected.id)?.id ?? null); }} /> : <ExecutionPanel task={selectedView} mep={mep} onStart={() => run(() => startTask(mep, selected.id))} onComplete={() => run(() => completeTask(mep, selected.id))} onToggle={(actionId) => run(() => toggleAction(mep, selected.id, actionId))} onAddNote={(note) => run(() => addExecutionNote(mep, selected.id, note))} />}</section>
    </div></>}<footer><span>{workspace.meps.length} minutier{workspace.meps.length > 1 ? 's' : ''} enregistré{workspace.meps.length > 1 ? 's' : ''}</span><span>•</span><span>{workspace.templates.length} modèle{workspace.templates.length > 1 ? 's' : ''}</span><span>•</span><span>Sauvegarde automatique</span></footer>
    {showCreator && <MepCreator templates={workspace.templates} onClose={() => setShowCreator(false)} onCreate={addMep} />}
  </main>;
}

function ManagementView({ meps, now, onOpenMep }: { meps: Mep[]; now: Date; onOpenMep: (id: string) => void }) {
  const actors = useMemo(() => listActorNames(meps), [meps]);
  const [actor, setActor] = useState(actors[0] ?? '');
  const [level, setLevel] = useState<'summary' | 'detail'>('summary');
  const selectedActor = actors.includes(actor) ? actor : actors[0] ?? '';
  const summaries = useMemo(() => getActorMepSummaries(meps, selectedActor, now), [meps, selectedActor, now]);
  const details = useMemo(() => getActorActionDetails(meps, selectedActor), [meps, selectedActor]);
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const periodText = { past: 'Passée', current: 'En cours', upcoming: 'À venir' } as const;
  return <section className="management-page">
    <div className="management-hero"><div><p className="eyebrow">PILOTAGE TRANSVERSE</p><h1>Vue Management</h1><p>Charge et historique des mises en production par acteur.</p></div><div className="management-kpis"><div><strong>{summaries.length}</strong><span>MEP concernées</span></div><div><strong>{summaries.filter((item) => item.period === 'upcoming').length}</strong><span>À venir</span></div><div><strong>{summaries.filter((item) => item.period === 'past').length}</strong><span>Passées</span></div></div></div>
    <div className="management-controls"><label>Acteur<select aria-label="Acteur du management" value={selectedActor} onChange={(event) => setActor(event.target.value)}>{actors.map((name) => <option key={name}>{name}</option>)}</select></label><div className="level-switch" aria-label="Niveau de vue"><button className={level === 'summary' ? 'active' : ''} onClick={() => setLevel('summary')}>Synthèse par MEP</button><button className={level === 'detail' ? 'active' : ''} onClick={() => setLevel('detail')}>Détail des actions</button></div></div>
    {level === 'summary' ? <div className="management-list"><div className="management-table-head"><span>MEP</span><span>Planning théorique</span><span>Exécution réelle</span><span>Avancement</span></div>{summaries.map((item) => <button className="management-row" key={item.mepId} onClick={() => onOpenMep(item.mepId)}><span><i className={`period-dot period-dot--${item.period}`} /><b>{item.title}</b><small>{periodText[item.period]}</small></span><span><small>Début</small>{formatDate(item.plannedStartAt)}<small>Fin · {formatDate(item.plannedEndAt)}</small></span><span><small>Première tâche démarrée</small>{formatDate(item.actualStartAt)}<small>Dernière tâche terminée · {formatDate(item.actualEndAt)}</small></span><span><b>{item.completedTaskCount}/{item.taskCount}</b><small>tâches terminées</small></span></button>)}{!summaries.length && <div className="management-empty">Aucune MEP affectée à cet acteur.</div>}</div> : <div className="action-detail-list"><div className="action-detail-head"><span>MEP / Tâche</span><span>Action</span><span>État</span><span>Horaires tâche</span></div>{details.map((item) => <div className="action-detail-row" key={`${item.mepId}-${item.taskId}-${item.actionId}`}><span><b>{item.mepTitle}</b><small>{item.taskTitle}</small></span><span>{item.actionLabel}</span><span className={item.completed ? 'action-ok' : 'action-wait'}>{item.completed ? '✓ Terminée' : '○ À faire'}</span><span><small>{formatDate(item.startedAt)}</small><small>→ {formatDate(item.endedAt)}</small></span></div>)}{!details.length && <div className="management-empty">Aucune action définie pour cet acteur.</div>}</div>}
  </section>;
}

function MepGraph({ mep, now, selectedTaskId, onSelect }: { mep: Mep; now: Date; selectedTaskId: string | null; onSelect: (id: string) => void }) {
  const levels = buildTaskLevels(mep.definition.tasks);
  return <section className="graph-panel" aria-label="Graphe temps réel de la MEP"><div className="graph-header"><div><p className="eyebrow">VISION TEMPS RÉEL</p><h2>Arbre de la MEP</h2></div><div className="graph-legend"><span><i className="graph-dot graph-dot--idle" />Pas démarré</span><span><i className="graph-dot graph-dot--running" />En cours</span><span><i className="graph-dot graph-dot--done" />OK</span></div></div><div className="graph-scroll"><div className="graph-tree">{levels.map((level, levelIndex) => {
    const visible = level.filter((task) => !task.parentId);
    if (!visible.length) return null;
    return <div className="graph-stage" key={levelIndex}><small>ÉTAPE {levelIndex + 1}</small><div className="graph-stage-nodes">{visible.map((task) => task.kind === 'project' ? <GraphProject key={task.id} project={task} mep={mep} now={now} selectedTaskId={selectedTaskId} onSelect={onSelect} /> : <GraphTaskNode key={task.id} task={task} mep={mep} now={now} selectedTaskId={selectedTaskId} onSelect={onSelect} />)}</div>{levelIndex < levels.length - 1 && <span className="graph-arrow" aria-hidden="true">→</span>}</div>;
  })}</div></div></section>;
}

function GraphProject({ project, mep, now, selectedTaskId, onSelect }: { project: TaskDefinition; mep: Mep; now: Date; selectedTaskId: string | null; onSelect: (id: string) => void }) {
  const children = mep.definition.tasks.filter((task) => task.parentId === project.id);
  const view = getTaskView(mep, project.id, now);
  const color = view.status === 'completed' ? 'done' : view.status === 'running' || view.status === 'overdue' ? 'running' : 'idle';
  return <div className={`graph-project graph-project--${color}`}><button className={`graph-project-header ${selectedTaskId === project.id ? 'graph-node--selected' : ''}`} onClick={() => onSelect(project.id)}><span>▣ PROJET / ÉTAPE</span><strong>{project.title}</strong><small>{children.length} sous-tâches · {statusText[view.status]}</small></button><div className="graph-project-children">{children.map((child) => <GraphTaskNode key={child.id} task={child} mep={mep} now={now} selectedTaskId={selectedTaskId} onSelect={onSelect} />)}{!children.length && <span className="graph-project-empty">Aucune sous-tâche</span>}</div></div>;
}

function GraphTaskNode({ task, mep, now, selectedTaskId, onSelect }: { task: TaskDefinition; mep: Mep; now: Date; selectedTaskId: string | null; onSelect: (id: string) => void }) {
  const view = getTaskView(mep, task.id, now);
  const color = view.status === 'completed' ? 'done' : view.status === 'running' || view.status === 'overdue' ? 'running' : 'idle';
  const actor = mep.definition.actors.find((candidate) => candidate.id === task.actorId)?.name ?? 'Non affecté';
  return <button className={`graph-node graph-node--${color} ${selectedTaskId === task.id ? 'graph-node--selected' : ''}`} onClick={() => onSelect(task.id)}><span className="graph-node-status">{color === 'done' ? '✓ OK' : color === 'running' ? `● ${view.status === 'overdue' ? 'DÉPASSEMENT' : 'EN COURS'}` : '○ PAS DÉMARRÉ'}</span><strong>{task.title}</strong><small>{actor}</small>{color === 'running' && <b>{formatTime(view.remainingSeconds)}</b>}</button>;
}

function MepCreator({ templates, onClose, onCreate }: { templates: MepTemplate[]; onClose: () => void; onCreate: (title: string, start: string, end: string, template?: MepTemplate) => void }) {
  const [title, setTitle] = useState('Nouvelle MEP');
  const [start, setStart] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [end, setEnd] = useState(() => new Date(Date.now() + 7200000).toISOString().slice(0, 16));
  const [templateId, setTemplateId] = useState('standard');
  const [formError, setFormError] = useState('');
  const submit = () => {
    if (!title.trim()) { setFormError('Le titre est obligatoire.'); return; }
    if (!start || !end || new Date(end) <= new Date(start)) { setFormError('La fin théorique doit être postérieure au début.'); return; }
    onCreate(title, start, end, templates.find((template) => template.id === templateId));
  };
  return <div className="modal-backdrop" role="presentation"><section className="creator-modal" role="dialog" aria-modal="true" aria-labelledby="creator-title"><div className="detail-heading"><div><p className="eyebrow">NOUVEAU MINUTIER</p><h2 id="creator-title">Créer une MEP</h2></div><button className="modal-close" onClick={onClose} aria-label="Fermer">×</button></div><label>Point de départ<select value={templateId} onChange={(event) => { setTemplateId(event.target.value); const template = templates.find((item) => item.id === event.target.value); if (template) setTitle(`${template.name} — copie`); }}><option value="standard">Exemple standard</option>{templates.map((template) => <option key={template.id} value={template.id}>Modèle · {template.name}</option>)}</select></label><label>Nom du minutier<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="creator-dates"><label>Début théorique<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Fin théorique<input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label></div>{formError && <p className="creator-error">{formError}</p>}<div className="creator-actions"><button className="button button--ghost" onClick={onClose}>Annuler</button><button className="button button--primary" onClick={submit}>Créer le minutier</button></div></section></div>;
}

function DraftEditor({ task, actors, allTasks, onAddChild, onAssignActor, onEdit, onDelete }: { task: TaskDefinition; actors: Actor[]; allTasks: TaskDefinition[]; onAddChild: () => void; onAssignActor: (name: string) => void; onEdit: (updater: (task: TaskDefinition) => void) => void; onDelete: () => void }) {
  const actorName = actors.find((actor) => actor.id === task.actorId)?.name ?? '';
  const projects = allTasks.filter((candidate) => candidate.kind === 'project' && candidate.id !== task.id);
  return <div className="editor"><div className="detail-heading"><div><p className="eyebrow">{task.kind === 'project' ? 'PROJET / ÉTAPE' : 'DÉFINITION DE LA TÂCHE'}</p><h2>{task.kind === 'project' ? 'Organiser les sous-tâches' : 'Préparer l’étape'}</h2></div><button className="danger-link" onClick={onDelete}>Supprimer</button></div><label>Type<select value={task.kind} onChange={(event) => onEdit((draft) => { draft.kind = event.target.value as 'task' | 'project'; draft.parentId = null; })}><option value="task">Tâche exécutable</option><option value="project">Projet / étape</option></select></label><label>Titre<input value={task.title} onChange={(event) => onEdit((draft) => { draft.title = event.target.value; })} /></label>{task.kind === 'task' && <label>Projet parent<select value={task.parentId ?? ''} onChange={(event) => onEdit((draft) => { draft.parentId = event.target.value || null; })}><option value="">Aucun — tâche principale</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>}<ActorField key={`${task.id}-${task.actorId}`} value={actorName} actors={actors} onCommit={onAssignActor} /><label>Consignes<textarea rows={4} value={task.description} onChange={(event) => onEdit((draft) => { draft.description = event.target.value; })} /></label>{task.kind === 'project' ? <div className="project-editor-note"><strong>{allTasks.filter((candidate) => candidate.parentId === task.id).length} sous-tâches</strong><span>Le statut du projet est calculé automatiquement.</span><button className="button button--primary" onClick={onAddChild}>＋ Ajouter une sous-tâche</button></div> : <><label>Durée prévue (minutes)<input type="number" min="1" value={Math.ceil(task.plannedDurationSeconds / 60)} onChange={(event) => onEdit((draft) => { draft.plannedDurationSeconds = Math.max(60, Number(event.target.value) * 60); })} /></label><fieldset><legend>Dépend de</legend><div className="choice-grid">{allTasks.filter((candidate) => candidate.id !== task.id && candidate.parentId !== task.id).map((candidate) => <label className="check-choice" key={candidate.id}><input type="checkbox" checked={task.dependsOn.includes(candidate.id)} onChange={() => onEdit((draft) => { draft.dependsOn = draft.dependsOn.includes(candidate.id) ? draft.dependsOn.filter((id) => id !== candidate.id) : [...draft.dependsOn, candidate.id]; })} />{candidate.title}</label>)}{allTasks.length === 1 && <small>Aucune autre tâche disponible.</small>}</div></fieldset><ListEditor title="Actions à cocher" items={task.actions} onChange={(items) => onEdit((draft) => { draft.actions = items; })} /><LinkEditor task={task} onEdit={onEdit} /></>}<div className="freeze-note"><strong>Définition modifiable</strong><span>Elle sera figée dès le lancement de la MEP.</span></div></div>;
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

function ExecutionPanel({ task, mep, onStart, onComplete, onToggle, onAddNote }: { task: ReturnType<typeof getTaskView>; mep: Mep; onStart: () => void; onComplete: () => void; onToggle: (id: string) => void; onAddNote: (note: string) => void }) {
  void onAddNote;
  const doneActions = task.execution?.completedActionIds ?? [];
  const blockers = task.dependsOn.filter((id) => !mep.execution?.tasks[id]?.endedAt).map((id) => mep.definition.tasks.find((candidate) => candidate.id === id)?.title);
  return <div className="execution"><div className="detail-heading"><div><p className="eyebrow">{task.kind === 'project' ? 'PROJET / ÉTAPE' : 'TÂCHE SÉLECTIONNÉE'}</p><h2>{task.title}</h2></div><span className={`status-pill status-pill--${task.status}`}>{statusText[task.status]}</span></div><p className="instructions">{task.description || 'Aucune consigne particulière.'}</p>{task.kind === 'project' ? <div className="project-editor-note"><strong>Avancement automatique</strong><span>{mep.definition.tasks.filter((candidate) => candidate.parentId === task.id && getTaskView(mep, candidate.id).status === 'completed').length} / {mep.definition.tasks.filter((candidate) => candidate.parentId === task.id).length} sous-tâches terminées</span></div> : <>{(task.status === 'running' || task.status === 'overdue') && <div className={`big-timer ${task.status === 'overdue' ? 'big-timer--late' : ''}`}><span>{task.status === 'overdue' ? 'Dépassement' : 'Temps restant'}</span><strong>{formatTime(task.remainingSeconds)}</strong><small>Prévu : {Math.ceil(task.plannedDurationSeconds / 60)} minutes</small></div>}{task.status === 'blocked' && <div className="blocked-note"><strong>En attente</strong><span>Terminez d’abord : {blockers.join(', ')}</span></div>}{task.status === 'ready' && <button className="button button--primary button--wide" onClick={onStart}>Démarrer cette tâche</button>}{(task.status === 'running' || task.status === 'overdue') && <button className="button button--complete button--wide" onClick={onComplete}>✓ Terminer manuellement</button>}{task.status === 'completed' && <div className="completed-note"><strong>Tâche terminée</strong><span>Fin enregistrée à {task.execution?.endedAt ? new Date(task.execution.endedAt).toLocaleTimeString('fr-FR') : ''}</span></div>}<div className="execution-section"><div className="subheading"><h3>Checklist</h3><span>{doneActions.length}/{task.actions.length}</span></div>{task.actions.length ? task.actions.map((action) => <label className="action-item" key={action.id}><input type="checkbox" disabled={task.status === 'blocked'} checked={doneActions.includes(action.id)} onChange={() => onToggle(action.id)} /><span>{action.label}</span></label>) : <p className="muted">Aucune action définie.</p>}</div>{task.links.length > 0 && <div className="execution-section"><h3>Liens utiles</h3><div className="resource-links">{task.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>↗</span>{link.label}</a>)}</div></div>}</>}</div>;
}
