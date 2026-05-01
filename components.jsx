// CriptoHouse — utilidades y componentes base

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// --- Helpers ---
const fmtUSD = (n, opts = {}) => {
  const { compact = false, decimals } = opts;
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (compact && abs >= 1e6) return (n/1e6).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "M€";
  if (compact && abs >= 1e3) return (n/1e3).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "K€";
  const d = decimals != null ? decimals : (abs < 1 ? 4 : 2);
  return n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + "€";
};
const fmtNum = (n, decimals = 2) => {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtPct = (n, decimals = 2) => {
  if (n == null || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(decimals) + "%";
};
const fmtAddr = (a) => {
  if (!a) return "";
  if (a.length < 14) return a;
  return a.slice(0,6) + "…" + a.slice(-4);
};

// --- TokenDot ---
const TokenDot = ({ symbol, size = 22 }) => {
  const t = (window.CH_DATA.tokens[symbol]) || { color: "#6f6a5d", symbol: symbol[0] };
  return (
    <span
      className="tk-dot"
      style={{
        width: size, height: size, fontSize: Math.max(9, size*0.45),
        background: t.color
      }}
    >
      {symbol[0]}
    </span>
  );
};

// --- Token chip ---
const TokenChip = ({ symbol, name }) => (
  <span className="tk">
    <TokenDot symbol={symbol} />
    <span style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.1 }}>
      <span style={{ fontWeight: 500 }}>{symbol}</span>
      {name && <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{name}</span>}
    </span>
  </span>
);

// --- Number with privacy blur ---
const Money = ({ value, compact, decimals, className = "", style }) => (
  <span className={"mono blur " + className} style={style}>{fmtUSD(value, { compact, decimals })}</span>
);
const NumberV = ({ value, decimals = 2, className = "", style }) => (
  <span className={"mono blur " + className} style={style}>{fmtNum(value, decimals)}</span>
);

// --- Sparkline (SVG) ---
const Sparkline = ({ data, width = 80, height = 24, stroke = "var(--accent)", fill = true }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i*dx, height - ((v - min) / range) * height]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = d + ` L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill && <path d={area} fill={stroke} opacity="0.12" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// --- Donut chart ---
const Donut = ({ data, size = 180, thickness = 22 }) => {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size/2, cy = size/2;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const start = acc / total * Math.PI * 2 - Math.PI/2;
    acc += d.value;
    const end = acc / total * Math.PI * 2 - Math.PI/2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const path = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
    return <path key={i} d={path} fill="none" stroke={d.color} strokeWidth={thickness} strokeLinecap="butt"/>;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thickness}/>
      {arcs}
    </svg>
  );
};

// --- Area chart with grid + hover ---
const AreaChart = ({ series, height = 260, color = "var(--accent)", showAxes = true }) => {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(800);

  useEffect(() => {
    const upd = () => { if (ref.current) setW(ref.current.clientWidth); };
    upd();
    const ro = new ResizeObserver(upd);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!series || series.length < 2) return <div ref={ref} style={{height}}/>;
  const padL = 56, padR = 12, padT = 10, padB = 24;
  const innerW = Math.max(100, w - padL - padR);
  const innerH = height - padT - padB;
  const vals = series.map(d => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const dx = innerW / (series.length - 1);
  const pts = series.map((d, i) => [padL + i*dx, padT + innerH - ((d.v - min) / range) * innerH]);
  const dPath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = dPath + ` L${padL+innerW},${padT+innerH} L${padL},${padT+innerH} Z`;

  // Y axis ticks
  const ticks = 5;
  const yTicks = Array.from({length: ticks+1}, (_, i) => min + (range * i / ticks));

  // X axis labels (5 ticks)
  const xN = 6;
  const xIdx = Array.from({length: xN}, (_, i) => Math.floor((series.length-1) * i / (xN-1)));

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padL;
    const idx = Math.max(0, Math.min(series.length-1, Math.round(x/dx)));
    setHover({ idx, ...series[idx], x: pts[idx][0], y: pts[idx][1] });
  };

  return (
    <div ref={ref} style={{ position: "relative", height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        <defs>
          <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {showAxes && yTicks.map((tv, i) => {
          const y = padT + innerH - (i/ticks)*innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={padL+innerW} y1={y} y2={y} stroke="var(--line-2)" strokeDasharray="2 4"/>
              <text x={padL-8} y={y+3} textAnchor="end" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">
                {tv >= 1e6 ? "$"+(tv/1e6).toFixed(2)+"M" : tv >= 1e3 ? "$"+(tv/1e3).toFixed(0)+"K" : "$"+tv.toFixed(0)}
              </text>
            </g>
          );
        })}
        {showAxes && xIdx.map((i, k) => {
          const d = new Date(series[i].t);
          const lbl = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return <text key={k} x={pts[i][0]} y={height-6} textAnchor="middle" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">{lbl}</text>;
        })}
        <path d={area} fill="url(#areaG)"/>
        <path d={dPath} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+innerH} stroke={color} strokeOpacity="0.4" strokeDasharray="2 3"/>
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="var(--bg-0)" strokeWidth="2"/>
          </g>
        )}
      </svg>
      {hover && (
        <div style={{
          position: "absolute",
          left: Math.min(hover.x + 12, w - 160),
          top: 8,
          background: "var(--bg-3)",
          border: "1px solid var(--bg-4)",
          borderRadius: 8,
          padding: "8px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          minWidth: 140,
          boxShadow: "var(--shadow-pop)",
          pointerEvents: "none"
        }}>
          <div style={{ color: "var(--fg-3)", fontSize: 10.5, marginBottom: 3 }}>
            {new Date(hover.t).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <div style={{ fontSize: 13 }}>{hover.v.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€</div>
        </div>
      )}
    </div>
  );
};

// --- Live price hook (simulated movements) ---
function useLivePrices() {
  const [tick, setTick] = useState(0);
  const pricesRef = useRef(JSON.parse(JSON.stringify(window.CH_DATA.tokens)));
  const sparksRef = useRef(Object.fromEntries(
    Object.keys(window.CH_DATA.tokens).map(k => {
      // initial 24-point spark
      const base = window.CH_DATA.tokens[k].price;
      const arr = [];
      let v = base * 0.985;
      for (let i = 0; i < 24; i++) {
        v = v * (1 + (Math.random() - 0.5) * 0.012 + Math.sin(i/4)*0.003);
        arr.push(v);
      }
      arr.push(base);
      return [k, arr];
    })
  ));
  const flashRef = useRef({});

  useEffect(() => {
    const id = setInterval(() => {
      const p = pricesRef.current;
      const flash = {};
      Object.keys(p).forEach(k => {
        const t = p[k];
        const isStable = t.type === "Stablecoin";
        const vol = isStable ? 0.0008 : 0.0035;
        const delta = (Math.random() - 0.5) * vol;
        const newPrice = Math.max(0.0001, t.price * (1 + delta));
        if (newPrice > t.price * 1.0003) flash[k] = "up";
        else if (newPrice < t.price * 0.9997) flash[k] = "down";
        t.price = newPrice;
        // Update sparkline
        const s = sparksRef.current[k];
        s.push(newPrice);
        if (s.length > 36) s.shift();
      });
      flashRef.current = flash;
      setTick(t => t + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return { prices: pricesRef.current, sparks: sparksRef.current, flash: flashRef.current, tick };
}

// --- I18n hook ---
function useI18n(lang) {
  return useCallback((key) => {
    const dict = window.CH_I18N[lang] || window.CH_I18N.es;
    const parts = key.split(".");
    let cur = dict;
    for (const p of parts) {
      if (cur && typeof cur === "object") cur = cur[p];
      else return key;
    }
    return cur != null ? cur : key;
  }, [lang]);
}

// --- Icons (inline svg) ---
const Icon = ({ name, size = 16 }) => {
  const paths = {
    overview:   <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    exposure:   <><circle cx="12" cy="12" r="9"/><path d="M12 3 v9 l8 0"/></>,
    perf:       <><path d="M3 17 L9 11 L13 14 L21 6"/><path d="M15 6 H21 V12"/></>,
    assets:     <><circle cx="12" cy="6" r="3.5"/><circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/></>,
    positions:  <><rect x="3" y="6" width="18" height="4" rx="1"/><rect x="3" y="14" width="12" height="4" rx="1"/></>,
    strategies: <><path d="M4 19 V5 M4 19 H20"/><path d="M8 14 V11 M12 14 V8 M16 14 V5"/></>,
    airdrops:   <><path d="M12 3 L12 14"/><path d="M7 9 L12 14 L17 9"/><path d="M5 17 H19 V21 H5 Z"/></>,
    accounts:   <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10 H21"/></>,
    settings:   <><circle cx="12" cy="12" r="3"/><path d="M19 12 L21 12 M3 12 L5 12 M12 3 L12 5 M12 19 L12 21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6"/></>,
    bell:       <><path d="M6 16 V11 a6 6 0 0 1 12 0 V16 L20 18 H4 Z"/><path d="M10 21 a2 2 0 0 0 4 0"/></>,
    eye:        <><path d="M2 12 C 5 6, 19 6, 22 12 C 19 18, 5 18, 2 12 Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff:     <><path d="M3 3 L21 21"/><path d="M2 12 C 5 6, 19 6, 22 12"/><path d="M2 12 C 4 15, 8 17, 12 17"/></>,
    refresh:    <><path d="M21 12 a9 9 0 1 1 -3 -6.7 L21 8"/><path d="M21 3 V8 H16"/></>,
    search:     <><circle cx="11" cy="11" r="7"/><path d="M16 16 L21 21"/></>,
    plus:       <><path d="M12 5 V19 M5 12 H19"/></>,
    chevron:    <><path d="M6 9 L12 15 L18 9"/></>,
    arrowUp:    <><path d="M12 19 V5 M5 12 L12 5 L19 12"/></>,
    arrowDown:  <><path d="M12 5 V19 M5 12 L12 19 L19 12"/></>,
    extLink:    <><path d="M14 4 H20 V10"/><path d="M20 4 L11 13"/><path d="M20 14 V20 H4 V4 H10"/></>,
    grid:       <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    rows:       <><rect x="3" y="4" width="18" height="4"/><rect x="3" y="11" width="18" height="4"/><rect x="3" y="18" width="18" height="2"/></>,
    chat:       <><path d="M21 12 a9 9 0 1 0 -4 7.5 L21 21 L20 16 A9 9 0 0 0 21 12 Z"/></>,
    sun:        <><circle cx="12" cy="12" r="4"/><path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M5 19 L6.5 17.5 M17.5 6.5 L19 5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

const inputSx = {
  width:"100%", background:"var(--bg-2)", border:"1px solid var(--border)",
  borderRadius:6, padding:"8px 10px", fontSize:13, color:"var(--fg-0)",
  fontFamily:"var(--font-sans)", boxSizing:"border-box", outline:"none"
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:11, color:"var(--fg-3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{label}</label>
    {children}
  </div>
);

const Modal = ({ open, onClose, title, onSubmit, children }) => {
  if (!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:2000,
      background:"rgba(0,0,0,0.65)", display:"flex",
      alignItems:"center", justifyContent:"center", padding:24
    }} onClick={onClose}>
      <div style={{
        background:"var(--bg-1)", border:"1px solid var(--border)",
        borderRadius:12, padding:24, width:460, maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 12px 40px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:15, color:"var(--fg-0)" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--fg-3)", cursor:"pointer", fontSize:22, lineHeight:1, padding:"0 4px" }}>×</button>
        </div>
        {children}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSubmit}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

const showToast = (msg, duration = 3000) => {
  let container = document.getElementById('ch-toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ch-toast';
    container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.style.cssText = 'background:var(--bg-2);color:var(--fg-0);border:1px solid var(--border);border-radius:8px;padding:10px 20px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.4);text-align:center;font-family:var(--font-sans);opacity:1;transition:opacity 0.3s;white-space:nowrap;';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
};

Object.assign(window, { fmtUSD, fmtNum, fmtPct, fmtAddr, TokenDot, TokenChip, Money, NumberV, Sparkline, Donut, AreaChart, useLivePrices, useI18n, Icon, showToast, Modal, Field, inputSx });
