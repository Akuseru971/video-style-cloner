import video from '@google-cloud/video-intelligence';

const client = new video.v1.VideoIntelligenceServiceClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE_PATH,
});

export async function analyzeVideo(videoUri: string): Promise<any> {
  try {
    console.log('[GCP Video] Analyzing video:', videoUri);

    // Lancer l'analyse vidéo
    const [operation] = await client.annotateVideo({
      inputUri: videoUri,
      features: [
        'SHOT_CHANGE_DETECTION',
        'TEXT_DETECTION',
        'LABEL_DETECTION',
      ],
    });

    console.log('[GCP Video] Analysis started, waiting for completion...');

    // Attendre la fin de l'analyse
    const [response] = await operation.promise();

    console.log('[GCP Video] Analysis completed');

    // Extraire les données importantes
    const result = parseAnalysisResults(response);

    return result;
  } catch (error) {
    console.error('[GCP Video] Error:', error);
    throw error;
  }
}

function parseAnalysisResults(response: any): any {
  const annotationResults = response.annotationResults[0];

  // Extraire les changements de scène
  const scenes: any[] = [];
  if (annotationResults.shotAnnotations) {
    annotationResults.shotAnnotations.forEach((shot: any) => {
      const startTime =
        shot.startTimeOffset?.seconds || 0 +
        (shot.startTimeOffset?.nanos || 0) / 1e9;
      const endTime =
        shot.endTimeOffset?.seconds || 0 +
        (shot.endTimeOffset?.nanos || 0) / 1e9;

      scenes.push({
        startTime,
        endTime,
        labels: [],
      });
    });
  }

  // Extraire les annotations de texte
  const textAnnotations: any[] = [];
  if (annotationResults.textAnnotations) {
    annotationResults.textAnnotations.forEach((annotation: any) => {
      annotation.segments.forEach((segment: any) => {
        const startTime =
          segment.segment?.startTimeOffset?.seconds || 0 +
          (segment.segment?.startTimeOffset?.nanos || 0) / 1e9;
        const endTime =
          segment.segment?.endTimeOffset?.seconds || 0 +
          (segment.segment?.endTimeOffset?.nanos || 0) / 1e9;

        textAnnotations.push({
          text: annotation.text,
          startTime,
          endTime,
          boundingBox: segment.frames?.[0]?.rotatedBoundingBox,
        });
      });
    });
  }

  // Extraire les labels
  const labels: string[] = [];
  if (annotationResults.segmentLabelAnnotations) {
    annotationResults.segmentLabelAnnotations.forEach((label: any) => {
      labels.push(label.entity?.description || '');
    });
  }

  // Calculer la durée totale
  const duration =
    scenes.length > 0 ? scenes[scenes.length - 1].endTime : 10;

  return {
    scenes,
    textAnnotations,
    labels,
    duration,
  };
}

export default { analyzeVideo };