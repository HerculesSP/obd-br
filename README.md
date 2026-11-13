# OBD Brasil

Painel web para scanners OBD-II com chip ELM327 (USB ou Bluetooth): mostradores, gráficos em tempo real, códigos de erro em português e exportação CSV. Não tem dependências nem etapa de build.

## Rodar

```sh
python3 -m http.server 8000
# abra http://localhost:8000 no Chrome ou Edge
```

Web Serial e Web Bluetooth exigem Chrome/Edge e `localhost` ou HTTPS. Clique em **Demonstração** para testar sem carro.

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
- Só os sensores que a ECU declara como suportados (PIDs 00/20/40) aparecem.

## Uso

- **Painel**: toque num mostrador para incluí-lo ou removê-lo dos gráficos. Mostradores e sensores em gráfico são lidos a cada ciclo; os demais, em rodízio.
- **Gráficos**: janela de 30 s, 1 min ou 5 min, com cursor para inspecionar valores. Use **Exportar CSV** para baixar o log da sessão (abre no Excel em português).
- **Códigos de erro**: lê os códigos armazenados (modo 03), pendentes (07) e permanentes (0A). **Apagar** (modo 04) desliga a luz de injeção e zera os monitores de prontidão.

## Testes

```sh
node test.mjs
```

## Arquivos

- `obd.js`: ELM327, tabela de PIDs, parsers e transportes (Serial, BLE e simulador)
- `dtc.js`: descrições de DTC em português
- `app.js` / `index.html`: interface
