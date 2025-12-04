import Creatomate from 'creatomate';

const client = new Creatomate.Client(
  process.env.CREATOMATE_API_KEY || ''
);

export async function renderVideoWithCreatomate(
  template: any,
  modifications: Record<string, any>,
  format: string
): Promise<string> {
  try {
    console.log('[Creatomate] Starting render...');
    console.log('Template:', JSON.stringify(template, null, 2));
    console.log('Modifications:', JSON.stringify(modifications, null, 2));
    console.log('Format:', format);

    // Adapter le template au format demandé
    const adaptedTemplate = {
      ...template,
      format: format,
    };

    // Appliquer les modifications
    const finalTemplate = applyModifications(adaptedTemplate, modifications);

    // Créer un rendu via Creatomate
    const render = await client.render({
      source: finalTemplate,
    });

    console.log('[Creatomate] Render created:', render);

    // Attendre que le rendu soit terminé
    const completed = await waitForRender(render.id);

    if (!completed || !completed.url) {
      throw new Error('Render failed or no URL returned');
    }

    console.log('[Creatomate] Render completed:', completed.url);
    return completed.url;
  } catch (error) {
    console.error('[Creatomate] Error:', error);
    throw error;
  }
}

function applyModifications(
  template: any,
  modifications: Record<string, any>
): any {
  const result = JSON.parse(JSON.stringify(template));

  // Parcourir les éléments et appliquer les modifications
  if (result.elements) {
    result.elements = result.elements.map((element: any) => {
      const modifiedElement = { ...element };

      // Appliquer les modifications de texte
      const textModKey = `${element.name}.text`;
      if (modifications[textModKey]) {
        modifiedElement.text = modifications[textModKey];
      }

      // Appliquer les modifications d'image/logo
      const srcModKey = `${element.name}.src`;
      if (modifications[srcModKey]) {
        modifiedElement.src = modifications[srcModKey];
      }

      // Appliquer les modifications de style
      const styleModKey = `${element.name}.style.fill`;
      if (modifications[styleModKey] && modifiedElement.style) {
        modifiedElement.style.fill = modifications[styleModKey];
      }

      return modifiedElement;
    });
  }

  return result;
}

async function waitForRender(
  renderId: string,
  maxAttempts = 60,
  interval = 5000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const render = await client.getRender(renderId);

    console.log(`[Creatomate] Render status: ${render.status}`);

    if (render.status === 'succeeded') {
      return render;
    }

    if (render.status === 'failed') {
      throw new Error(`Render failed: ${render.errorMessage}`);
    }

    // Attendre avant de re-vérifier
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Render timeout');
}

export default { renderVideoWithCreatomate };