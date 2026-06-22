//LP tokens represent your share of the pool.

//SPDX-License-Identifier:MIT

pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20{
    address public immutable pair;

    constructor(string memory name, string memory symbol) ERC20(name, symbol)
    {
        pair = msg.sender;
    }

    modifier onlyPair() {
        require(msg.sender == pair, "Only pair");
        _;
    }

    function mint(address to, uint256 amount) external onlyPair{
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyPair {
        _burn(from, amount);
    }
}