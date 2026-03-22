const express = require('express')
const path    = require('path')
const fs      = require('fs')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(express.static(path.join(__dirname, 'dist')))

// Health check
app.get('/api/status', (_req, res) => res.json({ ok: true }))

// SPA fallback
app.get('*', (_req, res) => {
  const idx = path.join(__dirname, 'dist', 'index.html')
  fs.existsSync(idx) ? res.sendFile(idx) : res.send('Run npm run build first')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 YTGrab → http://localhost:${PORT}\n`)
})
