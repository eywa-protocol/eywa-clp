// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ISynth.sol";


interface IERC20Extented is IERC20 {
    function decimals() external view returns (uint8);
}

/**
 * @notice ISynthAdapter implemenation. Should be used as synth for synthesis in case when
 * token synth already exists and our synth can not be used.
 */
contract ThirdPartySynthAdapter is ISynthAdapter, Ownable {

    /// @dev original token address (from origin chain)
    address public originalToken;
    /// @dev origin chain id
    uint64 public chainIdFrom;
    /// @dev origin chain symbol
    string public chainSymbolFrom;
    /// @dev synth type (SynthType.ThirdPartySynth in this case)
    uint8 public synthType;
    /// @dev synth token address (in current chain)
    address public synthToken;
    /// @dev synthezation cap (controlled from synthesis)
    uint256 public cap;
    /// @dev original token decimals
    uint8 public decimals;

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
        IERC20Extented erc20Impl = IERC20Extented(synthToken);
        require(decimals_ == erc20Impl.decimals(), "ThirdPartySynthAdapter: wrong decimals");
    }

    function setCap(uint256 cap_) external onlyOwner {
        cap = cap_;
        emit CapSet(cap);
    }

    function mint(address account, uint256 amount) external onlyOwner {
        IERC20 erc20Impl = IERC20(synthToken);
        uint256 balance = erc20Impl.balanceOf(address(this));
        require(balance >= amount, "ThirdPartySynthAdapter: wrong amount");
        SafeERC20.safeTransfer(erc20Impl, account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        SafeERC20.safeTransferFrom(IERC20(synthToken), account, address(this), amount);
    }
}
