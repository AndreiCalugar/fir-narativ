#!/usr/bin/env bash
# ============================================================
# Fir Narativ — autostart
# Pornește serverul HTTP local, apoi Chromium în kiosk pe TV.
# Rulează pe Pi:  bash ~/fir-narativ/start.sh
# ============================================================
set -u

# Folderul în care stă scriptul (deci merge indiferent de unde îl rulezi)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080
URL="http://localhost:${PORT}/index.html"
SERVER_LOG=/tmp/firnarativ-server.log

cd "$APP_DIR" || exit 1
echo "[firnarativ] folder: $APP_DIR"

# 1. Oprește instanțele vechi (server agățat pe port / kiosk vechi)
pkill -f "http.server ${PORT}" 2>/dev/null
pkill -f chromium 2>/dev/null
sleep 1

# 2. Pornește serverul HTTP din acest folder (ca path-urile să se rezolve)
nohup python3 -m http.server "$PORT" >"$SERVER_LOG" 2>&1 &
echo "[firnarativ] server pornit pe :$PORT"

# 3. Așteaptă până răspunde efectiv (max ~10s)
code=""
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)
  [ "$code" = "200" ] && break
  sleep 0.5
done
if [ "$code" != "200" ]; then
  echo "[firnarativ] EROARE: serverul nu răspunde (cod ${code:-none}). Vezi $SERVER_LOG"
  exit 1
fi
echo "[firnarativ] server OK (200)"

# 4. Cache proaspăt — ca un CSS/JS actualizat să se încarce mereu
rm -rf /tmp/chromium-cache

# 5. Pornește Chromium kiosk pe TV (DISPLAY=:0).
#    --disable-accelerated-video-decode e OBLIGATORIU: fără el video-ul se
#    decodează (se aude audio) dar imaginea e albă pe Pi (overlay GPU necompus).
DISPLAY=:0 chromium --kiosk --password-store=basic \
  --disk-cache-dir=/tmp/chromium-cache \
  --disable-accelerated-video-decode \
  --noerrdialogs --disable-translate --no-first-run \
  --disable-restore-session-state --overscroll-history-navigation=0 \
  "$URL" &

echo "[firnarativ] Chromium pornit — uită-te la TV"
