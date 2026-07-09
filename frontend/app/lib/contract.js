export const ADDRESSES ={
  tokenA: "0x1cdEBb61AE8e035C0cfB6EF85BF758cDD445CD69",
  tokenB: "0xFFF10189C30481Fc275235055532d08b490ecC20",
  tokenC: "0x72D03D070731D6B6A1dc795bd0d1d1340Bb16B12",
  factory: "0xeD315DCb5B323A66D5b0cA25D30794b8365ab8Ef",
  router: "0xFA971fBaD8FD62f23d22f8F2461fb77A7ADE57EB",
  pairAB: "0x1C10EC738e5C5678518eAf4CA1C5695891945785",
  pairBC: "0x3e85d317abB3D7426Fe5c79F464C433D4c8d3Ae0",
  pairAC: "0xEAa15FD4C9CA9B1EAED7E574F00d50720124f4a7",
  oracle: "0xA43d37F09515DfeEF94c53f925278BB1c1f18E4b",
};


// All swappable tokens — drives the token selector dropdowns
export const TOKENS = [
  { label: "TKA", address: ADDRESSES.tokenA, colorClass: "a" },
  { label: "TKB", address: ADDRESSES.tokenB, colorClass: "b" },
  { label: "TKC", address: ADDRESSES.tokenC, colorClass: "c" },
];

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;


export const TOKEN_LABELS = {
  [ADDRESSES.tokenA]: "TKA",
  [ADDRESSES.tokenB]: "TKB",
  [ADDRESSES.tokenC]: "TKC",
}


export const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function lpToken() view returns (address)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256)",
  "function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) returns (uint256, uint256, uint256)",
  "function removeLiquidity(uint256 liquidity, uint256 amount0Min, uint256 amount1Min, address to) returns (uint256, uint256)",
  "function swap(address tokenIn, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) returns (uint256)",
  "function MINIMUM_LIQUIDITY() view returns (uint256)",
  "function price0CumulativeLast() view returns (uint256)",
  "function price1CumulativeLast() view returns (uint256)",
  "function blockTimestampLast() view returns (uint32)",
  "event Swap(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)",
  "event Sync(uint256 reserve0, uint256 reserve1)",
];
 
export const ROUTER_ABI = [
  // Single + multi-hop swap (path-based)
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  // Multi-hop with permit (no separate approve tx)
  "function swapWithPermit(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256[] memory amounts)",
  // Quote helpers
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)",
  "function getBestAmountOut(uint256 amountIn, address tokenIn, address tokenOut, address intermediate) view returns (uint256 bestOut, address[] memory bestPath)",
  // Liquidity via router
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
];
 
export const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
];
 
export const ORACLE_ABI = [
  "function update() external",
  "function consult(address tokenIn, uint256 amountIn) view returns (uint256)",
  "function price0Average() view returns (uint256)",
  "function price1Average() view returns (uint256)",
  "function blockTimestampLast() view returns (uint32)",
  "function windowSize() view returns (uint32)",
];
 
export const LP_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]; 

 
// All pool definitions — used by the /pools discovery page
export const POOL_DEFS = [
  { label: "TKA / TKB", pair: ADDRESSES.pairAB, t0Label: "TKA", t1Label: "TKB", t0: ADDRESSES.tokenA, t1: ADDRESSES.tokenB },
  { label: "TKB / TKC", pair: ADDRESSES.pairBC, t0Label: "TKB", t1Label: "TKC", t0: ADDRESSES.tokenB, t1: ADDRESSES.tokenC },
  { label: "TKA / TKC", pair: ADDRESSES.pairAC, t0Label: "TKA", t1Label: "TKC", t0: ADDRESSES.tokenA, t1: ADDRESSES.tokenC },
];
 
// Resolve pair address for any two token addresses (order-independent)
export function getPairAddress(addrA, addrB) {
  const [a, b] = addrA.toLowerCase() < addrB.toLowerCase() ? [addrA, addrB] : [addrB, addrA];
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (aLow === ADDRESSES.tokenA.toLowerCase() && bLow === ADDRESSES.tokenB.toLowerCase()) return ADDRESSES.pairAB;
  if (aLow === ADDRESSES.tokenB.toLowerCase() && bLow === ADDRESSES.tokenC.toLowerCase()) return ADDRESSES.pairBC;
  if (aLow === ADDRESSES.tokenA.toLowerCase() && bLow === ADDRESSES.tokenC.toLowerCase()) return ADDRESSES.pairAC;
  return null;
}
 