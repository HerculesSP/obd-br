# Listas de sensores da comunidade

Coloque aqui listas de PIDs de modelos que você conhece, no formato CSV do Torque Pro:

```csv
Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header
Temp. fluido do câmbio,ATF,0x221940,A-40,-40,150,°C,7E1
```

Depois registre o arquivo no `catalog.json` na raiz do projeto, para ele aparecer na escolha de marca/modelo:

```json
{"make": "Fiat", "model": "Strada 1.3 Firefly (2021+) — comunidade", "csv": "pids/fiat-strada-13-firefly.csv", "source": "seu nome ou link"}
```

Envie por pull request. Informe de onde vieram os PIDs (testados no seu carro, fórum etc.) e use só listas que você tem direito de compartilhar.
