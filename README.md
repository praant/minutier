# MEP Tempo — version 2

Application React/Next.js pour préparer et piloter une mise en production depuis un navigateur. Les données sont enregistrées uniquement dans le `localStorage` de l'appareil.

## Installation et lancement

```bash
cd /home/adb/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/outputs/mep-timer-v2
npm install
npm run dev
```

Ouvrir ensuite l'adresse locale affichée dans le terminal.

## Étape 1 — modèle et moteur de dépendances

Fichiers :

- `lib/mep.ts` : types, validation des graphes, calcul des états, lancement, démarrage et fin manuelle.
- `lib/sample.ts` : exemple réaliste à quatre tâches, dont deux parallèles.
- `lib/mep.test.ts` : tests du cycle de dépendances, du snapshot, du parallélisme, du dépassement et des actions.

Test :

```bash
npm test -- lib/mep.test.ts
```

## Étape 2 — persistance locale

Fichiers :

- `lib/storage.ts` : lecture et écriture sous la clé `mep-timer-v2`.
- `lib/storage.test.ts` : rechargement et gestion d'une sauvegarde corrompue.

Test :

```bash
npm test -- lib/storage.test.ts
```

## Étape 3 — interface

Fichiers :

- `app/page.tsx` : éditeur de brouillon et poste de commande d'exécution.
- `app/globals.css` : interface responsive et états visuels.
- `app/layout.tsx` : métadonnées et langue du document.

Vérifications :

```bash
npm run lint
npm run build
```

## Scénario fonctionnel manuel

1. Dans le brouillon, modifier un titre, une consigne, une durée, les dépendances, actions ou liens.
2. Cliquer sur **Lancer la MEP** et vérifier que les champs d'édition disparaissent.
3. Démarrer puis terminer manuellement « Contrôles avant déploiement ».
4. Vérifier que « Déployer l'API » et « Déployer le front » deviennent prêtes simultanément.
5. Démarrer ces deux tâches en parallèle, cocher leurs actions, puis les terminer.
6. Vérifier que « Validation finale » devient prête seulement après la fin des deux tâches.
7. Recharger la page et vérifier que l'état d'exécution est conservé.

## Commandes disponibles

```bash
npm run dev        # serveur de développement
npm test           # tous les tests unitaires
npm run test:watch # tests en continu
npm run lint       # contrôle du code
npm run build      # compilation de production
npm run start      # serveur de production après compilation
```

## Déploiement Vercel

La configuration `vercel.json` sélectionne automatiquement Next.js. Après authentification :

```bash
npx vercel          # aperçu
npx vercel --prod   # production
```

L'application n'utilise aucune variable d'environnement ni base distante. Chaque navigateur conserve ses propres MEP dans son stockage local.

## Export Google Sheets

Le bouton **Exporter Sheets** télécharge un fichier CSV UTF-8 prêt à être importé dans Google Sheets. Il contient une ligne par tâche avec les statuts, durées, dépendances, actions, consignes, liens et horodatages.

Chaque tâche possède également un acteur obligatoire. Les acteurs sont conservés dans le référentiel local de la MEP. Lorsqu'un nom inconnu est saisi, il est automatiquement créé puis affecté à la tâche. L'acteur apparaît aussi dans l'export Google Sheets.

Dans Google Sheets : **Fichier → Importer**, puis sélectionner le fichier téléchargé. Le séparateur utilisé est le point-virgule, adapté aux paramètres régionaux français.
