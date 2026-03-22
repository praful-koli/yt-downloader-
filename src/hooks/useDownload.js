import { useState, useRef, useCallback } from 'react'

export function useDownload() {
  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState(0)
  const [speed,    setSpeed]    = useState('')
  const [eta,      setEta]      = useState('')
  const [logs,     setLogs]     = useState([])
  const [filename, setFilename] = useState('')
  const [dlUrl,    setDlUrl]    = useState('')
  const timerRef = useRef(null)

  const addLog = (l) => setLogs(p => [...p.slice(-80), l])

  const startDownload = useCallback(async (params) => {
    setStatus('starting'); setProgress(0)
    setSpeed(''); setEta(''); setLogs([]); setFilename(''); setDlUrl('')

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')

      setStatus('downloading')
      addLog('▶ Download started on server...')

      // Poll for progress
      timerRef.current = setInterval(async () => {
        try {
          const r  = await fetch(`/api/progress/${data.id}`)
          const d  = await r.json()

          setProgress(d.progress || 0)
          if (d.speed)    setSpeed(d.speed)
          if (d.eta)      setEta(d.eta)
          if (d.logs?.length) setLogs(prev => [...prev, ...d.logs].slice(-80))

          if (d.status === 'done') {
            clearInterval(timerRef.current)
            setStatus('done')
            setProgress(100)
            setFilename(d.filename || '')

            if (d.downloadUrl) {
              setDlUrl(d.downloadUrl)
              // KEY: trigger browser save-as dialog automatically
              triggerBrowserDownload(d.downloadUrl, d.filename)
            }
          } else if (d.status === 'error') {
            clearInterval(timerRef.current)
            setStatus('error')
          }
        } catch {}
      }, 800)

    } catch (err) {
      setStatus('error')
      addLog('❌ ' + err.message)
    }
  }, [])

  const triggerBrowserDownload = (url, name) => {
    // This creates an invisible <a> tag and clicks it
    // Browser shows "Save As" dialog (where to save) before downloading
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'video'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const reset = useCallback(() => {
    clearInterval(timerRef.current)
    setStatus('idle'); setProgress(0)
    setSpeed(''); setEta(''); setLogs([]); setFilename(''); setDlUrl('')
  }, [])

  return { status, progress, speed, eta, logs, filename, dlUrl, startDownload, triggerBrowserDownload, reset }
}
