// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Treasury.sol";


contract FeesTreasury is Treasury, Ownable2Step, ReentrancyGuard {

    function withdraw(
        string calldata reason,
        address token,
        uint256 amount,
        address to
    ) public nonReentrant onlyOwner {
        _withdraw(reason, token, amount, to);
    }

}
