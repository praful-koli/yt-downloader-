import { useState, useEffect, useRef } from 'react'
import { useDownload } from './hooks/useDownload'

const FORMATS = [
  { val:'video',      emoji:'🎬', label:'Video + Audio', sub:'MP4'    },
  { val:'audio',      emoji:'🎵', label:'Audio Only',    sub:'MP3'    },
  { val:'video-only', emoji:'📹', label:'Video Only',    sub:'Silent' },
  { val:'webm',       emoji:'🌐', label:'WebM',          sub:'Browser'},
]

const QUALITIES = [
  { val:'4k',   label:'4K',  sub:'2160p' },
  { val:'1080p',label:'FHD', sub:'1080p' },
  { val:'720p', label:'HD',  sub:'720p'  },
  { val:'480p', label:'SD',  sub:'480p'  },
  { val:'360p', label:'360p',sub:'Low'   },
  { val:'240p', label:'240p',sub:'Tiny'  },
  { val:'144p', label:'144p',sub:'Min'   },
  { val:'best', label:'BEST',sub:'Auto'  },
]

export default function App() {
  const [url,        setUrl]        = useState('')
  const [format,     setFormat]     = useState('video')
  const [quality,    setQuality]    = useState('720p')
  const [audioFmt,   setAudioFmt]   = useState('mp3')
  const [audioBit,   setAudioBit]   = useState('192')
  const [browser,    setBrowser]    = useState('')
  const [subtitles,  setSubtitles]  = useState(false)
  const [playlist,   setPlaylist]   = useState(false)
  const [serverMode, setServerMode] = useState(null)
  const [hasCookies, setHasCookies] = useState(false)
  const [cookieMsg,  setCookieMsg]  = useState('')
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef()
  const logRef  = useRef()

  const { status, progress, speed, eta, logs, filename, dlUrl, startDownload, triggerBrowserDownload, reset } = useDownload()

  useEffect(() => {
    fetch('/api/status').then(r=>r.json()).then(d=>{ setServerMode(d.mode); setHasCookies(d.hasCookies) }).catch(()=>setServerMode('offline'))
  }, [])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])

  const handleDownload = () => {
    if (!url.trim()) return
    startDownload({ url:url.trim(), format, quality, audioFormat:audioFmt, audioBitrate:audioBit, subtitles, playlist, browser })
  }

  const handleCookieFile = async (file) => {
    if (!file) return
    setUploading(true); setCookieMsg('')
    try {
      const text = await file.text()
      const r = await fetch('/api/upload-cookies', { method:'POST', headers:{'Content-Type':'text/plain'}, body:text })
      const d = await r.json()
      if (d.ok) { setHasCookies(true); setCookieMsg('✅ Cookies saved! (' + d.lines + ' entries)') }
      else setCookieMsg('❌ ' + (d.error||'Failed'))
    } catch(e) { setCookieMsg('❌ ' + e.message) }
    setUploading(false)
  }

  const isRunning = status==='downloading'||status==='starting'
  const isDone    = status==='done'
  const isError   = status==='error'

  const statusText =
    status==='starting' ? 'Connecting...' :
    isDone              ? '✅ Complete!' :
    isError             ? '❌ Failed' :
    progress < 20       ? 'Starting...' :
    progress < 60       ? 'Downloading...' :
    progress < 90       ? 'Almost done...' : 'Finishing...'

  return (
    <div style={{minHeight:'100vh',position:'relative'}}>
      {/* BG grid */}
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',backgroundSize:'52px 52px'}}/>
      <div style={{position:'fixed',top:-200,left:'50%',transform:'translateX(-50%)',width:700,height:500,borderRadius:'50%',pointerEvents:'none',zIndex:0,background:'radial-gradient(circle,rgba(255,0,0,0.08) 0%,transparent 65%)',filter:'blur(60px)'}}/>

      {/* NAV */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(8,8,9,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)'}}>
        <div style={{maxWidth:1000,margin:'0 auto',padding:'0 24px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,background:'var(--red)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 14px rgba(255,0,0,0.4)'}}>
              <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-2.75 12.64 12.64 0 00-7.64 0A4.83 4.83 0 014.41 6.69 28 28 0 003 12a28 28 0 001.41 5.31 4.83 4.83 0 003.77 2.75 12.64 12.64 0 007.64 0 4.83 4.83 0 003.77-2.75A28 28 0 0021 12a28 28 0 00-1.41-5.31zM10 15V9l5 3z"/></svg>
            </div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2}}>YT<span style={{color:'var(--red)'}}>GRAB</span></span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:serverMode==='offline'?'var(--orange)':'var(--green)',animation:serverMode&&serverMode!=='offline'?'pulse 2s infinite':'none'}}/>
            <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'var(--text2)'}}>
              {serverMode==='render'?'RENDER CLOUD':serverMode==='local'?'LOCAL':serverMode==='offline'?'OFFLINE':'...'}
            </span>
          </div>
        </div>
      </nav>

      <main style={{position:'relative',zIndex:1,paddingTop:58}}>
        {/* HERO */}
        <section style={{textAlign:'center',padding:'72px 24px 48px'}}>
          <div style={{display:'inline-block',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--red)',letterSpacing:3,marginBottom:20,background:'rgba(255,0,0,0.07)',border:'1px solid rgba(255,0,0,0.15)',padding:'5px 14px',borderRadius:50}}>⚡ POWERED BY YT-DLP</div>
          <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(52px,9vw,88px)',lineHeight:.95,letterSpacing:2,marginBottom:20,animation:'fadeUp 0.5s ease both'}}>
            Download Any<br/><span style={{color:'var(--red)'}}>YouTube Video</span>
          </h1>
          <p style={{fontSize:15,color:'var(--text2)',lineHeight:1.7,marginBottom:44,animation:'fadeUp 0.5s 0.1s ease both',opacity:0,animationFillMode:'forwards'}}>
            720p · 1080p · 4K · MP3 · No ads · No limits<br/>
            Click Download → choose where to save → file downloads to your PC
          </p>
          <div style={{maxWidth:700,margin:'0 auto',animation:'fadeUp 0.5s 0.2s ease both',opacity:0,animationFillMode:'forwards'}}>
            <URLInput url={url} onChange={setUrl} onGo={handleDownload} loading={isRunning}/>
          </div>
        </section>

        <div style={{maxWidth:920,margin:'0 auto',padding:'0 24px 80px'}}>

          {/* Cookies banner — Render only */}
          {serverMode==='render' && (
            <div style={{background:hasCookies?'rgba(74,222,128,0.06)':'rgba(251,146,60,0.06)',border:`1px solid ${hasCookies?'rgba(74,222,128,0.2)':'rgba(251,146,60,0.2)'}`,borderRadius:12,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:20}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:hasCookies?'var(--green)':'var(--orange)',marginBottom:3}}>
                  {hasCookies?'✅ Cookies active — YouTube auth loaded':'⚠️ Upload cookies.txt to fix bot detection'}
                </div>
                <div style={{fontSize:11,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>
                  {hasCookies?'Server has your YouTube cookies and will use them for downloads':'Export from youtube.com → install "Get cookies.txt LOCALLY" Chrome extension → export → upload here'}
                </div>
                {cookieMsg && <div style={{fontSize:11,marginTop:5,color:cookieMsg.startsWith('✅')?'var(--green)':'var(--red)'}}>{cookieMsg}</div>}
              </div>
              <label style={{cursor:'pointer',flexShrink:0}}>
                <input ref={fileRef} type="file" accept=".txt" style={{display:'none'}} onChange={e=>handleCookieFile(e.target.files[0])}/>
                <div style={{background:hasCookies?'rgba(74,222,128,0.1)':'var(--red)',color:hasCookies?'var(--green)':'white',border:hasCookies?'1px solid rgba(74,222,128,0.3)':'none',borderRadius:8,padding:'9px 18px',fontSize:12,fontWeight:700,opacity:uploading?.6:1,whiteSpace:'nowrap'}}>
                  {uploading?'⏳ Uploading...':hasCookies?'🔄 Update Cookies':'📄 Upload cookies.txt'}
                </div>
              </label>
            </div>
          )}

          {/* MAIN PANEL */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,padding:32,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,var(--red),transparent)',opacity:.6}}/>

            {/* FORMAT */}
            <Label n="01" t="Format"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:28}}>
              {FORMATS.map(f=><FmtCard key={f.val} {...f} active={format===f.val} onClick={()=>setFormat(f.val)}/>)}
            </div>

            {/* QUALITY */}
            {format!=='audio' && <>
              <Label n="02" t="Quality"/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:28}}>
                {QUALITIES.map(q=><QBtn key={q.val} {...q} active={quality===q.val} onClick={()=>setQuality(q.val)}/>)}
              </div>
            </>}

            {/* OPTIONS */}
            <Label n={format!=='audio'?'03':'02'} t="Options"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:28}}>
              {format==='audio' && <>
                <Sel label="Audio Format" val={audioFmt} set={setAudioFmt} opts={['mp3','m4a','wav','flac','ogg','opus']}/>
                <Sel label="Bitrate" val={audioBit} set={setAudioBit} opts={[{v:'320',l:'320kbps'},{v:'256',l:'256kbps'},{v:'192',l:'192kbps'},{v:'128',l:'128kbps'}]}/>
              </>}
              {serverMode!=='render' && <Sel label="Browser Cookies" val={browser} set={setBrowser} opts={[{v:'',l:'None'},{v:'chrome',l:'Chrome'},{v:'edge',l:'Edge'},{v:'firefox',l:'Firefox'},{v:'brave',l:'Brave'}]}/>}
              <Tog label="Embed Subtitles" val={subtitles} set={setSubtitles}/>
              <Tog label="Playlist Mode" val={playlist} set={setPlaylist}/>
            </div>

            {/* DOWNLOAD BTN */}
            <DlBtn loading={isRunning} done={isDone} hasUrl={!!url.trim()}
              onClick={handleDownload} onReset={reset}
              onSaveAgain={()=>triggerBrowserDownload(dlUrl,filename)}/>

            {/* PROGRESS */}
            {status!=='idle' && (
              <div style={{marginTop:20,animation:'fadeUp 0.3s ease'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={{fontSize:12,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>{statusText}</span>
                  <span style={{fontSize:15,fontWeight:700,color:isDone?'var(--green)':isError?'var(--red)':'var(--red)',fontFamily:"'JetBrains Mono',monospace"}}>{Math.floor(progress)}%</span>
                </div>
                <div style={{background:'var(--surface3)',borderRadius:50,height:6,overflow:'hidden',marginBottom:8}}>
                  <div style={{height:'100%',borderRadius:50,width:`${progress}%`,background:isDone?'linear-gradient(90deg,var(--green),#86efac)':isError?'var(--red)':'linear-gradient(90deg,var(--red),#ff6b6b)',boxShadow:isDone?'0 0 8px rgba(74,222,128,0.6)':'0 0 8px rgba(255,0,0,0.5)',transition:'width 0.4s ease'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text3)',fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>
                  <span>{speed?`⚡ ${speed}`:''}</span>
                  <span>{eta?`⏱ ETA: ${eta}`:''}</span>
                </div>
                <div ref={logRef} style={{background:'#050506',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',maxHeight:130,overflowY:'auto',fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--text3)',lineHeight:1.7,wordBreak:'break-all'}}>
                  {logs.map((l,i)=><div key={i}>{l}</div>)}
                </div>

                {/* SUCCESS */}
                {isDone && filename && (
                  <div style={{display:'flex',alignItems:'center',gap:16,background:'rgba(74,222,128,0.07)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:14,padding:'18px 22px',marginTop:16,animation:'fadeUp 0.4s ease'}}>
                    <span style={{fontSize:28,flexShrink:0}}>✅</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--green)',marginBottom:4}}>Download Complete!</div>
                      <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{filename}</div>
                      <div style={{fontSize:11,color:'var(--text2)'}}>A Save dialog appeared — choose your folder and save the file to your PC</div>
                    </div>
                    {dlUrl && <button onClick={()=>triggerBrowserDownload(dlUrl,filename)} style={{background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.3)',color:'var(--green)',borderRadius:9,padding:'9px 16px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>↓ Save Again</button>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* HOW IT WORKS */}
          <div style={{marginTop:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:'28px 32px'}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--red)',letterSpacing:3,marginBottom:20}}>HOW IT WORKS</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:24}}>
              {[
                {n:'01',t:'Paste URL',d:'Paste any YouTube video or playlist link above'},
                {n:'02',t:'Pick Options',d:'Format (MP4/MP3), quality (4K/1080p/720p/audio), and more'},
                {n:'03',t:'Click Download',d:'Server processes and downloads the video file using yt-dlp'},
                {n:'04',t:'Save to PC',d:'Browser shows a Save dialog — pick your folder, file saves directly to your PC'},
              ].map(s=>(
                <div key={s.n}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,color:'rgba(255,0,0,0.15)',lineHeight:1,marginBottom:6}}>{s.n}</div>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{s.t}</div>
                  <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer style={{borderTop:'1px solid var(--border)',padding:'28px 24px',textAlign:'center',position:'relative',zIndex:1}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,marginBottom:6}}>YT<span style={{color:'var(--red)'}}>GRAB</span></div>
        <p style={{fontSize:11,color:'var(--text3)'}}>Only download content you have permission to download • Respect copyright</p>
      </footer>
    </div>
  )
}

/* ── Small components ──────────────────────────────────────────────────────── */

function URLInput({url,onChange,onGo,loading}) {
  const [f,setF]=useState(false)
  return (
    <div style={{display:'flex',alignItems:'center',background:'var(--surface)',border:`1px solid ${f?'var(--red)':'var(--border2)'}`,borderRadius:14,padding:'8px 8px 8px 18px',gap:10,boxShadow:f?'0 0 0 3px rgba(255,0,0,0.1),0 8px 40px rgba(0,0,0,0.4)':'none',transition:'all 0.2s'}}>
      <span style={{fontSize:17,flexShrink:0}}>🔗</span>
      <input value={url} onChange={e=>onChange(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onGo()} onFocus={()=>setF(true)} onBlur={()=>setF(false)} placeholder="Paste YouTube URL here..." style={{flex:1,background:'none',border:'none',outline:'none',color:'var(--text)',fontFamily:"'JetBrains Mono',monospace",fontSize:13}}/>
      <button onClick={onGo} disabled={loading||!url.trim()} style={{background:'var(--red)',color:'white',border:'none',borderRadius:10,padding:'13px 24px',fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:2,cursor:loading||!url.trim()?'not-allowed':'pointer',opacity:!url.trim()?.5:1,transition:'all 0.2s',flexShrink:0,boxShadow:'0 4px 18px rgba(255,0,0,0.25)',display:'flex',alignItems:'center',gap:8}}>
        {loading?<><Spin/>LOADING</>:'DOWNLOAD'}
      </button>
    </div>
  )
}

function Label({n,t}) {
  return <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--red)',letterSpacing:1}}>{n}</span><span style={{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text2)'}}>{t}</span></div>
}

function FmtCard({emoji,label,sub,active,onClick}) {
  const [h,setH]=useState(false)
  return <div onClick={onClick} onMouseOver={()=>setH(true)} onMouseOut={()=>setH(false)} style={{background:active?'rgba(255,0,0,0.07)':h?'var(--surface3)':'var(--surface2)',border:`1px solid ${active?'var(--red)':h?'var(--border2)':'var(--border)'}`,borderRadius:12,padding:'14px 10px',cursor:'pointer',textAlign:'center',transition:'all 0.18s',transform:h&&!active?'translateY(-1px)':'none'}}><div style={{fontSize:22,marginBottom:6}}>{emoji}</div><div style={{fontSize:11,fontWeight:700,marginBottom:2}}>{label}</div><div style={{fontSize:9,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>{sub}</div></div>
}

function QBtn({label,sub,active,onClick}) {
  const [h,setH]=useState(false)
  return <button onClick={onClick} onMouseOver={()=>setH(true)} onMouseOut={()=>setH(false)} style={{background:active?'rgba(255,0,0,0.07)':h?'var(--surface3)':'var(--surface2)',border:`1px solid ${active?'var(--red)':h?'var(--border2)':'var(--border)'}`,borderRadius:10,padding:'9px 6px',cursor:'pointer',textAlign:'center',transition:'all 0.18s',display:'flex',flexDirection:'column',gap:2,alignItems:'center'}}><span style={{fontSize:11,fontWeight:800,color:'var(--text)'}}>{label}</span><span style={{fontSize:9,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>{sub}</span></button>
}

function Sel({label,val,set,opts}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,gap:12}}><span style={{fontSize:12,fontWeight:600}}>{label}</span><select value={val} onChange={e=>set(e.target.value)} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:6,padding:'5px 8px',color:'var(--text)',fontFamily:"'JetBrains Mono',monospace",fontSize:11,outline:'none',cursor:'pointer'}}>{opts.map(o=>typeof o==='string'?<option key={o} value={o}>{o.toUpperCase()}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
}

function Tog({label,val,set}) {
  return <div onClick={()=>set(!val)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,gap:12,cursor:'pointer'}}><span style={{fontSize:12,fontWeight:600}}>{label}</span><div style={{width:38,height:21,borderRadius:50,background:val?'var(--red)':'var(--surface3)',border:`1px solid ${val?'var(--red)':'var(--border2)'}`,position:'relative',transition:'all 0.2s',flexShrink:0}}><div style={{position:'absolute',width:14,height:14,borderRadius:'50%',background:val?'white':'var(--text3)',top:3,left:val?21:3,transition:'all 0.2s'}}/></div></div>
}

function DlBtn({loading,done,hasUrl,onClick,onReset,onSaveAgain}) {
  const [h,setH]=useState(false)
  if (done) return <div style={{display:'flex',gap:10}}><button onClick={onSaveAgain} style={{flex:1,background:'var(--green)',color:'#070708',border:'none',borderRadius:12,padding:17,fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:3,cursor:'pointer',boxShadow:'0 4px 20px rgba(74,222,128,0.3)'}}>↓ SAVE FILE AGAIN</button><button onClick={onReset} style={{background:'var(--surface2)',border:'1px solid var(--border2)',color:'var(--text2)',borderRadius:12,padding:'17px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:'pointer'}}>NEW</button></div>
  return <button onClick={onClick} disabled={loading||!hasUrl} onMouseOver={()=>setH(true)} onMouseOut={()=>setH(false)} style={{width:'100%',background:'var(--red)',color:'white',border:'none',borderRadius:13,padding:18,fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:3,cursor:loading||!hasUrl?'not-allowed':'pointer',opacity:!hasUrl?.5:1,transition:'all 0.2s',transform:h&&!loading&&hasUrl?'translateY(-1px)':'translateY(0)',boxShadow:h&&!loading&&hasUrl?'0 8px 36px rgba(255,0,0,0.45)':'0 4px 18px rgba(255,0,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
    {loading?<><Spin/>DOWNLOADING...</>:<><span style={{fontSize:20}}>↓</span>DOWNLOAD NOW</>}
  </button>
}

function Spin() {
  return <span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>
}
