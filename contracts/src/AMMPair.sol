//SPDX-License-Identifier:MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./LPToken.sol";

library UQ112x112 {
    uint224 constant Q112 = 2**112;
    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112;
    }
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        z = x / uint224(y);
    }
}

//core liquidity pool


contract AMMPair {
    using UQ112x112 for uint224;

    uint256 public price0CumulativeLast; // price of token0 in token1, accumulated × seconds
    uint256 public price1CumulativeLast; // price of token1 in token0, accumulated × seconds
    uint32  public blockTimestampLast;   // timestamp of last update

    IERC20 public immutable token0;
    IERC20 public immutable token1;
    LPToken public immutable lpToken;
    
    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public constant MINIMUM_LIQUIDITY = 1000; //locked forever
    uint256 private _unlocked =1;      //reentrancy lock
     

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 lpMinted);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 lpBurned);
    event Swap(address indexed user, address tokenIn,uint256 amountIn, address tokenOut, uint256 amountOut);
    event Sync(uint256 reserve0, uint256 reserve1);

    modifier nonReentrant(){
        require(_unlocked ==1, "Reentrancy");
        _unlocked =2;
        _;
        _unlocked =1;
    }

    constructor(address _token0, address _token1) {
        (address t0, address t1) = _token0 < _token1 ? (_token0, _token1): (_token1, _token0);
        token0 = IERC20(t0);
        token1 = IERC20(t1);
        lpToken = new LPToken("AMM LP Token", "ALP");
    }

   function _update(uint256 _r0, uint256 _r1) private {
    // ── TWAP accumulation ─────────────────────────────────────
    uint32  blockTs      = uint32(block.timestamp);
    uint32  timeElapsed  = blockTs - blockTimestampLast;

    // Only accumulate if time has passed and pool has reserves
    // (prevents division by zero on first deposit)
    if (timeElapsed > 0 && reserve0 > 0 && reserve1 > 0) {
        // price0 = reserve1 / reserve0 (how much token1 per token0)
        // Stored as UQ112x112 × timeElapsed to prevent overflow
        price0CumulativeLast +=
            uint256(UQ112x112.encode(uint112(reserve1)).uqdiv(uint112(reserve0)))
            * timeElapsed;

        price1CumulativeLast +=
            uint256(UQ112x112.encode(uint112(reserve0)).uqdiv(uint112(reserve1)))
            * timeElapsed;
    }

    reserve0           = _r0;
    reserve1           = _r1;
    blockTimestampLast = blockTs;
    emit Sync(_r0, _r1);
}
    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) external nonReentrant returns(uint256 amount0, uint256 amount1, uint256 liquidity){
        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;
        uint256 totalSupply = lpToken.totalSupply();

        //first liquidity: use desired amount as is.
        if(_reserve0 == 0 && _reserve1 == 0) {
            (amount0, amount1) = (amount0Desired, amount1Desired);
        } else {
            //calculate optimal amount maintaining current ratio
            uint256 amount1Optimal =   amount0Desired * _reserve1 / _reserve0;
            if (amount1Optimal <= amount1Desired) {
                require(amount1Optimal >= amount1Min, "Insufficient token1");
                (amount0, amount1) = (amount0Desired, amount1Optimal);
            } else {
                uint256 amount0Optimal = amount1Desired * _reserve0 / _reserve1;
                require(amount0Optimal >= amount0Min, "Insufficient token0");
                (amount0, amount1) = (amount0Optimal, amount1Desired);
            }
        }

         //router will transfer to pair contract.
        token0.transferFrom(msg.sender, address(this), amount0);
        token1.transferFrom(msg.sender, address(this), amount1);
        
        if (totalSupply == 0) {
            // First LP: geometric mean, lock MINIMUM_LIQUIDITY forever
         liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
        lpToken.mint(address(0xdead), MINIMUM_LIQUIDITY); // lock minimum
        } else {
            // Proportional to existing pool
            liquidity = Math.min(amount0 * totalSupply / _reserve0,amount1 * totalSupply / _reserve1);
        }
        require(liquidity > 0, "Insufficient liquidity minted");
        lpToken.mint(to, liquidity);

        _update(token0.balanceOf(address(this)),token1.balanceOf(address(this)));
        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }



    function removeLiquidity(uint256 liquidity, uint256 amount0Min, uint256 amount1Min, address to) external nonReentrant returns (uint256 amount0, uint256 amount1){
        uint256 totalSupply = lpToken.totalSupply();
        require(totalSupply > 0, "No liquidity");

        // Your share = (your LP tokens / total LP) × reserves
        amount0 = liquidity * reserve0 / totalSupply;
        amount1 = liquidity * reserve1 / totalSupply;

        require(amount0 >= amount0Min, "Insufficient token0 out");
        require(amount1 >= amount1Min, "Insufficient token1 out");
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");

        lpToken.burn(msg.sender, liquidity);
        token0.transfer(to, amount0);
        token1.transfer(to, amount1);

        _update(token0.balanceOf(address(this)),token1.balanceOf(address(this)));
        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }
        
    



    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut){
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getToken0Price() external view returns (uint256) {
        if(reserve0 == 0) return 0;
        return reserve1 * 1e18 /reserve0;
    }
    function getToken1Price() external view returns (uint256) {
        if (reserve1 == 0) return 0;
        return reserve0 * 1e18 / reserve1; 
    }

    function swap(address tokenIn, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external nonReentrant returns (uint256 amountOut){
        require(block.timestamp <=deadline, "Deadline expired");
        require(tokenIn == address(token0) || tokenIn == address(token1), "Invalid Token");
        require(amountIn > 0, "Zero Input");
        require(to != address(token0) && to != address(token1), "Invalid to");

        bool zeroForOne = (tokenIn == address(token0));
        IERC20 tokenOut = zeroForOne ? token1 : token0;
        uint256 rIn        = zeroForOne ? reserve0 : reserve1;
        uint256 rOut       = zeroForOne ? reserve1 : reserve0;

         amountOut = getAmountOut(amountIn, rIn, rOut);
        require(amountOut >= amountOutMin, "Slippage: insufficient output");
        require(amountOut < rOut, "Insufficient liquidity");

         IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        tokenOut.transfer(to, amountOut);
        

          _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
         emit Swap(msg.sender, tokenIn, amountIn, address(tokenOut), amountOut);

    }
   }
