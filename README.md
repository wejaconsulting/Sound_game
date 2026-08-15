# TonJakten 🎤✨

Ett sång- och lekspel med disco-vibe: du får en melodi uppspelad på keyboard och ska
sedan sjunga tillbaka exakt samma toner. Klarar du rundan blir nästa melodi längre
och snabbare – missar du för många toner åker du ut!

## Så spelar du

1. Välj nivå: **Lätt**, **Medium**, **Svår** eller **Hardcore** 🔥
2. Lyssna på melodin (på medium och uppåt spelas den med discotakt).
3. Sjung tonerna en i taget – håll ut varje ton tills appen låser den.
4. Mätaren visar om du ligger för lågt (♭) eller för högt (♯).
5. Klarar du alla toner spelas melodin upp igen **utan musik**, du får bonuspoäng
   och nästa runda börjar – en ton längre och lite snabbare.
6. Missar du fler toner än nivån tillåter: **DU ÅKTE UT!**

Appen jämför tonhöjd oktav-oberoende, så det går lika bra att sjunga i sitt eget
röstläge (mörk eller ljus röst) – det är tonen som räknas, inte oktaven.

## Nivåer

| Nivå | Toner från start | Tonmaterial | Tolerans | Tillåtna missar |
|------|-----------------|-------------|----------|-----------------|
| 🟢 Lätt | 3 | C-dur pentatonisk, små steg | ±75 cent | 2 |
| 🟡 Medium | 4 | Hela C-durskalan | ±60 cent | 1 |
| 🟠 Svår | 4 | C-dur med stora hopp | ±45 cent | 1 |
| 🔥 Hardcore | 5 | Kromatiskt, stora hopp | ±35 cent | 0 |

Rekord per nivå sparas lokalt i webbläsaren.

## Kör appen

Appen är ren HTML/CSS/JavaScript utan byggsteg, men mikrofonen kräver att sidan
serveras via **https eller localhost** (webbläsarnas säkerhetskrav):

```bash
npx serve .
# eller
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000` (eller porten `serve` visar), välj nivå och
tillåt mikrofonen när webbläsaren frågar.

## Teknik

- **Web Audio API** – syntetiserat keyboardljud, discotakt och ljudeffekter, inga samplingar.
- **Tonhöjdsdetektering** – autokorrelation (ACF2+) på mikrofonens signal i realtid.
- **SVG-notpapper** – melodin ritas som noter på ett notsystem med g-klav, korsförtecken
  och hjälplinjer, i neon/disco-stil.
- Inga beroenden och inget ramverk – öppna och spela.
