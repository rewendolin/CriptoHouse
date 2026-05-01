// CriptoHouse — vistas (pages)
const { useState: useStateP, useEffect: useEffectP, useMemo: useMemoP, useRef: useRefP } = React;

// ----- OVERVIEW -----
function PageOverview({ t, prices, sparks, flash, tick }) {
  const data = window.CH_DATA;
  const seriesRef = useRefP(null);
  if (!seriesRef.current) seriesRef.current = data.generateSeries(2350000, 90, 0.022);
  const series = seriesRef.current;

  // Compute totals from holdings × current prices
  const totals = useMemoP(() => {
    let total = 0;
    const byToken = {};
    const byType = { Stablecoin:0, ETH:0, BTC:0, SOL:0, Token:0, Memecoin:0, BNB:0, HYPE:0 };
    data.holdings.forEach(h => {
      const tk = prices[h.token];
      if (!tk) return;
      const v = h.amount * tk.price;
      total += v;
      byToken[h.token] = (byToken[h.token] || 0) + v;
      byType[tk.type] = (byType[tk.type] || 0) + v;
    });
    // Compute previous day total via change24h
    let prev = 0;
    Object.keys(byToken).forEach(k => {
      const tk = prices[k];
      const factor = 1 / (1 + (tk.change24h/100));
      prev += byToken[k] * factor;
    });
    const change = total - prev;
    const pct = (change / prev) * 100;
    return { total, byToken, byType, change, pct, prev };
  }, [tick]);

  const topTokens = Object.entries(totals.byToken)
    .map(([k,v]) => ({ symbol:k, value:v, color: prices[k].color }))
    .sort((a,b) => b.value - a.value);
  const topShown = topTokens.slice(0, 6);
  const otherV = topTokens.slice(6).reduce((a,t) => a + t.value, 0);
  const donutData = [...topShown, ...(otherV>0 ? [{symbol:"Otros", value:otherV, color:"#6f6a5d"}] : [])];

  // Idle / Deployed / Futures bucket
  const idle = data.holdings.filter(h => {
    const acc = data.accounts.find(a => a.id === h.account);
    return acc && (acc.group === "Cold Wallet" || acc.group === "Hot Wallet" || acc.group === "CEX");
  }).reduce((s,h) => s + h.amount * (prices[h.token]?.price || 0), 0);
  const deployed = data.positions.filter(p => p.category !== "Futures")
    .reduce((s,p) => {
      if (p.asset.includes("/")) return s + p.amount;
      const tk = prices[p.asset.split("-")[0]];
      return s + (tk ? p.amount * tk.price : p.amount);
    }, 0);
  const futures = data.positions.filter(p => p.category === "Futures")
    .reduce((s,p) => s + p.amount, 0);

  // Watchlist tokens
  const watchlist = ["BTC","ETH","SOL","USDC","HYPE","AVAX","BNB","stETH"];

  return (
    <div className="col">
      {/* Hero */}
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div style={{ fontSize: 11, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("portfolio")}</div>
            <div className="big blur"><Money value={totals.total} decimals={0}/></div>
            <div className="sub-row">
              <span className={"blur " + (totals.change >= 0 ? "pos" : "neg")}>
                {totals.change >= 0 ? "+" : ""}{fmtUSD(totals.change, {decimals:0})}
              </span>
              <span className={totals.change >= 0 ? "pos" : "neg"}>
                {fmtPct(totals.pct)}
              </span>
              <span style={{ color:"var(--fg-3)" }}>{t("change24h")}</span>
            </div>
            <div style={{ display:"flex", gap:24, marginTop:22 }}>
              <Bucket label={t("idle")} value={idle} accent="var(--info)" t={t} sub={[
                [t("stables"), 217500],
                [t("majors"), 1180000],
                [t("memecoins"), 27500]
              ]}/>
              <Bucket label={t("deployed")} value={deployed} accent="var(--accent)" t={t} sub={[
                [t("lending"), 184500],
                [t("staked"), 41386],
                [t("liquidityPool"), 71020]
              ]}/>
              <Bucket label={t("futures")} value={futures} accent="var(--warn)" t={t} sub={[
                [t("long"), futures],
                [t("short"), 0]
              ]}/>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("topAssets")}</div>
              <a href="#" style={{ fontSize:12, color:"var(--accent)", textDecoration:"none" }}>{t("seeAll")} →</a>
            </div>
            <div style={{ display:"flex", gap:18, alignItems:"center" }}>
              <Donut data={donutData} size={170} thickness={20}/>
              <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1 }}>
                {donutData.slice(0,7).map(d => (
                  <div key={d.symbol} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:d.color }}/>
                    <span style={{ flex:1, color:"var(--fg-1)" }}>{d.symbol}</span>
                    <span className="mono" style={{ color:"var(--fg-2)", fontSize:11 }}>
                      {((d.value/totals.total)*100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-col: chart + watchlist */}
      <div className="grid overview-grid">
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t("historicalValue")}<span className="count">90 {t("days")}</span></div>
            <div className="range">
              <button>1W</button><button>1M</button><button className="active">3M</button><button>1Y</button><button>YTD</button>
            </div>
          </div>
          <div className="card-pad" style={{ paddingTop: 8 }}>
            <AreaChart series={series} height={260}/>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">{t("livePrices")}<span className="count" style={{ color:"var(--pos)" }}>● LIVE</span></div>
            <div style={{ fontSize:11, color:"var(--fg-3)", fontFamily:"var(--font-mono)" }}>{t("watchlist")}</div>
          </div>
          <div style={{ maxHeight: 360, overflow:"auto" }}>
            <table className="table">
              <thead>
                <tr><th>{t("asset")}</th><th className="right">{t("price")}</th><th className="right">24h</th><th className="right" style={{width:90}}>1h</th></tr>
              </thead>
              <tbody>
                {watchlist.map(sym => {
                  const tk = prices[sym];
                  if (!tk) return null;
                  const fl = flash[sym];
                  return (
                    <tr key={sym}>
                      <td><TokenChip symbol={sym} name={tk.name}/></td>
                      <td className="num" style={{ color: fl==="up"?"var(--pos)":fl==="down"?"var(--neg)":"var(--fg-0)", transition:"color 0.5s" }}>
                        {fmtUSD(tk.price, { decimals: tk.price < 1 ? 4 : 2 })}
                      </td>
                      <td className={"num " + (tk.change24h >= 0 ? "pos" : "neg")}>{fmtPct(tk.change24h)}</td>
                      <td><Sparkline data={sparks[sym]} stroke={tk.change24h >= 0 ? "var(--pos)" : "var(--neg)"} width={70} height={22}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(4, 1fr)" }}>
        <Stat label={t("walletsTracked")} value={data.accounts.length} sub={data.accounts.filter(a => a.group !== "CEX").length + " on-chain"}/>
        <Stat label={t("protocolsActive")} value={new Set(data.positions.map(p => p.protocol)).size} sub={data.positions.length + " " + t("nav.positions").toLowerCase()}/>
        <Stat label={t("todayPnL")} value={<Money value={totals.change} decimals={0}/>} sub={fmtPct(totals.pct)} positive={totals.change >= 0}/>
        <Stat label={t("nav.airdrops")} value={data.airdrops.filter(a => a.status === "Active").length} sub={t("active").toLowerCase()}/>
      </div>

      {/* Key Changes */}
      <KeyChanges t={t} prices={prices}/>
    </div>
  );
}

const Bucket = ({ label, value, accent, t, sub }) => (
  <div style={{ flex:1 }}>
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-3)" }}>
      <span style={{ width:6, height:6, borderRadius:50, background:accent }}/>{label}
    </div>
    <div className="mono blur" style={{ fontSize:18, marginTop:4 }}>{fmtUSD(value, {compact:true})}</div>
    <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:2 }}>
      {sub.map(([k,v], i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:"var(--font-mono)", color:"var(--fg-3)" }}>
          <span>{k}</span><span className="blur">{fmtUSD(v, {compact:true})}</span>
        </div>
      ))}
    </div>
  </div>
);

const Stat = ({ label, value, sub, positive }) => (
  <div className="stat">
    <div className="label">{label}</div>
    <div className="value">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
    <div className="sub" style={{ color: positive==null ? "var(--fg-2)" : positive ? "var(--pos)" : "var(--neg)" }}>{sub}</div>
  </div>
);

function KeyChanges({ t, prices }) {
  const rows = [
    { strat:"Trade.xyz",      protocol:"HyperCore", account:"Hyperliquid Trading", asset:"USDC", priceChange:0,    amountChange:173573, value: 173573 },
    { strat:"Manual",         protocol:"HyperCore", account:"Hyperliquid Trading", asset:"HYPE", priceChange:-0.41, amountChange:1500,   value: 50445 },
    { strat:"Wallet",         protocol:"HyperCore", account:"Hyperliquid Trading", asset:"USDH", priceChange:0.05,  amountChange:50855,  value: 50058 },
    { strat:"Manual",         protocol:"Solana",    account:"My SOL Altcoins",     asset:"SPX",  priceChange:-3.91, amountChange:108000, value: 30824 },
    { strat:"Hyperliquid",    protocol:"HyperCore", account:"Hyperliquid Trading", asset:"ETH",  priceChange:-1.32, amountChange:0.5,    value: 21568 },
  ];
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{t("keyChanges")}<span className="count">24h</span></div>
        <div style={{ display:"flex", gap:8 }}>
          {[t("all"), t("stables"), t("majors"), t("lending"), t("futures")].map((tab, i) => (
            <button key={i} className={"btn-ghost " + (i===0 ? "btn" : "")} style={{ height:28, fontSize:12, padding:"0 10px" }}>{tab}</button>
          ))}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>{t("type")}</th>
            <th>{t("network")}</th>
            <th>{t("account")}</th>
            <th>{t("asset")}</th>
            <th className="right">{t("price")} (24h)</th>
            <th className="right">{t("netAmount")} (24h)</th>
            <th className="right">{t("value")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i}>
              <td><span className="pill">{r.strat}</span></td>
              <td style={{ color:"var(--fg-2)" }}>{r.protocol}</td>
              <td style={{ color:"var(--fg-2)" }}>{r.account}</td>
              <td><TokenChip symbol={r.asset}/></td>
              <td className={"num " + (r.priceChange >= 0 ? "pos" : "neg")}>{fmtPct(r.priceChange)}</td>
              <td className={"num " + (r.amountChange >= 0 ? "pos" : "neg")}>{r.amountChange >= 0 ? "+" : ""}{fmtNum(r.amountChange, 0)}</td>
              <td className="num blur">{fmtUSD(r.value, {decimals:0})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----- ASSETS -----
function PageAssets({ t, prices, sparks, tick }) {
  const data = window.CH_DATA;
  const [search, setSearch] = useStateP("");
  const [sortBy, setSortBy] = useStateP("value");
  const [sortDir, setSortDir] = useStateP("desc");

  const tokenAggr = useMemoP(() => {
    const m = {};
    data.holdings.forEach(h => {
      m[h.token] = (m[h.token] || 0) + h.amount;
    });
    let total = 0;
    const rows = Object.entries(m).map(([sym, amount]) => {
      const tk = prices[sym];
      const value = amount * (tk?.price || 0);
      total += value;
      return { sym, name:tk?.name, type:tk?.type, amount, price:tk?.price, value, change24h:tk?.change24h };
    });
    rows.forEach(r => r.pct = (r.value/total)*100);
    return rows;
  }, [tick]);

  const filtered = tokenAggr
    .filter(r => !search || r.sym.toLowerCase().includes(search.toLowerCase()) || r.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      const m = sortDir === "asc" ? 1 : -1;
      return (a[sortBy] - b[sortBy]) * m;
    });

  const totalUSD = tokenAggr.reduce((s,r) => s+r.value, 0);

  const setSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  return (
    <div className="col">
      <div className="row" style={{ flexWrap:"wrap" }}>
        <div className="search">
          <Icon name="search" size={14}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}/>
        </div>
        <button className="btn"><Icon name="settings" size={13}/>{t("type")}</button>
        <button className="btn">{t("network")}</button>
        <div style={{ flex:1 }}/>
        <button className="btn"><Icon name="extLink" size={13}/>{t("csvSnapshot")}</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{cursor:"pointer"}} onClick={() => setSort("sym")}>{t("symbol")}</th>
              <th>{t("name")}</th>
              <th>{t("type")}</th>
              <th className="right" style={{cursor:"pointer"}} onClick={() => setSort("amount")}>{t("netAmount")}</th>
              <th className="right" style={{cursor:"pointer"}} onClick={() => setSort("price")}>{t("price")}</th>
              <th className="right">24h</th>
              <th className="right" style={{cursor:"pointer"}} onClick={() => setSort("pct")}>%</th>
              <th className="right" style={{cursor:"pointer"}} onClick={() => setSort("value")}>{t("value")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.sym}>
                <td><TokenChip symbol={r.sym}/></td>
                <td style={{ color:"var(--fg-1)" }}>{r.name}</td>
                <td><span className="tk-tag">{r.type}</span></td>
                <td className="num blur">{fmtNum(r.amount, r.amount > 1000 ? 2 : 4)}</td>
                <td className="num">{fmtUSD(r.price, { decimals: r.price < 1 ? 4 : 2 })}</td>
                <td className={"num " + (r.change24h >= 0 ? "pos" : "neg")}>{fmtPct(r.change24h)}</td>
                <td className="num">
                  <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                    <div className="bar" style={{ width:60 }}>
                      <i style={{ width: Math.min(100,r.pct*3) + "%" }}/>
                    </div>
                    <span style={{ minWidth:42 }}>{r.pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="num blur" style={{ fontWeight:500 }}>{fmtUSD(r.value, {decimals:0})}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ padding:"10px 14px", color:"var(--fg-3)", fontSize:11, borderTop:"1px solid var(--line)", background:"var(--bg-2)" }}>
                {t("asset")}: {filtered.length} / {tokenAggr.length}
              </td>
              <td className="num blur" style={{ borderTop:"1px solid var(--line)", background:"var(--bg-2)", fontWeight:600 }}>{fmtUSD(totalUSD, {decimals:0})}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ----- POSITIONS -----
function PagePositions({ t, prices, tick }) {
  const data = window.CH_DATA;
  const [filter, setFilter] = useStateP("All");

  const enriched = data.positions.map(p => {
    const acc = data.accounts.find(a => a.id === p.account);
    let value = p.amount;
    if (!p.asset.includes("/") && !p.asset.includes("-")) {
      const tk = prices[p.asset];
      if (tk) value = p.amount * tk.price;
    }
    return { ...p, account: acc, value };
  });

  const byCategory = enriched.reduce((m, p) => {
    (m[p.category] = m[p.category] || []).push(p);
    return m;
  }, {});

  const categories = Object.keys(byCategory);
  const filtered = filter === "All" ? enriched : enriched.filter(p => p.category === filter);
  const totalsByCat = Object.fromEntries(categories.map(c => [c, byCategory[c].reduce((s,p) => s + p.value, 0)]));
  const grandTotal = enriched.reduce((s,p) => s + p.value, 0);

  return (
    <div className="row" style={{ alignItems:"flex-start", gap:18 }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="row">
          <button className="btn" onClick={() => showToast(t("addPosition") + ": próximamente")}><Icon name="plus" size={13}/>{t("addPosition")}</button>
          <div style={{ flex:1 }}/>
          <button className="btn"><Icon name="extLink" size={13}/>{t("csvSnapshot")}</button>
        </div>
        {(filter === "All" ? categories : [filter]).map(cat => (
          <div key={cat} className="card">
            <div className="card-head">
              <div className="card-title">
                {cat}
                <span className="count">{byCategory[cat].length}</span>
              </div>
              <div className="mono blur" style={{ color:"var(--fg-1)" }}>{fmtUSD(totalsByCat[cat], {decimals:0})}</div>
            </div>
            <table className="table">
              <thead>
                <tr><th>{t("asset")}</th><th>{t("network")} / {t("account")}</th><th>{t("apy")}</th><th>{t("collateral")}</th><th className="right">{t("amount")}</th><th className="right">{t("value")}</th></tr>
              </thead>
              <tbody>
                {byCategory[cat].map(p => (
                  <tr key={p.id}>
                    <td><TokenChip symbol={p.asset.split("/")[0].split("-")[0]} name={p.asset}/></td>
                    <td>
                      <div style={{ fontSize:12 }}>{p.protocol}</div>
                      <div style={{ fontSize:11, color:"var(--fg-3)" }}>{p.network} · {p.account?.name}</div>
                    </td>
                    <td>{p.apy > 0 ? <span className="pill pos">{p.apy.toFixed(2)}%</span> : <span style={{color:"var(--fg-3)"}}>—</span>}</td>
                    <td style={{color:"var(--fg-2)"}}>{p.collateral}</td>
                    <td className="num blur">{fmtNum(p.amount, p.amount > 1000 ? 0 : 2)}</td>
                    <td className="num blur" style={{fontWeight:500}}>{fmtUSD(p.value, {decimals:0})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={{ width:240, flexShrink:0, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="card card-pad">
          <div style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-3)", marginBottom:10 }}>{t("filterByType")}</div>
          {["All", ...categories].map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{
                width:"100%", textAlign:"left", display:"flex", justifyContent:"space-between",
                background: filter === c ? "var(--bg-3)" : "transparent",
                border:"none", color: filter === c ? "var(--fg-0)" : "var(--fg-2)",
                padding:"8px 10px", borderRadius:6, fontSize:13, fontFamily:"inherit", cursor:"pointer"
              }}>
              <span>{c === "All" ? t("all") : c}</span>
              <span className="mono blur" style={{ fontSize:11 }}>{fmtUSD(c === "All" ? grandTotal : totalsByCat[c], {compact:true})}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- ACCOUNTS -----
function PageAccounts({ t, prices, tick }) {
  const data = window.CH_DATA;
  const [search, setSearch] = useStateP("");

  // Calculate balance per account from holdings
  const balances = useMemoP(() => {
    const m = {};
    data.holdings.forEach(h => {
      m[h.account] = (m[h.account] || 0) + h.amount * (prices[h.token]?.price || 0);
    });
    return m;
  }, [tick]);

  const filtered = data.accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.address.toLowerCase().includes(search.toLowerCase())
  );
  const totalBalance = Object.values(balances).reduce((s,v) => s+v, 0);

  return (
    <div className="col">
      <div className="row">
        <div className="search">
          <Icon name="search" size={14}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}/>
        </div>
        <button className="btn">{t("group")}</button>
        <button className="btn">{t("type")}</button>
        <div style={{ flex:1 }}/>
        <button className="btn" onClick={() => showToast(t("addAccount") + ": próximamente")}><Icon name="plus" size={13}/>{t("addAccount")}</button>
        <button className="btn-ghost btn">{t("bulkImport")}</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("group")}</th>
              <th>{t("address")}</th>
              <th>{t("type")}</th>
              <th>{t("network")}</th>
              <th>{t("description")}</th>
              <th className="right">{t("balance")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight:500 }}>{a.name}</td>
                <td><span className="pill">{a.group}</span></td>
                <td className="mono" style={{ color:"var(--fg-2)", fontSize:12 }}>{a.address}</td>
                <td style={{ color:"var(--fg-2)" }}>{a.type}</td>
                <td><span className="tk-tag">{a.network}</span></td>
                <td style={{ color:"var(--fg-2)", fontSize:12 }}>{a.description}</td>
                <td className="num blur" style={{ fontWeight:500 }}>{fmtUSD(balances[a.id] || 0, {decimals:0})}</td>
                <td><button className="icon-btn" style={{ width:24, height:24 }}>⋯</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} style={{ padding:"10px 14px", color:"var(--fg-3)", fontSize:11, borderTop:"1px solid var(--line)", background:"var(--bg-2)" }}>
                {t("accounts2")}: {filtered.length} / {data.accounts.length}
              </td>
              <td className="num blur" style={{ borderTop:"1px solid var(--line)", background:"var(--bg-2)", fontWeight:600 }}>{fmtUSD(totalBalance, {decimals:0})}</td>
              <td style={{ borderTop:"1px solid var(--line)", background:"var(--bg-2)" }}/>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ----- STRATEGIES -----
function PageStrategies({ t, prices, tick }) {
  const data = window.CH_DATA;
  const [selected, setSelected] = useStateP(data.strategies[0].id);
  const s = data.strategies.find(x => x.id === selected);
  const seriesRef = useRefP({});
  if (!seriesRef.current[selected]) {
    seriesRef.current[selected] = {
      deployed: data.generateSeries(s.deployedValue * 0.85, 60, 0.005),
      positions: data.generateSeries(s.positionsValue * 0.6, 60, 0.025),
      pnl: data.generateSeries(Math.max(100, s.pnl * 0.3), 60, 0.04),
    };
  }
  const series = seriesRef.current[selected];
  const startDate = new Date(s.startDate);
  const days = Math.floor((Date.now() - startDate) / (1000*60*60*24));

  return (
    <div className="row" style={{ alignItems:"flex-start" }}>
      <div className="col" style={{ flex:1 }}>
        <div className="row">
          {data.strategies.map(st => (
            <button key={st.id} onClick={() => setSelected(st.id)}
              className={"btn " + (selected === st.id ? "btn-primary" : "")}>
              {st.name}
            </button>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns:"repeat(3, 1fr)" }}>
          <MiniCard label={t("deployedValue")} value={s.deployedValue} series={series.deployed} color="var(--info)"/>
          <MiniCard label={t("positionsValue")} value={s.positionsValue} series={series.positions} color="var(--accent)"/>
          <MiniCard label={t("currentPnL")} value={s.pnl} series={series.pnl} color={s.pnl >= 0 ? "var(--pos)" : "var(--neg)"} positive={s.pnl >= 0}/>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">{t("funding")}<span className="mono blur" style={{ marginLeft: 8, color:"var(--fg-2)" }}>{fmtUSD(s.deployedValue, {decimals:0})}</span></div>
            <button className="btn" onClick={() => showToast(t("add") + ": próximamente")}><Icon name="plus" size={13}/>{t("add")}</button>
          </div>
          <table className="table">
            <thead><tr><th>{t("asset")}</th><th>{t("operation")}</th><th>{t("date")}</th><th className="right">{t("amount")}</th><th className="right">USD</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              <tr>
                <td><TokenChip symbol="USDC"/></td>
                <td><span className="pill pos">{t("addedFunding")}</span></td>
                <td className="mono" style={{color:"var(--fg-2)"}}>2026-02-04</td>
                <td className="num blur">30,000</td>
                <td className="num blur">{fmtUSD(s.deployedValue, {decimals:0})}</td>
                <td style={{ color:"var(--fg-2)", fontSize:12 }}>{t("addingFunding")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad" style={{ width:280, flexShrink:0 }}>
        <div style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("name")}</div>
        <div style={{ fontSize:18, fontWeight:500, marginTop:4, marginBottom:14 }}>{s.name}</div>
        <div className="kv"><span className="k">{t("accountingCurrency")}</span><span className="v">{s.currency}</span></div>
        <div className="kv"><span className="k">{t("status")}</span><span><span className="pill pos">{t("ongoing")}</span> <span className="mono" style={{ color:"var(--fg-2)", fontSize:11 }}>{days} {t("days")}</span></span></div>
        <div className="kv"><span className="k">{t("startDate")}</span><span className="v">{s.startDate}</span></div>
        <div className="kv"><span className="k">{t("accounts2")}</span><span className="v">{s.accounts.length}</span></div>
      </div>
    </div>
  );
}

const MiniCard = ({ label, value, series, color, positive }) => (
  <div className="card card-pad">
    <div style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-3)" }}>{label}</div>
    <div className="mono blur" style={{ fontSize:24, marginTop:4, color: positive==null ? "var(--fg-0)" : positive ? "var(--pos)" : "var(--neg)" }}>
      {positive ? "+" : ""}{fmtUSD(value, {decimals:0})}
    </div>
    <div style={{ marginTop:8 }}>
      <Sparkline data={series.map(p => p.v)} stroke={color} width={240} height={48}/>
    </div>
  </div>
);

// ----- AIRDROPS -----
function PageAirdrops({ t }) {
  const data = window.CH_DATA;
  return (
    <div className="col">
      <div className="row">
        <div className="search"><Icon name="search" size={14}/><input placeholder={t("search")}/></div>
        <button className="btn">{t("status")}: {t("active")}</button>
        <div style={{ flex:1 }}/>
        <button className="btn"><Icon name="extLink" size={13}/>Feedback</button>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>{t("project")}</th><th>{t("status")}</th><th>{t("announcement")} / {t("claim")}</th><th>{t("deadline")}</th><th className="right">{t("eligibleAccounts")}</th></tr></thead>
          <tbody>
            {data.airdrops.map((a, i) => (
              <tr key={i}>
                <td style={{ fontWeight:500 }}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{ width:18, height:18, borderRadius:50, background:`oklch(0.7 0.15 ${(i*40)%360})`, fontSize:10, display:"grid", placeItems:"center", color:"#0a0a0a", fontFamily:"var(--font-mono)"}}>{a.project[0]}</span>
                    {a.project}
                  </div>
                </td>
                <td>{a.status === "Active" ? <span className="pill pos">{t("active")}</span> : <span className="pill">{t("claimed")}</span>}</td>
                <td>
                  <a href="#" style={{ color:"var(--accent)", textDecoration:"none", fontSize:12, marginRight:12 }}>{t("announcement")} ↗</a>
                  <a href="#" style={{ color:"var(--accent)", textDecoration:"none", fontSize:12 }}>{t("claim")} ↗</a>
                </td>
                <td className="mono" style={{ color:"var(--fg-2)", fontSize:12 }}>{a.deadline || "—"}</td>
                <td className="right">
                  <span className="pill" style={{ marginRight:6 }}>{a.total} {t("accounts2")}</span>
                  <span className="pill">{t("claimed")} {a.claimed}/{a.total}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----- EXPOSURE -----
function PageExposure({ t, prices, tick }) {
  const data = window.CH_DATA;
  const aggr = useMemoP(() => {
    const m = {};
    data.holdings.forEach(h => {
      m[h.token] = (m[h.token] || 0) + h.amount * (prices[h.token]?.price || 0);
    });
    return m;
  }, [tick]);

  const byType = {};
  Object.entries(aggr).forEach(([sym, v]) => {
    const tk = prices[sym];
    const ty = tk?.type || "Other";
    byType[ty] = (byType[ty] || 0) + v;
  });
  const total = Object.values(aggr).reduce((s,v) => s+v, 0);
  const stableTotal = byType.Stablecoin || 0;
  const futuresLong = data.positions.filter(p => p.category === "Futures").reduce((s,p) => s+p.amount, 0);

  return (
    <div className="col">
      <div className="grid" style={{ gridTemplateColumns:"repeat(4, 1fr)" }}>
        <Stat label={t("spotTotal")} value={<Money value={total} compact/>} sub={"100%"}/>
        <Stat label={t("futuresTotal")} value={<Money value={futuresLong} compact/>} sub={t("long")} positive={true}/>
        <Stat label="Net long" value={<Money value={total - stableTotal + futuresLong} compact/>} sub={((total - stableTotal + futuresLong)/total*100).toFixed(1)+"%"}/>
        <Stat label={t("netExposure")} value={<Money value={total - stableTotal} compact/>} sub={t("exclStables")}/>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">{t("exposureByType")}</div></div>
        <table className="table">
          <thead><tr><th>{t("type")}</th><th className="right">{t("spotAssets")}</th><th className="right">{t("spotNet")}</th><th className="right">{t("futuresLongShort")}</th><th className="right">{t("netExposure")}</th><th className="right">%</th></tr></thead>
          <tbody>
            {Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([ty, v]) => (
              <tr key={ty}>
                <td><span className="tk-tag" style={{ fontSize:11 }}>{ty}</span></td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num blur">{ty === "HYPE" ? <span className="pos">{fmtUSD(futuresLong, {decimals:0})}</span> : <span style={{color:"var(--fg-3)"}}>$0</span>}</td>
                <td className="num blur">{fmtUSD(v + (ty === "HYPE" ? futuresLong : 0), {decimals:0})}</td>
                <td className="num">{((v/total)*100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">{t("exposureByAsset")}</div></div>
        <table className="table">
          <thead><tr><th>{t("asset")}</th><th className="right">{t("spotAssets")}</th><th className="right">{t("spotNet")}</th><th className="right">{t("netExposure")}</th><th className="right">%</th></tr></thead>
          <tbody>
            {Object.entries(aggr).sort((a,b) => b[1] - a[1]).map(([sym, v]) => (
              <tr key={sym}>
                <td><TokenChip symbol={sym}/></td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num">
                  <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                    <div className="bar" style={{ width:60 }}><i style={{ width: Math.min(100, (v/total)*300) + "%" }}/></div>
                    <span style={{ minWidth:42 }}>{((v/total)*100).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----- PERFORMANCE -----
function PagePerformance({ t, prices }) {
  const data = window.CH_DATA;
  const [range, setRange] = useStateP("3m");
  const seriesRef = useRefP(null);
  if (!seriesRef.current) {
    seriesRef.current = {
      "1w": data.generateSeries(2300000, 7, 0.020),
      "1m": data.generateSeries(2150000, 30, 0.020),
      "3m": data.generateSeries(1950000, 90, 0.022),
      "1y": data.generateSeries(1100000, 365, 0.025),
    };
  }
  const series = seriesRef.current[range];
  const start = series[0].v, end = series[series.length-1].v;
  const change = end - start;
  const pct = (change/start)*100;

  return (
    <div className="col">
      <div className="row">
        <button className="btn">All accounts</button>
        <div className="range">
          {["1w","1m","3m","1y","ytd"].map(r => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{t(r)}</button>
          ))}
        </div>
        <div style={{ flex:1 }}/>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ marginBottom:8 }}>
          <div>
            <div className="mono blur" style={{ fontSize:32, fontWeight:500, letterSpacing:"-0.02em" }}>{fmtUSD(end, {decimals:0})}</div>
            <div className="mono blur" style={{ fontSize:13, marginTop:2 }}>
              <span className={change >= 0 ? "pos" : "neg"}>{change >= 0 ? "+" : ""}{fmtUSD(change, {decimals:0})}</span>
              <span className={change >= 0 ? "pos" : "neg"} style={{ marginLeft:8 }}>{fmtPct(pct)}</span>
              <span style={{ color:"var(--fg-3)", marginLeft:8 }}>during last period</span>
            </div>
          </div>
          <div style={{ flex:1 }}/>
          <div className="range">
            <button className="active">Value</button>
            <button>Assets</button>
            <button>PnL</button>
          </div>
        </div>
        <AreaChart series={series} height={320} color={change >= 0 ? "var(--pos)" : "var(--neg)"}/>
      </div>

      <div className="grid" style={{ gridTemplateColumns:"1fr 1fr" }}>
        <div className="card">
          <div className="card-head"><div className="card-title">Asset types</div></div>
          <div className="card-pad" style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { name:"Major Assets", val:1380000, change:6.18 },
              { name:"Stablecoins",  val:2380000, change:71.19 },
              { name:"Memecoins",    val:27500,   change:-12.4 },
              { name:"Tokens",       val:482000,  change:-2.1 },
            ].map((r,i) => (
              <div key={i} className="row" style={{ gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13 }}>{r.name}</div>
                  <div className="mono blur" style={{ fontSize:11, color:"var(--fg-2)" }}>{fmtUSD(r.val, {compact:true})}</div>
                </div>
                <div style={{ flex:2 }}>
                  <div className="bar"><i style={{ width: Math.min(100, Math.abs(r.change)*1.4)+"%", background: r.change >= 0 ? "var(--pos)" : "var(--neg)" }}/></div>
                </div>
                <div className={"mono " + (r.change >= 0 ? "pos" : "neg")} style={{ fontSize:12, minWidth:60, textAlign:"right" }}>{fmtPct(r.change)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Top {t("asset")} prices</div></div>
          <table className="table">
            <thead><tr><th>{t("asset")}</th><th className="right">Start</th><th className="right">End</th><th className="right">Δ</th></tr></thead>
            <tbody>
              {["BTC","ETH","SOL","HYPE","AVAX"].map(sym => {
                const tk = prices[sym];
                const startP = tk.price * (1 - tk.change24h/100 * 5);
                return (
                  <tr key={sym}>
                    <td><TokenChip symbol={sym}/></td>
                    <td className="num">{fmtUSD(startP, {decimals: tk.price < 1 ? 4 : 2})}</td>
                    <td className="num">{fmtUSD(tk.price, {decimals: tk.price < 1 ? 4 : 2})}</td>
                    <td className={"num " + (tk.change24h >= 0 ? "pos" : "neg")}>{fmtPct(tk.change24h * 5)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PageOverview, PageAssets, PagePositions, PageAccounts, PageStrategies, PageAirdrops, PageExposure, PagePerformance });
