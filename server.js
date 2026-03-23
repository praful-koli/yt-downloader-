const express = require('express')
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs   = require('fs')
const os   = require('os')

const app  = express()
const PORT = process.env.PORT || 3000

// ── Middleware ─────────────────────────────────────────────────────────────────
// IMPORTANT: raw body parser first — handles cookies.txt upload
app.use((req, res, next) => {
  if (req.path === '/api/cookies') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => { req.rawBody = body; next() })
    req.on('error', next)
  } else {
    next()
  }
})
app.use(express.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// ── Paths ──────────────────────────────────────────────────────────────────────
const TMP_DIR     = path.join(os.tmpdir(), 'ytgrab')
const COOKIE_FILE = path.join(TMP_DIR, 'cookies.txt')
try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}

function getYtDlp() {
  try { execSync('yt-dlp --version', { stdio: 'ignore' }); return 'yt-dlp' } catch {}
  return null
}

function buildFormat(format, quality) {
  const heights = { '4k':2160,'1080p':1080,'720p':720,'480p':480,'360p':360,'240p':240,'144p':144 }
  const h = heights[quality]
  if (format === 'mp3') return `-x --audio-format mp3 --audio-quality 192K`
  if (format === 'webm') return h
    ? `-f "bestvideo[height<=${h}][ext=webm]+bestaudio" --merge-output-format webm`
    : `-f "bestvideo[ext=webm]+bestaudio" --merge-output-format webm`
  return h
    ? `-f "bestvideo[height<=${h}]+bestaudio/best[height<=${h}]" --merge-output-format mp4`
    : `-f "bestvideo+bestaudio" --merge-output-format mp4`
}

const jobs = new Map()
let jobId = 1

// ── GET /api/status ────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    ytdlp: !!getYtDlp(),
    hasCookies: fs.existsSync(COOKIE_FILE)
  })
})

// ── POST /api/cookies ──────────────────────────────────────────────────────────
app.post('/api/cookies', (req, res) => {
  try {
    const text = req.rawBody || ''
    console.log(`[cookies] received ${text.length} bytes`)

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ ok: false, error: 'Cookie file is empty' })
    }

    // Make sure tmp dir exists
    try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}

    fs.writeFileSync(COOKIE_FILE, text, 'utf8')

    const count = text.split('\n').filter(l => l.trim() && !l.startsWith('#')).length
    console.log(`[cookies] saved ${count} entries to ${COOKIE_FILE}`)

    res.json({ ok: true, count })
  } catch (e) {
    console.error('[cookies] error:', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── POST /api/download ─────────────────────────────────────────────────────────
app.post('/api/download', (req, res) => {
  const { url, format = 'mp4', quality = '720p' } = req.body || {}
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const ytdlp = getYtDlp()
  if (!ytdlp) return res.status(500).json({ error: 'yt-dlp not installed on server. Contact admin.' })

  const id     = jobId++
  const outDir = path.join(TMP_DIR, `job_${id}`)
  try { fs.mkdirSync(outDir, { recursive: true }) } catch {}

  const fmtArg = buildFormat(format, quality)
  const parts  = [ytdlp, fmtArg]

  // Cookies
  if (fs.existsSync(COOKIE_FILE)) {
    parts.push(`--cookies "${COOKIE_FILE}"`)
    console.log('[download] using cookies')
  }

  // Node.js runtime for YouTube n-challenge
  try {
    const node = execSync('which node 2>/dev/null || where node 2>nul', { encoding: 'utf8' })
      .split('\n')[0].trim()
    if (node) parts.push(`--js-runtimes "node:${node}"`)
  } catch {}
  parts.push('--remote-components ejs:github')

  parts.push('--no-playlist')
  parts.push('--newline')
  parts.push('--progress')
  parts.push('--print after_move:filepath')
  parts.push(`-o "${path.join(outDir, '%(title)s.%(ext)s')}"`)
  parts.push(`"${url}"`)

  const cmd = parts.join(' ')
  console.log(`\n[job ${id}] url=${url} format=${format} quality=${quality}`)

  const job = {
    id, status: 'running', progress: 0,
    speed: '', eta: '', logs: '',
    filepath: null, filename: null, dir: outDir
  }
  jobs.set(id, job)

  const proc = spawn(cmd, [], { shell: true })

  proc.stdout.on('data', buf => {
    for (const raw of buf.toString().split('\n')) {
      const line = raw.trim(); if (!line) continue
      const pct = line.match(/(\d+\.?\d*)%/)
      const spd = line.match(/at\s+([\d.]+\s*\w+\/s)/)
      const eta = line.match(/ETA\s+([\d:]+)/)
      if (!pct && line.length > 3) {
        try { if (fs.existsSync(line)) { job.filepath = line; job.filename = path.basename(line) } } catch {}
      }
      if (pct) {
        job.progress = parseFloat(pct[1])
        if (spd) job.speed = spd[1].trim()
        if (eta) job.eta   = eta[1]
      }
    }
  })

  proc.stderr.on('data', buf => {
    const line = buf.toString().trim()
    if (line) { job.logs += line + '\n'; console.log('[yt-dlp]', line) }
  })

  proc.on('close', code => {
    job.status   = code === 0 ? 'done' : 'error'
    job.progress = code === 0 ? 100 : job.progress
    console.log(`[job ${id}] ${code === 0 ? '✅ done' : '❌ error'}: ${job.filename || 'failed'}`)
    // Clean up after 20 min
    setTimeout(() => {
      try { fs.rmSync(outDir, { recursive: true, force: true }) } catch {}
      jobs.delete(id)
    }, 20 * 60 * 1000)
  })

  res.json({ id })
})

// ── GET /api/progress/:id ──────────────────────────────────────────────────────
app.get('/api/progress/:id', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    status:   job.status,
    progress: job.progress,
    speed:    job.speed,
    eta:      job.eta,
    filename: job.filename,
    logs:     job.logs.slice(-800),
    fileUrl:  job.status === 'done' && job.filename
      ? `/api/file/${job.id}/${encodeURIComponent(job.filename)}` : null
  })
})

// ── GET /api/file/:id/:name — stream → browser Save As dialog ─────────────────
app.get('/api/file/:id/:filename', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job?.filepath || !fs.existsSync(job.filepath))
    return res.status(404).send('File not found or already expired')
  if (job.status !== 'done')
    return res.status(400).send('Download not finished yet')

  const name = path.basename(job.filepath)
  const size = fs.statSync(job.filepath).size
  console.log(`[stream] ${name} (${(size/1024/1024).toFixed(1)} MB)`)

  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', size)
  res.setHeader('Cache-Control', 'no-cache')
  fs.createReadStream(job.filepath).pipe(res)
})

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html')
  if (fs.existsSync(idx)) res.sendFile(idx)
  else res.send('Run node build.js first')
})

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 YTGrab → http://localhost:${PORT}`)
  console.log(`🔧 yt-dlp  : ${getYtDlp() || '❌ not found — run: pip install yt-dlp'}`)
  console.log(`🍪 cookies : ${fs.existsSync(COOKIE_FILE) ? '✅ loaded' : '⚠️  not uploaded yet'}`)
  console.log(`📁 tmp dir : ${TMP_DIR}\n`)
})
