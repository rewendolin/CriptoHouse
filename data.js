// CriptoHouse — Datos simulados de portfolio
// Precios base que se actualizan en vivo con pequeños movimientos

window.CH_DATA = (() => {
  const tokens = {
    BTC:  { name: "Bitcoin",        price: 76482.30, change24h: -1.84, type: "BTC",         color: "#f59e0b", symbol: "₿" },
    ETH:  { name: "Ethereum",       price: 2253.10,  change24h: -1.32, type: "ETH",         color: "#8b9aff", symbol: "Ξ" },
    SOL:  { name: "Solana",         price: 99.54,    change24h: -2.41, type: "SOL",         color: "#9945ff", symbol: "◎" },
    USDC: { name: "USD Coin",       price: 0.9994,   change24h: 0.01,  type: "Stablecoin",  color: "#2775ca", symbol: "$" },
    USDT: { name: "Tether",         price: 1.0001,   change24h: 0.02,  type: "Stablecoin",  color: "#26a17b", symbol: "₮" },
    USDH: { name: "USDH",           price: 1.0010,   change24h: 0.05,  type: "Stablecoin",  color: "#10b981", symbol: "$" },
    AVAX: { name: "Avalanche",      price: 18.02,    change24h: -2.21, type: "Token",       color: "#e84142", symbol: "△" },
    HYPE: { name: "Hyperliquid",    price: 33.63,    change24h: -0.41, type: "HYPE",        color: "#5cf2c4", symbol: "H" },
    WETH: { name: "Wrapped Ether",  price: 2251.80,  change24h: -1.30, type: "ETH",         color: "#5b6cff", symbol: "Ξ" },
    stETH:{ name: "Lido Staked ETH",price: 2250.90,  change24h: -1.28, type: "ETH",         color: "#00a3ff", symbol: "Ξ" },
    SPX:  { name: "SPX6900",        price: 0.30824,  change24h: -3.91, type: "Memecoin",    color: "#ff6b6b", symbol: "S" },
    PENGU:{ name: "Pudgy Penguins", price: 0.007496, change24h: -2.10, type: "Token",       color: "#5dadec", symbol: "P" },
    BNB:  { name: "BNB",            price: 754.90,   change24h: 0.74,  type: "BNB",         color: "#f0b90b", symbol: "B" },
    ARB:  { name: "Arbitrum",       price: 0.6215,   change24h: -1.95, type: "Token",       color: "#28a0f0", symbol: "A" },
    OP:   { name: "Optimism",       price: 1.4520,   change24h: -1.10, type: "Token",       color: "#ff0420", symbol: "O" },
    MATIC:{ name: "Polygon",        price: 0.3920,   change24h: -2.30, type: "Token",       color: "#7c3aed", symbol: "M" },
    AAVE: { name: "Aave",           price: 142.30,   change24h: 1.12,  type: "Token",       color: "#b6509e", symbol: "Å" },
    LINK: { name: "Chainlink",      price: 13.82,    change24h: -0.92, type: "Token",       color: "#2a5ada", symbol: "L" },
    UNI:  { name: "Uniswap",        price: 8.41,     change24h: 0.34,  type: "Token",       color: "#ff007a", symbol: "U" },

    // Wrapped & Aave tokens
    WBTC:     { name: "Wrapped Bitcoin",      price: 76480.00, change24h: -1.84, type: "BTC",        color: "#f7931a", symbol: "₿" },
    aWBTC:    { name: "Aave WBTC (ETH)",      price: 76480.00, change24h: -1.84, type: "BTC",        color: "#b6509e", symbol: "₿" },
    aWETH:    { name: "Aave WETH (ETH)",      price: 2253.10,  change24h: -1.32, type: "ETH",        color: "#b6509e", symbol: "Ξ" },
    aUSDC:    { name: "Aave USDC (ETH)",      price: 0.9994,   change24h:  0.01, type: "Stablecoin", color: "#b6509e", symbol: "$" },
    aArbWBTC: { name: "Aave WBTC (Arbitrum)", price: 76480.00, change24h: -1.84, type: "BTC",        color: "#28a0f0", symbol: "₿" },
    aArbWETH: { name: "Aave WETH (Arbitrum)", price: 2253.10,  change24h: -1.32, type: "ETH",        color: "#28a0f0", symbol: "Ξ" },
    aArbUSDC: { name: "Aave USDC (Arbitrum)", price: 0.9994,   change24h:  0.01, type: "Stablecoin", color: "#28a0f0", symbol: "$" },

    // Other chains
    XRP:  { name: "XRP",            price: 2.21,     change24h:  0.52, type: "Token",       color: "#00aae4", symbol: "✕" },
    XLM:  { name: "Stellar",        price: 0.28,     change24h:  0.31, type: "Token",       color: "#14b6e7", symbol: "★" },
    HBAR: { name: "Hedera",         price: 0.19,     change24h: -0.72, type: "Token",       color: "#888888", symbol: "ℏ" },
    XDC:  { name: "XDC Network",    price: 0.042,    change24h:  0.21, type: "Token",       color: "#4b82e0", symbol: "X" },
    SHX:  { name: "Stronghold",     price: 0.027,    change24h: -1.10, type: "Token",       color: "#8b5cf6", symbol: "S" },
  };

  // Datos del usuario — se cargan desde localStorage al hacer login
  const accounts  = [];
  const holdings  = [];
  const positions = [];
  const strategies = [];
  const airdrops  = [];

  // Genera serie temporal (90 días) para el portfolio total
  function generateSeries(startValue, days = 90, volatility = 0.018) {
    const out = [];
    let v = startValue;
    let t = Date.now() - days*24*60*60*1000;
    for (let i = 0; i < days; i++) {
      const drift = (Math.sin(i/9) + Math.cos(i/14)) * 0.004;
      const noise = (Math.random() - 0.48) * volatility;
      v = v * (1 + drift + noise);
      out.push({ t: t + i*24*60*60*1000, v });
    }
    return out;
  }

  return { tokens, accounts, holdings, positions, strategies, airdrops, generateSeries };
})();
