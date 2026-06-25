// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TestToken is ERC20, ERC20Permit {
    address public owner;

    constructor(string memory name, string memory symbol)
         ERC20(name, symbol)
         ERC20Permit(name)
    {
        owner = msg.sender;
        // Mint 1 million tokens to deployer for testing
        _mint(msg.sender, 1000000 * 10**18);
    }

    // Anyone can mint — only for testnet use
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}