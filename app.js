/* ============================================================
   Fir Narativ — experience runtime
   Vanilla JS. Reads chapters.json, plays segments in order.
   State: IDLE -> PLAYING (per segment) -> waits for input -> next/back
   ============================================================ */

(() => {
  'use strict'

  // --- DOM references ---------------------------------------------------
  const screens = {
    idle:  document.getElementById('idle'),
    video: document.getElementById('screen-video'),
    image: document.getElementById('screen-image'),
    pause: document.getElementById('screen-pause'),
    end:   document.getElementById('screen-end')
  }
  const video        = document.getElementById('video')
  const image        = document.getElementById('image')
  const pauseMessage = document.getElementById('pause-message')
  const blackout     = document.getElementById('blackout')
  const ctrlStatus   = document.getElementById('ctrl-status')
  const playBtn      = document.getElementById('btn-play')

  // --- State ------------------------------------------------------------
  let chapters = []
  let index = -1            // -1 = IDLE, chapters.length = END
  let started = false
  let transitioning = false // guards against double-advance during fades

  // --- Boot -------------------------------------------------------------
  async function boot() {
    try {
      const res = await fetch('chapters.json', { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      chapters = await res.json()
    } catch (err) {
      console.error('Nu am putut încărca chapters.json:', err)
      showLoadError(err)
      return
    }
    showScreen('idle')
    setStatus('IDLE — apăsați pentru start')
  }

  function showLoadError(err) {
    const idleSub = document.querySelector('.idle-sub')
    if (idleSub) {
      idleSub.textContent = 'Eroare la încărcarea chapters.json (rulați printr-un server local).'
    }
    setStatus('EROARE: ' + err.message)
  }

  // --- Screen switching with fade + black flash -------------------------
  // Only one screen is .is-active at a time. CSS handles the 200ms fade.
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('is-active', key === name)
    })
  }

  // Render the current segment. Wrapped in a short blackout so the eye
  // gets a clean cut between segments instead of a cross-dissolve smear.
  function render() {
    if (transitioning) return

    // IDLE
    if (index < 0) {
      stopVideo()
      showScreen('idle')
      setStatus('IDLE — apăsați pentru start')
      return
    }
    // END
    if (index >= chapters.length) {
      stopVideo()
      showScreen('end')
      setStatus('SFÂRȘIT')
      return
    }

    const seg = chapters[index]
    transitioning = true
    flashBlackout(() => {
      stopVideo()
      switch (seg.type) {
        case 'video': renderVideo(seg); break
        case 'image': renderImage(seg); break
        case 'pause': renderPause(seg); break
        default:
          console.warn('Tip segment necunoscut:', seg.type, seg)
          renderUnknown(seg)
      }
      setStatus(`${index + 1}/${chapters.length} · ${seg.type} · ${seg.title || seg.id || ''}`)
      transitioning = false
    })
  }

  // 100ms black screen between segments (CLAUDE.md: clean visual pause)
  function flashBlackout(midpoint) {
    blackout.classList.add('is-on')
    setTimeout(() => {
      midpoint()
      // small delay so new content paints under the blackout before reveal
      setTimeout(() => blackout.classList.remove('is-on'), 100)
    }, 100)
  }

  // --- Segment renderers -------------------------------------------------
  function renderVideo(seg) {
    showScreen('video')
    video.muted = false           // we want audio (reset any earlier fallback)
    video.src = seg.file
    video.load()                  // force a fresh decode when src changes
    // Start from frame 0 once the browser knows the duration.
    video.addEventListener('loadedmetadata', () => { video.currentTime = 0 }, { once: true })
    // Autoplay. Muted fallback only if the browser blocks audio autoplay;
    // after the first user keypress (start) audio autoplay is allowed.
    const p = video.play()
    if (p && p.catch) {
      p.catch(err => {
        console.warn('Autoplay blocat, reîncerc muted:', err)
        video.muted = true
        video.play().catch(e => console.error('Redare eșuată:', e))
      })
    }
  }

  function renderImage(seg) {
    showScreen('image')
    image.src = seg.file
  }

  function renderPause(seg) {
    showScreen('pause')
    pauseMessage.textContent = seg.message || ''
  }

  function renderUnknown(seg) {
    showScreen('pause')
    pauseMessage.textContent = 'Segment necunoscut: ' + (seg.type || '?')
  }

  function stopVideo() {
    if (!video.src) return
    try { video.pause() } catch (e) {}
    // Note: we intentionally leave the last frame visible (video stays on
    // its current screen until we switch away), per CLAUDE.md requirement.
  }

  // --- Navigation --------------------------------------------------------
  function start() {
    if (started) return
    started = true
    index = 0
    render()
  }

  function next() {
    if (!started) { start(); return }
    if (transitioning) return
    if (index >= chapters.length) return // already at END, nothing after
    index += 1
    render()
  }

  function back() {
    if (!started) return
    if (transitioning) return
    if (index <= 0) {
      // From the first segment, go back to the IDLE start screen.
      started = false
      index = -1
      render()
      return
    }
    index -= 1
    render()
  }

  // Debug-only play/pause toggle for the on-screen control.
  function togglePlay() {
    if (!started) { start(); return }
    const seg = chapters[index]
    if (seg && seg.type === 'video') {
      if (video.paused) video.play(); else video.pause()
      playBtn.textContent = video.paused ? '▶' : '⏸'
    }
  }

  // Pause the current segment (video playback). Slides have nothing to
  // play, so pause/resume are a no-op there but stay valid keys.
  function pauseSegment() {
    if (!started) return
    const seg = chapters[index]
    if (seg && seg.type === 'video' && !video.paused) {
      video.pause()
      playBtn.textContent = '▶'
    }
  }

  function resumeSegment() {
    if (!started) { start(); return }
    const seg = chapters[index]
    if (seg && seg.type === 'video' && video.paused) {
      video.play()
      playBtn.textContent = '⏸'
    }
  }

  // --- Input: keyboard ---------------------------------------------------
  // → / PageDown : înainte   ← / PageUp : înapoi
  // Space : pauză            Enter : continuă (unpause)
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault()
        next()
        break
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault()
        back()
        break
      case ' ':
        e.preventDefault()
        pauseSegment()
        break
      case 'Enter':
        e.preventDefault()
        resumeSegment()
        break
      // F5 from some remotes -> ignore (don't reload). Real F5 still works
      // because we can't fully block it, but we avoid acting on it here.
      default:
        break
    }
  })

  // --- Video diagnostics -------------------------------------------------
  // Surfaces the real failure mode on the Pi. If audio plays but the screen
  // stays blank, this almost always fires with MEDIA_ERR_DECODE (code 3) =
  // the H.264 video stream can't be decoded -> re-encode to yuv420p.
  video.addEventListener('error', () => {
    const err = video.error
    console.error('VIDEO ERROR', err && err.code, err && err.message, '· src:', video.currentSrc)
  })
  video.addEventListener('loadeddata', () => {
    console.log('VIDEO OK · dimensiuni:', video.videoWidth + 'x' + video.videoHeight)
    // videoWidth/Height = 0 here means audio decoded but NO video stream painted.
  })

  // --- Input: on-screen debug controls ----------------------------------
  document.getElementById('btn-next').addEventListener('click', next)
  document.getElementById('btn-back').addEventListener('click', back)
  playBtn.addEventListener('click', togglePlay)

  // --- Mouse-idle: reveal controls + cursor briefly ----------------------
  let idleTimer = null
  function wake() {
    document.body.classList.add('show-cursor')
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      document.body.classList.remove('show-cursor')
    }, 2500)
  }
  document.addEventListener('mousemove', wake)
  document.addEventListener('click', wake)

  // --- Status helper -----------------------------------------------------
  function setStatus(text) {
    if (ctrlStatus) ctrlStatus.textContent = text
  }

  // --- Go ----------------------------------------------------------------
  boot()
})()
