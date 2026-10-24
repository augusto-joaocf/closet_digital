# Closet Digital

Frontend mobile-first em **JavaScript, React, Vite, React Router DOM e CSS puro**. Reproduz as telas do arquivo `../assets/Closet Digital - Figma.png`, com referência de 393 × 852 px e largura máxima de 393 px no desktop. A pasta `backend` não é utilizada.

## Executar

Requer Node.js 22.12+ (ou Node.js 24) e npm.

```bash
cd frontend
npm install
npm run dev
```

Acesse o endereço informado pelo Vite, normalmente `http://127.0.0.1:5173`.

```bash
npm run build    # produção em dist/
npm run preview  # conferir a versão de produção
npm test         # testes dos serviços com o test runner nativo do Node
```

Na demonstração, entre com qualquer e-mail válido e uma senha fictícia de pelo menos oito caracteres, ou cadastre um nome. O código de recuperação demonstrativo é **12345**, exibido na própria tela. Nenhum e-mail é enviado.

## Organização

```text
src/
  assets/       Logo e ícones originais; fotos demonstrativas extraídas do Figma
  components/
    common/     Botões, inputs com label invertida, selects, upload, avatar e modais
    layout/     Estrutura mobile e navegação inferior
    pieces/     Imagem com fallback, cards, formulário, pesquisa, filtros e detalhes
    outfits/    Cards de conjuntos e seleção múltipla de peças
  context/      Estado compartilhado, pesquisa/filtros e feedback
  data/         Usuário, peças e conjuntos iniciais; opções dos campos
  hooks/        Execução e erros dos formulários
  pages/        Autenticação, Home, closet, álbuns, conjuntos e perfil
  services/     Operações demonstrativas, validação e persistência de metadados
  styles/       Cores, fonte e estilos globais
tests/          Testes de regras e persistência; imagem inválida para QA
```

`App.jsx` declara as rotas públicas e privadas. As páginas de criação e edição compartilham `PieceForm`; `PieceImage` centraliza o cabide para fotos ausentes ou quebradas, inclusive em favoritos e conjuntos. Os modais usam `<dialog>`, que contém o foco e permite Escape. A label invertida usa uma transição CSS de 200 ms, sem mudar o layout, com suporte a movimento reduzido.

## Dados demonstrativos

- Cinco peças e dois conjuntos iniciais. Há peças sem foto e uma indisponível para verificar o cabide e os filtros.
- Criar, editar, excluir e favoritar atualiza o estado imediatamente. Excluir uma peça remove seus vínculos nos conjuntos; um conjunto que perder todas as peças permanece editável e fica indisponível.
- A disponibilidade de um conjunto é derivada de suas peças. Nenhum status manual é salvo no conjunto.
- A listagem normal e os favoritos mostram peças disponíveis. O filtro explícito **Status → Indisponível** permite localizar e reativar as demais peças. Os conjuntos existentes continuam exibindo suas peças indisponíveis.
- Os filtros do closet e a pesquisa permanecem durante a navegação da sessão. A seleção de conjunto possui pesquisa e filtros independentes e impede duplicação.
- `localStorage` guarda somente nome/e-mail, metadados de peças e conjuntos, por uma lista explícita de campos permitidos. O marcador de sessão demonstrativa fica no `sessionStorage`; não é um token e não fornece segurança.
- Senhas não são retidas, comparadas com contas reais ou persistidas. Recuperação e alteração de senha somente validam o fluxo visual demonstrativo.
- Imagens escolhidas usam `URL.createObjectURL` e permanecem apenas em memória. Não são enviadas, convertidas para Base64 ou salvas no armazenamento local. Após recarregar, essas fotos e o avatar voltam ao fallback. Prévias abandonadas/substituídas são liberadas.
- Armazenamento bloqueado ou inválido não impede a demonstração. Para restaurar os dados iniciais, remova a chave `closet-digital:demo:v1` no armazenamento local do navegador e recarregue.

## Design e integração futura

As cores foram amostradas do PNG: fundo `#FAF7F2`, painéis `#FFFDF9`, bordas `#E8DCC8` e texto `#2E2A27`. A fonte **Playwrite US Modern**, do Google Fonts, é servida localmente pelo pacote `@fontsource-variable/playwrite-us-modern` (pesos 100–400), sem depender da rede durante o uso. Todos os ícones fornecidos foram preservados, incluindo `clothes-hanger-regular.png`.

As duas fotos de roupas foram extraídas das áreas de foto do PNG, sem usar recortes de telas como páginas. Sua resolução é de 120 × 120 px, conforme a referência. Os demais itens usam o cabide. As diferenças funcionais intencionais são links discretos de retorno, fechamento/remoção acessíveis, mensagens de validação e indicações do modo demonstrativo e de disponibilidade. A distribuição dos dados não repete os mesmos cards para preencher o grid.

Os métodos assíncronos de `authService`, `piecesService` e `outfitsService` separam dados da apresentação. Para integrar uma API, substitua essas operações e a publicação de snapshots no provider, preservando os contratos de campos e erros (`error.fields` para validação). A sessão atual é somente uma simulação de navegação; proteção real, autorização, armazenamento de imagens e autenticação devem ser implementados com o futuro backend. Hospedagem estática deve redirecionar rotas desconhecidas para `index.html` por utilizar `BrowserRouter`.

Não há Node/Express de servidor, banco de dados, JWT, bcrypt, Cloudinary, Nodemailer ou chamadas de API nesta etapa.

## Verificação

Os sete testes automatizados cobrem filtros combinados, pesquisa sem acentos, CRUD, favoritos, vínculos e disponibilidade dos conjuntos, recuperação demonstrativa e persistência sem credenciais/imagens. No navegador foram verificados cadastro/login/logout, rotas privadas, recuperação com colagem e Backspace, peças com e sem foto, imagem quebrada, edição/exclusão com confirmação, favoritos e estados vazios, conjuntos, perfil e label invertida. Foram comparadas telas a 393 × 852, 360 × 800 e desktop a 1440 × 1000, sem rolagem horizontal nos cenários conferidos e sem avisos/erros de execução capturados.

As capturas locais estão em `.qa/screenshots/` (ignoradas no Git). Teclado virtual, safe areas e comportamento em dispositivos físicos não foram verificados; os estilos correspondentes estão implementados. A hospedagem inclui uma regra de fallback para as rotas do React Router.
