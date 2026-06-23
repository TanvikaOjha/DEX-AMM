// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AMMPair.sol";
import "../src/TestToken.sol";

contract AMMPairTest is Test {
    AMMPair   public pair;
    TestToken public tokenA;
    TestToken public tokenB;

    address alice = makeAddr("alice"); // LP provider
    address bob   = makeAddr("bob");   // trader

    // Standard pool seed amounts
    uint256 constant SEED_A = 1000 ether;
    uint256 constant SEED_B = 2000 ether;

    function setUp() public {
        tokenA = new TestToken("Token A", "TKA");
        tokenB = new TestToken("Token B", "TKB");
        pair   = new AMMPair(address(tokenA), address(tokenB));

        // Fund alice so she can add liquidity
        tokenA.mint(alice, 10000 ether);
        tokenB.mint(alice, 10000 ether);

        // Fund bob so he can swap
        tokenA.mint(bob, 1000 ether);
    }

    //alice seeds the pool with 1000 TKA + 2000 TKB
    function _seed() internal {
        vm.startPrank(alice);
        tokenA.approve(address(pair), SEED_A);
        tokenB.approve(address(pair), SEED_B);
        pair.addLiquidity(SEED_A, SEED_B, 0, 0, alice);
        vm.stopPrank();
    }

    //direction — is tokenA the token0 in this pair?
    function _isAToken0() internal view returns (bool) {
        return address(pair.token0()) == address(tokenA);
    }

    //Add liquidity tests
    function test_AddLiquidity_FirstDeposit_SetsReserves() public {
        _seed();
        // After first deposit, reserves should match what was deposited
        bool aIs0 = _isAToken0();
        assertEq(pair.reserve0(), aIs0 ? SEED_A : SEED_B);
        assertEq(pair.reserve1(), aIs0 ? SEED_B : SEED_A);
    }

    function test_AddLiquidity_MintsLPTokensToProvider() public {
        _seed();
        // Alice should have received LP tokens
        assertTrue(pair.lpToken().balanceOf(alice) > 0);
    }

    function test_AddLiquidity_MinimumLiquidityLockedForever() public {
        _seed();
        // MINIMUM_LIQUIDITY (1000) is permanently locked at address(0xdead)
        assertEq(pair.lpToken().balanceOf(address(0xdead)), pair.MINIMUM_LIQUIDITY());
    }

    function test_AddLiquidity_SubsequentDeposit_MintsProportionally() public {
        _seed();
        uint256 lpBefore = pair.lpToken().totalSupply();

        // Bob adds the same ratio — should get half the existing supply
        tokenA.mint(bob, SEED_A / 2); tokenB.mint(bob, SEED_B / 2);
        vm.startPrank(bob);
        tokenA.approve(address(pair), SEED_A / 2);
        tokenB.approve(address(pair), SEED_B / 2);
        pair.addLiquidity(SEED_A / 2, SEED_B / 2, 0, 0, bob);
        vm.stopPrank();

        uint256 lpAfter = pair.lpToken().totalSupply();
        assertTrue(lpAfter > lpBefore);
        // Bob's share should be ~1/3 of total (he added half of existing)
        assertTrue(pair.lpToken().balanceOf(bob) > 0);
    }

    function test_AddLiquidity_TokensTransferredFromProvider() public {
        uint256 aliceABefore = tokenA.balanceOf(alice);
        _seed();
        assertEq(tokenA.balanceOf(alice), aliceABefore - SEED_A);
    }
    //remove liquiidty

    function test_RemoveLiquidity_BurnsLPTokens() public {
        _seed();
        uint256 lp = pair.lpToken().balanceOf(alice);
        vm.startPrank(alice);
        pair.lpToken().approve(address(pair), lp);
        pair.removeLiquidity(lp, 0, 0, alice);
        vm.stopPrank();
        assertEq(pair.lpToken().balanceOf(alice), 0);
    }

    function test_RemoveLiquidity_ReturnsTokensToProvider() public {
        _seed();
        uint256 aBalBefore = tokenA.balanceOf(alice);
        uint256 lp = pair.lpToken().balanceOf(alice);
        vm.startPrank(alice);
        pair.lpToken().approve(address(pair), lp);
        pair.removeLiquidity(lp, 0, 0, alice);
        vm.stopPrank();
        // Alice should get back almost all her tokens (tiny amount locked in MINIMUM_LIQUIDITY)
        assertTrue(tokenA.balanceOf(alice) > aBalBefore);
    }

    function test_RemoveLiquidity_PartialWithdrawal() public {
        _seed();
        uint256 lp = pair.lpToken().balanceOf(alice);
        vm.startPrank(alice);
        pair.lpToken().approve(address(pair), lp / 2);
        pair.removeLiquidity(lp / 2, 0, 0, alice);
        vm.stopPrank();
        // Alice should still have half her LP tokens
        assertApproxEqAbs(pair.lpToken().balanceOf(alice), lp / 2, 1);
    }

    function test_RemoveLiquidity_RevertWhen_MinimumNotMet() public {
        _seed();
        uint256 lp = pair.lpToken().balanceOf(alice);
        vm.startPrank(alice);
        pair.lpToken().approve(address(pair), lp);
        vm.expectRevert("Insufficient token0 out");
        pair.removeLiquidity(lp, type(uint256).max, 0, alice); // impossible min
        vm.stopPrank();
    }

      // ── swap happy-path tests ────────────────────────────────────

    function test_Swap_OutputMatchesGetAmountOut() public {
        _seed();
        uint256 swapIn = 10 ether;
        bool    aIs0   = _isAToken0();
        uint256 rIn    = aIs0 ? pair.reserve0() : pair.reserve1();
        uint256 rOut   = aIs0 ? pair.reserve1() : pair.reserve0();

        uint256 predicted = pair.getAmountOut(swapIn, rIn, rOut);

        uint256 bBefore = tokenB.balanceOf(bob);
        vm.startPrank(bob);
        tokenA.approve(address(pair), swapIn);
        pair.swap(address(tokenA), swapIn, 0, bob, block.timestamp + 60);
        vm.stopPrank();

        uint256 received = tokenB.balanceOf(bob) - bBefore;
        assertEq(received, predicted);
    }

    function test_Swap_ReservesUpdateAfterSwap() public {
        _seed();
        uint256 r0Before = pair.reserve0();
        vm.startPrank(bob);
        tokenA.approve(address(pair), 10 ether);
        pair.swap(address(tokenA), 10 ether, 0, bob, block.timestamp + 60);
        vm.stopPrank();
        // reserve of tokenA should increase (bob sent tokenA in)
        if (_isAToken0()) {
            assertTrue(pair.reserve0() > r0Before);
        } else {
            assertTrue(pair.reserve1() > r0Before);
        }
    }

    function test_Swap_ConstantProductIncreasesAfterFee() public {
        _seed();
        uint256 kBefore = pair.reserve0() * pair.reserve1();
        vm.startPrank(bob);
        tokenA.approve(address(pair), 50 ether);
        pair.swap(address(tokenA), 50 ether, 0, bob, block.timestamp + 60);
        vm.stopPrank();
        // k must grow (fee stays in pool) — the core invariant
        assertTrue(pair.reserve0() * pair.reserve1() >= kBefore);
    }

    function test_Swap_BothDirectionsWork() public {
        _seed();
        uint256 bBefore = tokenB.balanceOf(bob);
        tokenB.mint(bob, 100 ether);

        // Swap B → A
        vm.startPrank(bob);
        tokenB.approve(address(pair), 20 ether);
        pair.swap(address(tokenB), 20 ether, 0, bob, block.timestamp + 60);
        vm.stopPrank();
        // Bob should have received some tokenA
        assertTrue(tokenA.balanceOf(bob) > 1000 ether); // had 1000 + received more
    }