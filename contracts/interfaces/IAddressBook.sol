// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;


interface IAddressBook {
    /// @dev returns portal by given chainId
    function portal(uint64 chainId) external view returns (address);

    /// @dev returns synthesis by given chainId
    function synthesis(uint64 chainId) external view returns (address);

    /// @dev returns router by given chainId
    function router(uint64 chainId) external view returns (address);

    /// @dev returns whitelist
    function whitelist() external view returns (address);

    /// @dev returns treasury
    function treasury() external view returns (address);

    /// @dev returns gateKeeper
    function gateKeeper() external view returns (address);

    /// @dev returns bridge
    function bridge() external view returns (address);

    /// @dev returns wrapped native asset (WETH)
    function WETH() external view returns (address);
}