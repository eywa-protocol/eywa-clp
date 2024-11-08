// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IOpsRegistrar.sol";


/**
 * @title Ops registry.
 *
 * @notice Controlled by operator.
 */
contract OpsRegistrar is IOpsRegistrar, Ownable {

    /// @dev registered operations
    mapping(bytes32 => bool) public ops;

    event ComplexOpSet(string oop, bytes32 hash, bool registered);

    /**
     * @dev Registers set of complex operation.
     *
     * @param complexOps_ array of complex operations and registered flags.
     */
    function registerComplexOp(ComplexOp[] memory complexOps_) external onlyOwner {
        uint256 length = complexOps_.length;
        for (uint256 i; i < length; ++i) {
            bytes32 oop = keccak256(bytes(complexOps_[i].operation));
            ops[oop] = complexOps_[i].registered;
            emit ComplexOpSet(complexOps_[i].operation, oop, complexOps_[i].registered);
        }
    }
}