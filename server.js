const express = require('express')
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 9876
const IS_RENDER = !!process.env.RENDER

// ─── CORS — allow Chrome extensions ──────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use(express.json())

// ─── Temp folder for Render (or local Downloads) ──────────────────────────────
function getTempDir() {
  if (IS_RENDER) {
    const tmp = path.join('/tmp', 'ytgrab')
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    return tmp
  }
  const home = os.homedir()
  for (const p of [path.join(home, 'Downloads'), path.join(home, 'Download'), home]) {
    if (fs.existsSync(p)) return p
  }
  return os.tmpdir()
}

// ─── Find yt-dlp ─────────────────────────────────────────────────────────────
function getYtDlp() {
  try { execSync('yt-dlp --version', { stdio: 'ignore' }); return 'yt-dlp' } catch {}
  const checks = [
    path.join(os.homedir(), 'yt-dlp.exe'),
    path.join(os.homedir(), 'yt-dlp'),
    path.join(__dirname, 'yt-dlp.exe'),
    path.join(__dirname, 'yt-dlp'),
  ]
  for (const p of checks) { if (fs.existsSync(p)) return `"${p}"` }
  return null
}

// ─── Build format args ────────────────────────────────────────────────────────
function buildArgs(format, quality, audioFormat, audioBitrate) {
  const heights = { '4k':2160,'1080p':1080,'720p':720,'480p':480,'360p':360,'240p':240,'144p':144 }
  const h = heights[quality]
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

// Active jobs: id → { status, progress, speed, eta, logs, filepath, filename }
const jobs = new Map()
let nextId = 1

// ─── Status ───────────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  console.log(`Status check from: ${req.headers.origin || 'unknown'}`)
  res.json({
    ok: true,
    mode: IS_RENDER ? 'render' : 'local',
    ytdlp: !!getYtDlp(),
  })
})

// ─── Start download job ───────────────────────────────────────────────────────
app.post('/download', (req, res) => {
  const { url, format, quality, audioFormat, audioBitrate, subtitles, playlist, browser } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const ytdlp = getYtDlp()
  if (!ytdlp) return res.status(500).json({ error: 'yt-dlp not installed on server' })

  const jobDir = path.join(getTempDir(), `job_${nextId}`)
  fs.mkdirSync(jobDir, { recursive: true })

  const outTpl = path.join(jobDir, '%(title)s.%(ext)s')
  const fmtArg = buildArgs(format, quality, audioFormat, audioBitrate)

  const parts = [ytdlp, fmtArg]
  if (subtitles)                 parts.push('--write-subs --embed-subs')
  if (!playlist)                 parts.push('--no-playlist')
  if (browser && browser !== '') parts.push(`--cookies-from-browser ${browser}`)
  parts.push('--newline --progress --print after_move:filepath')
  parts.push(`-o "${outTpl}"`)
  parts.push(`"${url}"`)

  const fullCmd = parts.join(' ')
  console.log(`[JOB ${nextId}] ${fullCmd}`)

  const id = nextId++
  const job = {
    id, status: 'downloading', progress: 0,
    speed: '', eta: '', logs: [], filepath: null, filename: null,
    url, jobDir,
  }
  jobs.set(id, job)

  const proc = spawn(fullCmd, [], { shell: true })

  proc.stdout.on('data', chunk => {
    for (const line of chunk.toString().split('\n').filter(l => l.trim())) {
      const pct = line.match(/(\d+\.?\d*)%/)
      const spd = line.match(/at\s+([\d.]+\s*\w+\/s)/)
      const eta = line.match(/ETA\s+([\d:]+)/)

      // Detect final saved filepath from --print after_move:filepath
      if (!pct && line.trim().length > 3) {
        try {
          if (fs.existsSync(line.trim())) {
            job.filepath = line.trim()
            job.filename = path.basename(line.trim())
            console.log(`[JOB ${id}] Saved: ${job.filepath}`)
          }
        } catch {}
      }

      if (pct) {
        job.progress = parseFloat(pct[1])
        if (spd) job.speed = spd[1].trim()
        if (eta) job.eta   = eta[1]
      }
      job.logs.push(line.trim())
      if (job.logs.length > 100) job.logs.shift()
    }
  })

  proc.stderr.on('data', chunk => {
    const line = chunk.toString().trim()
    if (line) { job.logs.push(line); console.log(`[yt-dlp] ${line}`) }
    if (job.logs.length > 100) job.logs.shift()
  })

  proc.on('close', code => {
    job.status   = code === 0 ? 'done' : 'error'
    job.progress = code === 0 ? 100 : job.progress
    console.log(`[JOB ${id}] ${code === 0 ? '✅ Done' : '❌ Error'} — ${job.filename || ''}`)

    // Auto-cleanup after 10 min
    setTimeout(() => {
      try { fs.rmSync(job.jobDir, { recursive: true, force: true }) } catch {}
      jobs.delete(id)
    }, 10 * 60 * 1000)
  })

  res.json({ id, status: 'started' })
})

// ─── Poll progress ────────────────────────────────────────────────────────────
app.get('/progress/:id', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    id: job.id,
    status:   job.status,
    progress: job.progress,
    speed:    job.speed,
    eta:      job.eta,
    logs:     job.logs.slice(-10),
    filename: job.filename,
    // Only expose download link when done
    downloadUrl: job.status === 'done' && job.filename
      ? `/file/${job.id}/${encodeURIComponent(job.filename)}`
      : null,
  })
})

// ─── Stream file to browser → browser saves to PC Downloads ──────────────────
// This is the KEY endpoint — sends the file as a download response
// The browser receives it and saves it to the user's Downloads folder
app.get('/file/:id/:filename', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job || !job.filepath) return res.status(404).send('File not found')
  if (job.status !== 'done')  return res.status(400).send('Download not complete yet')

  const filePath = job.filepath
  if (!fs.existsSync(filePath)) return res.status(404).send('File expired or missing')

  const filename = path.basename(filePath)
  const stat = fs.statSync(filePath)

  console.log(`[STREAM] Sending ${filename} (${(stat.size/1024/1024).toFixed(1)} MB) to browser`)

  // These headers tell the browser: "save this file, don't open it"
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'no-cache')

  // Stream file → browser → PC Downloads folder
  const stream = fs.createReadStream(filePath)
  stream.pipe(res)

  stream.on('end', () => {
    console.log(`[STREAM] ✅ Sent ${filename} to browser`)
  })

  stream.on('error', (err) => {
    console.error(`[STREAM] ❌ Error: ${err.message}`)
    if (!res.headersSent) res.status(500).send('Stream error')
  })
})

// ─── Open folder (local only) ─────────────────────────────────────────────────
app.get('/open-folder', (_req, res) => {
  if (IS_RENDER) return res.json({ ok: false, reason: 'Not available on cloud' })
  const p = getTempDir()
  try {
    if (process.platform === 'win32') spawn('explorer', [p], { detached: true, shell: true })
    else if (process.platform === 'darwin') spawn('open', [p], { detached: true })
    else spawn('xdg-open', [p], { detached: true })
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

// ─── Health check for Render ──────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'YTGrab Helper',
    version: '3.0',
    mode: IS_RENDER ? 'render-cloud' : 'local',
    ytdlp: !!getYtDlp(),
    status: 'running',
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║   🎬  YTGrab Helper  v3.0            ║')
  console.log(`║   Mode: ${IS_RENDER ? '☁️  Render Cloud         ' : '💻 Local PC             '}  ║`)
  console.log('╚══════════════════════════════════════╝')
  console.log(`\n📡 Port: ${PORT}`)
  console.log(`🔧 yt-dlp: ${getYtDlp() || '❌ NOT FOUND — install it!'}`)
  console.log(`📁 Temp dir: ${getTempDir()}`)
  console.log('\n✅ Ready!\n')
})
