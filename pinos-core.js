// ===============================
// PINOS-CORE (Fase 07.4, simplificado na 07.8A)
// ===============================
//
// Função visual pura para criar o elemento <div> de um pino no mapa.
//
// Este arquivo NÃO sabe nada sobre:
//   - calibração (houveMovimento, pinArrastando, etc.);
//   - atracoesJSON;
//   - clustering;
//   - bottom sheet / mostrar();
//   - GPS;
//   - roteiro;
//   - filtros;
//   - o que fazer quando uma atração não tem coordenada ainda
//     (isso é uma decisão de quem usa esta função — ver admin.js).
//
// Ele só cria e posiciona o elemento visual do pino (quando há x/y),
// com a classe/cor de categoria e os atributos de dataset que o resto
// do app usa para identificar o pino depois. Não registra nenhum
// listener e não insere o elemento em lugar nenhum — quem chama
// decide isso.

// Cria o elemento <div class="pin"> de uma atração.
//
// Parâmetros:
//   id       - identificador da atração
//   atracao  - dados da atração (titulo, categoria, x, y, instagramavel)
//
// Retorna o elemento <div> criado — ainda NÃO inserido no mapa (sem
// appendChild) e sem nenhum listener registrado. Se a atração não
// tiver x/y definidos, o elemento é criado sem posição (`left`/`top`
// não são definidos) — cabe a quem chama decidir onde colocá-lo
// nesse caso (ex.: o admin usa isso para uma fileira de espera de
// calibração; o visitante, hoje, não precisa desse conceito).
function criarElementoPin(id, atracao) {
  const pin = document.createElement('div');

  // classe de cor por categoria (ver style.css: .pin.familia, .pin.radical, etc.)
  pin.className = `pin ${atracao.categoria || ''}`;

  pin.dataset.nome = atracao.titulo.toLowerCase();
  pin.dataset.categoria = atracao.categoria || '';
  pin.dataset.id = id;
  pin.dataset.instagramavel = atracao.instagramavel ? 'sim' : 'nao';

  const temCoordenadas =
    atracao.x !== null && atracao.x !== undefined &&
    atracao.y !== null && atracao.y !== undefined;

  if (temCoordenadas) {
    pin.style.left = `${atracao.x}%`;
    pin.style.top = `${atracao.y}%`;
  }

  return pin;
}
