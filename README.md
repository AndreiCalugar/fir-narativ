# Fir Narativ — Aplicație Experiență

Aplicație web vanilla (HTML + CSS + JS) care redă experiența Fir Narativ:
video MP4, imagini PNG și pauze, controlate cu telecomanda (tastatură).

## Cum o rulezi local pe Mac

Aplicația citește `chapters.json` cu `fetch()`, iar Chrome **blochează** `fetch`
pe `file://`. De aceea **trebuie** rulată printr-un mic server local — nu prin
dublu-click pe `index.html`.

Din folderul proiectului, în Terminal:

```bash
cd "/Users/andreixperience/Documents/Fir Narativ/Test system"
npx serve .
```

Apoi deschide în Chrome adresa afișată (de obicei `http://localhost:3000`).

Alternativă fără npm (Python e preinstalat pe Mac):

```bash
cd "/Users/andreixperience/Documents/Fir Narativ/Test system"
python3 -m http.server 8000
```

→ deschide `http://localhost:8000`.

Pentru fullscreen pe Mac în timpul testării: apasă `F11` (sau Cmd+Ctrl+F).

## Comenzi

- **Înainte:** `→` / `Space` / `Enter` / `PageDown`
- **Înapoi:** `←` / `PageUp`
- **Butoane on-screen** (colț dreapta-jos, apar la mișcarea mouse-ului):
  `⏮` înapoi · `▶/⏸` start/pauză video · `⏭` înainte

## Fișiere dummy pentru testare

Pune-le în `content/` cu exact aceste nume (referențiate în `chapters.json`):

| Fișier                      | Tip  | Recomandare                                            |
|-----------------------------|------|--------------------------------------------------------|
| `content/demo-1.mp4`        | MP4  | H.264 + AAC, 1920×1080, 5–10s, cu sunet (să testezi audio) |
| `content/demo-image-1.png`  | PNG  | 1920×1080, fundal negru cu text alb (o „întrebare")    |
| `content/demo-image-2.png`  | PNG  | 1920×1080, altă „întrebare"                            |
| `content/demo-2.mp4`        | MP4  | H.264 + AAC, 1920×1080, 5–10s, cu sunet                |

Recomandări:
- **MP4**: codec H.264 (video) + AAC (audio) — cea mai compatibilă combinație
  cu Chromium pe Pi. Rezoluție 1920×1080. Orice clip scurt cu sunet merge.
- **PNG**: 1920×1080 (16:9), fundal negru ca să se integreze perfect fullscreen.

Surse rapide de dummy: orice MP4 de test (ex. exportă 5s din QuickTime), iar
pentru PNG poți face un screenshot 1920×1080 cu text.

## Tipuri de segmente (`chapters.json`)

```json
{ "type": "video", "file": "content/x.mp4", "title": "..." }
{ "type": "image", "file": "content/x.png", "title": "..." }
{ "type": "pause", "message": "Text...\na doua linie", "title": "..." }
```

`\n` în `message` produce linie nouă pe ecran.

## Lăsat pentru sprintul următor (NICE TO HAVE)

- Recovery la refresh (localStorage „Continuă de unde ai rămas?")
- Fonturi locale pe Pi (acum se încarcă de la Google Fonts — necesită internet)
- Panou admin pe telefon (vezi capitol curent, RESET)
- Logging sesiune (durată, timestamp)
- Combinație taste pentru emergency reset (ex. 3 click-uri rapide stânga)
- Kiosk autostart pe Pi (Chromium `--kiosk`)
