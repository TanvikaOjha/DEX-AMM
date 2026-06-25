export const ADDRESSES ={
  tokenA: 0x1cdEBb61AE8e035C0cfB6EF85BF758cDD445CD69,
  tokenB: 0xFFF10189C30481Fc275235055532d08b490ecC20,
  tokenC: 0x72D03D070731D6B6A1dc795bd0d1d1340Bb16B12,
  factory: 0xeD315DCb5B323A66D5b0cA25D30794b8365ab8Ef,
  router: 0xFA971fBaD8FD62f23d22f8F2461fb77A7ADE57EB,
  pairAB: 0x1C10EC738e5C5678518eAf4CA1C5695891945785,
  pairBC: 0x3e85d317abB3D7426Fe5c79F464C433D4c8d3Ae0,
  pairAC: 0xEAa15FD4C9CA9B1EAED7E574F00d50720124f4a7,
};



export function getPairAddress(addrA, addrB) {
  const [a, b] = addrA < addrB ? [addrA, addrB] : [addrB, addrA];
  if (a===ADDRESSES.tokenA && b===ADDRESSES.tokenB) return ADDRESSES.pairAB;
  if (a===ADDRESSES.tokenB && b===ADDRESSES.tokenC) return ADDRESSES.pairBC;
  if (a===ADDRESSES.tokenA && b===ADDRESSES.tokenC) return ADDRESSES.pairAC;
  return null;
}

export const TOKEN_LABELS = {
  [ADDRESSES.tokenA]: "TKA",
  [ADDRESSES.tokenB]: "TKB",
  [ADDRESSES.tokenC]: "TKC",
}

export const RPC_URL = "https://rpc.ankr.com/eth_sepolia";

 
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
  "event Swap(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)",
  "event Sync(uint256 reserve0, uint256 reserve1)",
];
 
export const ROUTER_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
  "function swapExactTokensForTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) returns (uint256)",
  "function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256)",
];
 
export const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
];
