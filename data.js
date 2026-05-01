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
  };

  // Wallets / cuentas
  const accounts = [
    { id:"acc-1", name:"Bóveda Principal",   group:"Cold Wallet", type:"EVM",     address:"0x7a3F...91b2", network:"Ethereum",   description:"Almacenamiento a largo plazo", balance:842510.20 },
    { id:"acc-2", name:"Hot Trading",         group:"Hot Wallet",  type:"EVM",     address:"0x29Fa...4cd1", network:"Arbitrum",   description:"Operaciones diarias",            balance:128450.10 },
    { id:"acc-3", name:"Solana Daily",        group:"Hot Wallet",  type:"SVM",     address:"7nFkz...Wp4X",  network:"Solana",     description:"Trading SOL ecosystem",          balance:96320.50 },
    { id:"acc-4", name:"Hyperliquid Perps",   group:"Hot Trading", type:"EVM",     address:"0xC0fE...9b3a", network:"HyperCore",  description:"Cuenta de futuros",              balance:212940.00 },
    { id:"acc-5", name:"Binance Main",        group:"CEX",         type:"CEX",     address:"binance.com",   network:"Binance",    description:"Exchange centralizado",          balance:48210.30 },
    { id:"acc-6", name:"Ledger Cold",         group:"Cold Wallet", type:"EVM",     address:"0xB1C3...e5fa", network:"Ethereum",   description:"Hardware wallet",                balance:412300.00 },
    { id:"acc-7", name:"Aave V3 Lending",     group:"DeFi",        type:"EVM",     address:"0x4421...07d8", network:"Ethereum",   description:"Posiciones de préstamo",         balance:184500.40 },
    { id:"acc-8", name:"Uniswap LP",          group:"DeFi",        type:"EVM",     address:"0x88aa...12bc", network:"Base",       description:"Liquidity provider",             balance:62820.10 },
    { id:"acc-9", name:"OKX Backup",          group:"CEX",         type:"CEX",     address:"okx.com",       network:"OKX",        description:"Cuenta de respaldo",             balance:14820.00 },
  ];

  // Holdings: cantidad de cada token por cuenta
  const holdings = [
    { account:"acc-1", token:"BTC",  amount:7.85 },
    { account:"acc-1", token:"ETH",  amount:142.50 },
    { account:"acc-1", token:"USDC", amount:120000 },
    { account:"acc-2", token:"ETH",  amount:32.10 },
    { account:"acc-2", token:"USDC", amount:42000 },
    { account:"acc-2", token:"ARB",  amount:18500 },
    { account:"acc-3", token:"SOL",  amount:540.20 },
    { account:"acc-3", token:"USDC", amount:18500 },
    { account:"acc-3", token:"SPX",  amount:88000 },
    { account:"acc-4", token:"USDH", amount:50855 },
    { account:"acc-4", token:"HYPE", amount:1500 },
    { account:"acc-4", token:"USDC", amount:62000 },
    { account:"acc-5", token:"BNB",  amount:32.5 },
    { account:"acc-5", token:"ETH",  amount:8.2 },
    { account:"acc-5", token:"USDT", amount:5200 },
    { account:"acc-6", token:"BTC",  amount:4.20 },
    { account:"acc-6", token:"ETH",  amount:38.10 },
    { account:"acc-6", token:"stETH",amount:18.40 },
    { account:"acc-7", token:"USDC", amount:160000 },
    { account:"acc-7", token:"WETH", amount:11.80 },
    { account:"acc-8", token:"ETH",  amount:14.90 },
    { account:"acc-8", token:"USDC", amount:30200 },
    { account:"acc-9", token:"USDT", amount:14820 },
  ];

  // Posiciones en protocolos DeFi
  const positions = [
    { id:"p1", protocol:"Aave V3",       category:"Lending",        account:"acc-7", asset:"USDC",  amount:160000,  apy:4.82,  collateral:"WETH", network:"Ethereum" },
    { id:"p2", protocol:"Aave V3",       category:"Lending",        account:"acc-7", asset:"WETH",  amount:11.80,   apy:1.92,  collateral:"-",    network:"Ethereum" },
    { id:"p3", protocol:"Uniswap V3",    category:"Liquidity Pool", account:"acc-8", asset:"ETH/USDC", amount:62820, apy:18.41, collateral:"-",    network:"Base" },
    { id:"p4", protocol:"Hyperliquid",   category:"Futures",        account:"acc-4", asset:"HYPE-PERP", amount:50445, apy:0,    collateral:"USDH", network:"HyperCore" },
    { id:"p5", protocol:"Lido",          category:"Staking",        account:"acc-6", asset:"stETH", amount:18.40,   apy:3.20,  collateral:"-",    network:"Ethereum" },
    { id:"p6", protocol:"Jito",          category:"Staking",        account:"acc-3", asset:"SOL",   amount:120,     apy:7.10,  collateral:"-",    network:"Solana" },
    { id:"p7", protocol:"Pendle",        category:"Yield",          account:"acc-7", asset:"PT-stETH", amount:24500, apy:9.82,  collateral:"-",    network:"Ethereum" },
    { id:"p8", protocol:"Aerodrome",     category:"Liquidity Pool", account:"acc-8", asset:"AERO/USDC", amount:8200, apy:24.60, collateral:"-",    network:"Base" },
  ];

  // Estrategias: agrupaciones de posiciones
  const strategies = [
    { id:"s1", name:"HYPE Long Strategy", status:"Ongoing", startDate:"2024-06-02", currency:"USD", deployedValue:29990.01, positionsValue:50445.00, pnl:20454.99, accounts:["acc-4"] },
    { id:"s2", name:"Stable Yield",       status:"Ongoing", startDate:"2024-09-15", currency:"USD", deployedValue:160000,   positionsValue:172480,   pnl:12480,    accounts:["acc-7"] },
    { id:"s3", name:"ETH-USDC LP",        status:"Ongoing", startDate:"2025-01-08", currency:"USD", deployedValue:55000,    positionsValue:62820,    pnl:7820,     accounts:["acc-8"] },
    { id:"s4", name:"SOL Validator",      status:"Ongoing", startDate:"2024-11-20", currency:"USD", deployedValue:11200,    positionsValue:11944,    pnl:744,      accounts:["acc-3"] },
  ];

  // Airdrops
  const airdrops = [
    { project:"Hyperbeat",    status:"Active",  eligible:true,  claimed:0, total:1, deadline:"2026-12-05" },
    { project:"Aztec",        status:"Active",  eligible:true,  claimed:0, total:1, deadline:"2026-12-06" },
    { project:"Hyperstable",  status:"Active",  eligible:true,  claimed:0, total:1, deadline:null },
    { project:"Kamino S3",    status:"Active",  eligible:true,  claimed:0, total:2, deadline:null },
    { project:"Berachain",    status:"Active",  eligible:true,  claimed:0, total:1, deadline:null },
    { project:"deBridge",     status:"Active",  eligible:true,  claimed:0, total:1, deadline:"2026-05-17" },
    { project:"Optimism S5",  status:"Active",  eligible:true,  claimed:0, total:1, deadline:"2026-10-08" },
    { project:"EigenLayer",   status:"Active",  eligible:true,  claimed:0, total:4, deadline:null },
    { project:"Mode S1",      status:"Active",  eligible:true,  claimed:0, total:1, deadline:null },
    { project:"Uniswap",      status:"Claimed", eligible:true,  claimed:3, total:3, deadline:null },
  ];

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
