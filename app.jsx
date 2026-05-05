// CriptoHouse — App principal

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR } = React;

// --- Auth & persistence ---
const CH_PASS_KEY  = 'ch_pass';
const CH_DATA_KEY  = 'ch_udata';

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function loadUserData() {
  try {
    const raw = localStorage.getItem(CH_DATA_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.accounts)   window.CH_DATA.accounts   = d.accounts;
    if (d.holdings)   window.CH_DATA.holdings   = d.holdings;
    if (d.positions)  window.CH_DATA.positions  = d.positions;
    if (d.strategies) window.CH_DATA.strategies = d.strategies;
    if (d.airdrops)   window.CH_DATA.airdrops   = d.airdrops;
  } catch(e) { console.error('loadUserData', e); }
}

function saveUserData() {
  const d = window.CH_DATA;
  try {
    localStorage.setItem(CH_DATA_KEY, JSON.stringify({
      accounts: d.accounts, holdings: d.holdings,
      positions: d.positions, strategies: d.strategies, airdrops: d.airdrops,
    }));
  } catch(e) { console.error('saveUserData', e); }
}
window.CH_SAVE = saveUserData;

// --- Login screen ---
function LoginScreen({ onLogin }) {
  const hasPass = !!localStorage.getItem(CH_PASS_KEY);
  const [pass, setPass]   = useS('');
  const [pass2, setPass2] = useS('');
  const [show, setShow]   = useS(false);
  const [err, setErr]     = useS('');

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!pass) return setErr('Introduce una contraseña');
    if (!hasPass) {
      if (pass.length < 4)    return setErr('Mínimo 4 caracteres');
      if (pass !== pass2)     return setErr('Las contraseñas no coinciden');
      localStorage.setItem(CH_PASS_KEY, simpleHash(pass));
    } else {
      if (simpleHash(pass) !== localStorage.getItem(CH_PASS_KEY)) {
        setPass(''); return setErr('Contraseña incorrecta');
      }
    }
    onLogin();
  };

  const sx = {
    width:'100%', background:'var(--bg-2)', border:'1px solid var(--border)',
    borderRadius:6, padding:'10px 12px', fontSize:14, color:'var(--fg-0)',
    fontFamily:'var(--font-sans)', boxSizing:'border-box', outline:'none',
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-0)', fontFamily:'var(--font-sans)' }}>
      <div style={{ width:340, background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:16, padding:36, boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:30, fontWeight:700, letterSpacing:'-0.02em', color:'var(--fg-0)' }}>
            cripto<span style={{ color:'var(--accent)' }}>house</span>
          </div>
          <div style={{ color:'var(--fg-3)', fontSize:13, marginTop:8 }}>
            {hasPass ? 'Accede a tu portfolio privado' : 'Crea tu contraseña de acceso'}
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Contraseña</label>
            <div style={{ position:'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={pass}
                onChange={e => { setPass(e.target.value); setErr(''); }}
                placeholder="••••••••"
                autoFocus
                style={{ ...sx, paddingRight:40 }}
              />
              <button type="button" onClick={() => setShow(s => !s)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--fg-3)', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
                <Icon name={show ? 'eyeOff' : 'eye'} size={14}/>
              </button>
            </div>
          </div>

          {!hasPass && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Confirmar contraseña</label>
              <input
                type={show ? 'text' : 'password'}
                value={pass2}
                onChange={e => { setPass2(e.target.value); setErr(''); }}
                placeholder="••••••••"
                style={sx}
              />
            </div>
          )}

          {err && <div style={{ color:'var(--neg)', fontSize:12, marginBottom:12 }}>{err}</div>}

          <button type="submit" className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14, marginTop:4 }}>
            {hasPass ? 'Entrar' : 'Crear contraseña'}
          </button>
        </form>

        {!hasPass && (
          <div style={{ marginTop:16, fontSize:11, color:'var(--fg-3)', textAlign:'center', lineHeight:1.5 }}>
            La contraseña se almacena localmente en tu navegador.<br/>No se envía ningún dato a servidores externos.
          </div>
        )}
      </div>
    </div>
  );
}

// --- Accents & defaults ---
const ACCENTS = {
  lime:    { color: "#c5f24a", soft: "#c5f24a26", text: "#0a0a0a", name: "Lime" },
  amber:   { color: "#f5b94a", soft: "#f5b94a26", text: "#1a0f00", name: "Amber" },
  cyan:    { color: "#5cf2c4", soft: "#5cf2c426", text: "#001b14", name: "Mint" },
  violet:  { color: "#a78bfa", soft: "#a78bfa26", text: "#0a0414", name: "Violet" },
  rose:    { color: "#ff7a7a", soft: "#ff7a7a26", text: "#1a0606", name: "Rose" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "es",
  "accent": "lime",
  "theme": "dark",
  "density": "comfortable",
  "cols": 2,
  "privacy": false
}/*EDITMODE-END*/;

// --- Main App ---
function App() {
  const [authed, setAuthed] = useS(() => sessionStorage.getItem('ch_session') === '1');

  const handleLogin = () => {
    loadUserData();
    sessionStorage.setItem('ch_session', '1');
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ch_session');
    setAuthed(false);
  };

  if (!authed) return <LoginScreen onLogin={handleLogin}/>;

  return <AppShell onLogout={handleLogout}/>;
}

function AppShell({ onLogout }) {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useS("overview");
  const [updatedAgo, setUpdatedAgo] = useS(0);
  const t = window.useI18n(tweaks.lang);
  const live = window.useLivePrices();

  useE(() => {
    const a = ACCENTS[tweaks.accent] || ACCENTS.lime;
    document.documentElement.style.setProperty("--accent", a.color);
    document.documentElement.style.setProperty("--accent-soft", a.soft);
    document.documentElement.style.setProperty("--accent-text", a.text);
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.cols = String(tweaks.cols);
    document.documentElement.dataset.privacy = String(tweaks.privacy);
  }, [tweaks]);

  useE(() => {
    setUpdatedAgo(0);
    const id = setInterval(() => setUpdatedAgo(a => a+1), 1000);
    return () => clearInterval(id);
  }, [live.tick]);

  const total = useM(() => {
    let s = 0;
    window.CH_DATA.holdings.forEach(h => { s += h.amount * (live.prices[h.token]?.price || 0); });
    return s;
  }, [live.tick]);

  const prevTotal = useM(() => {
    let s = 0;
    window.CH_DATA.holdings.forEach(h => {
      const tk = live.prices[h.token];
      if (!tk) return;
      s += (h.amount * tk.price) / (1 + tk.change24h/100);
    });
    return s;
  }, [live.tick]);

  const change = total - prevTotal;
  const changePct = prevTotal ? (change/prevTotal)*100 : 0;

  const navItems = [
    { id:"overview",    icon:"overview" },
    { id:"exposure",    icon:"exposure" },
    { id:"performance", icon:"perf" },
    { id:"assets",      icon:"assets" },
    { id:"positions",   icon:"positions" },
  ];
  const navItems2 = [
    { id:"strategies",  icon:"strategies" },
    { id:"airdrops",    icon:"airdrops" },
  ];
  const navItems3 = [
    { id:"accounts",    icon:"accounts" },
    { id:"settings",    icon:"settings" },
  ];

  const renderPage = () => {
    const props = { t, prices: live.prices, sparks: live.sparks, flash: live.flash, tick: live.tick };
    switch (page) {
      case "overview":    return <PageOverview {...props}/>;
      case "exposure":    return <PageExposure {...props}/>;
      case "performance": return <PagePerformance {...props}/>;
      case "assets":      return <PageAssets {...props}/>;
      case "positions":   return <PagePositions {...props}/>;
      case "strategies":  return <PageStrategies {...props}/>;
      case "airdrops":    return <PageAirdrops {...props}/>;
      case "accounts":    return <PageAccounts {...props}/>;
      default:            return <div style={{ color:"var(--fg-3)", padding:40, textAlign:"center" }}>Próximamente</div>;
    }
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CH</div>
          <div className="brand-name">cripto<span className="accent">house</span></div>
        </div>

        <div className="networth">
          <div className="label">{t("netWorth")}</div>
          <div className="value blur">{fmtUSD(total, { decimals: 0 })}</div>
          <div className={"change " + (change >= 0 ? "pos" : "neg") + " blur"}>
            {change >= 0 ? "+" : ""}{fmtUSD(change, { decimals: 0 })} · {fmtPct(changePct)}
          </div>
        </div>

        <nav style={{ display:"flex", flexDirection:"column", gap:0, flex:1, overflowY:"auto" }}>
          {navItems.map(n => (
            <button key={n.id} className={"nav-item " + (page === n.id ? "active" : "")} onClick={() => setPage(n.id)}>
              <span className="ico"><Icon name={n.icon} size={16}/></span>
              <span>{t("nav." + n.id)}</span>
            </button>
          ))}
          <div className="nav-section-label">DeFi</div>
          {navItems2.map(n => (
            <button key={n.id} className={"nav-item " + (page === n.id ? "active" : "")} onClick={() => setPage(n.id)}>
              <span className="ico"><Icon name={n.icon} size={16}/></span>
              <span>{t("nav." + n.id)}</span>
            </button>
          ))}
          <div className="nav-section-label">{t("accounts2")}</div>
          {navItems3.map(n => (
            <button key={n.id} className={"nav-item " + (page === n.id ? "active" : "")} onClick={() => setPage(n.id)}>
              <span className="ico"><Icon name={n.icon} size={16}/></span>
              <span>{t("nav." + n.id)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="live-dot"/>
          <span style={{ flex:1 }}>{t("livePrices")} · {updatedAgo}s</span>
          <button onClick={onLogout} title="Cerrar sesión"
            style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", padding:"4px 6px", borderRadius:4, fontSize:11, display:"flex", alignItems:"center", gap:4 }}>
            ⎋ Salir
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="topbar">
          <h1>{t("nav." + page)}</h1>
          <span className="sub">· {t("pageDescriptions." + page)}</span>
          <div className="grow"/>

          <div className="row" style={{ gap: 8 }}>
            <button className="icon-btn" onClick={() => setTweak("privacy", !tweaks.privacy)} title={tweaks.privacy ? t("showBalances") : t("hideBalances")}>
              <Icon name={tweaks.privacy ? "eyeOff" : "eye"} size={14}/>
            </button>
            <button className="icon-btn" title={t("notifications")}>
              <Icon name="bell" size={14}/>
            </button>

            <select className="lang-select" value={tweaks.lang} onChange={e => setTweak("lang", e.target.value)}>
              <option value="es">🇪🇸 ES</option>
              <option value="en">🇬🇧 EN</option>
              <option value="pt">🇧🇷 PT</option>
            </select>

            <button className="btn"><Icon name="refresh" size={13}/>{t("refresh")}</button>
            <div className="avatar">U</div>
          </div>
        </header>

        <div className="content">
          {renderPage()}
        </div>
      </main>

      {/* TWEAKS PANEL */}
      <window.TweaksPanel title={t("tweaksTitle")}>
        <window.TweakSection title={t("language")}>
          <window.TweakSelect value={tweaks.lang} onChange={v => setTweak("lang", v)}
            options={[
              { value:"es", label:"🇪🇸 Español" },
              { value:"en", label:"🇬🇧 English" },
              { value:"pt", label:"🇧🇷 Português" },
            ]}/>
        </window.TweakSection>

        <window.TweakSection title={t("accentColor")}>
          <div style={{ display:"flex", gap:8 }}>
            {Object.entries(ACCENTS).map(([k, a]) => (
              <button key={k} onClick={() => setTweak("accent", k)}
                title={a.name}
                style={{
                  width:28, height:28, borderRadius:8, background:a.color,
                  border: tweaks.accent === k ? "2px solid var(--fg-0)" : "2px solid transparent",
                  cursor:"pointer", padding:0
                }}/>
            ))}
          </div>
        </window.TweakSection>

        <window.TweakSection title={t("theme")}>
          <window.TweakRadio value={tweaks.theme} onChange={v => setTweak("theme", v)}
            options={[{value:"dark", label:t("dark")}, {value:"light", label:t("light")}]}/>
        </window.TweakSection>

        <window.TweakSection title={t("density")}>
          <window.TweakRadio value={tweaks.density} onChange={v => setTweak("density", v)}
            options={[
              {value:"compact", label:t("compact")},
              {value:"comfortable", label:t("comfortable")},
              {value:"spacious", label:t("spacious")},
            ]}/>
        </window.TweakSection>

        <window.TweakSection title={t("layout")}>
          <window.TweakRadio value={String(tweaks.cols)} onChange={v => setTweak("cols", Number(v))}
            options={[
              {value:"1", label:"1"},
              {value:"2", label:"2"},
              {value:"3", label:"3"},
            ]}/>
        </window.TweakSection>

        <window.TweakSection title={t("privacy")}>
          <window.TweakToggle value={tweaks.privacy} onChange={v => setTweak("privacy", v)} label={t("hideBalances")}/>
        </window.TweakSection>

        <window.TweakSection title="Contraseña">
          <button className="btn" style={{ fontSize:12 }}
            onClick={() => {
              if (confirm("¿Cambiar contraseña? Se cerrará la sesión.")) {
                localStorage.removeItem(CH_PASS_KEY);
                sessionStorage.removeItem('ch_session');
                window.location.reload();
              }
            }}>
            Cambiar contraseña
          </button>
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
