// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AMMRouter.sol";
import "../src/TWAPOracle.sol";

contract DeployMissingContracts is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        address existingPairAB  =0x1C10EC738e5C5678518eAf4CA1C5695891945785; // Get this from your successful log
        TWAPOracle oracle = new TWAPOracle(existingPairAB, 300);
        console.log("New TWAP Oracle Deployed at:", address(oracle));

        vm.stopBroadcast();
    }
}