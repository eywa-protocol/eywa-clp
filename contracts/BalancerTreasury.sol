// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Treasury.sol";


contract BalancerTreasury is Treasury, AccessControlEnumerable, ReentrancyGuard {
    
    /// @dev balancer role id
    bytes32 public constant BALANCER_ROLE = keccak256("BALANCER_ROLE");

    modifier onlyTrusted() {
        require(
            hasRole(BALANCER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "EywaTreasury: only trusted"
        );
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function withdraw(
        string calldata reason,
        address token,
        uint256 amount,
        address to
    ) public nonReentrant onlyTrusted {
        _withdraw(reason, token, amount, to);
    }
}
