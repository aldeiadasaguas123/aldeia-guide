console.log('🚨 SCRIPT.JS ESTÁ SENDO EXECUTADO!');

// ===============================
// MODO CALIBRAÇÃO
// ===============================

const mapaCanvasCalibracao = document.getElementById('mapaCanvas');
const coordenadas = document.getElementById('coordenadas');

mapaCanvasCalibracao.addEventListener('mousemove', function(event) {
  const rect = mapaCanvasCalibracao.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  coordenadas.textContent = `X: ${x.toFixed(2)}% | Y: ${y.toFixed(2)}%`;
});

// ---------------------------------------------------------------------
// MINIMIZAR / EXPANDIR o painel de calibração (pra não tampar o mapa)
// ---------------------------------------------------------------------

const btnMinimizarCalibracao = document.getElementById('minimizarCalibracao');
const calibracaoCorpo = document.getElementById('calibracaoCorpo');

function aplicarEstadoCalibracao(colapsado) {
  calibracaoCorpo.classList.toggle('colapsado', colapsado);
  btnMinimizarCalibracao.textContent = colapsado ? '➕' : '➖';
}

if (btnMinimizarCalibracao && calibracaoCorpo) {
  // lembra o estado entre recarregamentos da página
  aplicarEstadoCalibracao(localStorage.getItem('aldeiaCalibPainelColapsado') === 'sim');

  btnMinimizarCalibracao.addEventListener('click', function () {
    const novoEstado = !calibracaoCorpo.classList.contains('colapsado');
    aplicarEstadoCalibracao(novoEstado);
    localStorage.setItem('aldeiaCalibPainelColapsado', novoEstado ? 'sim' : 'nao');
  });
}

// ---------------------------------------------------------------------
// MOSTRAR / ESCONDER a seção de calibração GPS (fica escondida por
// padrão — só é necessária no dia em que alguém for ao parque calibrar)
// ---------------------------------------------------------------------

const btnToggleGps = document.getElementById('toggleGps');
const gpsConteudo = document.getElementById('gpsConteudo');

function aplicarEstadoGps(aberto) {
  gpsConteudo.classList.toggle('oculto', !aberto);
  btnToggleGps.textContent = aberto
    ? '📡 Calibração GPS ▾ (clique pra recolher)'
    : '📡 Calibração GPS ▸ (fazer depois, no parque)';
}

if (btnToggleGps && gpsConteudo) {
  aplicarEstadoGps(localStorage.getItem('aldeiaCalibGpsAberto') === 'sim');

  btnToggleGps.addEventListener('click', function () {
    const novoEstado = gpsConteudo.classList.contains('oculto');
    aplicarEstadoGps(novoEstado);
    localStorage.setItem('aldeiaCalibGpsAberto', novoEstado ? 'sim' : 'nao');
  });
}

let atracoesJSON = {};
let atracoes = {};
let pinArrastando = null;
let ultimaX = null;
let ultimaY = null;

const atracaoSelecionada = document.getElementById('atracaoSelecionada');

// cache-busting: sem isso, dar F5 pode continuar mostrando uma versão
// antiga do atracoes.json que ficou guardada em cache pelo navegador
fetch('./atracoes.json?v=' + Date.now())
  .then(response => {
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    atracoesJSON = data;
    atracoes = data;

    console.log('✅ ATRAÇÕES CARREGADAS DO JSON:', atracoes);

    aplicarRascunhoSeExistir();

    Object.entries(atracoes).forEach(([id, atracao]) => {
      criarPin(id, atracao);
    });

    mostrarAvisoPinosNovos(contadorPinosNovos);

    ativarCalibracaoDosPins();
    renderChecklistRoteiro();
    popularSelectGps();
    atualizarStatusCalibracaoGps();
    renderGaleriaInstagram();
    atualizarContadorPendentes();
  })
  .catch(error => {
    console.error('❌ ERRO AO CARREGAR ATRACOES.JSON:', error);
  });

// ---------------------------------------------------------------------
// RASCUNHO AUTOMÁTICO — toda posição arrastada é salva sozinha aqui,
// então dar F5 sem ter clicado em "Salvar" NUNCA mais perde trabalho.
// ---------------------------------------------------------------------

const CHAVE_RASCUNHO = 'aldeiaRascunhoPosicoes';

function salvarRascunho() {
  const posicoes = {};
  Object.entries(atracoesJSON).forEach(([id, a]) => {
    if (a.x !== null && a.y !== null && a.x !== undefined && a.y !== undefined) {
      posicoes[id] = { x: a.x, y: a.y };
    }
  });
  localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(posicoes));
}

function aplicarRascunhoSeExistir() {
  const bruto = localStorage.getItem(CHAVE_RASCUNHO);
  if (!bruto) return;

  let posicoes;
  try {
    posicoes = JSON.parse(bruto);
  } catch {
    return;
  }

  // só pergunta se o rascunho tiver alguma posição DIFERENTE do arquivo carregado
  const temDiferenca = Object.entries(posicoes).some(([id, p]) => {
    const atual = atracoesJSON[id];
    return atual && (atual.x !== p.x || atual.y !== p.y);
  });

  if (!temDiferenca) return;

  const restaurar = confirm(
    '💾 Encontrei posições de pinos salvas automaticamente neste navegador ' +
    '(de uma sessão anterior que talvez não tenha sido baixada/substituída).\n\n' +
    'Quer restaurar essas posições agora, por cima do atracoes.json atual?'
  );

  if (!restaurar) {
    localStorage.removeItem(CHAVE_RASCUNHO);
    return;
  }

  Object.entries(posicoes).forEach(([id, p]) => {
    if (atracoesJSON[id]) {
      atracoesJSON[id].x = p.x;
      atracoesJSON[id].y = p.y;
    }
  });

  console.log('♻️ Rascunho restaurado por cima do atracoes.json carregado.');
}

let contadorPinosNovos = 0; // usado para espalhar os pinos sem posição numa fileira

function criarPin(id, atracao) {
  if (!atracao) {
    console.error('❌ Atração sem dados:', id);
    return;
  }

  const semCoordenadas =
    atracao.x === null || atracao.y === null ||
    atracao.x === undefined || atracao.y === undefined;

  const pin = document.createElement('div');

  // classe de cor por categoria (ver style.css: .pin.familia, .pin.radical, etc.)
  pin.className = `pin ${atracao.categoria || ''}`;

  pin.dataset.nome = atracao.titulo.toLowerCase();
  pin.dataset.categoria = atracao.categoria || '';
  pin.dataset.id = id;
  pin.dataset.instagramavel = atracao.instagramavel ? 'sim' : 'nao';

  if (semCoordenadas) {
    // PINO NOVO: ainda não tem posição real -> nasce numa fileira de
    // espera na parte de baixo do mapa, com visual tracejado, pra você
    // arrastar até o lugar certo usando o Modo Calibração.
    pin.classList.add('pin-novo');

    const x = 6 + (contadorPinosNovos % 11) * 8.5;
    const y = 97;
    contadorPinosNovos++;

    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.title = `⚠️ ${atracao.titulo} — ainda sem posição definida, arraste-me!`;
  } else {
    pin.style.left = `${atracao.x}%`;
    pin.style.top = `${atracao.y}%`;
  }

  // ===============================
  // ABRIR INFORMAÇÕES
  // ===============================
  pin.addEventListener('click', function() {
    mostrar(id, this);
  });

  // ===============================
  // ARRASTAR PIN (modo calibração)
  // ===============================
  pin.addEventListener('mousedown', function(event) {
    pinArrastando = pin;

    const nome = pin.dataset.nome || 'Atração sem nome';
    atracaoSelecionada.textContent = `📍 ${nome}`;

    event.preventDefault();
  });

  mapaCanvas.appendChild(pin);

  console.log(`📍 Pin criado: ${id} | X: ${atracao.x} | Y: ${atracao.y}${semCoordenadas ? ' (fileira de espera)' : ''}`);
}

function mostrarAvisoPinosNovos(total) {
  if (total === 0) return;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-pinos-novos';
  aviso.textContent = `⚠️ ${total} pino(s) novo(s) aguardando posição — arraste-os do rodapé do mapa`;
  mapaCanvas.appendChild(aviso);
}

function mostrar(id, elemento) {
  const atracao = atracoes[id];

  if (!atracao) {
    console.error('Atração não encontrada:', id);
    return;
  }

  document.getElementById('titulo').innerHTML = atracao.titulo;

  const fotoHtml = atracao.foto
    ? `<img class="foto-atracao" src="${atracao.foto}" alt="${atracao.titulo}">`
    : '';

  document.getElementById('conteudo').innerHTML = `
    ${fotoHtml}
    ${atracao.texto}

    <div class="info-grid">
      <div class="info-card">
        <strong>🕒 Espera</strong><br>
        ${atracao.espera || '—'}
      </div>

      <div class="info-card">
        <strong>📍 Zona</strong><br>
        ${atracao.zona || '—'}
      </div>

      <div class="info-card">
        <strong>🎯 Adrenalina</strong><br>
        ${atracao.adrenalina || '—'}
      </div>

      <div class="info-card">
        <strong>👶 Crianças</strong><br>
        ${atracao.infantil || '—'}
      </div>
    </div>

    <button class="btn-favorito" onclick="favoritar('${atracao.favorito || atracao.titulo}')">
      ❤️ Adicionar ao Meu Dia
    </button>

    ${atracao.instagramavel && atracao.moldura
      ? `<button class="btn-favorito btn-instagram" onclick="abrirModalMoldura('${id}')">📸 Criar minha foto aqui</button>`
      : ''}

    <div class="avaliacoes-box" id="avaliacoesContainer">
      <h4>⭐ Avaliações</h4>
      <p class="carregando-avaliacoes">Carregando avaliações...</p>
    </div>
  `;

  document.getElementById('status').innerHTML =
    `<div class="status">${atracao.status || ''}</div>`;

  carregarERenderizarAvaliacoes(id);
}

// ===============================
// FAVORITOS
// ===============================

function favoritar(nome) {
  let favoritos = JSON.parse(localStorage.getItem('aldeiaFavoritos')) || [];

  if (!favoritos.includes(nome)) {
    favoritos.push(nome);
  }

  localStorage.setItem('aldeiaFavoritos', JSON.stringify(favoritos));

  atualizarFavoritos();

  alert(`⭐ ${nome} adicionado ao Meu Dia!`);
}

function atualizarFavoritos() {
  const lista = document.getElementById('listaFavoritos');
  if (!lista) return;

  const favoritos = JSON.parse(localStorage.getItem('aldeiaFavoritos')) || [];

  if (favoritos.length === 0) {
    lista.innerHTML = '<li>Nenhuma atração favorita ainda</li>';
    return;
  }

  lista.innerHTML = favoritos.map(item => `<li>⭐ ${item}</li>`).join('');
}

window.addEventListener('load', atualizarFavoritos);

// ===============================
// ZOOM
// ===============================

const mapaCanvas = document.getElementById('mapaCanvas');
let zoom = 1;

function aplicarZoom(){
  mapaCanvas.style.transform = `scale(${zoom})`;
}

function zoomIn(){
  zoom = Math.min(zoom + 0.2, 3);
  aplicarZoom();
}

function zoomOut(){
  zoom = Math.max(zoom - 0.2, 1);
  aplicarZoom();
}

document.getElementById('busca').addEventListener('input', function(){
  const termo = this.value.toLowerCase();

  document.querySelectorAll('.pin').forEach(pin => {
    const nome = pin.dataset.nome;
    pin.style.display = nome.includes(termo) ? 'block' : 'none';
  });
});

function filtrar(tipo){
  document.querySelectorAll('.pin').forEach(pin => {
    if (tipo === 'instagram') {
      pin.style.display = pin.dataset.instagramavel === 'sim' ? 'block' : 'none';
      return;
    }

    pin.style.display =
      tipo === 'todos' || pin.dataset.categoria === tipo
        ? 'block'
        : 'none';
  });
}

// ===============================
// ARRASTAR/CALIBRAR PINOS
// ===============================

let pinSelecionado = null;
let houveMovimento = false;

const botaoCopiar = document.getElementById('copiarCoordenadas');
const botaoSalvar = document.getElementById('salvarCoordenadas');

// precisa ser chamado depois que os pinos são criados dinamicamente
function ativarCalibracaoDosPins(){
  document.querySelectorAll('.pin').forEach(pin => {
    pin.addEventListener('mousedown', function(event) {
      pinSelecionado = pin;
      pinArrastando = pin;
      houveMovimento = false;

      const nome = pin.dataset.nome || 'Atração sem nome';

      if (atracaoSelecionada) {
        atracaoSelecionada.textContent = `📍 ${nome}`;
      }

      event.preventDefault();
    });
  });
}

document.addEventListener('mousemove', function(event) {
  if (!pinArrastando) return;

  houveMovimento = true;

  const rect = mapaCanvasCalibracao.getBoundingClientRect();

  let x = ((event.clientX - rect.left) / rect.width) * 100;
  let y = ((event.clientY - rect.top) / rect.height) * 100;

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));

  ultimaX = x;
  ultimaY = y;

  pinArrastando.style.left = `${x}%`;
  pinArrastando.style.top = `${y}%`;

  if (coordenadas) {
    coordenadas.textContent = `X: ${x.toFixed(2)}% | Y: ${y.toFixed(2)}%`;
  }
});

document.addEventListener('mouseup', function() {
  if (!pinArrastando) return;

  const id = pinArrastando.dataset.id || pinArrastando.dataset.nome;

  // só grava se realmente houve arrasto (evita gravar coordenada antiga
  // por engano num clique simples, sem mover o mouse)
  if (houveMovimento && atracoesJSON[id]) {
    atracoesJSON[id].x = Number(ultimaX.toFixed(2));
    atracoesJSON[id].y = Number(ultimaY.toFixed(2));

    salvarRascunho();
    atualizarContadorPendentes();

    console.log(
      '📍 Posição gravada em memória + rascunho local:', id,
      'X:', ultimaX?.toFixed(2),
      'Y:', ultimaY?.toFixed(2)
    );
  }

  pinArrastando = null;
});

// ===============================
// COPIAR COORDENADAS
// ===============================

if (botaoCopiar) {
  botaoCopiar.addEventListener('click', function() {
    if (ultimaX === null || ultimaY === null) {
      alert('📍 Primeiro arraste um pin.');
      return;
    }

    const texto = `X: ${ultimaX.toFixed(2)}% | Y: ${ultimaY.toFixed(2)}%`;

    navigator.clipboard.writeText(texto);

    botaoCopiar.textContent = '✅ Copiado!';

    setTimeout(() => {
      botaoCopiar.textContent = '📋 Copiar coordenadas';
    }, 1500);
  });
}

// ===============================
// SALVAR TODAS AS POSIÇÕES
// ===============================
// Diferente da versão anterior, este botão NÃO salva só o último pino
// selecionado — ele baixa o atracoes.json com TODAS as posições
// arrastadas até agora na sessão (cada arrasto já vai sendo gravado em
// memória sozinho, ver mouseup acima). Então o fluxo correto é:
// arrastar quantos pinos quiser, à vontade, e só no final clicar aqui
// UMA VEZ pra baixar o arquivo completo.

function atualizarContadorPendentes() {
  const label = document.getElementById('contadorPendentes');
  if (!label) return;

  const total = Object.values(atracoesJSON).filter(a => a.x !== null && a.y !== null).length;
  label.textContent = `${total} posições prontas para salvar`;
}

if (botaoSalvar) {
  botaoSalvar.addEventListener('click', function() {
    const jsonAtualizado = JSON.stringify(atracoesJSON, null, 2);
    const arquivo = new Blob([jsonAtualizado], { type: 'application/json' });
    const url = URL.createObjectURL(arquivo);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'atracoes.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    botaoSalvar.textContent = '✅ Baixado! Agora substitua o arquivo antigo';

    setTimeout(() => {
      botaoSalvar.textContent = '💾 Salvar TODAS as posições';
    }, 2500);

    // depois de baixado com sucesso, pode limpar o rascunho de segurança
    localStorage.removeItem(CHAVE_RASCUNHO);

    console.log('📄 atracoes.json completo gerado! Substitua o arquivo antigo pelo baixado.');
  });
}

// ======================================================================
// SISTEMA DE ROTEIRO (rota otimizada + navegação por GPS)
// ======================================================================
//
// Como funciona:
// 1) O visitante marca no checklist quais atrações quer visitar hoje.
// 2) "Criar roteiro" calcula a ORDEM mais curta pra visitar todas elas
//    (algoritmo do "vizinho mais próximo" — parte do ponto atual e sempre
//    vai pra parada não visitada mais perto), e desenha a linha no mapa.
// 3) Se o GPS estiver calibrado e ativado, o pino "você está aqui" se move
//    sozinho com a posição real do celular, e quando o visitante chega
//    perto de uma parada (dentro de ROUTE_ARRIVAL_THRESHOLD), ela é
//    marcada como concluída automaticamente e a linha é redesenhada só
//    com o que falta.
//
// O GPS real (latitude/longitude) não sabe nada sobre o seu mapa desenhado
// à mão — por isso existe a calibração: você caminha até 3 pontos bem
// afastados do parque, associa cada um a uma atração/pino conhecido, e o
// sistema resolve um sistema linear (transformação afim) que converte
// qualquer lat/lon futura na posição X/Y correspondente do mapa.
// ======================================================================

const ROUTE_ARRIVAL_THRESHOLD = 4; // % do mapa — ajuste conforme o tamanho real do parque

let roteiroPendente = [];   // ids das atrações ainda não visitadas, em ordem
let roteiroConcluido = [];  // ids já visitados nesta sessão
let gpsWatchId = null;
let gpsCalibracao = carregarCalibracaoGps(); // {a,b,c,d,e,f} ou null

// ----------------------------------------------------------------------
// CHECKLIST DE ATRAÇÕES PARA O ROTEIRO
// ----------------------------------------------------------------------

function renderChecklistRoteiro() {
  const container = document.getElementById('listaRoteiroAtracoes');
  if (!container) return;

  const itens = Object.entries(atracoes)
    .filter(([id, a]) => a.x !== null && a.y !== null && a.x !== undefined && a.y !== undefined)
    .sort((a, b) => a[1].titulo.localeCompare(b[1].titulo));

  container.innerHTML = itens.map(([id, a]) => `
    <label>
      <input type="checkbox" value="${id}" class="checkbox-roteiro">
      ${a.titulo}
    </label>
  `).join('');
}

// ----------------------------------------------------------------------
// CÁLCULO DA ROTA (vizinho mais próximo)
// ----------------------------------------------------------------------

function distanciaPercentual(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function posicaoAtualNoMapa() {
  // se o GPS estiver ativo, usamos a posição real; senão, a posição
  // atual (manual) do marcador "você está aqui" no mapa.
  const el = document.getElementById('voceAqui');
  const x = parseFloat(el.style.left) || 0;
  const y = parseFloat(el.style.top) || 0;
  return { x, y };
}

function calcularOrdemVizinhoMaisProximo(inicioXY, ids) {
  const restantes = [...ids];
  const ordem = [];
  let atual = inicioXY;

  while (restantes.length > 0) {
    let idxMaisPerto = 0;
    let menorDist = Infinity;

    restantes.forEach((id, idx) => {
      const a = atracoes[id];
      const d = distanciaPercentual(atual.x, atual.y, a.x, a.y);
      if (d < menorDist) {
        menorDist = d;
        idxMaisPerto = idx;
      }
    });

    const proximoId = restantes.splice(idxMaisPerto, 1)[0];
    ordem.push(proximoId);
    atual = { x: atracoes[proximoId].x, y: atracoes[proximoId].y };
  }

  return ordem;
}

function criarRoteiro() {
  const selecionados = Array.from(document.querySelectorAll('.checkbox-roteiro:checked'))
    .map(cb => cb.value);

  if (selecionados.length === 0) {
    alert('📍 Marque pelo menos uma atração no checklist do roteiro.');
    return;
  }

  const inicio = posicaoAtualNoMapa();

  roteiroPendente = calcularOrdemVizinhoMaisProximo(inicio, selecionados);
  roteiroConcluido = [];

  desenharRotaSvg();
  renderPassosRoteiro();
}

// ----------------------------------------------------------------------
// DESENHO DA ROTA NO SVG (usa % igual aos pinos, ver viewBox no HTML)
// ----------------------------------------------------------------------

function desenharRotaSvg() {
  const svg = document.getElementById('rotaSvg');
  if (!svg) return;

  if (roteiroPendente.length === 0) {
    svg.innerHTML = '';
    return;
  }

  const inicio = posicaoAtualNoMapa();
  const pontos = [inicio, ...roteiroPendente.map(id => ({ x: atracoes[id].x, y: atracoes[id].y }))];

  const d = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  let svgInterno = `<path class="rota-path" d="${d}"></path>`;

  // numera cada parada (1, 2, 3...) ao longo da rota
  roteiroPendente.forEach((id, i) => {
    const a = atracoes[id];
    svgInterno += `
      <circle class="rota-ponto" cx="${a.x}" cy="${a.y}" r="4.2" fill="#ff9800" stroke="white" stroke-width="1"></circle>
      <text class="rota-numero" x="${a.x}" y="${a.y}">${i + 1}</text>
    `;
  });

  svg.innerHTML = svgInterno;
}

// ----------------------------------------------------------------------
// LISTA DE PASSOS NO PAINEL LATERAL
// ----------------------------------------------------------------------

function renderPassosRoteiro() {
  const container = document.getElementById('passosRoteiro');
  if (!container) return;

  if (roteiroPendente.length === 0 && roteiroConcluido.length === 0) {
    container.innerHTML = '';
    return;
  }

  if (roteiroPendente.length === 0) {
    container.innerHTML = `<div class="passo-roteiro concluido"><div class="passo-numero">✓</div> 🎉 Roteiro concluído!</div>`;
    return;
  }

  let html = '';

  roteiroConcluido.forEach((id, i) => {
    html += `<div class="passo-roteiro concluido"><div class="passo-numero">✓</div> ${atracoes[id].titulo}</div>`;
  });

  roteiroPendente.forEach((id, i) => {
    const classe = i === 0 ? 'atual' : '';
    html += `<div class="passo-roteiro ${classe}"><div class="passo-numero">${i + 1}</div> ${atracoes[id].titulo}${i === 0 ? ' — próxima parada' : ''}</div>`;
  });

  container.innerHTML = html;
}

// ----------------------------------------------------------------------
// GPS — CALIBRAÇÃO (3 pontos: lat/lon real -> x/y do mapa)
// ----------------------------------------------------------------------

function carregarCalibracaoGps() {
  try {
    return JSON.parse(localStorage.getItem('aldeiaGpsCalibracao')) || null;
  } catch {
    return null;
  }
}

function carregarPontosGps() {
  try {
    return JSON.parse(localStorage.getItem('aldeiaGpsPontos')) || [];
  } catch {
    return [];
  }
}

function salvarPontosGps(pontos) {
  localStorage.setItem('aldeiaGpsPontos', JSON.stringify(pontos));
}

function popularSelectGps() {
  const select = document.getElementById('selectAtracaoGps');
  if (!select) return;

  const todas = Object.entries(atracoes);

  // pontos recomendados (extremidades escolhidas pra calibração) sempre no topo,
  // mesmo que ainda não tenham posição no mapa — assim fica visível o que falta calibrar
  const recomendados = todas
    .filter(([id, a]) => a.pontoCalibracaoRecomendado)
    .sort((a, b) => (a[1].numeroMapa || 0) - (b[1].numeroMapa || 0));

  const outros = todas
    .filter(([id, a]) => !a.pontoCalibracaoRecomendado && a.x !== null && a.y !== null)
    .sort((a, b) => a[1].titulo.localeCompare(b[1].titulo));

  function opcao([id, a]) {
    const semPosicao = a.x === null || a.y === null;
    const estrela = a.pontoCalibracaoRecomendado ? '⭐ ' : '';
    const aviso = semPosicao ? ' — ⚠️ ainda sem posição no mapa' : '';
    return `<option value="${id}" ${semPosicao ? 'disabled' : ''}>${estrela}${a.titulo}${aviso}</option>`;
  }

  let html = '';

  if (recomendados.length > 0) {
    html += `<optgroup label="⭐ Pontos recomendados p/ calibração">${recomendados.map(opcao).join('')}</optgroup>`;
  }

  html += `<optgroup label="Outras atrações">${outros.map(opcao).join('')}</optgroup>`;

  select.innerHTML = html;
}

function atualizarStatusCalibracaoGps() {
  const pontos = carregarPontosGps();
  const status = document.getElementById('statusCalibracaoGps');
  const botaoCalcular = document.getElementById('calcularCalibracaoGps');

  if (status) status.textContent = `Pontos capturados: ${pontos.length}/3`;
  if (botaoCalcular) botaoCalcular.disabled = pontos.length < 3;
}

const botaoCapturarGps = document.getElementById('capturarGps');
if (botaoCapturarGps) {
  botaoCapturarGps.addEventListener('click', function () {
    if (!navigator.geolocation) {
      alert('❌ Seu navegador não suporta geolocalização.');
      return;
    }

    const select = document.getElementById('selectAtracaoGps');
    const id = select.value;
    const atracao = atracoes[id];

    if (!atracao || atracao.x === null || atracao.y === null) {
      alert('❌ Essa atração ainda não tem posição salva no mapa. Calibre o pino dela primeiro.');
      return;
    }

    botaoCapturarGps.textContent = '📡 Obtendo sinal GPS...';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const pontos = carregarPontosGps().filter(p => p.id !== id); // evita duplicar o mesmo ponto

        pontos.push({
          id,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          x: atracao.x,
          y: atracao.y
        });

        salvarPontosGps(pontos.slice(-3)); // guarda só os 3 últimos capturados
        atualizarStatusCalibracaoGps();

        botaoCapturarGps.textContent = '✅ Capturado!';
        setTimeout(() => { botaoCapturarGps.textContent = '📡 Capturar GPS aqui'; }, 1500);
      },
      function (erro) {
        alert('❌ Não foi possível obter o GPS: ' + erro.message);
        botaoCapturarGps.textContent = '📡 Capturar GPS aqui';
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// resolve um sistema linear 3x3 (regra de Cramer) — usado pra achar a
// transformação afim entre lat/lon reais e x/y do mapa
function resolver3x3(M) {
  const det = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const A = M.map(row => row.slice(0, 3));
  const B = M.map(row => row[3]);
  const detA = det(A);

  if (Math.abs(detA) < 1e-12) return null; // pontos colineares/repetidos, não dá pra calibrar

  const resultado = [];
  for (let col = 0; col < 3; col++) {
    const Ai = A.map((row, i) => row.map((v, j) => (j === col ? B[i] : v)));
    resultado.push(det(Ai) / detA);
  }
  return resultado; // [coef_lat, coef_lon, constante]
}

const botaoCalcularGps = document.getElementById('calcularCalibracaoGps');
if (botaoCalcularGps) {
  botaoCalcularGps.addEventListener('click', function () {
    const pontos = carregarPontosGps();

    if (pontos.length < 3) {
      alert('📍 Capture 3 pontos antes de calcular.');
      return;
    }

    // resolve: x = a*lat + b*lon + c
    const sistemaX = pontos.map(p => [p.lat, p.lon, 1, p.x]);
    const coefX = resolver3x3(sistemaX);

    // resolve: y = d*lat + e*lon + f
    const sistemaY = pontos.map(p => [p.lat, p.lon, 1, p.y]);
    const coefY = resolver3x3(sistemaY);

    if (!coefX || !coefY) {
      alert('❌ Os 3 pontos capturados estão muito próximos/alinhados. Escolha pontos mais espalhados pelo parque e capture de novo.');
      return;
    }

    gpsCalibracao = {
      a: coefX[0], b: coefX[1], c: coefX[2],
      d: coefY[0], e: coefY[1], f: coefY[2]
    };

    localStorage.setItem('aldeiaGpsCalibracao', JSON.stringify(gpsCalibracao));

    alert('✅ Calibração GPS concluída! Agora você pode ativar o GPS a qualquer momento.');
  });
}

const botaoResetarGps = document.getElementById('resetarCalibracaoGps');
if (botaoResetarGps) {
  botaoResetarGps.addEventListener('click', function () {
    if (!confirm('Apagar a calibração GPS atual e recomeçar?')) return;

    localStorage.removeItem('aldeiaGpsCalibracao');
    localStorage.removeItem('aldeiaGpsPontos');
    gpsCalibracao = null;
    atualizarStatusCalibracaoGps();
    alert('🗑️ Calibração apagada.');
  });
}

// ----------------------------------------------------------------------
// GPS — CONVERSÃO lat/lon -> x/y DO MAPA
// ----------------------------------------------------------------------

function gpsParaMapa(lat, lon) {
  if (!gpsCalibracao) return null;

  const { a, b, c, d, e, f } = gpsCalibracao;

  let x = a * lat + b * lon + c;
  let y = d * lat + e * lon + f;

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));

  return { x, y };
}

// ----------------------------------------------------------------------
// GPS — ATIVAR / DESATIVAR NAVEGAÇÃO AO VIVO
// ----------------------------------------------------------------------

const botaoAtivarGps = document.getElementById('btnAtivarGps');
const statusGpsDiv = document.getElementById('statusGps');

if (botaoAtivarGps) {
  botaoAtivarGps.addEventListener('click', function () {
    if (gpsWatchId !== null) {
      desativarGps();
    } else {
      ativarGps();
    }
  });
}

function ativarGps() {
  if (!navigator.geolocation) {
    alert('❌ Seu navegador não suporta geolocalização.');
    return;
  }

  gpsCalibracao = carregarCalibracaoGps();

  if (!gpsCalibracao) {
    alert('📡 O GPS ainda não foi calibrado neste mapa.\n\nAbra o Modo Calibração e capture 3 pontos de referência antes de ativar a navegação ao vivo.');
    return;
  }

  statusGpsDiv.textContent = '📡 Obtendo sinal GPS...';

  gpsWatchId = navigator.geolocation.watchPosition(
    function (pos) {
      const posMapa = gpsParaMapa(pos.coords.latitude, pos.coords.longitude);
      if (!posMapa) return;

      moverVoceAqui(posMapa.x, posMapa.y);

      statusGpsDiv.textContent = `📍 GPS ativo (precisão ~${Math.round(pos.coords.accuracy)}m)`;

      verificarChegadaNaParada(posMapa.x, posMapa.y);
    },
    function (erro) {
      statusGpsDiv.textContent = '❌ Erro no GPS: ' + erro.message;
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );

  botaoAtivarGps.textContent = '🛑 Desativar GPS';
  botaoAtivarGps.classList.add('ativo');
}

function desativarGps() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  botaoAtivarGps.textContent = '📍 Ativar GPS (você está aqui)';
  botaoAtivarGps.classList.remove('ativo');
  statusGpsDiv.textContent = '';
}

function moverVoceAqui(x, y) {
  const el = document.getElementById('voceAqui');
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;

  // se houver um roteiro em andamento, redesenha a linha a partir da nova posição
  if (roteiroPendente.length > 0) {
    desenharRotaSvg();
  }
}

function verificarChegadaNaParada(x, y) {
  if (roteiroPendente.length === 0) return;

  const proximoId = roteiroPendente[0];
  const proximo = atracoes[proximoId];

  const dist = distanciaPercentual(x, y, proximo.x, proximo.y);

  if (dist <= ROUTE_ARRIVAL_THRESHOLD) {
    roteiroConcluido.push(proximoId);
    roteiroPendente.shift();

    desenharRotaSvg();
    renderPassosRoteiro();

    if (roteiroPendente.length === 0) {
      alert('🎉 Você concluiu o roteiro de hoje!');
    } else {
      console.log(`✅ Chegou em: ${proximo.titulo}. Próxima parada: ${atracoes[roteiroPendente[0]].titulo}`);
    }
  }
}

// ----------------------------------------------------------------------
// BOTÃO "CRIAR ROTEIRO"
// ----------------------------------------------------------------------

const botaoCriarRoteiro = document.getElementById('btnCriarRoteiro');
if (botaoCriarRoteiro) {
  botaoCriarRoteiro.addEventListener('click', criarRoteiro);
}

// ======================================================================
// PONTOS INSTAGRAMÁVEIS + COMPOSITOR DE FOTO COM MOLDURA
// ======================================================================
//
// Cada atração pode ter "instagramavel": true e um campo "moldura"
// apontando pra um PNG transparente (proporção 1080x1350 = 4:5, igual
// ao formato retrato do Instagram). O compositor:
//   1) carrega a moldura no <canvas> do tamanho dela
//   2) quando o visitante escolhe/tira uma foto, desenha essa foto
//      "cobrindo" o canvas todo (estilo object-fit: cover)
//   3) desenha a moldura por cima (as partes transparentes deixam a
//      foto aparecer, as coloridas cobrem)
//   4) gera um PNG final pra download
//
// As molduras atuais (assets/molduras/*.png) são placeholders gerados
// automaticamente — troque pelos arquivos com a arte oficial da marca
// quando estiverem prontos, mantendo o mesmo tamanho 1080x1350.
// ======================================================================

function renderGaleriaInstagram() {
  const container = document.getElementById('galeriaInstagram');
  if (!container) return;

  const pontos = Object.entries(atracoes).filter(([id, a]) => a.instagramavel && a.moldura);

  if (pontos.length === 0) {
    container.innerHTML = '<p style="font-size:13px;color:#777;">Nenhum ponto marcado ainda.</p>';
    return;
  }

  container.innerHTML = pontos.map(([id, a]) => `
    <div class="item-instagram" onclick="abrirModalMoldura('${id}')">
      <span class="emoji-instagram">📸</span>
      ${a.titulo}
    </div>
  `).join('');
}

let molduraAtualId = null;
let molduraAtualImg = null; // Image() da moldura carregada
let fotoAtualImg = null;    // Image() da foto capturada/escolhida (null = ainda na câmera ao vivo)

const modalMoldura = document.getElementById('modalMoldura');
const canvasMoldura = document.getElementById('canvasMoldura');
const ctxMoldura = canvasMoldura ? canvasMoldura.getContext('2d') : null;
const inputFotoMoldura = document.getElementById('inputFotoMoldura');
const btnBaixarFotoMoldura = document.getElementById('btnBaixarFotoMoldura');
const btnBaixarSoMoldura = document.getElementById('btnBaixarSoMoldura');
const btnCompartilharFoto = document.getElementById('btnCompartilharFoto');

const cameraWrapper = document.getElementById('cameraWrapper');
const canvasWrapper = document.getElementById('canvasWrapper');
const videoCamera = document.getElementById('videoCamera');
const molduraOverlayCamera = document.getElementById('molduraOverlayCamera');
const cameraErro = document.getElementById('cameraErro');
const btnCapturarFoto = document.getElementById('btnCapturarFoto');
const btnTrocarCamera = document.getElementById('btnTrocarCamera');
const btnEscolherGaleria = document.getElementById('btnEscolherGaleria');
const btnNovaFoto = document.getElementById('btnNovaFoto');

let streamCamera = null;
let cameraAtual = 'environment'; // começa na câmera traseira (melhor pra fotografar o parque)

// ----------------------------------------------------------------------
// ABRIR / FECHAR O MODAL
// ----------------------------------------------------------------------

function abrirModalMoldura(id) {
  const atracao = atracoes[id];
  if (!atracao || !atracao.moldura) return;

  molduraAtualId = id;
  fotoAtualImg = null;

  document.getElementById('modalMolduraTitulo').textContent = `📸 ${atracao.titulo}`;
  document.getElementById('modalAjuda').textContent = 'Enquadre e toque em "Capturar", ou escolha uma foto da galeria:';
  if (inputFotoMoldura) inputFotoMoldura.value = '';
  if (btnBaixarFotoMoldura) btnBaixarFotoMoldura.disabled = true;
  if (btnCompartilharFoto) btnCompartilharFoto.classList.add('oculto');
  if (btnNovaFoto) btnNovaFoto.classList.add('oculto');

  molduraOverlayCamera.src = atracao.moldura;

  molduraAtualImg = new Image();
  molduraAtualImg.onerror = function () {
    alert('❌ Não encontrei o arquivo da moldura: ' + atracao.moldura + '\nColoque a imagem em assets/molduras/.');
  };
  molduraAtualImg.src = atracao.moldura;

  mostrarModoCamera();
  modalMoldura.classList.remove('oculto');
  iniciarCamera();
}

function fecharModalMoldura() {
  modalMoldura.classList.add('oculto');
  pararCamera();
}

const botaoFecharModal = document.getElementById('fecharModalMoldura');
if (botaoFecharModal) {
  botaoFecharModal.addEventListener('click', fecharModalMoldura);
}

if (modalMoldura) {
  modalMoldura.addEventListener('click', function (event) {
    if (event.target === modalMoldura) fecharModalMoldura(); // clique fora fecha
  });
}

// ----------------------------------------------------------------------
// CÂMERA AO VIVO (getUserMedia) — a moldura fica sobreposta em tempo
// real no <video>, então a pessoa já vê como vai ficar antes de tirar.
// IMPORTANTE: só funciona em HTTPS ou localhost (regra do navegador,
// igual o GPS). No file:// direto, cai automaticamente pra galeria.
// ----------------------------------------------------------------------

function mostrarModoCamera() {
  cameraWrapper.classList.remove('oculto');
  canvasWrapper.classList.add('oculto');
  btnCapturarFoto.classList.remove('oculto');
  btnTrocarCamera.classList.remove('oculto');
  btnEscolherGaleria.classList.remove('oculto');
  btnNovaFoto.classList.add('oculto');
}

function mostrarModoPreview() {
  cameraWrapper.classList.add('oculto');
  canvasWrapper.classList.remove('oculto');
  btnCapturarFoto.classList.add('oculto');
  btnTrocarCamera.classList.add('oculto');
  btnEscolherGaleria.classList.add('oculto');
  btnNovaFoto.classList.remove('oculto');
}

async function iniciarCamera() {
  pararCamera();
  cameraErro.classList.add('oculto');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraErro.classList.remove('oculto');
    return;
  }

  try {
    streamCamera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: cameraAtual },
      audio: false
    });
    videoCamera.srcObject = streamCamera;
  } catch (erro) {
    console.warn('⚠️ Câmera indisponível:', erro.message);
    cameraErro.classList.remove('oculto');
  }
}

function pararCamera() {
  if (streamCamera) {
    streamCamera.getTracks().forEach(track => track.stop());
    streamCamera = null;
  }
}

if (btnTrocarCamera) {
  btnTrocarCamera.addEventListener('click', function () {
    cameraAtual = cameraAtual === 'environment' ? 'user' : 'environment';
    iniciarCamera();
  });
}

// captura o frame atual do vídeo + a moldura, e joga no canvas de preview
if (btnCapturarFoto) {
  btnCapturarFoto.addEventListener('click', function () {
    if (!videoCamera.videoWidth) return; // câmera ainda não carregou nenhum frame

    const imagemCapturada = new Image();
    const canvasTemp = document.createElement('canvas');
    canvasTemp.width = videoCamera.videoWidth;
    canvasTemp.height = videoCamera.videoHeight;
    const ctxTemp = canvasTemp.getContext('2d');

    // espelha se for câmera frontal (senão a foto sai "invertida" tipo espelho)
    if (cameraAtual === 'user') {
      ctxTemp.translate(canvasTemp.width, 0);
      ctxTemp.scale(-1, 1);
    }
    ctxTemp.drawImage(videoCamera, 0, 0);

    imagemCapturada.onload = function () {
      fotoAtualImg = imagemCapturada;
      pararCamera();
      prepararCanvasComMoldura();
      mostrarModoPreview();
      if (btnBaixarFotoMoldura) btnBaixarFotoMoldura.disabled = false;
      if (btnCompartilharFoto) atualizarBotaoCompartilhar();
    };
    imagemCapturada.src = canvasTemp.toDataURL('image/jpeg', 0.92);
  });
}

if (btnNovaFoto) {
  btnNovaFoto.addEventListener('click', function () {
    fotoAtualImg = null;
    if (btnBaixarFotoMoldura) btnBaixarFotoMoldura.disabled = true;
    if (btnCompartilharFoto) btnCompartilharFoto.classList.add('oculto');
    mostrarModoCamera();
    iniciarCamera();
  });
}

// ----------------------------------------------------------------------
// GALERIA (upload de foto já existente)
// ----------------------------------------------------------------------

if (btnEscolherGaleria) {
  btnEscolherGaleria.addEventListener('click', function () {
    inputFotoMoldura.click();
  });
}

if (inputFotoMoldura) {
  inputFotoMoldura.addEventListener('change', function (event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        fotoAtualImg = img;
        pararCamera();
        prepararCanvasComMoldura();
        mostrarModoPreview();
        if (btnBaixarFotoMoldura) btnBaixarFotoMoldura.disabled = false;
        atualizarBotaoCompartilhar();
      };
      img.src = e.target.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

// ----------------------------------------------------------------------
// COMPOSIÇÃO FINAL (canvas = foto + moldura por cima)
// ----------------------------------------------------------------------

function prepararCanvasComMoldura() {
  if (!ctxMoldura || !molduraAtualImg || !fotoAtualImg) return;

  // usa o tamanho real da moldura (ex: 1080x1350) como resolução final
  const W = molduraAtualImg.naturalWidth || molduraAtualImg.width || 1080;
  const H = molduraAtualImg.naturalHeight || molduraAtualImg.height || 1350;

  canvasMoldura.width = W;
  canvasMoldura.height = H;

  ctxMoldura.clearRect(0, 0, W, H);

  // desenha a foto cobrindo o canvas inteiro (crop central, tipo object-fit:cover)
  const escala = Math.max(W / fotoAtualImg.width, H / fotoAtualImg.height);
  const larguraDesenho = fotoAtualImg.width * escala;
  const alturaDesenho = fotoAtualImg.height * escala;
  const offsetX = (W - larguraDesenho) / 2;
  const offsetY = (H - alturaDesenho) / 2;

  ctxMoldura.drawImage(fotoAtualImg, offsetX, offsetY, larguraDesenho, alturaDesenho);

  // a moldura sempre por cima (tem áreas transparentes por design)
  ctxMoldura.drawImage(molduraAtualImg, 0, 0, W, H);
}

// ----------------------------------------------------------------------
// BAIXAR
// ----------------------------------------------------------------------

if (btnBaixarFotoMoldura) {
  btnBaixarFotoMoldura.addEventListener('click', function () {
    if (!fotoAtualImg) return;

    canvasMoldura.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aldeia-${molduraAtualId || 'foto'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
}

if (btnBaixarSoMoldura) {
  btnBaixarSoMoldura.addEventListener('click', function () {
    const atracao = atracoes[molduraAtualId];
    if (!atracao || !atracao.moldura) return;

    const link = document.createElement('a');
    link.href = atracao.moldura;
    link.download = atracao.moldura.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// ----------------------------------------------------------------------
// COMPARTILHAR — abre o menu nativo do celular (Instagram, WhatsApp,
// Facebook, X/Twitter, E-mail, Mensagens etc. aparecem automaticamente,
// porque é o próprio sistema operacional que monta essa lista).
// A escolha entre "Feed" ou "Stories" do Instagram é decidida pelo
// próprio app do Instagram depois que ele recebe a imagem — não dá pra
// forçar isso a partir do site.
// Só funciona em celular com HTTPS (Web Share API); no computador, ou
// se o navegador não suportar, o botão nem aparece — a pessoa baixa e
// posta manualmente.
// ----------------------------------------------------------------------

function atualizarBotaoCompartilhar() {
  if (!btnCompartilharFoto) return;

  const suportaCompartilharArquivo =
    navigator.share && navigator.canShare && canvasMoldura.toBlob;

  btnCompartilharFoto.classList.toggle('oculto', !suportaCompartilharArquivo);
}

if (btnCompartilharFoto) {
  btnCompartilharFoto.addEventListener('click', function () {
    if (!fotoAtualImg) return;

    canvasMoldura.toBlob(async function (blob) {
      const atracao = atracoes[molduraAtualId];
      const arquivo = new File([blob], `aldeia-${molduraAtualId || 'foto'}.png`, { type: 'image/png' });

      const dadosCompartilhamento = {
        files: [arquivo],
        title: 'Aldeia das Águas',
        text: atracao ? `Curtindo o(a) ${atracao.titulo} no Aldeia das Águas! 🌊` : 'Meu dia no Aldeia das Águas! 🌊'
      };

      if (!navigator.canShare(dadosCompartilhamento)) {
        alert('⚠️ Seu navegador não permite compartilhar arquivos diretamente. Baixe a foto e poste manualmente.');
        return;
      }

      try {
        await navigator.share(dadosCompartilhamento);
      } catch (erro) {
        if (erro.name !== 'AbortError') { // AbortError = a pessoa só cancelou o menu, não é erro de verdade
          console.error('❌ Erro ao compartilhar:', erro);
        }
      }
    }, 'image/png');
  });
}

// ======================================================================
// AVALIAÇÕES (ESTRELAS + COMENTÁRIOS) — BACKEND: GOOGLE SHEETS
// ======================================================================
//
// Como funciona:
// - As avaliações NÃO ficam no atracoes.json (que é estático). Elas
//   moram numa planilha Google Sheets, acessada através de um Google
//   Apps Script publicado como "Web App" (ver apps-script-avaliacoes.gs.txt
//   e o LEIA-ME para o passo a passo de instalação).
// - Não existe cadastro/login: cada navegador ganha um ID anônimo
//   (gerado uma vez e salvo no localStorage) só pra permitir que a
//   pessoa EDITE a própria nota depois, sem duplicar linhas na planilha.
// - IMPORTANTE: troque a constante AVALIACOES_URL abaixo pela URL do
//   seu Apps Script depois de publicá-lo (instruções no LEIA-ME).
// ======================================================================

const AVALIACOES_URL = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';

function avaliacoesConfiguradas() {
  return AVALIACOES_URL && !AVALIACOES_URL.includes('COLE_AQUI');
}

function obterUsuarioAnonimo() {
  let uid = localStorage.getItem('aldeiaUsuarioId');
  if (!uid) {
    uid = 'visitante-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    localStorage.setItem('aldeiaUsuarioId', uid);
  }
  return uid;
}

// evita caracteres HTML de comentários virarem código na tela (segurança básica)
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

function calcularMedia(avaliacoes) {
  if (!avaliacoes || avaliacoes.length === 0) return { media: 0, total: 0 };
  const soma = avaliacoes.reduce((acc, a) => acc + Number(a.estrelas), 0);
  return { media: soma / avaliacoes.length, total: avaliacoes.length };
}

async function carregarAvaliacoes(atracaoId) {
  if (!avaliacoesConfiguradas()) return [];

  try {
    const resp = await fetch(`${AVALIACOES_URL}?atracaoId=${encodeURIComponent(atracaoId)}`);
    const dados = await resp.json();
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.error('❌ Erro ao carregar avaliações:', erro);
    return [];
  }
}

async function carregarERenderizarAvaliacoes(atracaoId) {
  const avaliacoes = await carregarAvaliacoes(atracaoId);
  const container = document.getElementById('avaliacoesContainer');

  // se o visitante já trocou de atração antes da resposta chegar, ignora
  if (!container) return;

  container.outerHTML = renderBlocoAvaliacoes(atracaoId, avaliacoes);
}

function renderBlocoAvaliacoes(atracaoId, avaliacoes) {
  const { media, total } = calcularMedia(avaliacoes);
  const percentual = total > 0 ? (media / 5) * 100 : 0;

  const meuUsuario = obterUsuarioAnonimo();
  const minhaAvaliacao = avaliacoes.find(a => a.usuarioId === meuUsuario);

  const comentarios = avaliacoes
    .filter(a => a.comentario && a.comentario.toString().trim() !== '')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const avisoNaoConfigurado = !avaliacoesConfiguradas()
    ? '<p class="aviso-avaliacoes-config">⚠️ Sistema de avaliações ainda não configurado — veja o LEIA-ME.</p>'
    : '';

  return `
    <div class="avaliacoes-box" id="avaliacoesContainer">
      <h4>⭐ Avaliações</h4>

      ${avisoNaoConfigurado}

      <div class="media-avaliacao">
        <div class="estrelas-media">
          <div class="estrelas-fundo">★★★★★</div>
          <div class="estrelas-preenchidas" style="width:${percentual}%">★★★★★</div>
        </div>
        <span>${total > 0 ? media.toFixed(1) : '—'} (${total} avaliação${total === 1 ? '' : 'ões'})</span>
      </div>

      <div class="form-avaliacao">
        <p>${minhaAvaliacao ? 'Sua avaliação:' : 'Avalie esta atração:'}</p>

        <div class="estrelas-input" data-atracao="${atracaoId}" data-selecionado="${minhaAvaliacao ? minhaAvaliacao.estrelas : 0}">
          ${[1, 2, 3, 4, 5].map(n => `<span class="estrela-clicavel ${minhaAvaliacao && n <= minhaAvaliacao.estrelas ? 'selecionada' : ''}" data-valor="${n}">★</span>`).join('')}
        </div>

        <input type="text" class="input-nome-avaliacao" placeholder="Seu nome (opcional)"
          value="${minhaAvaliacao && minhaAvaliacao.nome !== 'Visitante' ? escaparHtml(minhaAvaliacao.nome) : ''}">

        <textarea class="input-comentario-avaliacao" placeholder="Deixe um comentário (opcional)">${minhaAvaliacao ? escaparHtml(minhaAvaliacao.comentario) : ''}</textarea>

        <button class="btn-enviar-avaliacao" onclick="enviarAvaliacao('${atracaoId}')">
          ${minhaAvaliacao ? '✏️ Atualizar avaliação' : '📤 Enviar avaliação'}
        </button>

        <div class="status-envio-avaliacao"></div>
      </div>

      <div class="lista-comentarios">
        ${comentarios.length === 0
          ? '<p class="sem-comentarios">Nenhum comentário ainda. Seja o primeiro!</p>'
          : comentarios.map(c => `
              <div class="comentario-item">
                <div class="comentario-cabecalho">
                  <strong>${escaparHtml(c.nome || 'Visitante')}</strong>
                  <span class="comentario-estrelas">${'★'.repeat(c.estrelas)}${'☆'.repeat(5 - c.estrelas)}</span>
                </div>
                <p>${escaparHtml(c.comentario)}</p>
              </div>
            `).join('')
        }
      </div>
    </div>
  `;
}

// clique nas estrelinhas do formulário (delegação de evento, já que o
// bloco é recriado toda vez que uma atração é aberta)
document.addEventListener('click', function (event) {
  if (!event.target.classList.contains('estrela-clicavel')) return;

  const container = event.target.closest('.estrelas-input');
  const valor = Number(event.target.dataset.valor);

  container.dataset.selecionado = valor;

  Array.from(container.children).forEach(function (estrela, idx) {
    estrela.classList.toggle('selecionada', idx < valor);
  });
});

async function enviarAvaliacao(atracaoId) {
  const container = document.querySelector(`.estrelas-input[data-atracao="${atracaoId}"]`);
  const estrelas = Number(container ? container.dataset.selecionado : 0);
  const statusDiv = document.querySelector('.status-envio-avaliacao');

  if (!estrelas) {
    alert('⭐ Toque nas estrelas pra dar uma nota antes de enviar.');
    return;
  }

  if (!avaliacoesConfiguradas()) {
    if (statusDiv) statusDiv.textContent = '⚠️ Sistema de avaliações ainda não configurado (ver LEIA-ME).';
    return;
  }

  const nome = (document.querySelector('.input-nome-avaliacao')?.value || '').trim() || 'Visitante';
  const comentario = (document.querySelector('.input-comentario-avaliacao')?.value || '').trim();

  if (statusDiv) statusDiv.textContent = '📤 Enviando...';

  try {
    await fetch(AVALIACOES_URL, {
      method: 'POST',
      // Content-Type: text/plain evita o "preflight" de CORS que o
      // Apps Script não responde corretamente — o servidor faz o
      // JSON.parse manualmente (ver apps-script-avaliacoes.gs.txt).
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        atracaoId,
        estrelas,
        comentario,
        nome,
        usuarioId: obterUsuarioAnonimo()
      })
    });

    if (statusDiv) statusDiv.textContent = '✅ Avaliação enviada, obrigado!';

    await carregarERenderizarAvaliacoes(atracaoId);
  } catch (erro) {
    console.error('❌ Erro ao enviar avaliação:', erro);
    if (statusDiv) statusDiv.textContent = '❌ Erro ao enviar. Verifique sua internet e tente de novo.';
  }
}
