const express = require('express')
const { spawn, execSync } = require('child_process')
const path    = require('path')
const fs      = require('fs')
const os      = require('os')

const app      = express()
const PORT     = process.env.PORT || 9876
const IS_CLOUD = !!process.env.RENDER

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Cookie-Data')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use(express.json({ limit: '10mb' }))
app.use(express.text({ limit: '10mb' }))

// ─── Directories ──────────────────────────────────────────────────────────────
const TMP_DIR     = IS_CLOUD ? '/tmp/ytgrab' : os.tmpdir()
const COOKIES_DIR = path.join(TMP_DIR, 'cookies')

;[TMP_DIR, COOKIES_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }))

function jobDir(id) {
  const d = path.join(TMP_DIR, `job_${id}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}

function getDownloadDest() {
  if (IS_CLOUD) return TMP_DIR
  const home = os.homedir()
  for (const p of [path.join(home, 'Downloads'), home]) {
    if (fs.existsSync(p)) return p
  }
  return TMP_DIR
}

// Active cookie file path
const COOKIE_FILE = path.join(COOKIES_DIR, 'cookies.txt')

// ─── Find yt-dlp ──────────────────────────────────────────────────────────────
function getYtDlp() {
  try { execSync('yt-dlp --version', { stdio: 'ignore' }); return 'yt-dlp' } catch {}
  for (const p of [
    path.join(os.homedir(), 'yt-dlp.exe'),
    path.join(os.homedir(), 'yt-dlp'),
    path.join(__dirname, 'yt-dlp.exe'),
    path.join(__dirname, 'yt-dlp'),
  ]) { if (fs.existsSync(p)) return `"${p}"` }
  return null
}

// ─── Format args ──────────────────────────────────────────────────────────────
function buildFmt(format, quality, audioFormat, audioBitrate) {
  const H = { '4k':2160,'1080p':1080,'720p':720,'480p':480,'360p':360,'240p':240,'144p':144 }
  const h = H[quality]
  if (format === 'audio')
    return `-x --audio-format ${audioFormat||'mp3'} --audio-quality ${audioBitrate||192}K`
  if (format === 'video-only')
    return h ? `-f "bestvideo[height<=${h}]"` : `-f "bestvideo"`
  if (format === 'webm')
    return h
      ? `-f "bestvideo[height<=${h}][ext=webm]+bestaudio/best[height<=${h}]" --merge-output-format webm`
      : `-f "bestvideo[ext=webm]+bestaudio" --merge-output-format webm`
  return h
    ? `-f "bestvideo[height<=${h}]+bestaudio/best[height<=${h}]" --merge-output-format mp4`
    : `-f "bestvideo+bestaudio" --merge-output-format mp4`
}

// Jobs
const jobs = new Map()
let nextId = 1

// ─── GET /status ──────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  console.log(`[status] ${req.headers.origin || '?'}`)
  res.json({
    ok:         true,
    mode:       IS_CLOUD ? 'render' : 'local',
    ytdlp:      !!getYtDlp(),
    hasCookies: fs.existsSync(COOKIE_FILE),
  })
})

// ─── POST /upload-cookies  ────────────────────────────────────────────────────
// Receives cookies as plain text body — no multer needed
// Extension sends: Content-Type: text/plain, body = cookie file content
app.post('/upload-cookies', (req, res) => {
  try {
    let cookieText = ''

    if (typeof req.body === 'string') {
      cookieText = req.body
    } else if (req.body && typeof req.body === 'object') {
      // Fallback: JSON wrapped { text: "..." }
      cookieText = req.body.text || req.body.cookies || ''
    }

    if (!cookieText || !cookieText.includes('youtube.com')) {
      return res.status(400).json({ error: 'Invalid cookie file — must contain youtube.com cookies' })
    }

    fs.writeFileSync(COOKIE_FILE, cookieText, 'utf8')
    const lines = cookieText.split('\n').filter(l => l.trim() && !l.startsWith('#')).length
    console.log(`[cookies] Saved ${lines} cookies to ${COOKIE_FILE}`)
    res.json({ ok: true, lines, message: `Cookies saved! (${lines} entries)` })
  } catch (e) {
    console.error('[cookies] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /cookies-status ──────────────────────────────────────────────────────
app.get('/cookies-status', (_req, res) => {
  const has = fs.existsSync(COOKIE_FILE)
  let lines = 0
  if (has) {
    try {
      lines = fs.readFileSync(COOKIE_FILE, 'utf8')
        .split('\n').filter(l => l.trim() && !l.startsWith('#')).length
    } catch {}
  }
  res.json({ hasCookies: has, lines })
})

// ─── POST /download ───────────────────────────────────────────────────────────
app.post('/download', (req, res) => {
  const { url, format, quality, audioFormat, audioBitrate, subtitles, playlist, browser } = req.body
  if (!url) return res.status(400).json({ error: 'No URL' })

  const ytdlp = getYtDlp()
  if (!ytdlp) return res.status(500).json({ error: 'yt-dlp not installed on server' })

  const id  = nextId++
  const dir = jobDir(id)
  const fmt = buildFmt(format, quality, audioFormat, audioBitrate)

  const args = [ytdlp, fmt]

  if (IS_CLOUD) {
    // ── Render cloud mode ────────────────────────────────────────────────────
    // bgutil-ytdlp-pot-provider plugin handles PO Token generation automatically
    // It uses Node.js BotGuard challenge solver — installed in build command
    // No need to manually set player_client or po_token

    // Pass node path so bgutil plugin can use it
    try {
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim()
      if (nodePath) {
        args.push(`--js-runtimes "node:${nodePath}"`)
        console.log(`[runtime] node → ${nodePath}`)
      }
    } catch {}

    // Use web client — bgutil plugin will auto-provide PO tokens for it
    args.push('--extractor-args "youtube:player_client=web"')

    // Use uploaded cookies.txt
    if (fs.existsSync(COOKIE_FILE)) {
      args.push(`--cookies "${COOKIE_FILE}"`)
      console.log(`[cookies] ✅ Using ${COOKIE_FILE}`)
    } else {
      console.warn('[cookies] ⚠️  No cookies file — bot error likely')
    }

  } else {
    // ── Local PC mode ────────────────────────────────────────────────────────
    if (browser && browser !== '') {
      args.push(`--cookies-from-browser ${browser}`)
    }
  }

  args.push('--extractor-retries 3')
  args.push('--retry-sleep 2')

  if (subtitles) args.push('--write-subs --embed-subs')
  if (!playlist) args.push('--no-playlist')

  args.push('--newline --progress')
  args.push('--print after_move:filepath')
  args.push(`-o "${path.join(dir, '%(title)s.%(ext)s')}"`)
  args.push(`"${url}"`)

  const cmd = args.join(' ')
  console.log(`[job ${id}] ${cmd}`)

  const job = {
    id, status: 'downloading', progress: 0,
    speed: '', eta: '', logs: [`▶ Starting: ${url}`],
    filepath: null, filename: null, dir,
  }
  jobs.set(id, job)

  const proc = spawn(cmd, [], { shell: true })

  proc.stdout.on('data', chunk => {
    for (const raw of chunk.toString().split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const pct = line.match(/(\d+\.?\d*)%/)
      const spd = line.match(/at\s+([\d.]+\s*\w+\/s)/)
      const eta = line.match(/ETA\s+([\d:]+)/)
      if (!pct && line.length > 3) {
        try {
          if (fs.existsSync(line)) {
            job.filepath = line
            job.filename = path.basename(line)
            console.log(`[job ${id}] saved → ${job.filename}`)
          }
        } catch {}
      }
      if (pct) {
        job.progress = parseFloat(pct[1])
        if (spd) job.speed = spd[1].trim()
        if (eta) job.eta   = eta[1]
      }
      job.logs.push(line)
      if (job.logs.length > 120) job.logs.shift()
    }
  })

  proc.stderr.on('data', chunk => {
    const line = chunk.toString().trim()
    if (!line) return
    job.logs.push(line)
    if (job.logs.length > 120) job.logs.shift()
    console.log(`[yt-dlp] ${line}`)
  })

  proc.on('close', code => {
    job.status   = code === 0 ? 'done' : 'error'
    job.progress = code === 0 ? 100 : job.progress
    console.log(`[job ${id}] ${code === 0 ? '✅' : '❌'} ${job.filename || 'failed'}`)
    setTimeout(() => {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
      jobs.delete(id)
    }, 15 * 60 * 1000)
  })

  res.json({ id, status: 'started' })
})

// ─── GET /progress/:id ────────────────────────────────────────────────────────
app.get('/progress/:id', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    id:          job.id,
    status:      job.status,
    progress:    job.progress,
    speed:       job.speed,
    eta:         job.eta,
    logs:        job.logs.slice(-12),
    filename:    job.filename,
    downloadUrl: job.status === 'done' && job.filename
      ? `/file/${job.id}/${encodeURIComponent(job.filename)}`
      : null,
  })
})

// ─── GET /file/:id/:filename — stream to browser ──────────────────────────────
app.get('/file/:id/:filename', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job || !job.filepath)       return res.status(404).send('File not found')
  if (job.status !== 'done')        return res.status(400).send('Not ready')
  if (!fs.existsSync(job.filepath)) return res.status(404).send('File expired')

  const name = path.basename(job.filepath)
  const stat = fs.statSync(job.filepath)
  console.log(`[stream] → ${name} (${(stat.size/1024/1024).toFixed(1)} MB)`)

  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.setHeader('Content-Type',        'application/octet-stream')
  res.setHeader('Content-Length',      stat.size)
  res.setHeader('Cache-Control',       'no-cache')

  fs.createReadStream(job.filepath).pipe(res)
})

// ─── GET /open-folder ─────────────────────────────────────────────────────────
app.get('/open-folder', (_req, res) => {
  if (IS_CLOUD) return res.json({ ok: false, reason: 'Not on cloud' })
  try {
    const p = getDownloadDest()
    if (process.platform === 'win32')       spawn('explorer', [p], { detached: true, shell: true })
    else if (process.platform === 'darwin') spawn('open',     [p], { detached: true })
    else                                    spawn('xdg-open', [p], { detached: true })
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

// ─── GET / ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ name: 'YTGrab Helper', version: '3.2', mode: IS_CLOUD ? 'render' : 'local', status: 'running' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║   🎬  YTGrab Helper  v3.2            ║')
  console.log(`║   ${IS_CLOUD ? '☁️  Render Cloud' : '💻 Local PC    '}                  ║`)
  console.log('╚══════════════════════════════════════╝')
  console.log(`\n📡  Port   : ${PORT}`)
  console.log(`🔧  yt-dlp : ${getYtDlp() || '❌ NOT FOUND'}`)
  console.log(`🍪  cookies: ${fs.existsSync(COOKIE_FILE) ? '✅ found' : '⚠️  not uploaded yet'}`)
  console.log('\n✅  Ready!\n')
})