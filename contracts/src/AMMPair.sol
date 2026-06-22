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
   }
