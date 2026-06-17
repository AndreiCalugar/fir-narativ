# Fir Narativ — Aplicație Experiență

## Despre proiect

Fir Narativ e o experiență de cuplu de 2h30 într-un spațiu intim din București. Cuplul intră în cameră, își pune câte o pereche de căști, vede povestea proiectată pe tavan, ascultă vocea naratorului (Irina) în căști, joacă mici jocuri între segmente.

Această aplicație web rulează pe un Raspberry Pi 4 conectat la un proiector. E creierul vizual + audio al experienței. Cuplul controlează ritmul cu o telecomandă wireless (page-turner Bluetooth/2.4GHz). Aplicația rulează **local** pe Pi — fără dependență de internet.

## Stack & arhitectură

**Frontend: vanilla HTML + CSS + JavaScript pur.** Fără framework, fără build step, fără npm install. De ce:
- Aplicația e simplă: redă slide-uri, ascultă taste, redă video
- Pi 4 are putere limitată — React/Vite e overhead inutil
- Mai puțin cod = mai puțin de debugat
- Fără build = fișiere editabile direct pe Pi dacă e nevoie

**Runtime: Chromium pe Pi în kiosk mode**, deschis la `file:///home/pi/firnarativ/index.html`. Zero server. Zero internet. Totul local.

**Structura proiectului:**

```
firnarativ-experience/
├── CLAUDE.md              # acest fișier
├── README.md              # instrucțiuni rulare
├── index.html             # pagina principală fullscreen
├── style.css              # stilizare (fullscreen, tipografie, animații)
├── app.js                 # logica aplicației (state machine, keyboard, navigare)
├── chapters.json          # lista segmentelor în ordine
└── content/               # conținut Irina (video MP4, imagini PNG)
    ├── 01-prolog.mp4
    ├── 02-cap1-intro.mp4
    ├── 03-cap1-intrebari/
    │   ├── 01.png
    │   ├── 02.png
    │   └── ...
    └── ...
```

## Logica de bază

Aplicația citește `chapters.json` — o listă ordonată de segmente. Fiecare segment are un tip:

- `video` — redă un MP4 (audio + video împreună). La final, așteaptă apăsare „continuă".
- `image` — afișează o imagine PNG statică (de obicei o întrebare). Așteaptă apăsare „continuă".
- `pause` — afișează un mesaj de pauză cu fundal cald (ex: „Jucați-vă cu Lego. Apăsați când terminați.") cu un mic indicator vizual.

Cuplul controlează cu telecomanda:
- **Buton „înainte"** (tasta `ArrowRight` sau `Space` sau `Enter`) — trece la următorul segment
- **Buton „înapoi"** (tasta `ArrowLeft`) — revine la segmentul anterior

Aplicația ține minte segmentul curent (index în array). State machine simplu:

```
IDLE (înainte de start) → PLAYING (segment curent) → ASTEPTARE_INPUT → next/back
```

## Exemplu chapters.json

```json
[
  {
    "id": "prolog",
    "type": "video",
    "file": "content/01-prolog.mp4",
    "title": "Prolog"
  },
  {
    "id": "cap1-intro",
    "type": "video", 
    "file": "content/02-cap1-intro.mp4",
    "title": "Capitolul I — Expoziția"
  },
  {
    "id": "cap1-intrebare-01",
    "type": "image",
    "file": "content/03-cap1-intrebari/01.png",
    "title": "Capitolul I — Întrebare 1"
  },
  {
    "id": "cap1-joc",
    "type": "pause",
    "message": "Acum jucați-vă cu Lego.\nApăsați butonul când terminați.",
    "title": "Capitolul I — Pauză joacă"
  },
  {
    "id": "cap1-final",
    "type": "video",
    "file": "content/04-cap1-final.mp4",
    "title": "Capitolul I — Final"
  }
]
```

## Comportament critic

**1. Fullscreen real, fără cursor mouse vizibil.**
- Aplicația trebuie să arate identic în Chrome pe Mac (test) și în Chromium pe Pi (producție)
- CSS: `cursor: none` pe body, `body { margin: 0; overflow: hidden }`
- Tasta `F11` pentru fullscreen pe Mac în timpul dezvoltării

**2. Tranziții curate între segmente.**
- Fade-in/fade-out subtil (200ms) între slide-uri pentru a evita „smucirea" vizuală
- Black screen de 100ms între segmente pentru pauză vizuală naturală

**3. Video MP4 — comportament:**
- Pornește redarea automat la încărcare
- Audio embeddat (nu se separă audio de video)
- La final, oprește pe ultimul frame și așteaptă apăsare „continuă"
- Nu trece automat la următorul — cuplu controlează ritmul

**4. Imagini PNG — comportament:**
- Afișate fullscreen, centrate, cu fundal negru
- Stau pe ecran până la apăsare „continuă"

**5. Pause screens — comportament:**
- Fundal cremos cald (#f5efe4) sau verde oliv (#6b7a3f)
- Tipografie elegantă serif (Cormorant Garamond) — vezi paleta Fir Narativ
- Mesajul centrat, mare, generos
- Mic indicator subtil jos: „apăsați pentru a continua" (animat pulsant)

**6. Recovery la refresh:**
- Dacă cineva apasă F5 sau Chromium se restartează, aplicația trebuie să poată salva în localStorage indexul curent și să întrebe „Continuă de unde ai rămas?" la următoarea pornire
- Pentru demo inițial, această funcționalitate poate fi ignorată — adăugată ulterior

## Paleta vizuală Fir Narativ

- Verde oliv: `#6b7a3f`
- Verde oliv închis: `#4f5a2e`
- Cremos: `#f5efe4`
- Ivory: `#fbf8f1`
- Ink (text): `#2c2c2a`
- Font display (handwritten/elegant): Caveat
- Font body (serif clasic): Cormorant Garamond

Fonturile se încarcă din Google Fonts în `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
```

(Notă: Pe Pi în producție, fonturile trebuie descărcate local ca să nu depinzi de internet. Pentru demo dezvoltare, Google Fonts e ok.)

## Comportament telecomandă

Telecomanda fizică (page-turner wireless cu dongle USB) trimite taste de tastatură standard:
- `PageDown` sau `ArrowRight` → next
- `PageUp` sau `ArrowLeft` → back
- `F5` → adesea blank screen (ignoră în aplicație)
- Buton laser → nu trimite taste (e separat)

Aplicația ascultă `keydown` event pe `document`:

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
    next();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    back();
  }
});
```

## Mediul de dezvoltare

**Pe Mac (dezvoltare):**
- Deschizi `index.html` direct în Chrome (sau folosești `npx serve` pentru server local)
- Testezi cu fișiere dummy în `content/`
- Apeși tastele pentru navigare (săgeți, spațiu)

**Pe Pi (producție):**
- Repo clonat în `/home/pi/firnarativ/`
- Chromium pornește în kiosk mode la boot
- Comandă autostart: `chromium-browser --kiosk --noerrdialogs --disable-translate --no-first-run --fast --fast-start --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 --disable-restore-session-state file:///home/pi/firnarativ/index.html`

## Prioritizare features pentru lansare 1 iulie

**MUST HAVE (demo inițial):**
- Citire `chapters.json` și navigare prin segmente
- Redare video MP4 cu audio
- Afișare imagini PNG fullscreen
- Pause screens cu mesaje
- Navigare keyboard (înainte/înapoi)
- Tranziții curate între segmente
- Butoane on-screen pentru start/pause în timpul dezvoltării (pentru debug rapid pe Mac)

**NICE TO HAVE (post-lansare):**
- Recovery la refresh (localStorage)
- Panou admin pe telefon (vezi capitol curent, RESET)
- Logging sesiune (cine, când, cât a durat)
- Combinație taste pentru emergency reset (ex: 3 click-uri rapide stânga)

**OUT OF SCOPE pentru această aplicație:**
- Booking system (Calendly extern)
- Plata online (Stripe extern)
- Newsletter / waitlist (gestionat pe site separat firnarativ.ro)

## Convenții cod

- **Limba**: comentarii și variabile în engleză, mesaje afișate utilizatorului în română
- **Format**: 2 spații indentare, fără semicolons opționale, single quotes
- **Vanilla JS pur**: zero dependențe npm pentru runtime
- **Edit direct fără build**: orice modificare în `app.js` sau `style.css` trebuie să fie vizibilă instant la refresh

## Context business

Cuplul plătește 490 RON pentru această experiență. Calitatea redării (sunet curat, video fluid, tranziții curate, zero glitch-uri) e direct legată de reputația brand-ului. **Stabilitate > features noi.** Mai bine 5 segmente care merg perfect decât 50 care au glitch-uri ocazionale.
