pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/TestToken.sol";
import "../src/AMMFactory.sol";
import "../src/AMMPair.sol";
import "../src/AMMRouter.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk       = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        // 1. Deploy three tokens
        TestToken tA = new TestToken("Token Alpha", "TKA");
        TestToken tB = new TestToken("Token Beta",  "TKB");
        TestToken tC = new TestToken("Token Gamma", "TKC"); 

        console.log("TKA:", address(tA));
        console.log("TKB:", address(tB));
        console.log("TKC:", address(tC));

        // 2. Deploy factory and router
        AMMFactory factory = new AMMFactory();
        AMMRouter  router  = new AMMRouter(address(factory));
        console.log("Factory:", address(factory));
        console.log("Router:",  address(router));

        // 3. Create three pairs
        address pairAB = factory.createPair(address(tA), address(tB));
        address pairBC = factory.createPair(address(tB), address(tC)); // NEW
        address pairAC = factory.createPair(address(tA), address(tC)); // NEW
        console.log("Pair TKA/TKB:", pairAB);
        console.log("Pair TKB/TKC:", pairBC);
        console.log("Pair TKA/TKC:", pairAC);

        // 4. Seed liquidity in all three pools
 {       // TKA/TKB: 1000 TKA + 2000 TKB  (price: 1 TKA = 2 TKB)
        tA.approve(address(router), 1000 ether); tB.approve(address(router), 2000 ether);
        router.addLiquidity(address(tA), address(tB), 1000 ether, 2000 ether, 0, 0, deployer, block.timestamp + 60);

 }{       // TKB/TKC: 2000 TKB + 6000 TKC  (price: 1 TKB = 3 TKC)
        tB.approve(address(router), 2000 ether); tC.approve(address(router), 6000 ether);
        router.addLiquidity(address(tB), address(tC), 2000 ether, 6000 ether, 0, 0, deployer, block.timestamp + 60);
}{
        // TKA/TKC: 1000 TKA + 6000 TKC  (price: 1 TKA = 6 TKC — consistent!)
        tA.approve(address(router), 1000 ether); tC.approve(address(router), 6000 ether);
        router.addLiquidity(address(tA), address(tC), 1000 ether, 6000 ether, 0, 0, deployer, block.timestamp + 60);
    }
        console.log("All pools sorted & seeded.");
        vm.stopBroadcast();
    }
}