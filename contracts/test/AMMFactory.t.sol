// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AMMFactory.sol";
import "../src/TestToken.sol";

contract AMMFactoryTest is Test {
    AMMFactory factory;
    TestToken  tokenA;
    TestToken  tokenB;
    TestToken  tokenC;

    function setUp() public {
        factory = new AMMFactory();
        tokenA  = new TestToken("A", "TKA");
        tokenB  = new TestToken("B", "TKB");
        tokenC  = new TestToken("C", "TKC");
    }

    //  createPair returns a valid address 
    function test_CreatePair_ReturnsNonZeroAddress() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        assertTrue(pair != address(0));
    }

    //   Pair registered in both lookup directions 
    function test_GetPair_BothDirectionsWork() public {
        factory.createPair(address(tokenA), address(tokenB));
        address ab = factory.getPair(address(tokenA), address(tokenB));
        address ba = factory.getPair(address(tokenB), address(tokenA));
        assertEq(ab, ba); // same pair, regardless of order
        assertTrue(ab != address(0));
    }

    //Duplicate pair reverts
    function test_CreatePair_RevertWhen_PairAlreadyExists() public {
        factory.createPair(address(tokenA), address(tokenB));
        vm.expectRevert("Pair exists");
        factory.createPair(address(tokenA), address(tokenB));
    }

    // allPairsLength tracks correctly
    function test_AllPairsLength_IncrementsPerPair() public {
        assertEq(factory.allPairsLength(), 0);
        factory.createPair(address(tokenA), address(tokenB));
        assertEq(factory.allPairsLength(), 1);
        factory.createPair(address(tokenB), address(tokenC));
        assertEq(factory.allPairsLength(), 2);
    }

    //  Identical tokens revert
    function test_CreatePair_RevertWhen_IdenticalTokens() public {
        vm.expectRevert("Identical tokens");
        factory.createPair(address(tokenA), address(tokenA));
    }
}