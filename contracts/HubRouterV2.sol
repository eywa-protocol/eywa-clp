// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CryptoRouterV2.sol";
import "./interfaces/IAddressBook.sol";
import "./interfaces/IStablePoolAdapter.sol";


contract HubRouterV2 is CryptoRouterV2, IHubRouter {

    /// @dev add (stable) operation code
    bytes32 public constant ADD_STABLE_CODE = keccak256(abi.encodePacked("As"));
    /// @dev remove (stable) operation code
    bytes32 public constant REMOVE_STABLE_CODE = keccak256(abi.encodePacked("Rs"));
    /// @dev swap (stable) operation code
    bytes32 public constant SWAP_STABLE_CODE = keccak256(abi.encodePacked("Ss"));

    constructor(address addressBook_) CryptoRouterV2(addressBook_) {}

    /**
     * @dev Should be implemented for each router.
     *
     * Each implementation must:
     * Revert execution if op is not supported;
     * Return chainId, destination router (if current op is cross-chain) and execution result.
     *
     * @param op operation hash;
     * @param params serialized params corresponding to op.
     */
    function _executeOp(
        bool isOpHalfDone,
        bytes32 op,
        bytes32 nextOp,
        bytes memory params,
        MaskedParams memory prevMaskedParams
    ) internal virtual override returns (uint64 chainIdTo, bytes memory updatedParams, MaskedParams memory maskedParams, ExecutionResult result) {
        (chainIdTo, updatedParams, maskedParams, result) = super._executeOp(isOpHalfDone, op, nextOp, params, prevMaskedParams);
        if (result == ExecutionResult.Failed) {
            result = ExecutionResult.Succeeded;
            address poolAdapter = IAddressBook(addressBook).stablePoolAdapter(uint64(block.chainid));
            if (ADD_STABLE_CODE == op) {
                AddStableParams memory p = abi.decode(params, (AddStableParams));
                (p.amountIn, p.from, p.emergencyTo) = _checkMaskedParams(p.amountIn, p.from, p.emergencyTo, maskedParams);
                p.to = _checkTo(p.to, p.emergencyTo, uint64(block.chainid), nextOp);
                if (p.from != poolAdapter) {
                    SafeERC20.safeTransferFrom(IERC20(p.tokenIn), p.from, poolAdapter, p.amountIn);
                }
                maskedParams.amountOut = IStablePoolAdapter(poolAdapter).addLiquidity(
                    p.pool,
                    p.tokenIn,
                    p.amountIn,
                    p.minAmountOut,
                    uint256(p.i),
                    p.to,
                    p.count,
                    p.emergencyTo
                );
                maskedParams.to = p.to;
                maskedParams.emergencyTo = p.emergencyTo;
                if (maskedParams.amountOut == 0) {
                    result = ExecutionResult.Interrupted;
                }
            } else if (REMOVE_STABLE_CODE == op) {
                RemoveStableParams memory p = abi.decode(params, (RemoveStableParams));
                (p.amountIn, p.from, p.emergencyTo) = _checkMaskedParams(p.amountIn, p.from, p.emergencyTo, maskedParams);
                p.to = _checkTo(p.to, p.emergencyTo, uint64(block.chainid), nextOp);
                if (p.from != poolAdapter) {
                    SafeERC20.safeTransferFrom(IERC20(p.tokenIn), p.from, poolAdapter, p.amountIn);
                }
                maskedParams.amountOut = IStablePoolAdapter(poolAdapter).removeLiquidity(
                    p.pool,
                    int128(uint128(p.i)),
                    p.to,
                    p.tokenOut,
                    p.minAmountOut,
                    p.emergencyTo
                );
                maskedParams.to = p.to;
                maskedParams.emergencyTo = p.emergencyTo;
                if (maskedParams.amountOut == 0) {
                    result = ExecutionResult.Interrupted;
                }
            } else if (SWAP_STABLE_CODE == op) {
                SwapStableParams memory p = abi.decode(params, (SwapStableParams));
                (p.amountIn, p.from, p.emergencyTo) = _checkMaskedParams(p.amountIn, p.from, p.emergencyTo, maskedParams);
                p.to = _checkTo(p.to, p.emergencyTo, uint64(block.chainid), nextOp);
                if (p.from != poolAdapter) {
                    SafeERC20.safeTransferFrom(IERC20(p.tokenIn), p.from, poolAdapter, p.amountIn);
                }
                maskedParams.amountOut = IStablePoolAdapter(poolAdapter).swap(
                    p.tokenIn,
                    p.pool,
                    int128(uint128(p.i)),
                    int128(uint128(p.j)),
                    p.tokenOut,
                    p.to,
                    p.minAmountOut,
                    p.emergencyTo
                );
                maskedParams.to = p.to;
                maskedParams.emergencyTo = p.emergencyTo;
                if (maskedParams.amountOut == 0) {
                    result = ExecutionResult.Interrupted;
                }
            } else {
                result = ExecutionResult.Failed;
            }
        }
    }

    function _checkTo(address to, address emergencyTo, uint64 chainId, bytes32 nextOp) internal view virtual override returns (address correctTo) {
        correctTo = super._checkTo(to, emergencyTo, chainId, nextOp);
        if (correctTo == address(0)) {
            if (nextOp == ADD_STABLE_CODE || nextOp == REMOVE_STABLE_CODE || nextOp == SWAP_STABLE_CODE) {
                correctTo = IAddressBook(addressBook).stablePoolAdapter(chainId);
            }
        }
    }
}
