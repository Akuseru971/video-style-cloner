# Guide de Déploiement - Video Style Cloner

Ce guide te permettra de déployer la plateforme complète en ligne, du backend à n8n, en utilisant des services managés.

---

## 📋 Vue d'ensemble du stack

- **Backend API** : Node.js + TypeScript + Express + Prisma + BullMQ
- **Base de données** : PostgreSQL (managé)
- **Queue/Cache** : Redis (pour BullMQ)
- **Storage vidéo** : S3-compatible (AWS S3, Cloudflare R2, Backblaze B2)
- **Analyse vidéo** : Google Cloud Video Intelligence API
- **Rendu vidéo** : Creatomate API
- **Orchestration** : n8n (optionnel, pour automatisations avancées)

---

## 🚀 Étape 1 : Créer les comptes et récupérer les clés API

### 1.1 Google Cloud Platform (Analyse vidéo + Storage)

1. Va sur https://console.cloud.google.com
2. Crée un nouveau projet "video-style-cloner"
3. Active les APIs :
   - **Video Intelligence API**
   - **Cloud Storage API**
4. Crée un compte de service :
   - IAM & Admin → Comptes de service → Créer
   - Rôles : "Video Intelligence Admin" + "Storage Admin"
   - Télécharge la clé JSON (tu en auras besoin)
5. Crée un bucket Cloud Storage :
   - Storage → Browser → Create bucket
   - Nom : `video-cloner-storage` (unique globalement)
   - Région : Europe (ou proche de toi)

### 1.2 Creatomate (Rendu vidéo)

1. Va sur https://creatomate.com
2. Crée un compte
3. Récupère ta clé API :
   - Dashboard → API Keys → Copy
4. (Optionnel) Crée un premier template simple dans leur éditeur pour tester

### 1.3 Railway / Render (Hébergement backend)

**Option A : Railway (recommandé, simple)**

1. Va sur https://railway.app
2. Connecte ton compte GitHub
3. Clique "New Project" → "Deploy from GitHub repo"
4. Sélectionne `video-style-cloner`

**Option B : Render**

1. Va sur https://render.com
2. Connecte ton GitHub
3. "New +" → "Web Service"
4. Sélectionne ton repo

---

## 🛠️ Étape 2 : Configuration des services managés

### 2.1 PostgreSQL (sur Railway ou Render)

**Sur Railway :**
1. Dans ton projet Railway, clique "+ New"
2. Sélectionne "Database" → "PostgreSQL"
3. Railway génère automatiquement `DATABASE_URL`
4. Copie cette variable (elle sera injectée automatiquement)

**Sur Render :**
1. Dashboard → "New +" → "PostgreSQL"
2. Nom : `video-cloner-db`
3. Copie l'URL de connexion interne

### 2.2 Redis (pour BullMQ)

**Sur Railway :**
1. Dans ton projet, "+ New" → "Database" → "Redis"
2. Railway génère `REDIS_URL` automatiquement

**Sur Render / Upstash :**
1. Va sur https://upstash.com (Redis managé gratuit)
2. Crée une base Redis
3. Copie `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

---

## ⚙️ Étape 3 : Configurer les variables d'environnement

Dans Railway ou Render, va dans les **Settings → Environment Variables** de ton service backend et ajoute :

```bash
# Base de données
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis (BullMQ)
REDIS_HOST=redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=ton_password_redis

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
GCP_BUCKET_NAME=video-cloner-storage

# Creatomate
CREATOMATE_API_KEY=ta_cle_creatomate

# AWS S3 (si tu utilises S3 au lieu de GCP Storage)
AWS_ACCESS_KEY_ID=ta_cle_aws
AWS_SECRET_ACCESS_KEY=ton_secret_aws
AWS_BUCKET_NAME=video-cloner-bucket
AWS_REGION=eu-west-3

# App
PORT=3000
NODE_ENV=production
```

### Ajouter le fichier JSON Google Cloud

**Sur Railway :**
1. Encode ton fichier JSON GCP en base64 :
   ```bash
   cat gcp-service-account.json | base64
   ```
2. Ajoute une variable `GCP_KEY_BASE64` avec le contenu
3. Dans ton `index.ts`, décode et écris le fichier au démarrage :
   ```ts
   if (process.env.GCP_KEY_BASE64) {
     const key = Buffer.from(process.env.GCP_KEY_BASE64, 'base64').toString('utf-8');
     fs.writeFileSync('/app/gcp-key.json', key);
   }
   ```

---

## 📦 Étape 4 : Déployer le backend

### 4.1 Sur Railway

1. Railway détecte automatiquement `package.json`
2. Build command : `npm run build`
3. Start command : `npm start`
4. Railway lance automatiquement le déploiement
5. Note l'URL publique générée (ex: `https://video-cloner.up.railway.app`)

### 4.2 Sur Render

1. Root Directory : `backend`
2. Build Command : `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
3. Start Command : `npm start`
4. Clique "Create Web Service"

---

## 🗃️ Étape 5 : Initialiser la base de données

Une fois le backend déployé, exécute les migrations Prisma :

**Sur Railway :**
- Ouvre le terminal du service backend
- Lance :
  ```bash
  npx prisma migrate deploy
  npx prisma generate
  ```

**Sur Render :**
- Va dans "Shell" du service
- Lance les mêmes commandes

---

## ✅ Étape 6 : Tester l'API

Utilise un outil comme **Postman**, **Insomnia** ou **curl** pour tester :

### Test 1 : Créer un job

```bash
curl -X POST https://ton-backend.railway.app/jobs \
  -H "Content-Type: application/json" \
  -d '{"source_url": "https://www.tiktok.com/@test/video/123"}'
```

Réponse attendue :
```json
{
  "job_id": "uuid",
  "status": "PENDING_ANALYSIS"
}
```

### Test 2 : Vérifier le statut

```bash
curl https://ton-backend.railway.app/jobs/{job_id}
```

---

## 🤖 Étape 7 : Déployer n8n (optionnel)

### Option A : n8n Cloud (le plus simple)

1. Va sur https://n8n.io
2. Crée un compte cloud
3. Crée un workflow qui appelle ton API backend

### Option B : Self-host n8n sur Railway

1. Dans Railway, "+ New" → "Template" → cherche "n8n"
2. Ou crée un service avec Docker :
   - Image : `n8nio/n8n`
   - Port : 5678
3. Configure les variables :
   ```bash
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=ton_password
   ```

---

## 📊 Étape 8 : Monitoring et logs

### Railway
- Onglet "Deployments" → clique sur un déploiement
- "View Logs" pour voir les logs en temps réel

### Render
- Onglet "Logs" dans ton service
- Logs en temps réel + historique

### Vérifier les workers BullMQ

Les workers tournent dans le même processus que l'API (grâce à `index.ts` qui importe les workers). Tu verras dans les logs :
```
[Worker] IngestAndAnalyze worker started
[Worker] RenderVideo worker started
```

---

## 🔐 Sécurité et production

### Ajouter l'authentification

Dans `src/index.ts`, ajoute un middleware auth avant les routes :

```ts
app.use('/jobs', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

Puis ajoute `API_KEY=ton_secret` dans tes variables d'environnement.

### Rate limiting

Installe `express-rate-limit` :
```bash
npm install express-rate-limit
```

Ajoute dans `index.ts` :
```ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite de 100 requêtes
});

app.use(limiter);
```

---

## 🧪 Étape 9 : Frontend (optionnel)

Si tu veux ajouter un frontend simple :

### Déployer avec Vercel

1. Crée un dossier `frontend/` dans ton repo
2. Utilise Next.js ou React :
   ```bash
   npx create-next-app@latest frontend
   ```
3. Pousse sur GitHub
4. Sur Vercel, connecte ton repo
5. Root Directory : `frontend`
6. Ajoute la variable `NEXT_PUBLIC_API_URL=https://ton-backend.railway.app`

---

## 📈 Coûts estimés (MVP)

| Service | Plan gratuit | Plan payant |
|---------|-------------|-------------|
| Railway | $5/mois inclus | ~$10-20/mois |
| Render | Free tier limité | $7/mois + DB $7/mois |
| Upstash Redis | 10K req/jour | $0.2 par 100K req |
| GCP Video Intelligence | $0.10/min analysée | Pay as you go |
| Creatomate | 25 vidéos/mois | $49/mois (200 vidéos) |
| **Total MVP** | **~$5-15/mois** | **~$80-100/mois** |

---

## 🐛 Debugging courant

### Erreur : "Prisma Client not generated"
```bash
npx prisma generate
```

### Workers ne démarrent pas
Vérifie les logs et que Redis est bien connecté :
```bash
curl https://ton-backend.railway.app/health
```

### GCP credential error
Assure-toi que `GOOGLE_APPLICATION_CREDENTIALS` pointe vers un fichier JSON valide.

---

## 🎯 Prochaines étapes

1. ✅ Backend déployé et fonctionnel
2. 🔄 Tester le flux complet (URL → analyse → rendu)
3. 🎨 Créer des templates Creatomate plus avancés
4. 📱 Ajouter un frontend simple
5. 🤖 Connecter n8n pour automatiser les publications sur TikTok/IG
6. 💰 Mettre en place un système de paiement (Stripe)

---

**Tu as maintenant tout le nécessaire pour déployer ta plateforme !**

Si tu bloques à une étape, ouvre une issue sur GitHub ou contacte-moi.
