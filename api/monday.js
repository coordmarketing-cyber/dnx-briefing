// Endpoint: /api/monday
// Busca os boards de acompanhamento da Diana (Hotelaria) no Monday e retorna no formato compatível.
// Token fica em process.env.MONDAY_TOKEN (configurado no Vercel).

const BOARDS = [
  { id: '18412069690', name: 'DNX HOTELARIA - Projeto Ohana' },
  { id: '18416177633', name: 'ED TEMPO - CDT ENGENHARIA' },
  { id: '18401830911', name: 'FAROL HOTEL' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const TOKEN = process.env.MONDAY_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: 'MONDAY_TOKEN não configurado.' });
  }

  // Helper pra extrair coluna por título
  const colByTitle = (cols, title) => {
    return (cols || []).find(c =>
      (c.column?.title || '').trim().toLowerCase() === title.trim().toLowerCase()
    );
  };

  // Helper pra pegar data de coluna do tipo date
  const dateFromCol = (col) => {
    if (!col) return null;
    if (col.text && /^\d{4}-\d{2}-\d{2}/.test(col.text)) {
      return col.text.split(' ')[0];
    }
    if (col.value) {
      try {
        const parsed = JSON.parse(col.value);
        if (parsed?.date) return parsed.date;
      } catch (e) {}
    }
    return null;
  };

  // Função pra processar um board
  const processBoard = (boardData, boardMeta) => {
    if (!boardData) {
      return { name: boardMeta.name, source: 'monday', cards: [], error: 'Board não encontrado' };
    }

    const cards = (boardData.items_page?.items || []).map(item => {
      const cols = item.column_values || [];

      const pessoaCol = colByTitle(cols, 'Pessoa');
      let members = [];
      if (pessoaCol?.text) {
        members = pessoaCol.text.split(',').map(n => n.trim().split(' ')[0]).filter(Boolean);
      }

      const etapaCol = colByTitle(cols, 'Etapa');
      const etapa = etapaCol?.text || '';

      const statusCol = colByTitle(cols, 'Status');
      const statusGeral = statusCol?.text || '';

      const prazoFinalCol = colByTitle(cols, 'Prazo final');
      const dataEntregaCol = colByTitle(cols, 'Data de entrega');
      const due = dateFromCol(prazoFinalCol) || dateFromCol(dataEntregaCol);

      const artesaoCol = colByTitle(cols, 'Artesão / Fornecedor');
      const artesao = artesaoCol?.text || '';

      const groupTitle = item.group?.title || '';
      const dueComplete = ['Aprovado', 'Concluído', 'Concluido'].includes(etapa);

      return {
        name: item.name,
        list: artesao || groupTitle,
        group: groupTitle,
        due,
        dueComplete,
        url: item.url || '',
        members,
        etapa,
        statusGeral,
        artesao
      };
    });

    return { name: boardMeta.name, source: 'monday', cards };
  };

  // Query: pega TODOS os boards de uma vez (mais eficiente que 3 requests separados)
  const query = `
    query {
      boards(ids: [${BOARDS.map(b => b.id).join(', ')}]) {
        id
        name
        url
        items_page(limit: 200) {
          items {
            id
            name
            url
            group { id title }
            column_values {
              id
              type
              text
              value
              column { id title }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': TOKEN,
        'Content-Type': 'application/json',
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Monday API retornou ${response.status}`,
        detail: errText
      });
    }

    const data = await response.json();
    if (data.errors) {
      return res.status(500).json({ error: 'Monday GraphQL errors', detail: data.errors });
    }

    const boardsRaw = data.data?.boards || [];

    // Mapeia cada board configurado pelo ID; mantém a ordem da config (não a ordem da resposta)
    const result = BOARDS.map(meta => {
      const found = boardsRaw.find(b => b.id === meta.id);
      return processBoard(found, meta);
    });

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
