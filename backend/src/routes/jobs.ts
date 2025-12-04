import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ingestAndAnalyzeQueue, renderQueue } from '../lib/queues';

const router = Router();

// POST /jobs - Créer un job à partir d'une URL
router.post('/', async (req, res) => {
  try {
    const { source_url } = req.body;
    // TODO: get userId from auth middleware
    const userId = 'test-user-id';

    const job = await prisma.videoJob.create({
      data: {
        userId,
        sourceUrl: source_url,
        status: 'PENDING_ANALYSIS',
      },
    });

    await ingestAndAnalyzeQueue.add('INGEST_AND_ANALYZE', { jobId: job.id });

    res.json({ job_id: job.id, status: job.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// GET /jobs/:id - Récupérer l'état du job
router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.videoJob.findUnique({
      where: { id: req.params.id },
      include: { template: true, inputs: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      job_id: job.id,
      status: job.status,
      template: job.template
        ? {
            id: job.template.id,
            slots: job.template.slots,
          }
        : null,
      inputs: job.inputs
        ? { texts: job.inputs.texts, colors: job.inputs.colors }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// POST /jobs/:id/inputs - Stocker logo + textes
router.post('/:id/inputs', async (req, res) => {
  try {
    const { logo_uri, texts, colors, options } = req.body;
    const jobId = req.params.id;

    const job = await prisma.videoJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await prisma.clientInputs.upsert({
      where: { videoJobId: jobId },
      update: { logoUri: logo_uri, texts, colors, options },
      create: { videoJobId: jobId, logoUri: logo_uri, texts, colors, options },
    });

    await prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'READY_TO_RENDER' },
    });

    res.json({ job_id: jobId, status: 'READY_TO_RENDER' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save inputs' });
  }
});

// POST /jobs/:id/render - Lancer le rendu
router.post('/:id/render', async (req, res) => {
  try {
    const jobId = req.params.id;

    const job = await prisma.videoJob.findUnique({
      where: { id: jobId },
      include: { template: true, inputs: true },
    });

    if (!job || !job.template || !job.inputs) {
      return res.status(400).json({ error: 'Missing template or inputs' });
    }

    await prisma.videoJob.update({
      where: { id: jobId },
      data: { status: 'RENDERING' },
    });

    await renderQueue.add('RENDER_VIDEO', { jobId });

    res.json({ job_id: jobId, status: 'RENDERING' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start render' });
  }
});

// GET /jobs/:id/result - Liens finaux
router.get('/:id/result', async (req, res) => {
  try {
    const job = await prisma.videoJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      job_id: job.id,
      status: job.status,
      outputs: job.outputUrls || {},
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

export default router;