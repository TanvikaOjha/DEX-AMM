// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./AMMPair.sol";

// TWAPOracle — reads the price oracle from AMMPair.
// Deploy once per pair you want to track.
// Call update() regularly (e.g. every 30 minutes) to advance the window.
// Call consult() to read the TWAP for a given input amount.
contract TWAPOracle {
    AMMPair public immutable pair;
    uint32  public immutable windowSize; // seconds to average over (e.g. 1800 = 30 min)

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32  public blockTimestampLast;

    uint256 public price0Average; // stored as UQ112x112
    uint256 public price1Average;

    uint256 constant Q112 = 2**112;

    constructor(address _pair, uint32 _windowSize) {
        pair       = AMMPair(_pair);
        windowSize = _windowSize;
        // Seed with current values
        price0CumulativeLast = pair.price0CumulativeLast();
        price1CumulativeLast = pair.price1CumulativeLast();
        blockTimestampLast   = pair.blockTimestampLast();
    }

    // Call this periodically to update the TWAP.
    // Will revert if called too soon (< windowSize seconds).
    function update() external {
        uint32  blockTs     = uint32(block.timestamp);
        uint32  elapsed     = blockTs - blockTimestampLast;
        require(elapsed >= windowSize, "Update too soon");

        uint256 p0Cum = pair.price0CumulativeLast();
        uint256 p1Cum = pair.price1CumulativeLast();

        // Average = (currentCumulative - lastCumulative) / timeElapsed
        price0Average = (p0Cum - price0CumulativeLast) / elapsed;
        price1Average = (p1Cum - price1CumulativeLast) / elapsed;

        price0CumulativeLast = p0Cum;
        price1CumulativeLast = p1Cum;
        blockTimestampLast   = blockTs;
    }

    // Given an amountIn of token0 (or token1), return the TWAP-priced amountOut.
    function consult(address tokenIn, uint256 amountIn)
        external view
        returns (uint256 amountOut)
    {
        if (tokenIn == address(pair.token0())) {
            amountOut = (price0Average * amountIn) / Q112;
        } else {
            amountOut = (price1Average * amountIn) / Q112;
        }
    }
}