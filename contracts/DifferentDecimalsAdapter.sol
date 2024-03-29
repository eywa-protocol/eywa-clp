// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ISynth.sol";

abstract contract IERC20Extented is IERC20 {
    function decimals() public virtual view returns (uint8);
}

contract DifferentDecimalsAdapter is ISynthAdapter, Ownable {

    address public originalToken;
    uint64 public chainIdFrom;
    string public chainSymbolFrom;
    uint8 public synthType;
    uint256 public cap;
    address public synthToken;
    uint8 public decimals;  // decimals of originalToken

    constructor(
        address originalToken_,
        address synthToken_,
        uint64 chainIdFrom_,
        string memory chainSymbolFrom_,
        uint8 decimals_
    )  {
        originalToken = originalToken_;
        synthToken = synthToken_;
        chainIdFrom = chainIdFrom_;
        chainSymbolFrom = chainSymbolFrom_;
        synthType = uint8(SynthType.ThirdPartySynth);
        decimals = decimals_;
        cap = 2 ** 256 - 1;
    }

    function setCap(uint256 cap_) external onlyOwner {
        cap = cap_;
    }

    function mint(address account, uint256 amount) external onlyOwner {
        uint256 balance = ISynthERC20(synthToken).balanceOf(address(this));
        if (decimals > IERC20Extented(synthToken).decimals()) {
            amount /= 10 ** (decimals - IERC20Extented(synthToken).decimals());
        } else {
            amount *= 10 ** (IERC20Extented(synthToken).decimals() - decimals);
        }
        require(balance >= amount, "DifferentDecimalsAdapter: wrong amount");
        SafeERC20.safeTransfer(ISynthERC20(synthToken), account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        SafeERC20.safeTransferFrom(ISynthERC20(synthToken), account, address(this), amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        SafeERC20.safeTransfer(ISynthERC20(synthToken), owner(), amount);
    }

}
