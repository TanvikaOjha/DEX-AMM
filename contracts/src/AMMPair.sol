//SPDX-License-Identifier:MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./LPToken.sol";

//core liquidity pool


contract AMMPair {
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
        reserve0 = _r0;
        reserve1 = _r1;
        emit Sync(_r0, _r1);
    }
    
    function addLiquidty(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) external nonReentrant returns(uint256 amount0, uint256 amount1, uint256 liquidity){
        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;
        uint256 totalSupply = lpToken.totalSupply();

        //first liquidity
        if(_reserve0 == 0 && _reserve1 == 0) {
            (amount0, amount1) = (amount0Desired, amount1Desired);
        } else {
            uint256 
        }
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

    function swap(address tokenIn, uint256 amountIn, uint256 amountInMin, address to, uint256 deadline) external nonReentrant returns (uint256 amountOut){
        require(block.timestamp <=deadline, "Deadline expired");
        require(tokenIn == address(token0) || tokenIn == address(token1), "Invalid Token");
        require(amountIn > 0, "Zero Input");
        require(to != address(token0) && to != address(token1), "Invalid to");

        bool zeroForOne = (token == address(token0));
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
