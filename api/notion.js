// Endpoint: /api/notion
// Busca items do database do Notion e retorna no formato que o frontend espera.
// Chave fica em process.env.NOTION_KEY (configurada no Vercel).

export default async function handler(req, res) {
  // CORS liberado (o frontend chama do mesmo domínio, mas deixa pra não dar dor de cabeça)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache de 60 segundos pra evitar hit excessivo no Notion se várias pessoas abrem ao mesmo tempo
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '2f249b0c7c4749fd8151b97e7ef0d7b6';

  if (!NOTION_KEY) {
    return res.status(500).json({
      error: 'NOTION_KEY não configurada no Vercel. Vai em Settings → Environment Variables.'
    });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'Status', status: { does_not_equal: 'Publicado' } },
        sorts: [{ property: 'Data de publicação', direction: 'ascending' }],
        page_size: 100
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Notion API retornou ${response.status}`,
        detail: errText
      });
    }

    const data = await response.json();

    const items = (data.results || []).map(p => ({
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
