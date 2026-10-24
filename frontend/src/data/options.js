export const pieceOptions = {
  type: { label: 'Tipo', values: ['Camiseta', 'Calça', 'Casaco', 'Tênis', 'Vestido', 'Saia', 'Bermuda', 'Acessório'] },
  occasion: { label: 'Ocasião', values: ['Casual', 'Trabalho', 'Festa', 'Esporte'] },
  climate: { label: 'Clima', values: ['Meia estação', 'Calor', 'Frio'] },
  period: { label: 'Período', values: ['Dia', 'Noite', 'Dia/Noite'] },
  color: { label: 'Cor Principal', values: ['Preta', 'Cinza', 'Branca', 'Azul', 'Bege', 'Rosa', 'Marrom', 'Verde', 'Vermelha'] },
  status: { label: 'Status', values: ['Disponível', 'Indisponível'] },
};

export const emptyFilters = () => Object.fromEntries(Object.keys(pieceOptions).map((key) => [key, '']));
export const emptyPiece = () => ({ name: '', ...emptyFilters(), image: '', imageKey: '', favorite: false });
