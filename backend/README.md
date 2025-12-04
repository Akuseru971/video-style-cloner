# Video Style Cloner - Backend API

## Description

Backend Node.js/TypeScript pour la plateforme de clonage de style vidéo. Ce service permet de :

- Analyser une vidéo source pour extraire sa structure (scènes, textes, placements)
- Créer un template paramétrable à partir de cette analyse
- Générer des vidéos personnalisées avec logo et textes du client
- Exporter en plusieurs formats (9:16, 1:1, 16:9)

## Stack

- **Runtime** : Node.js + TypeScript
- **Framework** : Express
- **Base de données** : PostgreSQL + Prisma ORM
- **Queue** : BullMQ + Redis
- **Analyse vidéo** : Google Cloud Video Intelligence API
- **Rendu vidéo** : Creatomate
- **Storage** : Google Cloud Storage (ou S3 compatible)

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/Akuseru971/video-style-cloner.git
cd video-style-cloner/backend
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration

Créer un fichier `.env` à partir de `.env.example` :

```bash
cp .env.example .env
```

Remplir les variables d'environnement :

- `DATABASE_URL` : URL de connexion PostgreSQL
- `REDIS_HOST` / `REDIS_PORT` : Connexion Redis
- `CREATOMATE_API_KEY` : Clé API Creatomate
- `GOOGLE_CLOUD_PROJECT_ID` : ID projet GCP
- `GOOGLE_CLOUD_KEYFILE_PATH` : Chemin vers le fichier JSON de service account GCP
- `GCS_BUCKET_NAME` : Nom du bucket GCS

### 4. Générer le client Prisma

```bash
npm run prisma:generate
```

### 5. Exécuter les migrations

```bash
npm run prisma:migrate
```

### 6. Lancer le serveur en mode dev

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

## Routes API

### `POST /jobs`

Créer un job d'analyse vidéo.

**Body :**
```json
{
  "source_url": "https://www.tiktok.com/@brand/video/123"
}
```

**Réponse :**
```json
{
  "job_id": "uuid",
  "status": "PENDING_ANALYSIS"
}
```

### `GET /jobs/:id`

Récupérer l'état du job + template généré.

**Réponse :**
```json
{
  "job_id": "uuid",
  "status": "STRUCTURE_BUILT",
  "template": {
    "id": "tpl_123",
    "slots": {
      "textSlots": [
        { "key": "hook", "sceneIndex": 0, "description": "Hook principal" }
      ],
      "logoSlots": [
        { "key": "main_logo", "sceneIndex": 0, "description": "Logo principal" }
      ]
    }
  }
}
```

### `POST /jobs/:id/inputs`

Envoyer le logo et les textes du client.

**Body :**
```json
{
  "logo_uri": "https://cdn.example.com/logo.png",
  "texts": {
    "hook": "Ton message ici",
    "cta": "Clique maintenant"
  },
  "colors": {
    "primary": "#FF006E"
  },
  "options": {
    "formats": ["9:16", "1:1"]
  }
}
```

### `POST /jobs/:id/render`

Lancer le rendu vidéo.

**Réponse :**
```json
{
  "job_id": "uuid",
  "status": "RENDERING"
}
```

### `GET /jobs/:id/result`

Récupérer les vidéos finales.

**Réponse :**
```json
{
  "job_id": "uuid",
  "status": "READY",
  "outputs": {
    "9:16": "https://cdn.example.com/final-9x16.mp4",
    "1:1": "https://cdn.example.com/final-1x1.mp4"
  }
}
```

## Architecture

- **index.ts** : Serveur Express principal
- **routes/jobs.ts** : Endpoints REST
- **workers/** : Workers BullMQ pour jobs async (analyse + rendu)
- **lib/prisma.ts** : Client Prisma
- **lib/queues.ts** : Configuration BullMQ
- **lib/creatomate.ts** : Intégration API Creatomate
- **lib/gcpVideo.ts** : Intégration GCP Video Intelligence
- **lib/storage.ts** : Utilitaires stockage (GCS/S3)

## Déploiement

### Railway / Render

1. Connecter le repo GitHub
2. Ajouter les variables d'environnement
3. Ajouter les services PostgreSQL + Redis
4. Déployer

### Cloud Run (GCP)

1. Build Docker : `docker build -t gcr.io/PROJECT_ID/video-style-cloner .`
2. Push : `docker push gcr.io/PROJECT_ID/video-style-cloner`
3. Déployer : `gcloud run deploy video-style-cloner --image gcr.io/PROJECT_ID/video-style-cloner`

## Licence

MIT