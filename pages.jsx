// CriptoHouse — vistas (pages)
const { useState: useStateP, useEffect: useEffectP, useMemo: useMemoP, useRef: useRefP } = React;

// ----- Wallet auto-detect helpers -----
function detectWalletType(addr) {
  if (!addr || addr === '—') return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return 'EVM';
  if (/^[xX][dD][cC][0-9a-fA-F]{40}$/.test(addr)) return 'XDC';
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr)) return 'XRP';
  if (/^G[A-Z2-7]{55}$/.test(addr)) return 'XLM';
  if (/^0\.0\.\d+$/.test(addr)) return 'HBAR';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) && !addr.startsWith('0x')) return 'SOL';
  return null;
}

// Common Solana SPL mint → symbol mapping
const SOL_MINT_MAP = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'So11111111111111111111111111111111111111112':   'SOL',
  'HZ1JovNiVvGrk1A2gkYvFWKJm8z8Xs8iaqhB8RuLkjT': 'USDH',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
  'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': 'USDCpo',
};

// BlockScout multi-chain config — ALL chains scanned in parallel for EVM wallets
const EVM_CHAINS = {
  'ethereum':     { host: 'eth.blockscout.com',       native: 'ETH'  },
  'arbitrum':     { host: 'arbitrum.blockscout.com',  native: 'ETH'  },
  'arbitrum one': { host: 'arbitrum.blockscout.com',  native: 'ETH'  },
  'polygon':      { host: 'polygon.blockscout.com',   native: 'MATIC'},
  'optimism':     { host: 'optimism.blockscout.com',  native: 'ETH'  },
  'base':         { host: 'base.blockscout.com',      native: 'ETH'  },
  'bnb chain':    { host: 'bsc.blockscout.com',       native: 'BNB'  },
  'bsc':          { host: 'bsc.blockscout.com',       native: 'BNB'  },
  'avalanche':    { host: 'avalanche.blockscout.com', native: 'AVAX' },
  'gnosis':       { host: 'gnosis.blockscout.com',    native: 'xDAI' },
};

// Scan a single EVM chain — returns [] on any error so Promise.allSettled stays clean
async function _fetchOneEVMChain(address, chain) {
  try {
    const base = `https://${chain.host}/api/v2/addresses/${address}`;
    const [addrRes, tokRes] = await Promise.all([
      fetch(base, { signal: AbortSignal.timeout(12000) }),
      fetch(base + '/token-balances', { signal: AbortSignal.timeout(12000) }),
    ]);
    if (!addrRes.ok) return [];
    const [addrData, tokData] = await Promise.all([addrRes.json(), tokRes.json()]);
    const out = [];
    const nativeAmt = parseFloat(addrData.coin_balance || '0') / 1e18;
    if (nativeAmt > 1e-9) out.push({ symbol: chain.native, amount: nativeAmt });
    (Array.isArray(tokData) ? tokData : []).forEach(item => {
      if (item.token?.type !== 'ERC-20') return;
      const sym = item.token?.symbol;
      const dec = parseInt(item.token?.decimals ?? 18);
      const amt = parseFloat(item.value || '0') / Math.pow(10, dec);
      if (sym && amt > 1e-9) out.push({ symbol: sym, amount: amt });
    });
    return out;
  } catch { return []; }
}

// Scan ALL EVM chains in parallel, aggregate by symbol (sums ETH across Ethereum+Arbitrum+etc.)
async function fetchEVMBalances(address) {
  const seen = new Set();
  const unique = Object.values(EVM_CHAINS).filter(c => !seen.has(c.host) && seen.add(c.host));
  const results = await Promise.allSettled(unique.map(c => _fetchOneEVMChain(address, c)));
  const totals = {};
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach(({ symbol, amount }) => { totals[symbol] = (totals[symbol] || 0) + amount; });
  });
  return Object.entries(totals).map(([symbol, amount]) => ({ symbol, amount }));
}

// XDC Network (EVM-compatible, xdc prefix → 0x)
async function fetchXDCBalances(address) {
  const normalized = '0x' + address.slice(3);
  return _fetchOneEVMChain(normalized, { host: 'xdc.blockscout.com', native: 'XDC' });
}

async function fetchSOLBalances(address) {
  const rpc = 'https://api.mainnet-beta.solana.com';
  const h = { 'Content-Type': 'application/json' };
  const [solRes, splRes] = await Promise.all([
    fetch(rpc, { method:'POST', headers:h, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getBalance', params:[address] }) }),
    fetch(rpc, { method:'POST', headers:h, body: JSON.stringify({
      jsonrpc:'2.0', id:2, method:'getTokenAccountsByOwner',
      params:[address, { programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding:'jsonParsed' }]
    })}),
  ]);
  const [solData, splData] = await Promise.all([solRes.json(), splRes.json()]);
  const out = [];
  const solAmt = (solData.result?.value || 0) / 1e9;
  if (solAmt > 0.001) out.push({ symbol:'SOL', amount: solAmt });
  (splData.result?.value || []).forEach(acc => {
    const info = acc.account?.data?.parsed?.info;
    if (!info) return;
    const sym = SOL_MINT_MAP[info.mint];
    const amt = info.tokenAmount?.uiAmount || 0;
    if (sym && amt > 1e-9) out.push({ symbol: sym, amount: amt });
  });
  return out;
}

// XRP Ledger via public cluster
async function fetchXRPBalances(address) {
  try {
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_info', params: [{ account: address, ledger_index: 'current' }] }),
    });
    const data = await res.json();
    if (!data.result?.account_data) return [];
    const xrp = parseFloat(data.result.account_data.Balance) / 1e6;
    return xrp > 0.001 ? [{ symbol: 'XRP', amount: xrp }] : [];
  } catch { return []; }
}

// Stellar Horizon — returns XLM + any issued assets (e.g. SHX on Stellar)
async function fetchXLMBalances(address) {
  try {
    const res = await fetch(`https://horizon.stellar.org/accounts/${address}`);
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    (data.balances || []).forEach(b => {
      const sym = b.asset_type === 'native' ? 'XLM' : b.asset_code;
      const amt = parseFloat(b.balance);
      if (sym && amt > 1e-7) out.push({ symbol: sym, amount: amt });
    });
    return out;
  } catch { return []; }
}

// Hedera Mirror Node
async function fetchHBARBalances(address) {
  try {
    const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
    if (!res.ok) return [];
    const data = await res.json();
    const hbar = parseFloat(data.balance?.balance || 0) / 1e8;
    return hbar > 0.0001 ? [{ symbol: 'HBAR', amount: hbar }] : [];
  } catch { return []; }
}

// ----- OVERVIEW -----
function PageOverview({ t, prices, sparks, flash, tick }) {
  const data = window.CH_DATA;
  const seriesRef = useRefP(null);
  const totalRef = useRefP(0);

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
    let prev = 0;
    Object.keys(byToken).forEach(k => {
      const tk = prices[k];
      const factor = 1 / (1 + (tk.change24h/100));
      prev += byToken[k] * factor;
    });
    const change = total - prev;
    const pct = prev ? (change / prev) * 100 : 0;
    totalRef.current = total;
    return { total, byToken, byType, change, pct, prev };
  }, [tick]);

  if (!seriesRef.current) seriesRef.current = data.generateSeries(Math.max(totalRef.current || 10000, 10000), 90, 0.022);
  const series = seriesRef.current;

  const topTokens = Object.entries(totals.byToken)
    .map(([k,v]) => ({ symbol:k, value:v, color: prices[k]?.color || "#6f6a5d" }))
    .sort((a,b) => b.value - a.value);
  const topShown = topTokens.slice(0, 6);
  const otherV = topTokens.slice(6).reduce((a,t) => a + t.value, 0);
  const donutData = totals.total > 0
    ? [...topShown, ...(otherV>0 ? [{symbol:"Otros", value:otherV, color:"#6f6a5d"}] : [])]
    : [];

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

  const watchlist = Object.keys(prices).slice(0, 8);

  if (totals.total === 0) {
    return (
      <div className="col" style={{ alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏦</div>
        <div style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>Tu portfolio está vacío</div>
        <div style={{ color:"var(--fg-3)", fontSize:13, marginBottom:24, maxWidth:380 }}>
          Empieza añadiendo tus cuentas y wallets. Desde la sección <strong>Cuentas</strong> puedes registrar tus wallets y añadir los activos que tienes en cada una.
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" onClick={() => {
            document.querySelector('.nav-item[data-page="accounts"]')?.click();
          }}>Ir a Cuentas</button>
        </div>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div style={{ fontSize: 11, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("portfolio")}</div>
            <div className="big blur"><Money value={totals.total} decimals={0}/></div>
            <div className="sub-row">
              <span className={"blur " + (totals.change >= 0 ? "pos" : "neg")}>
                {totals.change >= 0 ? "+" : ""}{fmtUSD(totals.change, {decimals:0})}
              </span>
              <span className={totals.change >= 0 ? "pos" : "neg"}>{fmtPct(totals.pct)}</span>
              <span style={{ color:"var(--fg-3)" }}>{t("change24h")}</span>
            </div>
            <div style={{ display:"flex", gap:24, marginTop:22 }}>
              <Bucket label={t("idle")}     value={idle}     accent="var(--info)"   t={t} sub={[]}/>
              <Bucket label={t("deployed")} value={deployed} accent="var(--accent)" t={t} sub={[]}/>
              <Bucket label={t("futures")}  value={futures}  accent="var(--warn)"   t={t} sub={[]}/>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("topAssets")}</div>
            </div>
            <div style={{ display:"flex", gap:18, alignItems:"center" }}>
              {donutData.length > 0 && <Donut data={donutData} size={170} thickness={20}/>}
              <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1 }}>
                {donutData.slice(0,7).map(d => (
                  <div key={d.symbol} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:d.color }}/>
                    <span style={{ flex:1, color:"var(--fg-1)" }}>{d.symbol}</span>
                    <span className="mono" style={{ color:"var(--fg-2)", fontSize:11 }}>
                      {totals.total > 0 ? ((d.value/totals.total)*100).toFixed(1) : "0"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid overview-grid">
        <div className="card">
          <div className="card-head">
            <div className="card-title">{t("historicalValue")}<span className="count">90 {t("days")}</span></div>
            <div className="range">
              <button>1W</button><button>1M</button><button className="active">3M</button><button>1Y</button>
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

      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(4, 1fr)" }}>
        <Stat label={t("walletsTracked")} value={data.accounts.length} sub={data.accounts.filter(a => a.group !== "CEX").length + " on-chain"}/>
        <Stat label={t("protocolsActive")} value={new Set(data.positions.map(p => p.protocol)).size} sub={data.positions.length + " " + t("nav.positions").toLowerCase()}/>
        <Stat label={t("todayPnL")} value={<Money value={totals.change} decimals={0}/>} sub={fmtPct(totals.pct)} positive={totals.change >= 0}/>
        <Stat label={t("nav.airdrops")} value={data.airdrops.filter(a => a.status === "Active").length} sub={t("active").toLowerCase()}/>
      </div>
    </div>
  );
}

const Bucket = ({ label, value, accent, t, sub }) => (
  <div style={{ flex:1 }}>
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-3)" }}>
      <span style={{ width:6, height:6, borderRadius:50, background:accent }}/>{label}
    </div>
    <div className="mono blur" style={{ fontSize:18, marginTop:4 }}>{fmtUSD(value, {compact:true})}</div>
  </div>
);

const Stat = ({ label, value, sub, positive }) => (
  <div className="stat">
    <div className="label">{label}</div>
    <div className="value">{typeof value === "number" ? value.toLocaleString("es-ES") : value}</div>
    <div className="sub" style={{ color: positive==null ? "var(--fg-2)" : positive ? "var(--pos)" : "var(--neg)" }}>{sub}</div>
  </div>
);

// ----- ASSETS -----
function PageAssets({ t, prices, sparks, tick }) {
  const data = window.CH_DATA;
  const [search, setSearch] = useStateP("");
  const [sortBy, setSortBy] = useStateP("value");
  const [sortDir, setSortDir] = useStateP("desc");

  const tokenAggr = useMemoP(() => {
    const m = {};
    data.holdings.forEach(h => { m[h.token] = (m[h.token] || 0) + h.amount; });
    let total = 0;
    const rows = Object.entries(m).map(([sym, amount]) => {
      const tk = prices[sym];
      const value = amount * (tk?.price || 0);
      total += value;
      return { sym, name:tk?.name, type:tk?.type, amount, price:tk?.price, value, change24h:tk?.change24h };
    });
    rows.forEach(r => r.pct = total > 0 ? (r.value/total)*100 : 0);
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
        <div style={{ flex:1 }}/>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--fg-3)" }}>
            No hay activos. Añade cuentas con sus holdings desde la sección <strong>Cuentas</strong>.
          </div>
        ) : (
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
                      <div className="bar" style={{ width:60 }}><i style={{ width: Math.min(100,r.pct*3) + "%" }}/></div>
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
        )}
      </div>
    </div>
  );
}

// ----- POSITIONS -----
function PagePositions({ t, prices, tick }) {
  const data = window.CH_DATA;
  const [filter, setFilter] = useStateP("All");
  const [showModal, setShowModal] = useStateP(false);
  const [positions, setPositions] = useStateP(() => [...data.positions]);
  const blank = { asset:"BTC", protocol:"", network:"Ethereum", account:data.accounts[0]?.id||"", category:"Lending", apy:"", amount:"" };
  const [form, setForm] = useStateP(blank);
  const upd = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const handleAdd = () => {
    if (!form.protocol || !form.amount) { showToast("Completa protocolo y cantidad"); return; }
    if (!form.account) { showToast("Primero añade una cuenta"); return; }
    const pos = {
      id:"pos_"+Date.now(), asset:form.asset, protocol:form.protocol,
      network:form.network, account:form.account, category:form.category,
      apy:parseFloat(form.apy)||0, amount:parseFloat(form.amount)||0, collateral:"—"
    };
    const updated = [...positions, pos];
    setPositions(updated); data.positions = updated;
    window.CH_SAVE?.();
    setForm({ ...blank, account: data.accounts[0]?.id||"" });
    setShowModal(false); showToast("Posición añadida ✓");
  };

  const handleDelete = (id) => {
    const updated = positions.filter(p => p.id !== id);
    setPositions(updated); data.positions = updated;
    window.CH_SAVE?.();
    showToast("Posición eliminada");
  };

  const enriched = positions.map(p => {
    const acc = data.accounts.find(a => a.id === p.account);
    let value = p.amount;
    if (!p.asset.includes("/") && !p.asset.includes("-")) {
      const tk = prices[p.asset]; if (tk) value = p.amount * tk.price;
    }
    return { ...p, accountObj: acc, value };
  });

  const byCategory = enriched.reduce((m, p) => { (m[p.category] = m[p.category] || []).push(p); return m; }, {});
  const categories = Object.keys(byCategory);
  const totalsByCat = Object.fromEntries(categories.map(c => [c, byCategory[c].reduce((s,p) => s + p.value, 0)]));
  const grandTotal = enriched.reduce((s,p) => s + p.value, 0);

  return (
    <div className="row" style={{ alignItems:"flex-start", gap:18 }}>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t("addPosition")} onSubmit={handleAdd}>
        <Field label="Token">
          <select value={form.asset} onChange={upd("asset")} style={inputSx}>
            {Object.keys(data.tokens).map(s => <option key={s} value={s}>{s} — {data.tokens[s].name}</option>)}
          </select>
        </Field>
        <Field label="Protocolo">
          <input value={form.protocol} onChange={upd("protocol")} placeholder="Aave V3, Uniswap..." style={inputSx}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Red">
            <input value={form.network} onChange={upd("network")} placeholder="Ethereum, Arbitrum..." style={inputSx}/>
          </Field>
          <Field label="Categoría">
            <select value={form.category} onChange={upd("category")} style={inputSx}>
              {["Lending","LP","Staking","Perp","Yield","Farming"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="APY (%)">
            <input value={form.apy} onChange={upd("apy")} type="number" step="0.01" placeholder="5.20" style={inputSx}/>
          </Field>
          <Field label={t("amount")}>
            <input value={form.amount} onChange={upd("amount")} type="number" step="any" placeholder="1000" style={inputSx}/>
          </Field>
        </div>
        <Field label="Cuenta">
          {data.accounts.length === 0
            ? <div style={{ color:"var(--neg)", fontSize:12 }}>Primero añade una cuenta desde la sección Cuentas.</div>
            : <select value={form.account} onChange={upd("account")} style={inputSx}>
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
          }
        </Field>
      </Modal>

      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:14 }}>
        <div className="row">
          <button className="btn" onClick={() => setShowModal(true)}><Icon name="plus" size={13}/>{t("addPosition")}</button>
          <div style={{ flex:1 }}/>
        </div>

        {positions.length === 0 ? (
          <div className="card" style={{ padding:40, textAlign:"center", color:"var(--fg-3)" }}>
            No hay posiciones. Usa el botón "+ {t("addPosition")}" para añadir tu primera posición DeFi.
          </div>
        ) : (
          (filter === "All" ? categories : [filter]).map(cat => (
            <div key={cat} className="card">
              <div className="card-head">
                <div className="card-title">{cat}<span className="count">{byCategory[cat].length}</span></div>
                <div className="mono blur" style={{ color:"var(--fg-1)" }}>{fmtUSD(totalsByCat[cat], {decimals:0})}</div>
              </div>
              <table className="table">
                <thead>
                  <tr><th>{t("asset")}</th><th>{t("network")} / {t("account")}</th><th>{t("apy")}</th><th>{t("collateral")}</th><th className="right">{t("amount")}</th><th className="right">{t("value")}</th><th></th></tr>
                </thead>
                <tbody>
                  {byCategory[cat].map(p => (
                    <tr key={p.id}>
                      <td><TokenChip symbol={p.asset.split("/")[0].split("-")[0]} name={p.asset}/></td>
                      <td>
                        <div style={{ fontSize:12 }}>{p.protocol}</div>
                        <div style={{ fontSize:11, color:"var(--fg-3)" }}>{p.network} · {p.accountObj?.name}</div>
                      </td>
                      <td>{p.apy > 0 ? <span className="pill pos">{p.apy.toFixed(2)}%</span> : <span style={{color:"var(--fg-3)"}}>—</span>}</td>
                      <td style={{color:"var(--fg-2)"}}>{p.collateral}</td>
                      <td className="num blur">{fmtNum(p.amount, p.amount > 1000 ? 0 : 2)}</td>
                      <td className="num blur" style={{fontWeight:500}}>{fmtUSD(p.value, {decimals:0})}</td>
                      <td>
                        <button onClick={() => handleDelete(p.id)} title="Eliminar"
                          style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", fontSize:16, padding:"2px 6px" }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
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
              <span className="mono blur" style={{ fontSize:11 }}>{fmtUSD(c === "All" ? grandTotal : (totalsByCat[c]||0), {compact:true})}</span>
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
  const [showModal, setShowModal] = useStateP(false);
  const [accounts, setAccounts] = useStateP(() => [...data.accounts]);
  const [holdings, setHoldings] = useStateP(() => [...data.holdings]);
  const [holdRefresh, setHoldRefresh] = useStateP(0);
  const [fetchingAcc, setFetchingAcc] = useStateP(null);

  // Add account form
  const blank = { name:"", group:"Cold Wallet", type:"EVM", network:"Ethereum", address:"", description:"" };
  const [form, setForm] = useStateP(blank);
  const upd = k => e => setForm(f => ({...f, [k]: e.target.value}));

  // Add holding modal
  const [holdModal, setHoldModal] = useStateP({ open:false, accId:null, accName:"" });
  const blankH = { token:"BTC", amount:"" };
  const [holdForm, setHoldForm] = useStateP(blankH);
  const updH = k => e => setHoldForm(f => ({...f, [k]: e.target.value}));

  const importDetectedHoldings = async (accId, address, wType, network, replace) => {
    setFetchingAcc(accId);
    setExpandedAcc(accId);
    try {
      const detected = wType === 'EVM'  ? await fetchEVMBalances(address)  :
                       wType === 'SOL'  ? await fetchSOLBalances(address)  :
                       wType === 'XRP'  ? await fetchXRPBalances(address)  :
                       wType === 'XLM'  ? await fetchXLMBalances(address)  :
                       wType === 'HBAR' ? await fetchHBARBalances(address) :
                       wType === 'XDC'  ? await fetchXDCBalances(address)  : [];
      const known = window.CH_DATA;
      let base = replace ? known.holdings.filter(h => h.account !== accId) : [...known.holdings];
      let total = 0;
      detected.forEach(d => {
        // Try exact symbol, then uppercase (handles stETH vs USDC vs eth)
        const key = known.tokens[d.symbol] ? d.symbol : (known.tokens[d.symbol?.toUpperCase?.()] ? d.symbol.toUpperCase() : null);
        if (!key) return;
        total++;
        const idx = base.findIndex(h => h.account === accId && h.token === key);
        if (idx >= 0) { base[idx] = { ...base[idx], amount: d.amount }; }
        else { base.push({ account: accId, token: key, amount: d.amount }); }
      });
      setHoldings([...base]); known.holdings = base;
      window.CH_SAVE?.();
      setHoldRefresh(n => n+1);
      showToast(total > 0 ? `${total} activo${total > 1 ? 's' : ''} ${replace ? 'sincronizado' : 'importado'}${total > 1 ? 's' : ''} ✓` : "Sin activos reconocidos en esta dirección");
    } catch(e) {
      showToast("Error al detectar activos: " + (e.message || "timeout"));
    } finally {
      setFetchingAcc(null);
    }
  };

  const handleAdd = async () => {
    if (!form.name) { showToast("El nombre es obligatorio"); return; }
    const addr = form.address || "—";
    const acc = {
      id:"acc-"+Date.now(), name:form.name, group:form.group, type:form.type,
      network:form.network, address: addr, description:form.description, balance:0
    };
    const updated = [...accounts, acc];
    setAccounts(updated); data.accounts = updated;
    window.CH_SAVE?.();
    setForm(blank); setShowModal(false); showToast("Cuenta añadida ✓");
    const wType = detectWalletType(addr);
    if (wType) await importDetectedHoldings(acc.id, addr, wType, form.network, false);
  };

  const handleSync = async (acc) => {
    const wType = detectWalletType(acc.address);
    if (!wType) { showToast("Esta cuenta no tiene una dirección pública válida"); return; }
    await importDetectedHoldings(acc.id, acc.address, wType, acc.network, true);
  };

  const handleDelete = (id) => {
    if (!confirm("¿Eliminar esta cuenta y todos sus activos?")) return;
    const updAcc = accounts.filter(a => a.id !== id);
    const updH   = holdings.filter(h => h.account !== id);
    setAccounts(updAcc); data.accounts = updAcc;
    setHoldings(updH);   data.holdings = updH;
    window.CH_SAVE?.();
    showToast("Cuenta eliminada");
  };

  const handleAddHolding = () => {
    if (!holdForm.amount || parseFloat(holdForm.amount) <= 0) { showToast("Introduce una cantidad válida"); return; }
    const existing = holdings.findIndex(h => h.account === holdModal.accId && h.token === holdForm.token);
    let updH;
    if (existing >= 0) {
      updH = holdings.map((h, i) => i === existing ? { ...h, amount: h.amount + parseFloat(holdForm.amount) } : h);
    } else {
      updH = [...holdings, { account:holdModal.accId, token:holdForm.token, amount:parseFloat(holdForm.amount) }];
    }
    setHoldings(updH); data.holdings = updH;
    window.CH_SAVE?.();
    setHoldRefresh(n => n+1);
    setHoldForm(blankH);
    setHoldModal({ open:false, accId:null, accName:"" });
    showToast("Activo añadido ✓");
  };

  const handleDeleteHolding = (accId, token) => {
    const updH = holdings.filter(h => !(h.account === accId && h.token === token));
    setHoldings(updH); data.holdings = updH;
    window.CH_SAVE?.();
    setHoldRefresh(n => n+1);
    showToast("Activo eliminado");
  };

  const balances = useMemoP(() => {
    const m = {};
    holdings.forEach(h => { m[h.account] = (m[h.account] || 0) + h.amount * (prices[h.token]?.price || 0); });
    return m;
  }, [tick, holdRefresh]);

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.address.toLowerCase().includes(search.toLowerCase())
  );
  const totalBalance = Object.values(balances).reduce((s,v) => s+v, 0);

  // Holdings by account (for expanded view)
  const [expandedAcc, setExpandedAcc] = useStateP(null);
  const holdingsByAcc = useMemoP(() => {
    const m = {};
    holdings.forEach(h => { (m[h.account] = m[h.account]||[]).push(h); });
    return m;
  }, [holdRefresh, tick]);

  return (
    <div className="col">
      {/* Add account modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t("addAccount")} onSubmit={handleAdd}>
        <Field label={t("name")}>
          <input value={form.name} onChange={upd("name")} placeholder="Ledger, Kraken, MetaMask..." style={inputSx}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label={t("group")}>
            <select value={form.group} onChange={upd("group")} style={inputSx}>
              {["Cold Wallet","Hot Wallet","Hot Trading","CEX","DeFi"].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label={t("type")}>
            <select value={form.type} onChange={upd("type")} style={inputSx}>
              {["EVM","SVM","CEX","BTC"].map(tp => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("network")}>
          <input value={form.network} onChange={upd("network")} placeholder="Ethereum, Solana, Arbitrum..." style={inputSx}/>
        </Field>
        <Field label={t("address")}>
          <input value={form.address} onChange={upd("address")} placeholder="0x... / dirección de wallet" style={inputSx}/>
          {detectWalletType(form.address) && (
            <div style={{ fontSize:11, color:"var(--accent)", marginTop:4 }}>
              Dirección {detectWalletType(form.address) === 'EVM' ? 'EVM' : 'Solana'} detectada — los activos se importarán automáticamente al guardar.
            </div>
          )}
          {form.address && !detectWalletType(form.address) && form.address.length > 5 && (
            <div style={{ fontSize:11, color:"var(--fg-3)", marginTop:4 }}>
              Formato no reconocido como EVM ni Solana. Puedes continuar y añadir activos manualmente.
            </div>
          )}
        </Field>
        <Field label={t("description")}>
          <input value={form.description} onChange={upd("description")} placeholder="Descripción opcional..." style={inputSx}/>
        </Field>
      </Modal>

      {/* Add holding modal */}
      <Modal open={holdModal.open} onClose={() => setHoldModal({ open:false, accId:null, accName:"" })} title={`Añadir activo — ${holdModal.accName}`} onSubmit={handleAddHolding}>
        <Field label="Token">
          <select value={holdForm.token} onChange={updH("token")} style={inputSx}>
            {Object.keys(data.tokens).map(s => <option key={s} value={s}>{s} — {data.tokens[s].name}</option>)}
          </select>
        </Field>
        <Field label="Cantidad">
          <input value={holdForm.amount} onChange={updH("amount")} type="number" step="any" placeholder="0.00" style={inputSx}/>
        </Field>
        <div style={{ fontSize:11, color:"var(--fg-3)", marginTop:-8 }}>
          Si ya tienes ese token en esta cuenta, la cantidad se sumará a la existente.
        </div>
      </Modal>

      <div className="row">
        <div className="search">
          <Icon name="search" size={14}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}/>
        </div>
        <div style={{ flex:1 }}/>
        <button className="btn" onClick={() => setShowModal(true)}><Icon name="plus" size={13}/>{t("addAccount")}</button>
      </div>

      {accounts.length === 0 ? (
        <div className="card" style={{ padding:48, textAlign:"center", color:"var(--fg-3)" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🗂️</div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--fg-1)", marginBottom:8 }}>Sin cuentas todavía</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Añade tu primera wallet o exchange para empezar a trackear tu portfolio.</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={13}/>Añadir primera cuenta</button>
        </div>
      ) : (
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
                <React.Fragment key={a.id}>
                  <tr style={{ cursor:"pointer" }} onClick={() => setExpandedAcc(expandedAcc === a.id ? null : a.id)}>
                    <td style={{ fontWeight:500 }}>
                      <span style={{ marginRight:6, color:"var(--fg-3)", fontSize:11 }}>{expandedAcc === a.id ? "▼" : "▶"}</span>
                      {a.name}
                    </td>
                    <td><span className="pill">{a.group}</span></td>
                    <td className="mono" style={{ color:"var(--fg-2)", fontSize:12 }}>{a.address}</td>
                    <td style={{ color:"var(--fg-2)" }}>{a.type}</td>
                    <td><span className="tk-tag">{a.network}</span></td>
                    <td style={{ color:"var(--fg-2)", fontSize:12 }}>{a.description}</td>
                    <td className="num blur" style={{ fontWeight:500 }}>{fmtUSD(balances[a.id] || 0, {decimals:0})}</td>
                    <td onClick={e => e.stopPropagation()} style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      {detectWalletType(a.address) && (
                        <button className="btn" style={{ padding:"3px 8px", fontSize:11 }}
                          title="Sincronizar activos desde la blockchain"
                          onClick={() => handleSync(a)}
                          disabled={fetchingAcc === a.id}>
                          {fetchingAcc === a.id ? "..." : "⟳"}
                        </button>
                      )}
                      <button className="btn" style={{ padding:"3px 8px", fontSize:11 }}
                        onClick={() => setHoldModal({ open:true, accId:a.id, accName:a.name })}>
                        <Icon name="plus" size={11}/>Activo
                      </button>
                      <button onClick={() => handleDelete(a.id)} title="Eliminar cuenta"
                        style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", fontSize:16, padding:"2px 6px" }}>×</button>
                    </td>
                  </tr>
                  {expandedAcc === a.id && (
                    <tr>
                      <td colSpan={8} style={{ padding:0, background:"var(--bg-0)" }}>
                        {fetchingAcc === a.id ? (
                          <div style={{ padding:"14px 20px", color:"var(--fg-3)", fontSize:12, display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ color:"var(--accent)" }}>⟳</span>
                            Consultando la blockchain... esto puede tardar unos segundos.
                          </div>
                        ) : (holdingsByAcc[a.id]||[]).length === 0 ? (
                          <div style={{ padding:"12px 20px", color:"var(--fg-3)", fontSize:12 }}>
                            Sin activos.{detectWalletType(a.address) ? ' Pulsa ⟳ para sincronizar desde la blockchain, o' : ''} Usa "+ Activo" para añadir manualmente.
                          </div>
                        ) : (
                          <table className="table" style={{ margin:0 }}>
                            <thead>
                              <tr>
                                <td style={{ paddingLeft:32, fontSize:11, color:"var(--fg-3)" }}>Token</td>
                                <td className="right" style={{ fontSize:11, color:"var(--fg-3)" }}>Cantidad</td>
                                <td className="right" style={{ fontSize:11, color:"var(--fg-3)" }}>Precio</td>
                                <td className="right" style={{ fontSize:11, color:"var(--fg-3)" }}>Valor</td>
                                <td></td>
                              </tr>
                            </thead>
                            <tbody>
                              {(holdingsByAcc[a.id]||[]).map((h, i) => {
                                const tk = prices[h.token];
                                const val = h.amount * (tk?.price||0);
                                return (
                                  <tr key={i} style={{ background:"var(--bg-0)" }}>
                                    <td style={{ paddingLeft:32 }}><TokenChip symbol={h.token} name={tk?.name}/></td>
                                    <td className="num blur">{fmtNum(h.amount, h.amount > 1000 ? 2 : 4)}</td>
                                    <td className="num">{fmtUSD(tk?.price||0, { decimals: (tk?.price||0) < 1 ? 4 : 2 })}</td>
                                    <td className="num blur" style={{ fontWeight:500 }}>{fmtUSD(val, {decimals:0})}</td>
                                    <td>
                                      <button onClick={() => handleDeleteHolding(a.id, h.token)} title="Eliminar activo"
                                        style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", fontSize:16, padding:"2px 6px" }}>×</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding:"10px 14px", color:"var(--fg-3)", fontSize:11, borderTop:"1px solid var(--line)", background:"var(--bg-2)" }}>
                  {t("accounts2")}: {filtered.length} / {accounts.length}
                </td>
                <td className="num blur" style={{ borderTop:"1px solid var(--line)", background:"var(--bg-2)", fontWeight:600 }}>{fmtUSD(totalBalance, {decimals:0})}</td>
                <td style={{ borderTop:"1px solid var(--line)", background:"var(--bg-2)" }}/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ----- STRATEGIES -----
function PageStrategies({ t, prices, tick }) {
  const data = window.CH_DATA;
  const [strategies, setStrategies] = useStateP(() => [...data.strategies]);
  const [selected, setSelected] = useStateP(() => data.strategies[0]?.id || null);
  const [showAddStrategy, setShowAddStrategy] = useStateP(false);
  const [stForm, setStForm] = useStateP({ name:"", currency:"EUR" });
  const updSt = k => e => setStForm(f => ({...f, [k]: e.target.value}));

  const handleAddStrategy = () => {
    if (!stForm.name) { showToast("El nombre es obligatorio"); return; }
    const st = {
      id:"s"+Date.now(), name:stForm.name, status:"Ongoing",
      startDate: new Date().toISOString().slice(0,10),
      currency:stForm.currency, deployedValue:0, positionsValue:0, pnl:0, accounts:[]
    };
    const updated = [...strategies, st];
    setStrategies(updated); data.strategies = updated;
    window.CH_SAVE?.();
    setSelected(st.id);
    setStForm({ name:"", currency:"EUR" });
    setShowAddStrategy(false);
    showToast("Estrategia creada ✓");
  };

  const strategyModal = (
    <Modal open={showAddStrategy} onClose={() => setShowAddStrategy(false)} title="Nueva estrategia" onSubmit={handleAddStrategy}>
      <Field label="Nombre">
        <input value={stForm.name} onChange={updSt("name")} placeholder="HYPE Long, Stable Yield..." style={inputSx}/>
      </Field>
      <Field label="Moneda de referencia">
        <select value={stForm.currency} onChange={updSt("currency")} style={inputSx}>
          {["EUR","USD","BTC","ETH"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </Modal>
  );

  const s = strategies.find(x => x.id === selected);

  const [showFundModal, setShowFundModal] = useStateP(false);
  const [fundMap, setFundMap] = useStateP(() => {
    const m = {};
    strategies.forEach(st => { m[st.id] = []; });
    return m;
  });
  const blankFund = { asset:"USDC", op:"Depósito", amount:"", notes:"" };
  const [fundForm, setFundForm] = useStateP(blankFund);
  const updF = k => e => setFundForm(f => ({...f, [k]: e.target.value}));

  const handleAddFund = () => {
    if (!fundForm.amount) { showToast("Introduce la cantidad"); return; }
    const entry = {
      id:"f"+Date.now(), asset:fundForm.asset, op:fundForm.op,
      date: new Date().toISOString().slice(0,10),
      amount: parseFloat(fundForm.amount)||0, value: parseFloat(fundForm.amount)||0, notes: fundForm.notes
    };
    setFundMap(m => ({...m, [selected]: [...(m[selected]||[]), entry]}));
    window.CH_SAVE?.();
    setFundForm(blankFund); setShowFundModal(false); showToast("Movimiento añadido ✓");
  };

  const seriesRef = useRefP({});

  if (strategies.length === 0) {
    return (
      <div className="col">
        {strategyModal}
        <div className="card" style={{ padding:48, textAlign:"center", color:"var(--fg-3)" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--fg-1)", marginBottom:8 }}>Sin estrategias</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Crea una estrategia para organizar y seguir el rendimiento de tus posiciones.</div>
          <button className="btn btn-primary" onClick={() => setShowAddStrategy(true)}><Icon name="plus" size={13}/>Nueva estrategia</button>
        </div>
      </div>
    );
  }

  if (!seriesRef.current[selected] && s) {
    seriesRef.current[selected] = {
      deployed:  data.generateSeries(Math.max(s.deployedValue || 100, 100), 60, 0.005),
      positions: data.generateSeries(Math.max(s.positionsValue || 100, 100), 60, 0.025),
      pnl:       data.generateSeries(Math.max(Math.abs(s.pnl) || 100, 100), 60, 0.04),
    };
  }
  const series = s ? seriesRef.current[selected] : null;
  const startDate = s ? new Date(s.startDate) : new Date();
  const days = Math.floor((Date.now() - startDate) / (1000*60*60*24));

  return (
    <div className="row" style={{ alignItems:"flex-start" }}>
      {strategyModal}
      <div className="col" style={{ flex:1 }}>
        <div className="row">
          {strategies.map(st => (
            <button key={st.id} onClick={() => setSelected(st.id)}
              className={"btn " + (selected === st.id ? "btn-primary" : "")}>
              {st.name}
            </button>
          ))}
          <button className="btn" onClick={() => setShowAddStrategy(true)}><Icon name="plus" size={13}/>Nueva</button>
        </div>

        {s && series && (
          <>
            <div className="grid" style={{ gridTemplateColumns:"repeat(3, 1fr)" }}>
              <MiniCard label={t("deployedValue")}  value={s.deployedValue}  series={series.deployed}  color="var(--info)"/>
              <MiniCard label={t("positionsValue")} value={s.positionsValue} series={series.positions} color="var(--accent)"/>
              <MiniCard label={t("currentPnL")}     value={s.pnl}           series={series.pnl}       color={s.pnl >= 0 ? "var(--pos)" : "var(--neg)"} positive={s.pnl >= 0}/>
            </div>

            <Modal open={showFundModal} onClose={() => setShowFundModal(false)} title={t("add") + " " + t("funding")} onSubmit={handleAddFund}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Token">
                  <select value={fundForm.asset} onChange={updF("asset")} style={inputSx}>
                    {["USDC","USDT","USDH","BTC","ETH","SOL"].map(tk => <option key={tk} value={tk}>{tk}</option>)}
                  </select>
                </Field>
                <Field label="Operación">
                  <select value={fundForm.op} onChange={updF("op")} style={inputSx}>
                    <option value="Depósito">Depósito</option>
                    <option value="Retiro">Retiro</option>
                  </select>
                </Field>
              </div>
              <Field label={t("amount")}>
                <input value={fundForm.amount} onChange={updF("amount")} type="number" step="any" placeholder="10000" style={inputSx}/>
              </Field>
              <Field label={t("notes")}>
                <input value={fundForm.notes} onChange={updF("notes")} placeholder="Descripción opcional..." style={inputSx}/>
              </Field>
            </Modal>

            <div className="card">
              <div className="card-head">
                <div className="card-title">{t("funding")}</div>
                <button className="btn" onClick={() => setShowFundModal(true)}><Icon name="plus" size={13}/>{t("add")}</button>
              </div>
              {(fundMap[selected]||[]).length === 0 ? (
                <div style={{ padding:"20px 16px", color:"var(--fg-3)", fontSize:12, textAlign:"center" }}>
                  Sin movimientos. Registra depósitos y retiros de esta estrategia.
                </div>
              ) : (
                <table className="table">
                  <thead><tr><th>{t("asset")}</th><th>{t("operation")}</th><th>{t("date")}</th><th className="right">{t("amount")}</th><th className="right">EUR</th><th>{t("notes")}</th></tr></thead>
                  <tbody>
                    {(fundMap[selected]||[]).map(e => (
                      <tr key={e.id}>
                        <td><TokenChip symbol={e.asset}/></td>
                        <td><span className={"pill " + (e.op === "Depósito" ? "pos" : "neg")}>{e.op}</span></td>
                        <td className="mono" style={{color:"var(--fg-2)"}}>{e.date}</td>
                        <td className="num blur">{fmtNum(e.amount, 0)}</td>
                        <td className="num blur">{fmtUSD(e.value, {decimals:0})}</td>
                        <td style={{ color:"var(--fg-2)", fontSize:12 }}>{e.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {s && (
        <div className="card card-pad" style={{ width:280, flexShrink:0 }}>
          <div style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-3)" }}>{t("name")}</div>
          <div style={{ fontSize:18, fontWeight:500, marginTop:4, marginBottom:14 }}>{s.name}</div>
          <div className="kv"><span className="k">{t("accountingCurrency")}</span><span className="v">{s.currency}</span></div>
          <div className="kv"><span className="k">{t("status")}</span><span><span className="pill pos">{t("ongoing")}</span> <span className="mono" style={{ color:"var(--fg-2)", fontSize:11 }}>{days} {t("days")}</span></span></div>
          <div className="kv"><span className="k">{t("startDate")}</span><span className="v">{s.startDate}</span></div>
        </div>
      )}
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
  const [airdrops, setAirdrops] = useStateP(() => [...data.airdrops]);
  const [showModal, setShowModal] = useStateP(false);
  const blank = { project:"", status:"Active", total:"1", deadline:"" };
  const [form, setForm] = useStateP(blank);
  const upd = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const handleAdd = () => {
    if (!form.project) { showToast("El nombre del proyecto es obligatorio"); return; }
    const a = {
      project:form.project, status:form.status, eligible:true,
      claimed:0, total:parseInt(form.total)||1,
      deadline:form.deadline||null
    };
    const updated = [...airdrops, a];
    setAirdrops(updated); data.airdrops = updated;
    window.CH_SAVE?.();
    setForm(blank); setShowModal(false); showToast("Airdrop añadido ✓");
  };

  const handleDelete = (i) => {
    const updated = airdrops.filter((_, idx) => idx !== i);
    setAirdrops(updated); data.airdrops = updated;
    window.CH_SAVE?.();
  };

  const toggleClaim = (i) => {
    const updated = airdrops.map((a, idx) => {
      if (idx !== i) return a;
      const newClaimed = a.claimed < a.total ? a.claimed + 1 : a.claimed;
      return { ...a, claimed:newClaimed, status: newClaimed >= a.total ? "Claimed" : a.status };
    });
    setAirdrops(updated); data.airdrops = updated;
    window.CH_SAVE?.();
  };

  return (
    <div className="col">
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Añadir airdrop" onSubmit={handleAdd}>
        <Field label="Proyecto">
          <input value={form.project} onChange={upd("project")} placeholder="Uniswap, EigenLayer..." style={inputSx}/>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Estado">
            <select value={form.status} onChange={upd("status")} style={inputSx}>
              <option value="Active">Activo</option>
              <option value="Claimed">Reclamado</option>
            </select>
          </Field>
          <Field label="Nº cuentas elegibles">
            <input value={form.total} onChange={upd("total")} type="number" min="1" step="1" style={inputSx}/>
          </Field>
        </div>
        <Field label="Deadline (opcional)">
          <input value={form.deadline} onChange={upd("deadline")} type="date" style={inputSx}/>
        </Field>
      </Modal>

      <div className="row">
        <div style={{ flex:1 }}/>
        <button className="btn" onClick={() => setShowModal(true)}><Icon name="plus" size={13}/>Añadir airdrop</button>
      </div>

      <div className="card">
        {airdrops.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--fg-3)" }}>
            Sin airdrops. Añade los proyectos en los que participas para no perder ningún claim.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("project")}</th>
                <th>{t("status")}</th>
                <th>{t("deadline")}</th>
                <th className="right">{t("eligibleAccounts")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {airdrops.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:500 }}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{ width:18, height:18, borderRadius:50, background:`oklch(0.7 0.15 ${(i*40)%360})`, fontSize:10, display:"grid", placeItems:"center", color:"#0a0a0a", fontFamily:"var(--font-mono)"}}>{a.project[0]}</span>
                      {a.project}
                    </div>
                  </td>
                  <td>
                    <button onClick={() => toggleClaim(i)} title="Marcar como reclamado"
                      style={{ background:"none", border:"none", padding:0, cursor:"pointer" }}>
                      {a.status === "Active"
                        ? <span className="pill pos">{t("active")}</span>
                        : <span className="pill">{t("claimed")}</span>
                      }
                    </button>
                  </td>
                  <td className="mono" style={{ color:"var(--fg-2)", fontSize:12 }}>{a.deadline || "—"}</td>
                  <td className="right">
                    <span className="pill">{a.claimed}/{a.total} reclamados</span>
                  </td>
                  <td>
                    <button onClick={() => handleDelete(i)} title="Eliminar"
                      style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", fontSize:16, padding:"2px 6px" }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

  if (total === 0) {
    return (
      <div className="col" style={{ textAlign:"center", padding:60, color:"var(--fg-3)" }}>
        <div style={{ fontSize:15, marginBottom:8 }}>Sin datos de exposición</div>
        <div style={{ fontSize:13 }}>Añade cuentas y activos para ver tu distribución de riesgo.</div>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="grid" style={{ gridTemplateColumns:"repeat(4, 1fr)" }}>
        <Stat label={t("spotTotal")} value={<Money value={total} compact/>} sub={"100%"}/>
        <Stat label={t("futuresTotal")} value={<Money value={futuresLong} compact/>} sub={t("long")} positive={futuresLong > 0}/>
        <Stat label="Net long" value={<Money value={total - stableTotal + futuresLong} compact/>} sub={((total - stableTotal + futuresLong)/total*100).toFixed(1)+"%"}/>
        <Stat label={t("netExposure")} value={<Money value={total - stableTotal} compact/>} sub={t("exclStables")}/>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">{t("exposureByType")}</div></div>
        <table className="table">
          <thead><tr><th>{t("type")}</th><th className="right">{t("spotAssets")}</th><th className="right">{t("netExposure")}</th><th className="right">%</th></tr></thead>
          <tbody>
            {Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([ty, v]) => (
              <tr key={ty}>
                <td><span className="tk-tag" style={{ fontSize:11 }}>{ty}</span></td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num blur">{fmtUSD(v, {decimals:0})}</td>
                <td className="num">{((v/total)*100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">{t("exposureByAsset")}</div></div>
        <table className="table">
          <thead><tr><th>{t("asset")}</th><th className="right">{t("spotAssets")}</th><th className="right">{t("netExposure")}</th><th className="right">%</th></tr></thead>
          <tbody>
            {Object.entries(aggr).sort((a,b) => b[1] - a[1]).map(([sym, v]) => (
              <tr key={sym}>
                <td><TokenChip symbol={sym}/></td>
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
    const base = 10000;
    seriesRef.current = {
      "1w":  data.generateSeries(base, 7, 0.020),
      "1m":  data.generateSeries(base, 30, 0.020),
      "3m":  data.generateSeries(base, 90, 0.022),
      "1y":  data.generateSeries(base, 365, 0.025),
      "ytd": data.generateSeries(base, 120, 0.022),
    };
  }
  const series = seriesRef.current[range] || seriesRef.current["3m"];
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
            </div>
          </div>
          <div style={{ flex:1 }}/>
        </div>
        <AreaChart series={series} height={320} color={change >= 0 ? "var(--pos)" : "var(--neg)"}/>
      </div>
    </div>
  );
}

Object.assign(window, { PageOverview, PageAssets, PagePositions, PageAccounts, PageStrategies, PageAirdrops, PageExposure, PagePerformance });
