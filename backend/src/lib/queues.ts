import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

export const ingestAndAnalyzeQueue = new Queue('INGEST_AND_ANALYZE', {
  connection,
});

export const renderQueue = new Queue('RENDER_VIDEO', {
  connection,
});