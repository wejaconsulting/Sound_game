# Sing Song 🎤✨

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

## Riktiga melodier

Melodierna är riktiga, kända låtar ur en inbyggd songbok (`songs.js`) – alla
upphovsrättsfria (traditionella eller klassiska) så att spelet kan spridas fritt:

- **Lätt:** Blinka lilla stjärna, Broder Jakob, Gubben Noak, Per Olsson, Imse vimse spindel
- **Medium:** ovanstående plus Happy Birthday, An die Freude (Beethoven), Bjällerklang
- **Svår:** Happy Birthday, An die Freude, Bjällerklang, Für Elise, Greensleeves
- **Hardcore:** Für Elise, Greensleeves, The Entertainer (Joplin)

Varje runda spelas en bit av låten – bitarna blir längre (och tempot högre) för
varje runda tills hela melodin är med. Vilken låt det var avslöjas först när du
klarat rundan. Melodierna spelas med sin riktiga rytm, och halvnoter ritas
ihåliga på notpapperet precis som i riktig notskrift.

## Nivåer

| Nivå | Toner från start | Melodier | Tolerans | Tillåtna missar |
|------|-----------------|----------|----------|-----------------|
| 🟢 Lätt | 3 | Barnvisor | ±75 cent | 2 |
| 🟡 Medium | 4 | Kända melodier | ±60 cent | 1 |
| 🟠 Svår | 5 | Klassiker med hopp | ±45 cent | 1 |
| 🔥 Hardcore | 6 | Kromatiska klassiker | ±35 cent | 0 |

Rekord per nivå sparas lokalt i webbläsaren.

## På mobilen 📱

Sing Song är byggd som en PWA (progressiv webbapp):

- Öppna appen via **https** i mobilens webbläsare och tryck på en nivå –
  mikrofonen startas direkt i tryckgesten, precis som mobilwebbläsare kräver,
  och webbläsaren frågar om lov första gången.
- Välj **"Lägg till på hemskärmen"** så installeras appen med egen ikon och
  körs i helskärm utan adressfält.
- Skärmen hålls vaken medan du spelar (Wake Lock), och ljudmotorn väcks
  automatiskt om mobilen pausat den när du växlat app.
- Appen cachas av en service worker så att den laddar snabbt och fungerar
  även med skakig uppkoppling.
- Blockerade du mikrofonen av misstag får du en tydlig förklaring om hur du
  slår på den igen.

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
