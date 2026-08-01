// Кошельки для дашборда. Данные тянем из Zerion API (бесплатный ключ — в .zerion-key).
// sources — ссылки на оригинальные сайты-сканы (DeBank / Krystal).
export const WALLETS = [
  {
    id: "wallet-a",
    name: "Кошелёк A",
    address: "0x8d957ca626df9280dc0662f39fc76d4f250ae2f1",
    sources: [
      { name: "DeBank", url: "https://debank.com/profile/0x8d957ca626df9280dc0662f39fc76d4f250ae2f1" },
      { name: "Krystal", url: "https://defi.krystal.app/account/0x8d957ca626df9280dc0662f39fc76d4f250ae2f1/positions" },
    ],
  },
  {
    id: "wallet-b",
    name: "Кошелёк B",
    address: "0x374db5dfa3ca89993ef0aa447dcde99e3e43577b",
    sources: [
      { name: "DeBank", url: "https://debank.com/profile/0x374db5dfa3ca89993ef0aa447dcde99e3e43577b" },
    ],
  },
];

// РФ-инструменты: watchlist (бэкенд /api/rf). Классы: stocks (TQBR), bonds (TQOB), pifs (INAV).
export const RF_WATCHLIST = [
  { secid: "SBER", name: "Сбербанк", klass: "stocks" },
  { secid: "GAZP", name: "Газпром", klass: "stocks" },
  { secid: "LKOH", name: "Лукойл", klass: "stocks" },
  { secid: "YDEX", name: "Яндекс", klass: "stocks" },
  { secid: "ROSN", name: "Роснефть", klass: "stocks" },
  { secid: "SU26207RMFS9", name: "ОФЗ 26207", klass: "bonds" },
  { secid: "2xEQT", name: "iNAV 2xEQT", klass: "pifs" },
  { secid: "2xOFZ", name: "iNAV 2xOFZ", klass: "pifs" },
];

// Горячие пулы: watchlist токенов. Пулы берём только из пар этих токенов
// (не весь дамп DefiLlama) — так и данные меньше, и качество выше.
// Blue-chip-токены (активы)
export const POOL_BLUE_TOKENS = [
  "WBTC", "BTC", "ETH", "WETH", "STETH", "WSTETH", "SOL", "BNB", "XRP", "ADA",
  "DOGE", "TON", "LINK", "AVAX", "DOT", "POL", "UNI", "AAVE", "ARB", "OP", "SUI", "LTC",
];
// Стейблкоины (для stable-категории)
export const POOL_STABLE_TOKENS = [
  "USDC", "USDT", "DAI", "PYUSD", "FRAX", "USDE", "TUSD", "USD0",
];

// Стейблкоины для категоризации активов в donut (символы, верхний регистр)
export const STABLECOIN_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "BUSD", "TUSD", "USDP", "GUSD", "LUSD", "FRAX", "USDE",
  "USDS", "PYUSD", "USD0", "USD1", "USDG", "USDD", "EURC", "EURS", "EURT", "XUSD",
  "SUSDS", "SUSDE", "CRVUSD", "GHO", "USDR", "USDC.E", "USDT.E", "USD₮0", "USDT0",
]);

// Человекочитаемые названия сетей
export const CHAIN_NAMES = {  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "BNB Chain",
  "binance-smart-chain": "BNB Chain",
  monad: "Monad",
  avalanche: "Avalanche",
  solana: "Solana",
  fantom: "Fantom",
  linea: "Linea",
  zksync: "zkSync",
  mantle: "Mantle",
  gnosis: "Gnosis",
  celo: "Celo",
  "avalanche-c": "Avalanche",
};

// Названия сетей для DefiLlama пулов (ключ — как в yields.llama.fi, значение — для отображения)
export const POOL_CHAIN_NAMES = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  "optimism": "Optimism",
  "op mainnet": "Optimism",
  base: "Base",
  polygon: "Polygon",
  bsc: "BNB Chain",
  solana: "Solana",
  avalanche: "Avalanche",
  fantom: "Fantom",
  linea: "Linea",
  "zksync era": "zkSync",
  mantle: "Mantle",
  scroll: "Scroll",
  blast: "Blast",
  mode: "Mode",
  sei: "Sei",
  ink: "Ink",
  monad: "Monad",
  sonic: "Sonic",
  "hyperliquid l1": "Hyperliquid",
  berachain: "Berachain",
  "world chain": "World Chain",
  apchain: "ApeChain",
  corn: "Corn",
  gravity: "Gravity",
  ronin: "Ronin",
  hemi: "Hemi",
  "rootstock": "Rootstock",
  telos: "Telos",
  kava: "Kava",
  metis: "Metis",
  astar: "Astar",
  taiko: "Taiko",
  zircuit: "Zircuit",
  "x layer": "X Layer",
  hydradx: "Hydration",
  polygon_zkevm: "Polygon zkEVM",
  celo: "Celo",
  gnosis: "Gnosis",
  moonbeam: "Moonbeam",
  moonriver: "Moonriver",
  cronos: "Cronos",
  aurora: "Aurora",
  harmony: "Harmony",
  evmos: "Evmos",
  aptos: "Aptos",
  sui: "Sui",
  ton: "TON",
  cardano: "Cardano",
  stellar: "Stellar",
  ripple: "Ripple",
  litecoin: "Litecoin",
  dogecoin: "Dogecoin",
  bitcoin: "Bitcoin",
  near: "NEAR",
  polkadot: "Polkadot",
  kusama: "Kusama",
  starknet: "Starknet",
  canto: "Canto",
  osmosis: "Osmosis",
  kujira: "Kujira",
  injective: "Injective",
  stacks: "Stacks",
  zksync: "zkSync",
  zkfair: "zkFair",
  manta: "Manta",
  xdai: "Gnosis",
  pulsechain: "PulseChain",
  "plasma": "Plasma",
  zetchain: "Zetachain",
  zigchain: "ZIGChain",
  fuel: "Fuel",
  inkonchain: "Ink",
};

export function poolChainName(id) {
  return POOL_CHAIN_NAMES[String(id).toLowerCase()] || id;
}

// Палитра для графика
export const COLORS = [
  "#7aa2ff", "#3ddc84", "#ffb454", "#ff7a9c", "#9b7aff",
  "#5bd3c7", "#e05f9e", "#8bd450", "#ff8a5c", "#5c8aff",
  "#d4d450", "#b55cd4", "#50d4b4", "#ff5c5c", "#4fd4e0",
];
