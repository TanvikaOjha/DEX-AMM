// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LPToken.sol";


contract LPTokenTest is Test {
    LPToken public lp;

    address pair    = address(this); // test contract = simulated pair
    address alice   = makeAddr("alice");
    address attacker = makeAddr("attacker");

    function setUp() public {
        //deployer (this contract) becomes the pair
        lp = new LPToken("AMM LP Token", "ALP");
    }

    //pair address stored correctly
    function test_PairAddressSetInConstructor() public view {
        assertEq(lp.pair(), pair);
    }

    function test_PairCanMint() public {
        lp.mint(alice, 100 ether); // called from address(this) = pair 
        assertEq(lp.balanceOf(alice), 100 ether);
    }

    function test_PairCanBurn() public {
        lp.mint(alice, 100 ether);
        lp.burn(alice, 40 ether);
        assertEq(lp.balanceOf(alice), 60 ether);
    }

    function test_RevertWhen_NonPairTriesToMint() public {
        vm.prank(attacker);
        vm.expectRevert("Only pair");
        lp.mint(attacker, 1000 ether);
    }
}