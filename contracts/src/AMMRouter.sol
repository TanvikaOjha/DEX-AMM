// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
import "./AMMFactory.sol";
import "./AMMPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AMMRouter {
    AMMFactory public immutable factory;

    constructor(address _factory) {
        factory = AMMFactory(_factory);
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Router: expired");
        _;
    }

    function _getPair(address tokenA, address tokenB) internal view returns (AMMPair) {
        address pairAddr = factory.getPair(tokenA, tokenB);
        require(pairAddr != address(0), "Pair not found");
        return AMMPair(pairAddr);
    }

    //  Add liquidity via router 
    function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin,address to, uint256 deadline) external ensure(deadline)
    returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        AMMPair pair = _getPair(tokenA, tokenB);

        // Pull tokens from user to router, then approve pair
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);
        IERC20(tokenA).approve(address(pair), amountADesired);
        IERC20(tokenB).approve(address(pair), amountBDesired);

        // Determine pair token ordering
        bool isAToken0 = (address(pair.token0()) == tokenA);
        (amountA, amountB, liquidity) = pair.addLiquidity(isAToken0 ? amountADesired : amountBDesired, isAToken0 ? amountBDesired : amountADesired,
            isAToken0 ? amountAMin : amountBMin, isAToken0 ? amountBMin : amountAMin,to);

        // Refund any unused tokens
        uint256 refA = IERC20(tokenA).balanceOf(address(this));
        uint256 refB = IERC20(tokenB).balanceOf(address(this));
        if (refA > 0) IERC20(tokenA).transfer(msg.sender, refA);
        if (refB > 0) IERC20(tokenB).transfer(msg.sender, refB);
    }

    // ── Swap exact tokens in ─────────────────────────────────────
   function swapExactTokensForTokens(
    uint256   amountIn,
    uint256   amountOutMin,  // slippage: minimum final output
    address[] calldata path, // e.g. [TKA, TKB, TKC]
    address   to,
    uint256   deadline
) external ensure(deadline) returns (uint256[] memory amounts) {
    require(path.length >= 2, "Invalid path");

    // Pre-compute all hop amounts (read-only, no state change yet)
    amounts = getAmountsOut(amountIn, path);
    require(amounts[amounts.length - 1] >= amountOutMin, "Slippage: insufficient output");

    // Pull amountIn of first token from user into this router
    IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]);

    // Execute each hop
    for (uint256 i = 0; i < path.length - 1; i++) {
        address pairAddr = factory.getPair(path[i], path[i+1]);
        bool    isLast   = (i == path.length - 2);

        // Approve pair to pull tokens from router
        IERC20(path[i]).approve(pairAddr, amounts[i]);

        // Send output to: next pair (if another hop) or final recipient
        address recipient = isLast ? to : address(this);

        AMMPair(pairAddr).swap(
            path[i],
            amounts[i],
            amounts[i+1],   // exact minimum (our pre-computation is exact)
            recipient,
            deadline
        );
    }
    // amounts[last] = how much tokenOut the recipient got
}

    //  Quote-get output for input without swapping 
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        AMMPair pair = _getPair(tokenIn, tokenOut);
        (uint256 r0, uint256 r1) = (pair.reserve0(), pair.reserve1());
        bool zeroForOne = (address(pair.token0()) == tokenIn);
        return pair.getAmountOut(amountIn, zeroForOne ? r0 : r1, zeroForOne ? r1 : r0);
    }
    function getAmountsOut(uint256 amountIn, address[] memory path)
    public view
    returns (uint256[] memory amounts)
{
    require(path.length >= 2, "Invalid path");
    amounts = new uint256[](path.length);
    amounts[0] = amountIn;

    for (uint256 i = 0; i < path.length - 1; i++) {
        address pairAddr = factory.getPair(path[i], path[i+1]);
        require(pairAddr != address(0), "No pair for hop");
        AMMPair pair = AMMPair(pairAddr);

        bool    zeroForOne = address(pair.token0()) == path[i];
        uint256 rIn        = zeroForOne ? pair.reserve0() : pair.reserve1();
        uint256 rOut       = zeroForOne ? pair.reserve1() : pair.reserve0();

        amounts[i+1] = pair.getAmountOut(amounts[i], rIn, rOut);
    }
}

// Convenience: best 2-hop path or direct — compare and return the higher output
function getBestAmountOut(
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    address intermediate  // address(0) to skip 2-hop comparison
) external view returns (uint256 bestOut, address[] memory bestPath) {
    // Option A: direct swap
    address directPair = factory.getPair(tokenIn, tokenOut);
    uint256 directOut  = 0;
    if (directPair != address(0)) {
        address[] memory directPath = new address[](2);
        directPath[0] = tokenIn; directPath[1] = tokenOut;
        directOut = getAmountsOut(amountIn, directPath)[1];
    }

    // Option B: 2-hop via intermediate
    uint256 hopOut = 0;
    if (intermediate != address(0)) {
        address[] memory hopPath = new address[](3);
        hopPath[0] = tokenIn; hopPath[1] = intermediate; hopPath[2] = tokenOut;
        if (factory.getPair(tokenIn, intermediate) != address(0) &&
            factory.getPair(intermediate, tokenOut) != address(0)) {
            hopOut = getAmountsOut(amountIn, hopPath)[2];
        }
    }

    if (directOut >= hopOut) {
        bestOut  = directOut;
        bestPath = new address[](2);
        bestPath[0] = tokenIn; bestPath[1] = tokenOut;
    } else {
        bestOut  = hopOut;
        bestPath = new address[](3);
        bestPath[0] = tokenIn; bestPath[1] = intermediate; bestPath[2] = tokenOut;
    }
}
}