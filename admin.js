console.log('🛠️ ADMIN.JS ESTÁ SENDO EXECUTADO!');

// ===============================
// ADMIN / CALIBRAÇÃO (Fase 07.5)
// ===============================
//
// Este arquivo é a versão administrativa independente: roda em
// admin.html, separado do visitante. A lógica abaixo foi TRANSPORTADA
// do script.js (não reescrita), preservando o comportamento validado
// nas missões 05.x e 06.x.
//
// houveMovimento vive SOMENTE aqui — o visitante não participa desse
// mecanismo (Fase 07.5).

const mapaCanvasCalibracao = document.getElementById('mapaCanvas');
const coordenadas = document.getElementById('coordenadas');

// Declarada aqui porque aplicarEstadoCalibracao() já precisa lê-la/
// escrevê-la na primeira chamada, na carga da página (Missão 06.6B).
let houveMovimento = false;

// ---------------------------------------------------------------------
// MINIMIZAR / EXPANDIR o painel de calibração (pra não tampar o mapa)
// ---------------------------------------------------------------------

const calibracaoCorpo = document.getElementById('calibracaoCorpo');
const btnMinimizarCalibracao = document.getElementById('minimizarCalibracao');

function aplicarEstadoCalibracao(colapsado) {
  calibracaoCorpo.classList.toggle('colapsado', colapsado);
  btnMinimizarCalibracao.textContent = colapsado ? '➕' : '➖';

  // Missão 06.6B: colapsar o painel é o encerramento lógico do ciclo de
  // arraste. Sem isso, houveMovimento podia ficar preso em true (setado
  // por um arrasto anterior e nunca resetado, já que o mousedown que o
  // reseta é bloqueado pelo próprio painel colapsado — Missão 05.5B).
  if (colapsado) {
    houveMovimento = false;
  }
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
// ABRIR / FECHAR o sub-painel de calibração GPS
// ---------------------------------------------------------------------

const gpsConteudo = document.getElementById('gpsConteudo');
const btnToggleGps = document.getElementById('toggleGps');

function aplicarEstadoGps(aberto) {
  gpsConteudo.classList.toggle('oculto', !aberto);
  btnToggleGps.textContent = aberto
    ? '📡 Calibração GPS ▾ (fazer depois, no parque)'
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

// ---------------------------------------------------------------------
// COORDENADAS DO MOUSE SOBRE O MAPA
// ---------------------------------------------------------------------

mapaCanvasCalibracao.addEventListener('mousemove', function(event) {
  const rect = mapaCanvasCalibracao.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  coordenadas.textContent = `X: ${x.toFixed(2)}% | Y: ${y.toFixed(2)}%`;
});

// ---------------------------------------------------------------------
// ESTADO DOS DADOS E DO ARRASTE
// ---------------------------------------------------------------------

let atracoesJSON = {};
let atracoes = {};
let pinArrastando = null;
let ultimaX = null;
let ultimaY = null;
let pinSelecionado = null;
let contadorPinosNovos = 0; // usado para espalhar os pinos sem posição numa fileira

const atracaoSelecionada = document.getElementById('atracaoSelecionada');
const botaoCopiar = document.getElementById('copiarCoordenadas');
const botaoSalvar = document.getElementById('salvarCoordenadas');

// ---------------------------------------------------------------------
// RASCUNHO LOCAL DAS POSIÇÕES (sobrevive a F5 / fechar a aba)
// ---------------------------------------------------------------------

const CHAVE_RASCUNHO = 'aldeiaRascunhoPosicoes';

function salvarRascunho() {
  const posicoes = {};

  Object.entries(atracoesJSON).forEach(([id, a]) => {
    posicoes[id] = { x: a.x, y: a.y };
  });

  localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(posicoes));
}

function aplicarRascunhoSeExistir() {
  const bruto = localStorage.getItem(CHAVE_RASCUNHO);
  if (!bruto) return;

  try {
    const posicoes = JSON.parse(bruto);
    let quantas = 0;

    Object.entries(posicoes).forEach(([id, pos]) => {
      if (atracoesJSON[id] && pos && pos.x !== null && pos.y !== null) {
        atracoesJSON[id].x = pos.x;
        atracoesJSON[id].y = pos.y;
        quantas++;
      }
    });

    if (quantas > 0) {
      console.log(`♻️ Rascunho local restaurado: ${quantas} posições`);
    }
  } catch (e) {
    console.warn('⚠️ Rascunho local inválido, ignorando:', e);
  }
}

// ---------------------------------------------------------------------
// CRIAÇÃO DOS PINOS (usa criarElementoPin de pinos-core.js)
// ---------------------------------------------------------------------

function criarPinAdmin(id, atracao) {
  if (!atracao) {
    console.error('❌ Atração sem dados:', id);
    return;
  }

  const semCoordenadas =
    atracao.x === null || atracao.y === null ||
    atracao.x === undefined || atracao.y === undefined;

  const pin = criarElementoPin(id, atracao, contadorPinosNovos);

  if (semCoordenadas) {
    contadorPinosNovos++;
  }

  mapaCanvasCalibracao.appendChild(pin);

  console.log(`📍 Pin criado (admin): ${id} | X: ${atracao.x} | Y: ${atracao.y}${semCoordenadas ? ' (fileira de espera)' : ''}`);
}

function mostrarAvisoPinosNovos() {
  if (contadorPinosNovos === 0) return;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-pinos-novos';
  aviso.textContent =
    `⚠️ ${contadorPinosNovos} atração(ões) ainda sem posição — ` +
    `estão na fileira de baixo do mapa, arraste cada uma para o lugar certo.`;

  mapaCanvasCalibracao.appendChild(aviso);
}

// ---------------------------------------------------------------------
// ARRASTAR/CALIBRAR PINOS
// ---------------------------------------------------------------------

// precisa ser chamado depois que os pinos são criados dinamicamente
function ativarCalibracaoDosPins(){
  document.querySelectorAll('.pin').forEach(pin => {
    pin.addEventListener('mousedown', function(event) {
      // Missão 05.5B: painel de calibração colapsado = fora do modo
      // calibração. Não inicia arraste nem altera nenhum estado.
      if (calibracaoCorpo && calibracaoCorpo.classList.contains('colapsado')) {
        return;
      }

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

// ---------------------------------------------------------------------
// COPIAR COORDENADAS
// ---------------------------------------------------------------------

if (botaoCopiar) {
  botaoCopiar.addEventListener('click', function() {
    if (!pinSelecionado) {
      alert('📍 Primeiro selecione uma atração.');
      return;
    }

    const id = pinSelecionado.dataset.id || pinSelecionado.dataset.nome;
    const dados = atracoesJSON[id];

    if (!dados || dados.x === null || dados.x === undefined || dados.y === null || dados.y === undefined) {
      alert('📍 Esta atração ainda não tem coordenadas definidas.');
      return;
    }

    const texto = `X: ${dados.x.toFixed(2)}% | Y: ${dados.y.toFixed(2)}%`;

    navigator.clipboard.writeText(texto);

    botaoCopiar.textContent = '✅ Copiado!';

    setTimeout(() => {
      botaoCopiar.textContent = '📋 Copiar coordenadas';
    }, 1500);
  });
}

// ---------------------------------------------------------------------
// SALVAR TODAS AS POSIÇÕES
// ---------------------------------------------------------------------

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
  });
}

// ---------------------------------------------------------------------
// CALIBRAÇÃO GPS (captura dos 3 pontos + cálculo da transformação)
// ---------------------------------------------------------------------

const CHAVE_GPS_PONTOS = 'aldeiaGpsPontos';
const CHAVE_GPS_CALIBRACAO = 'aldeiaGpsCalibracao';

const selectAtracaoGps = document.getElementById('selectAtracaoGps');
const botaoCapturarGps = document.getElementById('capturarGps');
const botaoCalcularGps = document.getElementById('calcularCalibracaoGps');
const botaoResetarGps = document.getElementById('resetarCalibracaoGps');
const statusCalibracaoGps = document.getElementById('statusCalibracaoGps');

function carregarPontosGps() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_GPS_PONTOS)) || [];
  } catch (e) {
    return [];
  }
}

function salvarPontosGps(pontos) {
  localStorage.setItem(CHAVE_GPS_PONTOS, JSON.stringify(pontos));
}

function popularSelectGps() {
  if (!selectAtracaoGps) return;

  selectAtracaoGps.innerHTML = '';

  const recomendadas = Object.entries(atracoes)
    .filter(([id, a]) => a.pontoCalibracaoRecomendado)
    .sort((a, b) => (a[1].numeroMapa || 0) - (b[1].numeroMapa || 0));

  const demais = Object.entries(atracoes)
    .filter(([id, a]) => !a.pontoCalibracaoRecomendado && a.x !== null && a.y !== null);

  [...recomendadas, ...demais].forEach(([id, a]) => {
    const opt = document.createElement('option');
    const estrela = a.pontoCalibracaoRecomendado ? '⭐ ' : '';
    opt.value = id;
    opt.textContent = `${estrela}${a.titulo}`;

    if (a.x === null || a.y === null) {
      opt.disabled = true;
      opt.textContent += ' (sem posição no mapa)';
    }

    selectAtracaoGps.appendChild(opt);
  });
}

function atualizarStatusCalibracaoGps() {
  if (!statusCalibracaoGps) return;

  const pontos = carregarPontosGps();
  statusCalibracaoGps.textContent = `Pontos capturados: ${pontos.length}/3`;

  if (botaoCalcularGps) {
    botaoCalcularGps.disabled = pontos.length < 3;
  }
}

if (botaoCapturarGps) {
  botaoCapturarGps.addEventListener('click', function () {
    if (!navigator.geolocation) {
      alert('❌ Este navegador não suporta GPS.');
      return;
    }

    const id = selectAtracaoGps.value;
    const atracao = atracoes[id];

    if (!atracao || atracao.x === null || atracao.y === null) {
      alert('❌ Escolha uma atração que já tenha posição no mapa.');
      return;
    }

    botaoCapturarGps.textContent = '📡 Capturando...';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const pontos = carregarPontosGps().filter(p => p.id !== id);

        pontos.push({
          id: id,
          titulo: atracao.titulo,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          x: atracao.x,
          y: atracao.y
        });

        salvarPontosGps(pontos);
        atualizarStatusCalibracaoGps();

        botaoCapturarGps.textContent = '✅ Capturado!';
        setTimeout(() => {
          botaoCapturarGps.textContent = '📍 Capturar GPS aqui';
        }, 1500);
      },
      function (err) {
        alert('❌ Não consegui pegar o GPS: ' + err.message);
        botaoCapturarGps.textContent = '📍 Capturar GPS aqui';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// resolve um sistema linear 3x3 por eliminação de Gauss
function resolver3x3(M) {
  for (let i = 0; i < 3; i++) {
    let maxLinha = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxLinha][i])) maxLinha = k;
    }
    [M[i], M[maxLinha]] = [M[maxLinha], M[i]];

    if (Math.abs(M[i][i]) < 1e-12) return null;

    for (let k = i + 1; k < 3; k++) {
      const fator = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) {
        M[k][j] -= fator * M[i][j];
      }
    }
  }

  const sol = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let soma = M[i][3];
    for (let j = i + 1; j < 3; j++) soma -= M[i][j] * sol[j];
    sol[i] = soma / M[i][i];
  }

  return sol;
}

if (botaoCalcularGps) {
  botaoCalcularGps.addEventListener('click', function () {
    const pontos = carregarPontosGps();

    if (pontos.length < 3) {
      alert('❌ Preciso de 3 pontos capturados.');
      return;
    }

    const [p1, p2, p3] = pontos;

    const solX = resolver3x3([
      [p1.lon, p1.lat, 1, p1.x],
      [p2.lon, p2.lat, 1, p2.x],
      [p3.lon, p3.lat, 1, p3.x]
    ]);

    const solY = resolver3x3([
      [p1.lon, p1.lat, 1, p1.y],
      [p2.lon, p2.lat, 1, p2.y],
      [p3.lon, p3.lat, 1, p3.y]
    ]);

    if (!solX || !solY) {
      alert('❌ Os 3 pontos estão muito alinhados. Capture pontos mais espalhados.');
      return;
    }

    const calib = {
      a: solX[0], b: solX[1], c: solX[2],
      d: solY[0], e: solY[1], f: solY[2]
    };

    localStorage.setItem(CHAVE_GPS_CALIBRACAO, JSON.stringify(calib));

    alert('✅ Calibração GPS concluída! Agora o "Você está aqui" vai funcionar de verdade no visitante.');
    console.log('📐 Calibração GPS:', calib);
  });
}

if (botaoResetarGps) {
  botaoResetarGps.addEventListener('click', function () {
    localStorage.removeItem(CHAVE_GPS_PONTOS);
    localStorage.removeItem(CHAVE_GPS_CALIBRACAO);
    atualizarStatusCalibracaoGps();
    alert('🗑️ Calibração GPS reiniciada.');
  });
}

// ---------------------------------------------------------------------
// INICIALIZAÇÃO (ordem confirmada na Fase 07.3)
// ---------------------------------------------------------------------

fetch('./atracoes.json?v=' + Date.now())
  .then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then(data => {
    atracoesJSON = data;
    atracoes = data;

    aplicarRascunhoSeExistir();

    Object.entries(atracoes).forEach(([id, atracao]) => {
      criarPinAdmin(id, atracao);
    });

    mostrarAvisoPinosNovos();
    ativarCalibracaoDosPins();
    popularSelectGps();
    atualizarStatusCalibracaoGps();
    atualizarContadorPendentes();

    console.log('✅ ADMIN pronto:', Object.keys(atracoes).length, 'atrações carregadas');
  })
  .catch(erro => {
    console.error('❌ ERRO AO CARREGAR ATRACOES.JSON (admin):', erro);
  });
