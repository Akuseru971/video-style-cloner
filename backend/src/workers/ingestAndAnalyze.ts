import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { analyzeVideo } from '../lib/gcpVideo';
import { downloadVideoFromUrl } from '../lib/storage';
import { ingestAndAnalyzeQueue } from '../lib/queues';

interface AnalysisResult {
  scenes: Array<{
    startTime: number;
    endTime: number;
    labels: string[];
  }>;
  textAnnotations: Array<{
    text: string;
    startTime: number;
    endTime: number;
    boundingBox: any;
  }>;
}

function buildTemplateFromAnalysis(analysis: AnalysisResult, totalDuration: number) {
  // Créer un template simple 3 scènes
  const templateJson = {
    id: 'template-auto',
    format: '9:16',
    duration: totalDuration || 10,
    elements: [
      {
        type: 'video',
        name: 'background',
        src: 'https://cdn.example.com/default-bg.mp4',
        start: 0,
        duration: totalDuration || 10,
      },
      {
        type: 'image',
        name: 'main_logo',
        src: 'https://cdn.example.com/placeholder-logo.png',
        position: 'top-right',
        start: 0,
        duration: totalDuration || 10,
        width: 80,
        height: 80,
      },
      {
        type: 'text',
        name: 'hook',
        text: 'Texte hook par défaut',
        start: 0,
        duration: (totalDuration || 10) * 0.3,
        style: {
          fontSize: 64,
          fill: '#ffffff',
          align: 'center',
          fontWeight: 'bold',
        },
      },
      {
        type: 'text',
        name: 'benefit',
        text: 'Texte bénéfice par défaut',
        start: (totalDuration || 10) * 0.3,
        duration: (totalDuration || 10) * 0.4,
        style: {
          fontSize: 52,
          fill: '#ffffff',
          align: 'center',
        },
      },
      {
        type: 'text',
        name: 'cta',
        text: 'CTA par défaut',
        start: (totalDuration || 10) * 0.7,
        duration: (totalDuration || 10) * 0.3,
        style: {
          fontSize: 56,
          fill: '#FF006E',
          align: 'center',
          fontWeight: 'bold',
        },
      },
    ],
  };

  const slots = {
    textSlots: [
      {
        key: 'hook',
        sceneIndex: 0,
        description: 'Hook principal (première accroche)',
        defaultText: 'Texte hook par défaut',
        maxLength: 80,
      },
      {
        key: 'benefit',
        sceneIndex: 1,
        description: 'Bénéfice clé (proposition de valeur)',
        defaultText: 'Texte bénéfice par défaut',
        maxLength: 120,
      },
      {
        key: 'cta',
        sceneIndex: 2,
        description: 'Call to action (appel à l\'action)',
        defaultText: 'CTA par défaut',
        maxLength: 50,
      },
    ],
    logoSlots: [
      {
        key: 'main_logo',
        sceneIndex: 0,
        description: 'Logo principal de la marque',
      },
    ],
    mediaSlots: [],
  };

  return { templateJson, slots };
}

// Worker
const worker = new Worker(
  'INGEST_AND_ANALYZE',
  async (job) => {
    const { jobId } = job.data;

    try {
      console.log(`[Worker] Starting job ${jobId}`);

      // 1. Récupérer le VideoJob
      const videoJob = await prisma.videoJob.findUnique({
        where: { id: jobId },
      });

      if (!videoJob) {
        throw new Error(`Job ${jobId} not found`);
      }

      // 2. Télécharger la vidéo source
      console.log(`[Worker] Downloading video from ${videoJob.sourceUrl}`);
      const sourceVideoUri = await downloadVideoFromUrl(videoJob.sourceUrl);

      await prisma.videoJob.update({
        where: { id: jobId },
        data: { sourceVideoUri },
      });

      // 3. Analyser la vidéo avec GCP Video Intelligence
      console.log(`[Worker] Analyzing video ${sourceVideoUri}`);
      const analysisMetadata = await analyzeVideo(sourceVideoUri);

      // 4. Construire le template à partir de l'analyse
      const totalDuration = analysisMetadata.duration || 10;
      const { templateJson, slots } = buildTemplateFromAnalysis(
        analysisMetadata,
        totalDuration
      );

      // 5. Créer le Template en base
      const template = await prisma.template.create({
        data: {
          sourceVideoJobId: jobId,
          name: `Auto Template - ${videoJob.sourceUrl}`,
          engine: 'creatomate',
          renderScript: templateJson,
          slots,
        },
      });

      // 6. Mettre à jour le VideoJob
      await prisma.videoJob.update({
        where: { id: jobId },
        data: {
          templateId: template.id,
          analysisMetadata,
          status: 'STRUCTURE_BUILT',
        },
      });

      console.log(`[Worker] Job ${jobId} completed successfully`);
    } catch (error: any) {
      console.error(`[Worker] Job ${jobId} failed:`, error);

      await prisma.videoJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('[Worker] IngestAndAnalyze worker started');

export default worker;