import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { renderVideoWithCreatomate } from '../lib/creatomate';
import { renderQueue } from '../lib/queues';

function buildModificationsFromInputs(
  slots: any,
  texts: Record<string, string>,
  logoUri: string | null,
  colors: Record<string, string>
) {
  const modifications: Record<string, any> = {};

  // Mapper les textes
  if (slots.textSlots) {
    slots.textSlots.forEach((slot: any) => {
      if (texts[slot.key]) {
        modifications[`${slot.key}.text`] = texts[slot.key];
      }
    });
  }

  // Mapper le logo
  if (slots.logoSlots && logoUri) {
    slots.logoSlots.forEach((slot: any) => {
      modifications[`${slot.key}.src`] = logoUri;
    });
  }

  // Mapper les couleurs
  if (colors.primary) {
    modifications['cta.style.fill'] = colors.primary;
  }

  return modifications;
}

// Worker
const worker = new Worker(
  'RENDER_VIDEO',
  async (job) => {
    const { jobId } = job.data;

    try {
      console.log(`[RenderWorker] Starting render for job ${jobId}`);

      // 1. Récupérer le VideoJob avec template et inputs
      const videoJob = await prisma.videoJob.findUnique({
        where: { id: jobId },
        include: { template: true, inputs: true },
      });

      if (!videoJob || !videoJob.template || !videoJob.inputs) {
        throw new Error(
          `Job ${jobId} missing template or inputs`
        );
      }

      const { template, inputs } = videoJob;

      // 2. Construire les modifications
      const modifications = buildModificationsFromInputs(
        template.slots,
        inputs.texts as Record<string, string>,
        inputs.logoUri,
        inputs.colors as Record<string, string>
      );

      console.log(
        `[RenderWorker] Modifications:`,
        JSON.stringify(modifications, null, 2)
      );

      // 3. Appeler Creatomate pour le rendu
      const formats = (inputs.options as any)?.formats || ['9:16'];
      const renderResults: Record<string, string> = {};

      for (const format of formats) {
        console.log(`[RenderWorker] Rendering format ${format}`);

        const videoUrl = await renderVideoWithCreatomate(
          template.renderScript,
          modifications,
          format
        );

        renderResults[format] = videoUrl;
      }

      // 4. Mettre à jour le VideoJob avec les URLs
      await prisma.videoJob.update({
        where: { id: jobId },
        data: {
          outputUrls: renderResults,
          status: 'READY',
        },
      });

      console.log(
        `[RenderWorker] Job ${jobId} completed. Outputs:`,
        renderResults
      );
    } catch (error: any) {
      console.error(`[RenderWorker] Job ${jobId} failed:`, error);

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
  console.log(`Render job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Render job ${job?.id} failed:`, err);
});

console.log('[Worker] RenderVideo worker started');

export default worker;