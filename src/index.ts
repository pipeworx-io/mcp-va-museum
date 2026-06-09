interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Victoria and Albert Museum (V&A) Collections MCP.
 * Keyless. Wraps the V&A Collections API v2.
 */


const BASE = 'https://api.vam.ac.uk/v2';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_objects',
    description:
      'Search the Victoria & Albert Museum (V&A) — the world\'s leading art & design museum. Find objects across 1M+ items (furniture, fashion, ceramics, photographs, paintings, jewellery, sculpture) by keyword. Returns id, title, maker, date, place, type, and thumbnail. Use the returned id with get_object for full details. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text keyword search (e.g. "Jasper Morrison chair", "Tudor portrait", "Japanese ceramics").' },
        limit: { type: 'number', description: 'Max results to return (default 15, max 100).' },
        page: { type: 'number', description: 'Page number, 1-based (default 1).' },
        with_images: { type: 'boolean', description: 'If true, only return objects that have images (default false).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_object',
    description:
      'Get the full record for a single V&A object by its system number (e.g. "O72610", as returned by search_objects). Returns title, maker, object type, materials, description, date, place, dimensions, and a usable image URL. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'V&A system number, e.g. "O72610".' },
      },
      required: ['id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_objects':
        return await searchObjects(args);
      case 'get_object':
        return await getObject(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchObjects(args: Record<string, unknown>): Promise<unknown> {
  const query = args.query;
  if (typeof query !== 'string' || !query.trim()) {
    return { error: 'Required argument "query" is missing. Pass a keyword string like "Jasper Morrison chair".' };
  }
  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 15;
  if (!Number.isFinite(limit) || limit < 1) limit = 15;
  if (limit > 100) limit = 100;
  let page = typeof args.page === 'number' ? Math.floor(args.page) : 1;
  if (!Number.isFinite(page) || page < 1) page = 1;
  const withImages = args.with_images === true;

  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(limit),
  });
  if (withImages) params.set('images_exist', '1');

  const data = (await vamGet(`/objects/search?${params.toString()}`)) as VaSearchResponse;
  const info = data.info ?? {};
  const records = Array.isArray(data.records) ? data.records : [];

  const objects = records.map((r) => ({
    id: r.systemNumber,
    title: r._primaryTitle || null,
    maker: r._primaryMaker?.name || null,
    date: r._primaryDate || null,
    place: r._primaryPlace || null,
    type: r.objectType || null,
    thumbnail: r._images?._primary_thumbnail || null,
  }));

  return {
    total: info.record_count ?? null,
    count: objects.length,
    objects,
  };
}

async function getObject(args: Record<string, unknown>): Promise<unknown> {
  const id = args.id;
  if (typeof id !== 'string' || !id.trim()) {
    return { error: 'Required argument "id" is missing. Pass a V&A system number like "O72610".' };
  }
  const res = await fetch(`${BASE}/object/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'object not found', id };
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    return { error: `V&A: ${res.status} ${body}` };
  }
  const data = (await res.json()) as VaObjectResponse;
  const record = data.record;
  if (!record) return { error: 'object not found', id };

  const title = record.titles?.find((t) => t.title)?.title || null;
  const maker = record.artistMakerPerson?.find((p) => p.name?.text)?.name?.text || null;
  const date = record.productionDates?.find((d) => d.date?.text)?.date?.text || null;
  const place = record.placesOfOrigin?.find((p) => p.place?.text)?.place?.text || null;
  const dimensions = Array.isArray(record.dimensions)
    ? record.dimensions
        .filter((d) => d.dimension && d.value)
        .map((d) => `${d.dimension}: ${d.value}${d.unit ? ' ' + d.unit : ''}`)
    : [];

  const image =
    data.meta?.images?._primary_thumbnail ||
    data.meta?.images?._iiif_image ||
    null;

  return {
    id: record.systemNumber || id,
    title,
    maker,
    object_type: record.objectType || null,
    materials: record.materialsAndTechniques || null,
    description: record.briefDescription || record.summaryDescription || null,
    date,
    place,
    dimensions,
    image,
  };
}

async function vamGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`V&A: ${res.status} ${body}`);
  }
  return res.json();
}

interface VaSearchResponse {
  info?: { record_count?: number; page?: number; pages?: number };
  records?: Array<{
    systemNumber: string;
    _primaryTitle?: string;
    _primaryMaker?: { name?: string; association?: string };
    _primaryDate?: string;
    _primaryPlace?: string;
    objectType?: string;
    _images?: { _primary_thumbnail?: string; _iiif_image_base_url?: string };
  }>;
}

interface VaObjectResponse {
  meta?: { images?: { _primary_thumbnail?: string; _iiif_image?: string } };
  record?: {
    systemNumber?: string;
    objectType?: string;
    titles?: Array<{ title?: string; type?: string }>;
    artistMakerPerson?: Array<{ name?: { text?: string; id?: string } }>;
    materialsAndTechniques?: string;
    briefDescription?: string;
    summaryDescription?: string;
    physicalDescription?: string;
    productionDates?: Array<{ date?: { text?: string } }>;
    placesOfOrigin?: Array<{ place?: { text?: string } }>;
    dimensions?: Array<{ dimension?: string; value?: string; unit?: string }>;
    images?: string[];
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
