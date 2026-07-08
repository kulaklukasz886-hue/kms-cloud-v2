import formidable from 'formidable';
import fs from 'fs/promises';
import OpenAI from 'openai';

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
  });
}

function first(v) { return Array.isArray(v) ? v[0] : v; }
function dataUrl(mime, b64) { return `data:${mime || 'application/octet-stream'};base64,${b64}`; }

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string' },
    material: { type: 'string' },
    isHPL: { type: 'boolean' },
    joints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          location: { type: 'string' },
          confidence: { type: 'number' }
        },
        required: ['type', 'location', 'confidence']
      }
    },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overallDepth: { type: 'number' },
        mainDepth: { type: 'number' },
        mainLength: { type: 'number' },
        sideWidth: { type: 'number' }
      },
      required: ['overallDepth', 'mainDepth', 'mainLength', 'sideWidth']
    },
    holes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          diameter: { type: 'number' },
          qty: { type: 'number' },
          confidence: { type: 'number' }
        },
        required: ['type', 'diameter', 'qty', 'confidence']
      }
    },
    connectors: {
      type: 'object',
      additionalProperties: false,
      properties: {
        screwHoles: { type: 'boolean' },
        cncJoint: { type: 'boolean' }
      },
      required: ['screwHoles', 'cncJoint']
    },
    realSawCuts: { type: 'number' },
    detectedOperations: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['type', 'material', 'isHPL', 'joints', 'dimensions', 'holes', 'connectors', 'realSawCuts', 'detectedOperations', 'notes', 'confidence']
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'KMS AI backend działa. Użyj POST z plikiem do analizy.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Only GET and POST allowed' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Brak OPENAI_API_KEY w Vercel Environment Variables.' });
    }

    const { fields, files } = await parseForm(req);
    const file = first(files.file);
    if (!file) return res.status(400).json({ ok: false, error: 'Brak pliku.' });

    const analysisType = first(fields.analysisType) || 'Blaty';
    const materialType = first(fields.materialType) || 'Inny niż HPL';
    const bytes = await fs.readFile(file.filepath);
    const mime = file.mimetype || 'application/octet-stream';

    const filePart = mime === 'application/pdf'
      ? { type: 'input_file', filename: file.originalFilename || 'rysunek.pdf', file_data: dataUrl(mime, bytes.toString('base64')) }
      : { type: 'input_image', image_url: dataUrl(mime, bytes.toString('base64')) };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Jesteś modułem KMS AI Analiza Rysunku dla firmy Kułak Meble.

Stałe zasady:
1. Rysunek klienta jest świętością. Nie zmieniaj wymiarów zewnętrznych, głębokości ani położenia łączeń.
2. Najpierw wykryj wszystkie łączenia blatów.
3. Określ, który blat wchodzi w który: element żeński ma wymiar z rysunku, element męski jest liczony z pozostałego wymiaru.
4. Stosuj naddatek technologiczny tylko tam, gdzie obowiązuje.
5. Zwróć dane do weryfikacji i dalszego liczenia w KMS, nie generuj ścieżek CNC.

Typ analizy: ${analysisType}.
Materiał/rodzaj: ${materialType}.
Zwróć wyłącznie JSON zgodny ze schematem. Jeśli nie jesteś pewien, opisz to w notes i obniż confidence.`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, filePart] }],
      text: { format: { type: 'json_schema', name: 'kms_drawing_analysis', schema, strict: true } }
    });

    return res.status(200).json(JSON.parse(response.output_text));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || 'Błąd analizy AI', details: 'Sprawdź OPENAI_API_KEY i logi Vercel.' });
  }
}
