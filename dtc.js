// Descrições de DTC em português. Códigos genéricos SAE (P0/P2/U0); P1/B1/C1/U1 são do fabricante.
const D = {
  P0010: 'Atuador do comando de válvulas variável (A) banco 1 - circuito',
  P0011: 'Comando de válvulas (A) banco 1 - avanço excessivo / desempenho',
  P0016: 'Correlação sensor de rotação (virabrequim) x sensor de fase (comando) - banco 1',
  P0030: 'Aquecedor da sonda lambda B1S1 - circuito',
  P0068: 'MAP/MAF - correlação com posição da borboleta',
  P0087: 'Pressão do combustível muito baixa',
  P0100: 'Sensor de fluxo de ar (MAF) - circuito',
  P0101: 'Sensor de fluxo de ar (MAF) - faixa/desempenho',
  P0102: 'Sensor de fluxo de ar (MAF) - sinal baixo',
  P0103: 'Sensor de fluxo de ar (MAF) - sinal alto',
  P0105: 'Sensor de pressão do coletor (MAP) - circuito',
  P0106: 'Sensor MAP - faixa/desempenho',
  P0107: 'Sensor MAP - sinal baixo',
  P0108: 'Sensor MAP - sinal alto',
  P0110: 'Sensor de temperatura do ar (IAT) - circuito',
  P0112: 'Sensor de temperatura do ar (IAT) - sinal baixo',
  P0113: 'Sensor de temperatura do ar (IAT) - sinal alto',
  P0115: 'Sensor de temperatura do motor (ECT) - circuito',
  P0116: 'Sensor de temperatura do motor (ECT) - faixa/desempenho',
  P0117: 'Sensor de temperatura do motor (ECT) - sinal baixo',
  P0118: 'Sensor de temperatura do motor (ECT) - sinal alto',
  P0120: 'Sensor de posição da borboleta (TPS) - circuito',
  P0121: 'Sensor de posição da borboleta (TPS) - faixa/desempenho',
  P0122: 'Sensor de posição da borboleta (TPS) - sinal baixo',
  P0123: 'Sensor de posição da borboleta (TPS) - sinal alto',
  P0125: 'Temperatura insuficiente para controle em malha fechada',
  P0128: 'Válvula termostática - temperatura abaixo da regulada',
  P0130: 'Sonda lambda B1S1 - circuito',
  P0131: 'Sonda lambda B1S1 - tensão baixa',
  P0132: 'Sonda lambda B1S1 - tensão alta',
  P0133: 'Sonda lambda B1S1 - resposta lenta',
  P0134: 'Sonda lambda B1S1 - sem atividade',
  P0135: 'Aquecedor da sonda lambda B1S1 - circuito',
  P0136: 'Sonda lambda B1S2 - circuito',
  P0141: 'Aquecedor da sonda lambda B1S2 - circuito',
  P0171: 'Mistura pobre - banco 1 (comum em flex: vazamento de vácuo, injetor, bomba ou adaptação etanol)',
  P0172: 'Mistura rica - banco 1',
  P0230: 'Bomba de combustível - circuito primário',
  P0300: 'Falha de ignição aleatória / múltiplos cilindros',
  P0325: 'Sensor de detonação - circuito',
  P0335: 'Sensor de rotação (virabrequim) - circuito',
  P0340: 'Sensor de fase (comando de válvulas) - circuito',
  P0400: 'Recirculação dos gases de escape (EGR) - fluxo',
  P0420: 'Eficiência do catalisador abaixo do limite - banco 1',
  P0440: 'Sistema de controle de emissões evaporativas (EVAP/cânister)',
  P0443: 'Válvula de purga do cânister - circuito',
  P0455: 'Sistema EVAP - vazamento grande',
  P0500: 'Sensor de velocidade do veículo (VSS)',
  P0505: 'Controle da marcha lenta',
  P0506: 'Marcha lenta abaixo do esperado',
  P0507: 'Marcha lenta acima do esperado',
  P0560: 'Tensão do sistema',
  P0562: 'Tensão do sistema baixa',
  P0563: 'Tensão do sistema alta',
  P0601: 'Módulo de controle (ECU) - erro de checksum da memória',
  P0606: 'Módulo de controle (ECU) - falha do processador',
  P0627: 'Bomba de combustível - circuito de controle aberto',
  P0700: 'Sistema de controle da transmissão (consulte o módulo TCM)',
  P0705: 'Sensor de faixa da transmissão - circuito',
  P0715: 'Sensor de rotação de entrada/turbina - circuito',
  P0720: 'Sensor de velocidade de saída - circuito',
  P2135: 'Correlação sensores de posição da borboleta A/B',
  P2138: 'Correlação sensores do pedal do acelerador D/E',
  P2187: 'Mistura pobre em marcha lenta - banco 1',
  P2188: 'Mistura rica em marcha lenta - banco 1',
  U0001: 'Barramento CAN de alta velocidade',
  U0100: 'Perda de comunicação com ECM/PCM',
  U0121: 'Perda de comunicação com módulo ABS',
  U0155: 'Perda de comunicação com o painel de instrumentos',
};
for (let i = 1; i <= 8; i++) {
  D['P020' + i] = `Injetor do cilindro ${i} - circuito`;
  D['P030' + i] = `Falha de ignição no cilindro ${i}`;
  D['P035' + i] = `Bobina de ignição ${i} - circuito`;
}

const SYS = {
  B: 'Carroceria', C: 'Chassi', U: 'Rede de comunicação',
  P: ['Combustível e ar', 'Combustível e ar', 'Injeção', 'Ignição / falha de combustão', 'Controle de emissões',
    'Velocidade e marcha lenta', 'ECU e saídas', 'Transmissão', 'Transmissão', 'Transmissão'],
};

export function describe(code) {
  if (D[code]) return D[code];
  const sys = code[0] === 'P' ? SYS.P[code[2]] ?? 'Trem de força' : SYS[code[0]];
  const own = code[1] === '1' || code[1] === '3' ? ' - código específico do fabricante' : '';
  return `${sys}${own}`;
}
