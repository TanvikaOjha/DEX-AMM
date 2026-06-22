// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AMMPair.sol";

contract AMMFactory {
    // token0 → token1 → pair address
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair);

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Identical tokens");
         // Sort tokens so mapping is order-independent
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(t0 != address(0), "Zero address");
        require(getPair[t0][t1] == address(0), "Pair exists");

        pair = address(new AMMPair(t0, t1));
        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair; // both directions map to same pair
        allPairs.push(pair);

        emit PairCreated(t0, t1, pair);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}