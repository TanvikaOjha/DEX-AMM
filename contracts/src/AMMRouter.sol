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
        (amountA, amountB, liquidity) = pair.addLiquidity(
            isAToken0 ? amountADesired : amountBDesired,
            isAToken0 ? amountBDesired : amountADesired,
            isAToken0 ? amountAMin    : amountBMin,
            isAToken0 ? amountBMin    : amountAMin,
            to
        );

        // Refund any unused tokens
        uint256 refA = IERC20(tokenA).balanceOf(address(this));
        uint256 refB = IERC20(tokenB).balanceOf(address(this));
        if (refA > 0) IERC20(tokenA).transfer(msg.sender, refA);
        if (refB > 0) IERC20(tokenB).transfer(msg.sender, refB);
    }

    // ── Swap exact tokens in ─────────────────────────────────────
    function swapExactTokensForTokens(
        address tokenIn,  address tokenOut,uint256 amountIn, uint256 amountOutMin,address to,uint256 deadline) external ensure(deadline) returns (uint256 amountOut) {
        AMMPair pair = _getPair(tokenIn, tokenOut);
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(pair), amountIn);
        amountOut = pair.swap(tokenIn, amountIn, amountOutMin, to, deadline);
    }

    //  Quote-get output for input without swapping 
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        AMMPair pair = _getPair(tokenIn, tokenOut);
        (uint256 r0, uint256 r1) = (pair.reserve0(), pair.reserve1());
        bool zeroForOne = (address(pair.token0()) == tokenIn);
        return pair.getAmountOut(amountIn, zeroForOne ? r0 : r1, zeroForOne ? r1 : r0);
    }
}