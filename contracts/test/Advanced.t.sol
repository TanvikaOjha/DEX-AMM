//SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AMMFactory.sol";
import "../src/AMMRouter.sol";
import "../src/AMMPair.sol";
import "../src/TWAPOracle.sol";
import "../src/TestToken.sol";

contract AdvancedTest is Test {
    AMMPair pair;
    AMMRouter router;
    TWAPOracle oracle;
    TestToken tA;
    TestToken tB;

    address alice;
    uint256 aliceKey = 0xA11CE;

    function setUp() public {
        tA = new TestToken("TokenA", "TKA");
        tB = new TestToken("TokenB", "TKB");
        AMMFactory factory = new AMMFactory();
        router = new AMMRouter(address(factory));
        pair = AMMPair(factory.createPair(address(tA), address(tB)));
         
        tA.mint(address(this), 1000 ether);
        tB.mint(address(this), 2000 ether);
        tA.approve(address(router), 1000 ether);
        tB.approve(address(router), 2000 ether);
        router.addLiquidity(
            address(tA), address(tB),
            1000 ether, 2000 ether,
            0, 0,
            address(this), block.timestamp + 60
        );
        oracle = new TWAPOracle(address(pair), 300); // 5 min window

        alice = vm.addr(aliceKey);
        tA.mint(alice, 100 ether);
    }

    // ── TWAP Test 1: Cumulative price accumulates over time ──────
    function test_TWAP_CumulativePriceAccumulates() public {
        uint256 cum0Before = pair.price0CumulativeLast();
        // Do a swap to trigger _update() which accumulates price
        tA.mint(address(this), 10 ether);
        tA.approve(address(pair), 10 ether);
        vm.warp(block.timestamp + 60); // let 60 seconds pass first
        pair.swap(
            address(tA),
            10 ether,
            0,
            address(this),
            block.timestamp + 60
        );
        assertTrue(pair.price0CumulativeLast() > cum0Before);
    }

    // ── TWAP Test 2: oracle.update() works after window passes ──
    function test_TWAP_UpdateSucceedsAfterWindow() public {
        vm.warp(block.timestamp + 1);
        tA.mint(address(this), 10 ether);
        tA.approve(address(pair), 10 ether);
        pair.swap(
            address(tA),
            10 ether,
            0,
            address(this),
            block.timestamp + 60
        );

        vm.warp(block.timestamp + 301); // past the 5-minute window
        oracle.update(); // should not revert

        uint256 twapOut = oracle.consult(address(tA), 1 ether);
        assertTrue(twapOut > 0);
    }

    // ── TWAP Test 3: update reverts before window elapses ───────
    function test_TWAP_RevertWhen_UpdatedTooSoon() public {
        vm.expectRevert("Update too soon");
        oracle.update();
    }

    // ── Permit Test 1: Swap without separate approve tx ─────────
    function test_Permit_SwapWithoutSeparateApprove() public {
        address[] memory path = new address[](2);
        path[0] = address(tA);
        path[1] = address(tB);

        uint256 deadline = block.timestamp + 300;
        uint256 nonce = tA.nonces(alice);

        // Build the EIP-712 permit digest
        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(abi.encode(
                PERMIT_TYPEHASH, alice, address(router), 10 ether, nonce, deadline));
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", tA.DOMAIN_SEPARATOR(), structHash)
        );

        // Sign with alice's known private key (Foundry cheatcode)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);

        uint256 bBefore = tB.balanceOf(alice);
        vm.prank(alice);
        // Alice never called approve() — permit does it inside the same tx
        router.swapWithPermit(10 ether, 0, path, alice, deadline, v, r, s);

        assertTrue(tB.balanceOf(alice) > bBefore);
        // Allowance should now be 0 (consumed by the swap)
        assertEq(tA.allowance(alice, address(router)), 0);
    }

    // ── Permit Test 2: Signature from wrong signer reverts ───────
    function test_Permit_RevertWhen_WrongSigner() public {
        address[] memory path = new address[](2);
        path[0] = address(tA);
        path[1] = address(tB);
        uint256 deadline = block.timestamp + 300;

        // Build same digest but sign with a DIFFERENT key (not alice's)
        uint256 wrongKey = 0xBAD;
        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                alice,
                address(router),
                10 ether,
                tA.nonces(alice),
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", tA.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);

        vm.prank(alice);
        vm.expectRevert(); // ERC20Permit will revert — invalid signature
        router.swapWithPermit(10 ether, 0, path, alice, deadline, v, r, s);

    }

    // ── Permit Test 3: Expired permit deadline reverts ───────────
    function test_Permit_RevertWhen_PermitExpired() public {
        address[] memory path = new address[](2);
        path[0] = address(tA);
        path[1] = address(tB);
        uint256 deadline = block.timestamp + 60;

        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                alice,
                address(router),
                10 ether,
                tA.nonces(alice),
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", tA.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);

        vm.warp(block.timestamp + 120); // past the permit deadline
        vm.prank(alice);
        vm.expectRevert(); // ERC20Permit will revert — deadline passed
        router.swapWithPermit(10 ether, 0, path, alice, deadline, v, r, s);
    }
}
