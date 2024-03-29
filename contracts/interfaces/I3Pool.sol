// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

interface I3Pool {
    function get_virtual_price() external view returns (uint256);
}
