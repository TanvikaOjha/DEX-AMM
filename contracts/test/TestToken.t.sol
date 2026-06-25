//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import '../src/TestToken.sol';


contract TestTokenTest is Test {
    TestToken public token;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new TestToken("TokenA", "TKA");
    }

    function test_ConstructorMintsOneMillionTokens() public view{
        assertEq(token.balanceOf(owner), 1000000*10**18);
    }

    function test_NameAndSymbol() public view {
        assertEq(token.name(), "TokenA");
        assertEq(token.symbol(), "TKA");
    }
    function test_MintToAddress() public {
        token.mint(alice, 500 ether);
        assertEq(token.balanceOf(alice), 500 ether);
    }

    function test_Transfer() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
        assertEq(token.balanceOf(owner), 1000000 ether -100 ether);
    }

    function test_Approve() public {
        token.approve(alice, 200 ether);
        assertEq(token.allowance(owner, alice), 200 ether);
    }

    function test_TransferFrom() public {
        token.approve(alice, 200 ether);
        vm.prank(alice);
        token.transferFrom(owner, bob, 200 ether);
        assertEq(token.balanceOf(bob), 200 ether);
        assertEq(token.allowance(owner, alice), 0);
    }
}