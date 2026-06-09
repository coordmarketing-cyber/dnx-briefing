// Endpoint: /api/trello
// Boards do Grupo DNX no Trello.
// Removidos (migraram pro Monday): Ohana, Farol.

const BOARDS = [
  { name: 'Marca Pablo',                   id: '69c5223867d694afd7d17e4d' },
  { name: 'GRUPO DNX | Ceará Autoral',     id: '69c2b29bd9183074fd575b9f' },
  { name: "JORNADA DE CAMPANHAS'26",       id: '697a1c4abd45ce76bea89fb3' },
  { name: 'HUB NB BY DESCO',               id: '69c66fcbfbf6936927e1d5f0' },
  { name: 'EZ MAIO - 26',                  id: '69c2faf19f45c3b470254729' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const KEY = process.env.TRELLO_KEY;
  const TOKEN = process.env.TRELLO_TOKEN;
  if (!KEY || !TOKEN) {
    return res.status(500).json({ error: 'TRELLO_KEY ou TRELLO_TOKEN não configurados.' });
  }

  try {
    const boardsData = await Promise.all(BOARDS.map(async (board) => {
      const [listsRes, cardsRes, membersRes] = await Promise.all([
        fetch(`https://api.trello.com/1/boards/${board.id}/lists?key=${KEY}&token=${TOKEN}`),
        fetch(`https://api.trello.com/1/boards/${board.id}/cards?key=${KEY}&token=${TOKEN}&fields=name,due,dueComplete,shortUrl,idList,idMembers`),
        fetch(`https://api.trello.com/1/boards/${board.id}/members?key=${KEY}&token=${TOKEN}&fields=fullName,username`)
      ]);

      if (!listsRes.ok || !cardsRes.ok) {
        return { name: board.name, source: 'trello', cards: [], error: `Lists: ${listsRes.status}, Cards: ${cardsRes.status}` };
      }

      const lists = await listsRes.json();
      const cards = await cardsRes.json();
      const members = membersRes.ok ? await membersRes.json() : [];

      const listMap = {};
      lists.forEach(l => { listMap[l.id] = l.name; });

      const memberMap = {};
      members.forEach(m => {
        memberMap[m.id] = (m.fullName || m.username || '').split(' ')[0];
      });

      return {
        name: board.name,
        source: 'trello',
        cards: cards.map(c => ({
          name: c.name,
          list: listMap[c.idList] || '',
          due: c.due ? c.due.split('T')[0] : null,
          dueComplete: !!c.dueComplete,
          url: c.shortUrl || '',
          members: (c.idMembers || []).map(id => memberMap[id]).filter(Boolean)
        }))
      };
    }));

    res.status(200).json(boardsData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
