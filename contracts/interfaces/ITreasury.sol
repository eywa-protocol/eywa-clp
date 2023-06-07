// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface ITreasury {
    
    function withdraw(
        string calldata reason,
        address token,
        uint256 amount,
        address to
    ) external;
    
}