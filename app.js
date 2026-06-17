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
  let currentVideo = null   // the <video> element created for the active segment

  // CLAUDE.md: couple controls the pace — stop on the last frame and wait.
  // Flip to true if you want the video to advance automatically when it ends.
  const AUTO_ADVANCE_ON_END = false

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

  // MediaError codes: 1 ABORTED · 2 NETWORK · 3 DECODE · 4 SRC_NOT_SUPPORTED
  const MEDIA_ERR = {
    1: 'ABORTED (redare întreruptă)',
    2: 'NETWORK (eroare de rețea/server)',
    3: 'DECODE (Chromium nu poate decoda codecul)',
    4: 'SRC_NOT_SUPPORTED (format/codec nesuportat)'
  }

  // --- Segment renderers -------------------------------------------------
  // Build a fresh <video> at runtime and append it into the #screen-video
  // container. No dependency on static markup; a clean element each time
  // avoids stale state between segments.
  function renderVideo(seg) {
    showScreen('video')
    const container = screens.video
    container.innerHTML = ''                 // drop any previous <video>

    const v = document.createElement('video')
    v.className = 'media'                     // 100vw/100vh, object-fit:contain, black bg
    v.setAttribute('playsinline', '')        // no native fullscreen takeover
    v.preload = 'auto'
    v.muted = false                          // we want audio
    v.src = seg.file

    // [DEBUG] element just created
    console.log('🎬 VIDEO CREATED:', {
      src: v.src,
      readyState: v.readyState,
      networkState: v.networkState
    })

    // Surface decode/codec failures on screen so they're visible on the Pi.
    v.addEventListener('error', () => {
      const code = v.error ? v.error.code : 0
      const msg = 'EROARE VIDEO ' + code + ': ' + (MEDIA_ERR[code] || 'necunoscută')
      console.error(msg, v.error, '· src:', v.currentSrc)
      setStatus(msg)
      showScreen('pause')
      pauseMessage.textContent = msg
    })
    v.addEventListener('loadeddata', () => {
      console.log('VIDEO OK ·', v.videoWidth + 'x' + v.videoHeight)
    })
    // Natural end: stop on the last frame and wait (couple controls the pace).
    v.addEventListener('ended', () => { if (AUTO_ADVANCE_ON_END) next() })

    // [DEBUG] verbose media lifecycle events
    v.addEventListener('loadedmetadata', () => console.log('🎬 metadata loaded:', v.videoWidth, 'x', v.videoHeight))
    v.addEventListener('canplay', () => console.log('🎬 canplay'))
    v.addEventListener('playing', () => console.log('🎬 PLAYING · paused:', v.paused, '· currentTime:', v.currentTime))
    v.addEventListener('pause', () => console.log('🎬 paused at', v.currentTime))
    v.addEventListener('error', () => console.error('🎬 VIDEO ERROR:', v.error && v.error.code, v.error && v.error.message))
    v.addEventListener('stalled', () => console.log('🎬 stalled'))
    v.addEventListener('waiting', () => console.log('🎬 waiting'))

    container.appendChild(v)
    currentVideo = v

    // [DEBUG] computed layout once it's in the DOM
    const cs = getComputedStyle(v)
    console.log('🎬 VIDEO IN DOM:', {
      parent: v.parentElement && v.parentElement.tagName,
      parentClass: v.parentElement && v.parentElement.className,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      width: cs.width,
      height: cs.height,
      position: cs.position,
      zIndex: cs.zIndex,
      rect: v.getBoundingClientRect()
    })

    // Autoplay; fall back to muted only if the browser blocks audio autoplay.
    const p = v.play()
    if (p && p.then) {
      p.then(() => console.log('🎬 PLAY SUCCESS - paused:', v.paused))
       .catch(err => console.error('🎬 PLAY FAILED:', err.name, err.message))
    }
    if (p && p.catch) {
      p.catch(err => {
        console.warn('Autoplay blocat, reîncerc muted:', err)
        v.muted = true
        v.play()
          .then(() => console.log('🎬 PLAY SUCCESS (muted) - paused:', v.paused))
          .catch(e => console.error('🎬 PLAY FAILED (muted):', e.name, e.message))
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

  // Called when we leave a segment. The blackout already covers the screen,
  // so we fully tear down the <video> to avoid a stale element lingering.
  function stopVideo() {
    if (!currentVideo) return
    console.log('🎬 VIDEO REMOVED from slide')
    try { currentVideo.pause() } catch (e) {}
    currentVideo.removeAttribute('src')
    currentVideo.load()
    currentVideo.remove()
    currentVideo = null
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
    if (currentVideo) {
      if (currentVideo.paused) currentVideo.play(); else currentVideo.pause()
      playBtn.textContent = currentVideo.paused ? '▶' : '⏸'
    }
  }

  // Pause the current segment (video playback). Slides have nothing to
  // play, so pause/resume are a no-op there but stay valid keys.
  function pauseSegment() {
    if (!started) return
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause()
      playBtn.textContent = '▶'
    }
  }

  function resumeSegment() {
    if (!started) { start(); return }
    if (currentVideo && currentVideo.paused) {
      currentVideo.play()
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
