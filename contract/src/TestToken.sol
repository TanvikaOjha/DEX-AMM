// Why a mintable token? On testnet you need tokens to test swaps with. This gives you free tokens to play with — not how real tokens work, but perfect for building and demo-ing your DEX.


//SPDX-License-Identifier:MIT

pragma solidity ^0.8.20;
import "openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20{

    address public owner;
    constructor(string memory name, string memory symbol) ERC20(name, symbol)
    {
        owner = msg.sender;
        _mint(msg.sender, 1000000 * 10**18);
    }
 //anyone can mint this(for testnet use)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

