const express  = require('express')
const cors     = require('cors')
const { spawn, execSync } = require('child_process')
const path     = require('path')
const fs       = require('fs')
const os       = require('os')
const http     = require('http')

const app      = express()
const PORT     = process.env.PORT || 3001
const IS_CLOUD = !!process.env.RENDER

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.text({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'dist')))

// ── dirs ────────────────────────────────────────────────────────────────────
const TMP       = IS_CLOUD ? '/tmp/ytgrab' : os.tmpdir()
const COOK_DIR  = path.join(TMP, 'cookies')
const COOKIE_F  = path.join(COOK_DIR, 'cookies.txt')
;[TMP, COOK_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }))

function dlDest() {
  if (IS_CLOUD) return TMP
  const h = os.homedir()
  for (const p of [path.join(h,'Downloads'), h]) if (fs.existsSync(p)) return p
  return TMP
}

function jobDir(id) {
  const d = path.join(TMP, `job_${id}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}

// ── yt-dlp ──────────────────────────────────────────────────────────────────
function getYtDlp() {
  try { execSync('yt-dlp --version', { stdio:'ignore' }); return 'yt-dlp' } catch {}
  for (const p of [
    path.join(os.homedir(),'yt-dlp.exe'), path.join(os.homedir(),'yt-dlp'),
    path.join(__dirname,'yt-dlp.exe'),    path.join(__dirname,'yt-dlp'),
  ]) if (fs.existsSync(p)) return `"${p}"`
  return null
}

function buildFmt(format, quality, audioFmt, audioBit) {
  const H = {'4k':2160,'1080p':1080,'720p':720,'480p':480,'360p':360,'240p':240,'144p':144}
  const h = H[quality]
  if (format==='audio')      return `-x --audio-format ${audioFmt||'mp3'} --audio-quality ${audioBit||192}K`
  if (format==='video-only') return h ? `-f "bestvideo[height<=${h}]"` : `-f "bestvideo"`
  if (format==='webm')       return h
    ? `-f "bestvideo[height<=${h}][ext=webm]+bestaudio/best[height<=${h}]" --merge-output-format webm`
    : `-f "bestvideo[ext=webm]+bestaudio" --merge-output-format webm`
  return h
    ? `-f "bestvideo[height<=${h}]+bestaudio/best[height<=${h}]" --merge-output-format mp4`
    : `-f "bestvideo+bestaudio" --merge-output-format mp4`
}

const jobs = new Map()
let nid = 1

// ── routes ───────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({ ok:true, mode: IS_CLOUD?'render':'local', ytdlp:!!getYtDlp(), hasCookies: fs.existsSync(COOKIE_F) })
})

app.post('/api/upload-cookies', (req, res) => {
  try {
    const text = typeof req.body === 'string' ? req.body : (req.body.text||'')
    if (!text || text.length < 20) return res.status(400).json({ error:'Empty file' })
    fs.writeFileSync(COOKIE_F, text, 'utf8')
    const lines = text.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).length
    console.log(`[cookies] saved ${lines} entries`)
    res.json({ ok:true, lines })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/download', (req, res) => {
  const { url, format, quality, audioFormat, audioBitrate, subtitles, playlist, browser } = req.body
  if (!url) return res.status(400).json({ error:'No URL' })
  const ytdlp = getYtDlp()
  if (!ytdlp) return res.status(500).json({ error:'yt-dlp not installed' })

  const id  = nid++
  const dir = jobDir(id)
  const fmt = buildFmt(format, quality, audioFormat, audioBitrate)
  const args = [ytdlp, fmt]

  if (IS_CLOUD) {
    let nodePath = 'node'
    try { nodePath = execSync('which node',{encoding:'utf8'}).trim() } catch {}
    args.push(`--js-runtimes "node:${nodePath}"`)
    args.push('--remote-components ejs:github')
    if (fs.existsSync(COOKIE_F)) {
      args.push(`--cookies "${COOKIE_F}"`)
    }
  } else {
    if (browser && browser !== '') args.push(`--cookies-from-browser ${browser}`)
  }

  if (subtitles) args.push('--write-subs --embed-subs')
  if (!playlist)  args.push('--no-playlist')
  args.push('--extractor-retries 3')
  args.push('--newline --progress --print after_move:filepath')
  args.push(`-o "${path.join(dir,'%(title)s.%(ext)s')}"`)
  args.push(`"${url}"`)

  const cmd = args.join(' ')
  console.log(`[job ${id}] ${cmd}`)

  const job = { id, status:'downloading', progress:0, speed:'', eta:'', logs:[`▶ ${url}`], filepath:null, filename:null, dir }
  jobs.set(id, job)

  const proc = spawn(cmd, [], { shell:true })

  proc.stdout.on('data', chunk => {
    for (const raw of chunk.toString().split('\n')) {
      const line = raw.trim(); if (!line) continue
      const pct = line.match(/(\d+\.?\d*)%/)
      const spd = line.match(/at\s+([\d.]+\s*\w+\/s)/)
      const eta = line.match(/ETA\s+([\d:]+)/)
      if (!pct && line.length > 3) {
        try { if (fs.existsSync(line)) { job.filepath=line; job.filename=path.basename(line) } } catch {}
      }
      if (pct) { job.progress=parseFloat(pct[1]); if(spd)job.speed=spd[1].trim(); if(eta)job.eta=eta[1] }
      job.logs.push(line); if (job.logs.length>150) job.logs.shift()
    }
  })

  proc.stderr.on('data', chunk => {
    const l = chunk.toString().trim(); if(!l) return
    job.logs.push(l); if(job.logs.length>150) job.logs.shift()
    console.log('[yt-dlp]', l)
  })

  proc.on('close', code => {
    job.status   = code===0 ? 'done' : 'error'
    job.progress = code===0 ? 100 : job.progress
    console.log(`[job ${id}] ${code===0?'✅':'❌'} ${job.filename||'?'}`)
    setTimeout(() => { try{fs.rmSync(dir,{recursive:true,force:true})}catch{}; jobs.delete(id) }, 20*60*1000)
  })

  res.json({ id, status:'started' })
})

app.get('/api/progress/:id', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job) return res.status(404).json({ error:'Not found' })
  res.json({
    id: job.id, status: job.status,
    progress: job.progress, speed: job.speed, eta: job.eta,
    logs: job.logs.slice(-15), filename: job.filename,
    downloadUrl: job.status==='done' && job.filename
      ? `/api/file/${job.id}/${encodeURIComponent(job.filename)}` : null
  })
})

// KEY: Stream file to browser → browser shows "Save As" dialog
app.get('/api/file/:id/:filename', (req, res) => {
  const job = jobs.get(Number(req.params.id))
  if (!job?.filepath || !fs.existsSync(job.filepath)) return res.status(404).send('File not found')
  if (job.status !== 'done') return res.status(400).send('Not ready')
  const name = path.basename(job.filepath)
  const stat = fs.statSync(job.filepath)
  console.log(`[stream] → ${name} (${(stat.size/1024/1024).toFixed(1)} MB)`)
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'no-cache')
  fs.createReadStream(job.filepath).pipe(res)
})

app.get('/api/open-folder', (_req, res) => {
  if (IS_CLOUD) return res.json({ ok:false })
  try {
    const p = dlDest()
    if (process.platform==='win32') spawn('explorer',[p],{detached:true,shell:true})
    else if (process.platform==='darwin') spawn('open',[p],{detached:true})
    else spawn('xdg-open',[p],{detached:true})
    res.json({ ok:true })
  } catch { res.json({ ok:false }) }
})

// SPA fallback
app.get('*', (req, res) => {
  const idx = path.join(__dirname,'dist','index.html')
  if (fs.existsSync(idx)) res.sendFile(idx)
  else res.send('Run npm run build first, or npm run dev for development')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 YTGrab Web → http://localhost:${PORT}`)
  console.log(`📁 Downloads → ${dlDest()}`)
  console.log(`🔧 yt-dlp   → ${getYtDlp()||'NOT FOUND'}`)
  console.log(`🍪 Cookies  → ${fs.existsSync(COOKIE_F)?'✅':'⚠️  not uploaded'}\n`)
})
