// ===============================
// PINOS-CORE (Fase 07.4)
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
//   - filtros.
//
// Ele só cria e posiciona o elemento visual do pino, com a classe/cor
// de categoria e os atributos de dataset que o resto do app usa para
// identificar o pino depois. Não registra nenhum listener e não insere
// o elemento em lugar nenhum — quem chama decide isso.

// Cria o elemento <div class="pin"> de uma atração, já posicionado.
//
// Parâmetros:
//   id                       - identificador da atração
//   atracao                  - dados da atração (titulo, categoria, x, y, instagramavel)
//   indicePinoSemCoordenada  - número inteiro (0, 1, 2, ...) usado só quando
//                              a atração ainda não tem x/y, para espalhar os
//                              pinos "novos" numa fileira de espera. Quem
//                              chama esta função é responsável por controlar
//                              e incrementar esse índice entre chamadas.
//
// Retorna o elemento <div> criado e posicionado — ainda NÃO inserido no
// mapa (sem appendChild) e sem nenhum listener registrado.
function criarElementoPin(id, atracao, indicePinoSemCoordenada) {
  const semCoordenadas =
    atracao.x === null || atracao.x === undefined ||
    atracao.y === null || atracao.y === undefined;

  const pin = document.createElement('div');

  // classe de cor por categoria (ver style.css: .pin.familia, .pin.radical, etc.)
  pin.className = `pin ${atracao.categoria || ''}`;

  pin.dataset.nome = atracao.titulo.toLowerCase();
  pin.dataset.categoria = atracao.categoria || '';
  pin.dataset.id = id;
  pin.dataset.instagramavel = atracao.instagramavel ? 'sim' : 'nao';

  if (semCoordenadas) {
    // PINO NOVO: ainda não tem posição real -> nasce numa fileira de
    // espera na parte de baixo do mapa, com visual tracejado, para ser
    // arrastado até o lugar certo (isso é decidido por quem usa este
    // pino depois — este arquivo só calcula onde desenhá-lo agora).
    pin.classList.add('pin-novo');

    const x = 6 + (indicePinoSemCoordenada % 11) * 8.5;
    const y = 97;

    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.title = `⚠️ ${atracao.titulo} — ainda sem posição definida, arraste-me!`;
  } else {
    pin.style.left = `${atracao.x}%`;
    pin.style.top = `${atracao.y}%`;
  }

  return pin;
}
