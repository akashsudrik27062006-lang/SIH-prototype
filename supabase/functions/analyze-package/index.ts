const visionKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
const geminiKey = Deno.env.get('GEMINI_API_KEY');
const geminiModel = 'gemini-3.1-flash-lite';
const geminiEndpointPath = `/v1beta/models/${geminiModel}:generateContent`;
const maxBytes = 8 * 1024 * 1024;
const log = (stage: string, details: Record<string, unknown> = {}) => console.log(`[analyze-package] ${stage}`, details);
const fail = (stage: string, status: number, message: string, headers: HeadersInit) => {
  console.error(`[analyze-package] ${stage}`, { status });
  return Response.json({ error: { stage, status, message } }, { status, headers });
};
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map((origin) => origin.trim());
const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};
const schema = {
  type: 'OBJECT',
  properties: Object.fromEntries(['productName', 'netQuantity', 'mrp', 'manufacturerPackerImporter', 'countryOfOrigin', 'packingDate', 'bestBefore', 'consumerCare', 'unitSalePrice'].map((key) => [key, {
    type: 'OBJECT', properties: {
      value: { type: 'STRING', nullable: true }, confidence: { type: 'NUMBER' }, applicable: { type: 'BOOLEAN', nullable: true }, evidenceText: { type: 'ARRAY', items: { type: 'STRING' } },
    }, required: ['value', 'confidence', 'applicable', 'evidenceText'],
  }])),
  required: ['productName', 'netQuantity', 'mrp', 'manufacturerPackerImporter', 'countryOfOrigin', 'packingDate', 'bestBefore', 'consumerCare', 'unitSalePrice'],
};

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
const vertices = (poly: { vertices?: Array<{ x?: number; y?: number }> }) => poly.vertices?.map(({ x = 0, y = 0 }) => ({ x, y })) || [];

function ocrRegions(annotation: any) {
  const pages = annotation?.pages || [];
  const words = pages.flatMap((page: any) => page.blocks || []).flatMap((block: any) => block.paragraphs || []).flatMap((paragraph: any) => paragraph.words || []);
  return words.map((word: any, index: number) => ({
    id: `ocr-${index}`, text: (word.symbols || []).map((symbol: any) => symbol.text || '').join(''), boundingBox: vertices(word.boundingBox), confidence: word.confidence ?? null,
  })).filter((region: any) => region.text);
}

function evidenceFor(text: string, regions: any[]) {
  const needle = text.toLocaleLowerCase();
  return regions.filter((region) => needle.includes(region.text.toLocaleLowerCase())).slice(0, 12).map(({ id, text, boundingBox, confidence }) => ({ id, text, boundingBox, confidence }));
}

// Retained for a future OCR-enabled workflow. The live Gemini-only path below does not call this.
async function runGoogleVisionOcrForFutureUse(base64: string) {
  if (!visionKey) return null;
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  const annotation = body.responses?.[0]?.fullTextAnnotation;
  return annotation ? { text: annotation.text || '', regions: ocrRegions(annotation) } : null;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  const origin = request.headers.get('origin');
  let stage = 'request.received';
  log(stage, { method: request.method, hasOrigin: Boolean(origin) });
  if (origin && !allowedOrigins.includes(origin)) return fail('request.origin_not_allowed', 403, 'This browser origin is not allowed.', headers);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return fail('request.method_not_allowed', 405, 'Use POST.', headers);
  try {
    stage = 'environment.checked';
    log(stage, { visionKeyPresent: Boolean(visionKey), geminiKeyPresent: Boolean(geminiKey), liveAnalysisProvider: 'gemini' });
    if (!geminiKey) return fail('environment.missing_gemini_secret', 503, 'Gemini image-analysis secret is not configured.', headers);
    stage = 'request.parsing_form_data';
    const form = await request.formData();
    const image = form.get('image');
    log('request.form_data_parsed', { hasImage: image instanceof File, imageType: image instanceof File ? image.type : null, imageSizeBytes: image instanceof File ? image.size : null });
    if (!(image instanceof File) || !image.type.startsWith('image/') || image.size > maxBytes) return fail('request.invalid_image', 400, 'Provide an image file no larger than 8 MB.', headers);
    stage = 'request.reading_image';
    const bytes = new Uint8Array(await image.arrayBuffer());
    const base64 = toBase64(bytes);
    stage = 'gemini.requesting';
    log(stage, { imageType: image.type, imageSizeBytes: image.size, provider: 'gemini_image_analysis' });
    const prompt = `Analyze only the uploaded package image. Extract the requested declarations only when text is visible and reliably readable in that image. Never infer, complete, or invent information. If a declaration is absent, obscured, or unreadable, set value to null. evidenceText must contain only text visibly present in the image. Confidence is 0-1 extraction confidence, not legal confidence. Do not determine legal compliance, violations, or final rule applicability. Treat applicability cautiously; it is not legal authority.`;
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com${geminiEndpointPath}?key=${geminiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: image.type, data: base64 } }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 } }),
    });
    log('gemini.response_received', { status: geminiResponse.status, ok: geminiResponse.ok });
    stage = 'gemini.parsing_response';
    const gemini = await geminiResponse.json().catch(() => null);
    if (!geminiResponse.ok) {
      const upstreamMessage = typeof gemini?.error?.message === 'string' ? gemini.error.message : 'Gemini returned an unreadable error response.';
      const diagnostic = { stage: 'gemini.failed', status: geminiResponse.status, model: geminiModel, endpoint: geminiEndpointPath, message: `Gemini upstream error: ${upstreamMessage}` };
      console.error('[analyze-package] gemini.failed', diagnostic);
      return Response.json({ error: diagnostic }, { status: 502, headers });
    }
    stage = 'gemini.parsing_json';
    const declarations = JSON.parse(gemini.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    const requiredFields = ['productName', 'netQuantity', 'mrp', 'manufacturerPackerImporter', 'countryOfOrigin', 'packingDate', 'bestBefore', 'consumerCare', 'unitSalePrice'];
    const extractionComplete = requiredFields.every((field) => declarations[field] && Array.isArray(declarations[field].evidenceText));
    log('gemini.json_parsed', { extractionComplete, declarationFieldCount: Object.keys(declarations).length });
    if (!extractionComplete) return fail('gemini.incomplete_contract', 502, 'Gemini returned an incomplete extraction contract.', headers);
    stage = 'response.mapping_evidence';
    for (const [field, declaration] of Object.entries(declarations) as [string, any][]) {
      declaration.evidence = (declaration.evidenceText || []).map((text: string) => ({
        field,
        text,
        confidence: declaration.confidence ?? null,
        source: 'uploaded_package_image',
      }));
    }
    log('response.sending', { evidenceSource: 'uploaded_package_image', declarationFieldCount: Object.keys(declarations).length });
    return Response.json({ declarations, evidenceSource: 'uploaded_package_image' }, { headers });
  } catch (error) {
    console.error(`[analyze-package] ${stage}`, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return Response.json({ error: { stage, status: 500, message: 'Analysis failed before a response could be completed.' } }, { status: 500, headers });
  }
});
