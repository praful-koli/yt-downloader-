import { useState } from 'react'

const FORMATS = [
  { val:'video',      emoji:'🎬', label:'Video + Audio', sub:'MP4'     },
  { val:'audio',      emoji:'🎵', label:'Audio Only',    sub:'MP3/M4A' },
  { val:'video-only', emoji:'📹', label:'Video Only',    sub:'No Sound'},
  { val:'webm',       emoji:'🌐', label:'WebM',          sub:'Browser' },
]

const QUALITIES = [
  { val:'4k',   label:'4K',  sub:'2160p' },
  { val:'1080p',label:'FHD', sub:'1080p' },
  { val:'720p', label:'HD',  sub:'720p'  },
  { val:'480p', label:'SD',  sub:'480p'  },
  { val:'360p', label:'360', sub:'Low'   },
  { val:'240p', label:'240', sub:'Tiny'  },
  { val:'144p', label:'144', sub:'Min'   },
  { val:'best', label:'BEST',sub:'Auto'  },
]

function buildCmd(url, format, quality, audioFmt, audioBit, browser, subtitles, playlist) {
  const H = {'4k':2160,'1080p':1080,'720p':720,'480p':480,'360p':360,'240p':240,'144p':144}
  const h = H[quality]
  const u = url || 'YOUR_URL_HERE'
  let cmd = 'yt-dlp'
  if (format==='audio')      cmd += ` -x --audio-format ${audioFmt} --audio-quality ${audioBit}K`
  else if (format==='video-only') cmd += h ? ` -f "bestvideo[height<=${h}]"` : ` -f "bestvideo"`
  else if (format==='webm')  cmd += h ? ` -f "bestvideo[height<=${h}][ext=webm]+bestaudio/best[height<=${h}]" --merge-output-format webm` : ` -f "bestvideo[ext=webm]+bestaudio" --merge-output-format webm`
  else cmd += h ? ` -f "bestvideo[height<=${h}]+bestaudio/best[height<=${h}]" --merge-output-format mp4` : ` -f "bestvideo+bestaudio" --merge-output-format mp4`
  cmd += ' --js-runtimes node --remote-components ejs:github'
  if (browser) cmd += ` --cookies-from-browser ${browser}`
  if (subtitles) cmd += ' --write-subs --embed-subs'
  if (!playlist) cmd += ' --no-playlist'
  cmd += ' --output "%(title)s.%(ext)s"'
  cmd += ` "${u}"`
  return cmd
}

export default function App() {
  const [url,       setUrl]       = useState('')
  const [format,    setFormat]    = useState('video')
  const [quality,   setQuality]   = useState('720p')
  const [audioFmt,  setAudioFmt]  = useState('mp3')
  const [audioBit,  setAudioBit]  = useState('192')
  const [browser,   setBrowser]   = useState('chrome')
  const [subtitles, setSubtitles] = useState(false)
  const [playlist,  setPlaylist]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [step,      setStep]      = useState(1) // 1=options, 2=install, 3=run

  const cmd = buildCmd(url, format, quality, audioFmt, audioBit, browser, subtitles, playlist)

  const copy = () => {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{minHeight:'100vh', position:'relative'}}>
      {/* BG */}
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',backgroundSize:'52px 52px'}}/>
      <div style={{position:'fixed',top:-200,left:'50%',transform:'translateX(-50%)',width:800,height:600,pointerEvents:'none',zIndex:0,background:'radial-gradient(ellipse,rgba(255,0,0,0.07) 0%,transparent 65%)',filter:'blur(80px)'}}/>

      {/* NAV */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(8,8,9,0.93)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)'}}>
        <div style={{maxWidth:1000,margin:'0 auto',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:28,height:28,background:'var(--red)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 12px rgba(255,0,0,0.4)'}}>
              <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-2.75 12.64 12.64 0 00-7.64 0A4.83 4.83 0 014.41 6.69 28 28 0 003 12a28 28 0 001.41 5.31 4.83 4.83 0 003.77 2.75 12.64 12.64 0 007.64 0 4.83 4.83 0 003.77-2.75A28 28 0 0021 12a28 28 0 00-1.41-5.31zM10 15V9l5 3z"/></svg>
            </div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:2}}>YT<span style={{color:'var(--red)'}}>GRAB</span></span>
          </div>
          <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:'var(--text3)',letterSpacing:1}}>COMMAND GENERATOR</span>
        </div>
      </nav>

      <main style={{position:'relative',zIndex:1,paddingTop:56}}>

        {/* HERO */}
        <section style={{textAlign:'center',padding:'64px 24px 48px'}}>
          <div style={{display:'inline-block',fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--red)',letterSpacing:3,marginBottom:18,background:'rgba(255,0,0,0.07)',border:'1px solid rgba(255,0,0,0.15)',padding:'4px 14px',borderRadius:50}}>⚡ POWERED BY YT-DLP</div>
          <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(48px,8vw,84px)',lineHeight:.95,letterSpacing:2,marginBottom:18,animation:'fadeUp 0.5s ease both'}}>
            Download Any<br/><span style={{color:'var(--red)'}}>YouTube Video</span>
          </h1>
          <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.7,marginBottom:16,animation:'fadeUp 0.5s 0.1s ease both',opacity:0,animationFillMode:'forwards'}}>
            4K · 1080p · 720p · MP3 · Playlists · No ads · No limits
          </p>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:8,padding:'8px 16px',fontSize:12,color:'var(--orange)',fontFamily:"'JetBrains Mono',monospace",animation:'fadeUp 0.5s 0.15s ease both',opacity:0,animationFillMode:'forwards'}}>
            ⚠️ This tool generates a command you run in your PC terminal
          </div>
        </section>

        <div style={{maxWidth:900,margin:'0 auto',padding:'0 24px 80px'}}>

          {/* URL INPUT */}
          <div style={{marginBottom:20,animation:'fadeUp 0.5s 0.2s ease both',opacity:0,animationFillMode:'forwards'}}>
            <URLInput url={url} onChange={setUrl}/>
          </div>

          {/* MAIN PANEL */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,padding:28,marginBottom:16,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,var(--red),transparent)',opacity:.5}}/>

            {/* FORMAT */}
            <Lbl n="01" t="Format"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:24}}>
              {FORMATS.map(f=><FCard key={f.val} {...f} active={format===f.val} onClick={()=>setFormat(f.val)}/>)}
            </div>

            {/* QUALITY */}
            {format!=='audio' && <>
              <Lbl n="02" t="Quality"/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:24}}>
                {QUALITIES.map(q=><QBtn key={q.val} {...q} active={quality===q.val} onClick={()=>setQuality(q.val)}/>)}
              </div>
            </>}

            {/* OPTIONS */}
            <Lbl n={format!=='audio'?'03':'02'} t="Options"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:24}}>
              {format==='audio' && <>
                <Sel label="Audio Format" val={audioFmt} set={setAudioFmt} opts={['mp3','m4a','wav','flac','ogg','opus']}/>
                <Sel label="Bitrate" val={audioBit} set={setAudioBit} opts={[{v:'320',l:'320kbps'},{v:'256',l:'256kbps'},{v:'192',l:'192kbps'},{v:'128',l:'128kbps'}]}/>
              </>}
              <Sel label="Browser Cookies" val={browser} set={setBrowser} opts={[{v:'chrome',l:'Chrome'},{v:'edge',l:'Edge'},{v:'firefox',l:'Firefox'},{v:'brave',l:'Brave'},{v:'',l:'None'}]}/>
              <Tog label="Embed Subtitles" val={subtitles} set={setSubtitles}/>
              <Tog label="Playlist Mode"   val={playlist}  set={setPlaylist}/>
            </div>

            {/* COMMAND BOX */}
            <div style={{background:'#050506',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{width:9,height:9,borderRadius:'50%',background:c}}/>)}
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--text3)',marginLeft:6,letterSpacing:.5}}>terminal command</span>
                </div>
                <button onClick={copy} style={{background:copied?'rgba(74,222,128,0.1)':'var(--surface3)',border:`1px solid ${copied?'rgba(74,222,128,0.3)':'var(--border2)'}`,color:copied?'var(--green)':'var(--text2)',fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:'4px 12px',borderRadius:5,cursor:'pointer',transition:'all 0.2s'}}>
                  {copied?'✓ Copied!':'📋 Copy'}
                </button>
              </div>
              <div style={{padding:'14px 16px',fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#4ade80',wordBreak:'break-all',lineHeight:1.8,display:'flex',gap:10}}>
                <span style={{color:'var(--text3)',flexShrink:0,userSelect:'none'}}>$</span>
                <span>{cmd}</span>
              </div>
            </div>

            {/* BIG COPY BUTTON */}
            <button onClick={copy} style={{
              width:'100%',marginTop:12,background:copied?'rgba(74,222,128,0.12)':'var(--red)',
              color:copied?'var(--green)':'white',border:copied?'1px solid rgba(74,222,128,0.3)':'none',
              borderRadius:12,padding:16,fontFamily:"'Bebas Neue',sans-serif",
              fontSize:20,letterSpacing:3,cursor:'pointer',transition:'all 0.2s',
              boxShadow:copied?'0 4px 20px rgba(74,222,128,0.2)':'0 4px 20px rgba(255,0,0,0.25)',
              display:'flex',alignItems:'center',justifyContent:'center',gap:10,
            }}>
              {copied ? '✓ COMMAND COPIED!' : '📋 COPY COMMAND'}
            </button>
          </div>

          {/* HOW TO RUN — 3 steps */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:28}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--red)',letterSpacing:3,marginBottom:20}}>HOW TO RUN IT ON YOUR PC</div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:20,marginBottom:28}}>
              {[
                { n:'01', t:'Install yt-dlp', cmd:'pip install yt-dlp', desc:'Run this in PowerShell / CMD first (only once)' },
                { n:'02', t:'Install FFmpeg', cmd:'winget install ffmpeg', desc:'Required to merge video + audio into MP4' },
                { n:'03', t:'Copy & Run', cmd: url ? cmd.slice(0,40)+'...' : 'Copy the command above', desc:'Paste in PowerShell and hit Enter — file saves to current folder' },
              ].map(s => <StepCard key={s.n} {...s}/>)}
            </div>

            {/* Tip boxes */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <TipBox icon="🍪" title="Bot error?" text='Close Chrome → run the command → it uses your login cookies automatically' color='orange'/>
              <TipBox icon="📁" title="Where does it save?" text='In whatever folder your terminal is open in. Type explorer . to open it' color='green'/>
              <TipBox icon="⚡" title="pip not found?" text='Reinstall Python from python.org and check "Add to PATH" during install' color='orange'/>
              <TipBox icon="🔧" title="Need Node.js?" text='The command includes --js-runtimes node which needs Node.js installed from nodejs.org' color='green'/>
            </div>
          </div>

        </div>
      </main>

      <footer style={{borderTop:'1px solid var(--border)',padding:'24px',textAlign:'center',position:'relative',zIndex:1}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,marginBottom:6}}>YT<span style={{color:'var(--red)'}}>GRAB</span></div>
        <p style={{fontSize:11,color:'var(--text3)'}}>Only download content you own or have permission to download</p>
      </footer>
    </div>
  )
}

/* ── Components ────────────────────────────────────────────────────────────── */

function URLInput({url, onChange}) {
  const [f,setF]=useState(false)
  return (
    <div style={{display:'flex',alignItems:'center',background:'var(--surface)',border:`1px solid ${f?'var(--red)':'var(--border2)'}`,borderRadius:14,padding:'8px 8px 8px 18px',gap:10,boxShadow:f?'0 0 0 3px rgba(255,0,0,0.1)':'none',transition:'all 0.2s'}}>
      <span style={{fontSize:16,flexShrink:0}}>🔗</span>
      <input value={url} onChange={e=>onChange(e.target.value)} onFocus={()=>setF(true)} onBlur={()=>setF(false)} placeholder="Paste YouTube URL here to include it in the command..." style={{flex:1,background:'none',border:'none',outline:'none',color:'var(--text)',fontFamily:"'JetBrains Mono',monospace",fontSize:13}}/>
    </div>
  )
}

function Lbl({n,t}) {
  return <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--red)',letterSpacing:1}}>{n}</span><span style={{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text2)'}}>{t}</span></div>
}

function FCard({emoji,label,sub,active,onClick}) {
  const [h,setH]=useState(false)
  return <div onClick={onClick} onMouseOver={()=>setH(true)} onMouseOut={()=>setH(false)} style={{background:active?'rgba(255,0,0,0.07)':h?'var(--surface3)':'var(--surface2)',border:`1px solid ${active?'var(--red)':h?'var(--border2)':'var(--border)'}`,borderRadius:11,padding:'13px 8px',cursor:'pointer',textAlign:'center',transition:'all 0.15s',transform:h&&!active?'translateY(-1px)':'none'}}><div style={{fontSize:20,marginBottom:5}}>{emoji}</div><div style={{fontSize:10,fontWeight:700,marginBottom:1}}>{label}</div><div style={{fontSize:9,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>{sub}</div></div>
}

function QBtn({label,sub,active,onClick}) {
  const [h,setH]=useState(false)
  return <button onClick={onClick} onMouseOver={()=>setH(true)} onMouseOut={()=>setH(false)} style={{background:active?'rgba(255,0,0,0.07)':h?'var(--surface3)':'var(--surface2)',border:`1px solid ${active?'var(--red)':h?'var(--border2)':'var(--border)'}`,borderRadius:9,padding:'8px 4px',cursor:'pointer',textAlign:'center',transition:'all 0.15s',display:'flex',flexDirection:'column',gap:2,alignItems:'center'}}><span style={{fontSize:10,fontWeight:800,color:'var(--text)'}}>{label}</span><span style={{fontSize:8,color:'var(--text2)',fontFamily:"'JetBrains Mono',monospace"}}>{sub}</span></button>
}

function Sel({label,val,set,opts}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 13px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:9,gap:10}}><span style={{fontSize:11,fontWeight:600}}>{label}</span><select value={val} onChange={e=>set(e.target.value)} style={{background:'var(--surface3)',border:'1px solid var(--border2)',borderRadius:5,padding:'4px 8px',color:'var(--text)',fontFamily:"'JetBrains Mono',monospace",fontSize:10,outline:'none',cursor:'pointer'}}>{opts.map(o=>typeof o==='string'?<option key={o} value={o}>{o.toUpperCase()}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
}

function Tog({label,val,set}) {
  return <div onClick={()=>set(!val)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 13px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:9,gap:10,cursor:'pointer'}}><span style={{fontSize:11,fontWeight:600}}>{label}</span><div style={{width:36,height:20,borderRadius:50,background:val?'var(--red)':'var(--surface3)',border:`1px solid ${val?'var(--red)':'var(--border2)'}`,position:'relative',transition:'all 0.2s',flexShrink:0}}><div style={{position:'absolute',width:13,height:13,borderRadius:'50%',background:val?'white':'var(--text3)',top:3,left:val?20:3,transition:'all 0.2s'}}/></div></div>
}

function StepCard({n,t,cmd,desc}) {
  const [copied,setCopied]=useState(false)
  const copy=()=>{navigator.clipboard.writeText(cmd);setCopied(true);setTimeout(()=>setCopied(false),1500)}
  return (
    <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:'rgba(255,0,0,0.18)',lineHeight:1,marginBottom:6}}>{n}</div>
      <div style={{fontSize:13,fontWeight:700,marginBottom:5}}>{t}</div>
      <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.6,marginBottom:10}}>{desc}</div>
      <div style={{background:'#050506',border:'1px solid var(--border)',borderRadius:7,padding:'7px 10px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--green)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cmd}</span>
        <button onClick={copy} style={{background:'var(--surface3)',border:'1px solid var(--border2)',color:copied?'var(--green)':'var(--text2)',fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:'2px 7px',borderRadius:3,cursor:'pointer',flexShrink:0,transition:'all 0.2s'}}>{copied?'✓':'copy'}</button>
      </div>
    </div>
  )
}

function TipBox({icon,title,text,color}) {
  const c = color==='orange'?'rgba(251,146,60,':'rgba(74,222,128,'
  return (
    <div style={{background:`${c}0.05)`,border:`1px solid ${c}0.15)`,borderRadius:10,padding:'12px 14px'}}>
      <div style={{fontSize:12,fontWeight:700,color:color==='orange'?'var(--orange)':'var(--green)',marginBottom:4}}>{icon} {title}</div>
      <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.5}}>{text}</div>
    </div>
  )
}
