# OBD Brasil

Painel web para scanners OBD-II com chip ELM327 (USB ou Bluetooth): mostradores, gráficos em tempo real, códigos de erro em português e exportação CSV. Não tem dependências nem etapa de build.

## Rodar

```sh
python3 -m http.server 8000
# abra http://localhost:8000 no Chrome ou Edge
```

Web Serial e Web Bluetooth exigem Chrome/Edge e `localhost` ou HTTPS. Clique em **Demonstração** para testar sem carro.

### Instalar no celular (PWA)

1. Publique a pasta num host com HTTPS (GitHub Pages, Netlify, Cloudflare Pages etc.). É só copiar os arquivos, não tem build.
2. Abra a página no Chrome do Android e escolha **⋮ → Instalar app**.
3. O app abre em tela cheia, funciona offline e mantém a tela acesa enquanto está conectado.

No celular use adaptador **Bluetooth LE**, ou **USB via cabo OTG** (só se o Chrome do aparelho tiver Web Serial; se não tiver, o botão USB fica desativado).

## Adaptadores

| Adaptador | Botão | Observação |
|---|---|---|
| USB (CH340, FTDI, PL2303) | USB / Serial | 38400 baud (padrão do ELM327) |
| Bluetooth clássico (o "azulzinho" barato) | USB / Serial | Pareie no sistema (PIN 1234 ou 0000); ele aparece como porta serial |
| Bluetooth LE (Vgate iCar Pro, Vlinker, ELM327 BLE) | Bluetooth LE | Funciona também no Chrome do Android |

No Android só funciona BLE. Adaptadores de Bluetooth clássico não aparecem no navegador do celular.

## Carros brasileiros

- **OBDBr-2 (2010 em diante)**: todos os carros vendidos no Brasil têm OBD-II genérico. Use o protocolo **Automático**.
- **K-line (ISO 9141 / KWP2000)**: comum em Fiat, VW e GM até ~2012. A busca automática pode levar até 15 s. Se falhar, escolha o protocolo manualmente.
- **OBDBr-1 (2007–2009)**: o suporte é parcial; muitos não respondem a scanners genéricos.
- **Flex**: o painel mostra o tipo de combustível (PID 51) e o **% de etanol no tanque** (PID 52), quando a ECU informa. O P0171 (mistura pobre) tem nota específica para flex.
- Só os sensores que a ECU declara como suportados (PIDs 00 a A0) aparecem.

## Uso

- **Painel**: mostradores e sensores dos gráficos são lidos a cada ciclo; os demais, em rodízio.
- **Gráficos**: 4 gráficos, cada um com o sensor que você escolher (a escolha fica salva). Janela de 30 s, 1 min ou 5 min, com cursor para inspecionar valores. Use **Exportar CSV** para baixar o log da sessão (abre no Excel em português).
- **Sensores**: a tabela SAE J1979 completa (~90 PIDs: motor, combustível, todas as sondas lambda, bancos 1 e 2, catalisadores, EVAP, torque, pedal, etanol…). Também junta os sensores anunciados por todos os módulos que respondem (motor, câmbio…). Só aparecem os que o carro suporta.
- **Calculados**: consumo instantâneo (km/L), fluxo de combustível (L/h, quando a central não informa), potência (cv) e consumo médio da viagem. O cálculo usa o sensor de etanol se existir; se não, o combustível escolhido na aba Veículo (gasolina comum E30, etanol ou mistura).
- **Códigos de erro**: lê os códigos armazenados (modo 03), pendentes (07) e permanentes (0A). **Apagar** (modo 04) desliga a luz de injeção e zera os monitores de prontidão. Na mesma leitura:
  - **Estado e prontidão** (modo 01 PID 01): mostra se a luz de injeção está acesa, quantos códigos há e cada monitor (catalisador, EVAP, sonda…) completo ou incompleto. Avisa quando há **indício de códigos apagados recentemente** (monitores incompletos, poucos km ou poucas partidas desde a limpeza). Útil na compra de usado.
  - **Dados congelados** (modo 02): os sensores no instante em que a falha aconteceu.
  - **Falhas de ignição por cilindro** (modo 06, só carros CAN): contagem do ciclo atual e média dos últimos ciclos.
  - **Fabricante**: é detectado pelo chassi e pode ser trocado manualmente. Códigos P1xxx têm descrição própria para VW/Audi, Chevrolet/GM, Ford, Toyota, Honda, Nissan e Hyundai/Kia (KSDS). O significado pode variar por modelo e ano.
  - **Fiat/Jeep, Renault e Peugeot/Citroën**: não há lista P1 confiável para OBD genérico, porque os códigos variam por central (Marelli, Bosch, Continental). Nesses carros o app mostra o sistema afetado (ignição, injeção, emissões…) e indica que é código do fabricante.
- **Veículo**: mostra o chassi (VIN, modo 09), o fabricante, o país, o ano-modelo, o odômetro (PID A6, só em centrais recentes), a distância rodada desde a limpeza dos códigos e com a luz acesa, e a viagem atual calculada pela velocidade.
  - A quilometragem do painel fica no módulo do painel de instrumentos, que não é acessível pelo OBD genérico. Carros antes de 2019 dificilmente informam o odômetro.

## Sensores do fabricante (importação CSV)

Em **Veículo → Sensores do fabricante**, importe uma lista no formato CSV do **Torque Pro**:

```csv
Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header
Temp. fluido do câmbio,ATF,0x221940,A-40,-40,150,°C,7E1
```

- `ModeAndPID`: modo + PID (ex.: `221940` = serviço 22, identificador 1940).
- `Equation`: `A`, `B`… são os bytes da resposta (`AA` = 27º byte). Aceita `+ - * / ( )`, `{A:7}` (bit 7 de A), `Signed(A)`, `INT()`, `ABS()`. Outros tokens são rejeitados, então o arquivo não executa código.
- `Header`: endereço do módulo (ex.: `7E1` = câmbio). Em branco = central do motor.

Os sensores importados aparecem no Painel e nos gráficos e ficam salvos no navegador. Listas por modelo circulam em fóruns e grupos (procure por "<modelo> torque pids csv"). O arquivo `exemplo-pids.csv` só mostra o formato e funciona no modo demo. Para ler outros módulos, o adaptador precisa aceitar `ATSH`/`ATCRA`; clones baratos às vezes não aceitam.

## Testes

```sh
node test.mjs
```

## Arquivos

- `obd.js`: ELM327, tabela de PIDs, parsers e transportes (Serial, BLE e simulador)
- `dtc.js`: descrições de DTC em português
- `custom.js`: importação de CSV do Torque e avaliador de fórmulas
- `app.js` / `index.html`: interface
- `manifest.webmanifest`, `sw.js`, `icon*`: PWA (instalável e offline)
