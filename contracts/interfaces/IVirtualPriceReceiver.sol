// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;


interface IVirtualPriceReceiver {
    function receiveVirtualPrice(uint256 virtualPrice_, uint64 chainIdFrom) external;
}
