// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface IOpsRegistrar {
    struct ComplexOp {
        string operation;
        bool registered;
    }

    /// @dev returns is complex op registered
    function ops(bytes32 ops_) external returns (bool);

    /// @dev registers ComplexOp's
    function registerComplexOp(ComplexOp[] memory complexOps_) external;
}