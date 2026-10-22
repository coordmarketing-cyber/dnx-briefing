// Endpoint: /api/notion
// Busca items do database do Notion e retorna no formato que o frontend espera.
// Chave fica em process.env.NOTION_KEY (configurada no Vercel).
// IMPORTANTE: paginação implementada (API Notion limita 100 por página)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache 60s pra evitar hit excessivo
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '2f249b0c7c4749fd8151b97e7ef0d7b6';
  const MAX_PAGES = 5; // limite de segurança: até 500 items (5 páginas × 100)

  if (!NOTION_KEY) {
    return res.status(500).json({
      error: 'NOTION_KEY não configurada no Vercel.'
    });
  }

  try {
    let allResults = [];
    let nextCursor = undefined;
    let pageCount = 0;

    // Loop de paginação: segue puxando enquanto a API indicar que tem mais
    do {
      const body = {
        filter: { property: 'Status', status: { does_not_equal: 'Publicado' } },
        sorts: [{ property: 'Data de publicação', direction: 'descending' }],
        page_size: 100
      };
      if (nextCursor) body.start_cursor = nextCursor;

      const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `Notion API retornou ${response.status}`,
          detail: errText
        });
      }

      const data = await response.json();
      allResults = allResults.concat(data.results || []);
      nextCursor = data.has_more ? data.next_cursor : null;
      pageCount++;
    } while (nextCursor && pageCount < MAX_PAGES);

    const items = allResults.map(p => ({
      name: p.properties?.Name?.title?.[0]?.plain_text || '',
      marca: (p.properties?.Marca?.multi_select || []).map(m => m.name).join(', '),
      canal: (p.properties?.Canal?.multi_select || []).map(c => c.name).join(', '),
      formato: (p.properties?.Formato?.multi_select || []).map(f => f.name).join(', '),
      status: p.properties?.Status?.status?.name || '',
      due: p.properties?.['Data de publicação']?.date?.start?.split('T')[0] || null,
      url: p.url || ''
    }));

    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
