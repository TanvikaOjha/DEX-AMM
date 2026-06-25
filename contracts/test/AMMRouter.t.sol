// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AMMFactory.sol";
import "../src/AMMRouter.sol";
import "../src/AMMPair.sol";
import "../src/TestToken.sol";

contract AMMRouterTest is Test {
    AMMFactory  factory;
    AMMRouter   router;
    AMMPair     pairAB;
    AMMPair     pairBC;
    TestToken   tA; TestToken tB; TestToken tC;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        tA = new TestToken("TokenA","TKA");
        tB = new TestToken("TokenB","TKB"); 
        tC = new TestToken("TokenC","TKC");

        factory = new AMMFactory();
        router  = new AMMRouter(address(factory));
        pairAB  = AMMPair(factory.createPair(address(tA), address(tB)));
        pairBC  = AMMPair(factory.createPair(address(tB), address(tC)));
       tA.mint(address(this), 1000 ether);
       tB.mint(address(this), 4000 ether); // 2000 for AB + 2000 for BC
       tC.mint(address(this), 6000 ether);

      tA.approve(address(router), 1000 ether); 
      tB.approve(address(router), 2000 ether);
      router.addLiquidity(
        address(tA), address(tB),
        1000 ether, 2000 ether,
        0, 0,
        address(this), block.timestamp + 60
    );
    tB.approve(address(router), 2000 ether); 
    tC.approve(address(router), 6000 ether);
    router.addLiquidity(
        address(tB), address(tC),
        2000 ether, 6000 ether,
        0, 0,
        address(this), block.timestamp + 60
    );

        tA.mint(bob, 500 ether);
        tB.mint(alice, 200 ether);
    }

    function _path2(address a, address b) internal pure returns (address[] memory p) {
        p = new address[](2); p[0] = a; p[1] = b;
    }
    function _path3(address a, address b, address c) internal pure returns (address[] memory p) {
        p = new address[](3); p[0] = a; p[1] = b; p[2] = c;
    }
     // ── Single hop ───────────────────────────────────────────────
    function test_SingleHop_TKA_to_TKB() public {
        uint256 bBefore = tB.balanceOf(bob);
        vm.startPrank(bob);
        tA.approve(address(router), 10 ether);
        router.swapExactTokensForTokens(10 ether, 0, _path2(address(tA),address(tB)), bob, block.timestamp+60);
        vm.stopPrank();
        assertTrue(tB.balanceOf(bob) > bBefore);
    }

    // ── Multi-hop TKA → TKB → TKC ───────────────────────────────
    function test_MultiHop_TKA_to_TKC_via_TKB() public {
        uint256 cBefore = tC.balanceOf(bob);
        vm.startPrank(bob);
        tA.approve(address(router), 10 ether);
        router.swapExactTokensForTokens(10 ether, 0, _path3(address(tA),address(tB),address(tC)), bob, block.timestamp+60);
        vm.stopPrank();
        // TKC lands in bob's wallet
        assertTrue(tC.balanceOf(bob) > cBefore);
        // TKB never touches bob's wallet — router handled it
        assertEq(tB.balanceOf(bob), 0);
    }

    // ── Predicted output matches actual ─────────────────────────
    function test_GetAmountsOut_MatchesActualOutput() public {
        address[] memory path = _path3(address(tA),address(tB),address(tC));
        uint256[] memory amounts = router.getAmountsOut(10 ether, path);
        uint256 cBefore = tC.balanceOf(bob);
        vm.startPrank(bob);
        tA.approve(address(router), 10 ether);
        router.swapExactTokensForTokens(10 ether, 0, path, bob, block.timestamp+60);
        vm.stopPrank();
        assertEq(tC.balanceOf(bob) - cBefore, amounts[2]); // exact match
    }

    // ── Router slippage protection ───────────────────────────────
    function test_Router_RevertWhen_SlippageExceeded() public {
        vm.startPrank(bob);
        tA.approve(address(router), 10 ether);
        vm.expectRevert("Slippage: insufficient output");
        router.swapExactTokensForTokens(10 ether, type(uint256).max, _path2(address(tA),address(tB)), bob, block.timestamp+60);
        vm.stopPrank();
    }

    // ── Router deadline protection ───────────────────────────────
    function test_Router_RevertWhen_DeadlineExpired() public {
        vm.warp(block.timestamp + 1000);
        vm.startPrank(bob);
        tA.approve(address(router), 10 ether);
        vm.expectRevert("Router: expired");
        router.swapExactTokensForTokens(10 ether, 0, _path2(address(tA),address(tB)), bob, block.timestamp - 1);
        vm.stopPrank();
    }

    // ── Router add liquidity ─────────────────────────────────────
    function test_Router_AddLiquidity() public {
        vm.startPrank(alice);
        tA.mint(alice, 100 ether);
        tA.approve(address(router), 100 ether);
        tB.approve(address(router), 200 ether);
        router.addLiquidity(address(tA),address(tB),100 ether,200 ether,0,0,alice,block.timestamp+60);
        vm.stopPrank();
        assertTrue(pairAB.lpToken().balanceOf(alice) > 0);
    }

    // ── Path must have at least 2 tokens ────────────────────────
    function test_Router_RevertWhen_PathTooShort() public {
        address[] memory shortPath = new address[](1);
        shortPath[0] = address(tA);
        vm.expectRevert("Invalid path");
        router.swapExactTokensForTokens(10 ether, 0, shortPath, bob, block.timestamp+60);
    }

    // ── Fuzz: any valid amount, predicted output always matches ──
    function testFuzz_Router_PredictionAlwaysMatchesExecution(uint256 amountIn) public {
        amountIn = bound(amountIn, 1, 100 ether);
        tA.mint(bob, amountIn);
        address[] memory path = _path2(address(tA),address(tB));
        uint256[] memory predicted = router.getAmountsOut(amountIn, path);
        uint256 bBefore = tB.balanceOf(bob);
        vm.startPrank(bob);
        tA.approve(address(router), amountIn);
        router.swapExactTokensForTokens(amountIn, 0, path, bob, block.timestamp+60);
        vm.stopPrank();
        assertEq(tB.balanceOf(bob) - bBefore, predicted[1]);
    }

    // ── Fuzz: multi-hop always produces non-zero output ─────────
    function testFuzz_MultiHop_AlwaysProducesOutput(uint256 amountIn) public {
        amountIn = bound(amountIn, 1, 50 ether);
        tA.mint(bob, amountIn);
        uint256 cBefore = tC.balanceOf(bob);
        vm.startPrank(bob);
        tA.approve(address(router), amountIn);
        router.swapExactTokensForTokens(amountIn, 0, _path3(address(tA),address(tB),address(tC)), bob, block.timestamp+60);
        vm.stopPrank();
        assertTrue(tC.balanceOf(bob) > cBefore);
    }
}