import type { Mep } from './mep';

export const createSampleMep = (): Mep => ({
  id: crypto.randomUUID(),
  status: 'draft',
  execution: null,
  definition: {
    title: 'MEP — Portail client 4.2',
    plannedStartAt: '2026-08-29T20:00',
    plannedEndAt: '2026-08-29T21:30',
    actors: [
      { id: 'actor-release', name: 'Release manager' },
      { id: 'actor-backend', name: 'Équipe Backend' },
      { id: 'actor-frontend', name: 'Équipe Frontend' },
      { id: 'actor-product', name: 'Product owner' },
    ],
    tasks: [
      {
        id: 'preflight',
        kind: 'task', parentId: null,
        title: 'Contrôles avant déploiement',
        description: 'Valider le pipeline, le plan de retour arrière et prévenir le canal de suivi.',
        actorId: 'actor-release',
        plannedDurationSeconds: 300,
        dependsOn: [],
        actions: [
          { id: 'pipeline', label: 'Pipeline au vert' },
          { id: 'rollback', label: 'Plan de rollback validé' },
        ],
        links: [{ id: 'runbook', label: 'Runbook de déploiement', url: 'https://example.com/runbook' }],
      },
      {
        id: 'api',
        kind: 'task', parentId: null,
        title: 'Déployer l’API',
        description: 'Déployer la nouvelle image puis surveiller les erreurs pendant quelques minutes.',
        actorId: 'actor-backend',
        plannedDurationSeconds: 600,
        dependsOn: ['preflight'],
        actions: [
          { id: 'deploy-api', label: 'Déploiement déclenché' },
          { id: 'logs-api', label: 'Logs contrôlés' },
        ],
        links: [{ id: 'pipeline-api', label: 'Pipeline API', url: 'https://example.com/pipeline-api' }],
      },
      {
        id: 'web',
        kind: 'task', parentId: null,
        title: 'Déployer le front',
        description: 'Publier les assets, purger le cache et vérifier la page de connexion.',
        actorId: 'actor-frontend',
        plannedDurationSeconds: 480,
        dependsOn: ['preflight'],
        actions: [
          { id: 'deploy-web', label: 'Assets publiés' },
          { id: 'smoke-web', label: 'Smoke test réussi' },
        ],
        links: [{ id: 'monitoring-web', label: 'Monitoring front', url: 'https://example.com/monitoring' }],
      },
      {
        id: 'validation',
        kind: 'task', parentId: null,
        title: 'Validation finale',
        description: 'Consolider les contrôles fonctionnels et annoncer la fin de la mise en production.',
        actorId: 'actor-product',
        plannedDurationSeconds: 300,
        dependsOn: ['api', 'web'],
        actions: [
          { id: 'business', label: 'Validation métier reçue' },
          { id: 'announce', label: 'Fin de MEP annoncée' },
        ],
        links: [],
      },
    ],
  },
});
