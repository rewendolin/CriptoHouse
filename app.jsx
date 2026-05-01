// CriptoHouse — App principal

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useR } = React;

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

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useS("overview");
  const [updatedAgo, setUpdatedAgo] = useS(0);
  const t = window.useI18n(tweaks.lang);
  const live = window.useLivePrices();

  // Apply tweaks to root
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

  // Update "updated x seconds ago"
  useE(() => {
    setUpdatedAgo(0);
    const id = setInterval(() => setUpdatedAgo(a => a+1), 1000);
    return () => clearInterval(id);
  }, [live.tick]);

  // Compute total
  const total = useM(() => {
    let s = 0;
    window.CH_DATA.holdings.forEach(h => {
      s += h.amount * (live.prices[h.token]?.price || 0);
    });
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
    { id:"overview",   icon:"overview" },
    { id:"exposure",   icon:"exposure" },
    { id:"performance",icon:"perf" },
    { id:"assets",     icon:"assets" },
    { id:"positions",  icon:"positions" },
  ];
  const navItems2 = [
    { id:"strategies", icon:"strategies" },
    { id:"airdrops",   icon:"airdrops" },
  ];
  const navItems3 = [
    { id:"accounts",   icon:"accounts" },
    { id:"settings",   icon:"settings" },
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
          <span>{t("livePrices")} · {t("lastUpdated").toLowerCase()} {updatedAgo}s</span>
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
            <div className="avatar">A</div>
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
      </window.TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
