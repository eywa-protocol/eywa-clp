// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface IRouterParams {

    struct Invoice {
        uint256 executionPrice;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct PermitParams {
        address token;
        address owner;
        uint256 amount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * @dev amount can be set as prev op result by using uint256 max. 
     */
    struct SynthParams {
        address tokenIn;
        uint256 amountIn; // amount | 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        address from; // from | 0x0000000000000000000000000000000000000000
        address to;
        uint64 chainIdTo;
        uint64 tokenInChainIdFrom;
        address emergencyTo;
    }

    /**
     * @dev Cancellation applicable only for cross-chain ops (LM, BU, BM).
     */
    struct CancelParams {
        bytes32 requestId;
        uint64 chainIdTo;
        SynthParams emergencyParams;
    }

    /**
     * @dev amountIn can be set as prev op result by using uint256 max. 
     */
    struct AddParams {
        address tokenIn;
        uint256 amountIn; // amount | 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        address from;  // from | 0x0000000000000000000000000000000000000000
        address to;
        address pool;
        uint256 minAmountOut;
        uint8 i;
        address emergencyTo;
    }

    /**
     * @dev amountIn can be set as prev op result by using uint256 max. 
     */
    struct RemoveParams {
        address tokenIn;
        uint256 amountIn; // amount | 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        address from;  // from | 0x0000000000000000000000000000000000000000
        address to;
        address pool;
        uint256 minAmountOut;
        uint8 j;
        address emergencyTo;
    }

    /**
     * @dev amountIn can be set as prev op result by using uint256 max. 
     */
    struct SwapParams {
        address tokenIn;
        uint256 amountIn; // amount | 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        address from;  // from | 0x0000000000000000000000000000000000000000
        address to;
        address pool;
        uint256 minAmountOut;
        uint8 i;
        uint8 j;
        address emergencyTo;
    }

    /**
     * @dev amount can be set as prev op result by using uint256 max.
     */
    struct WrapParams {
        address tokenIn;
        uint256 amountIn; // amount | 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        address from;  // from | 0x0000000000000000000000000000000000000000
        address to; // router if op not last
    }
}

interface IRouter is IRouterParams {
    function start(
        string[] calldata operations,
        bytes[] calldata params,
        Invoice calldata receipt
    ) external payable;

    function resume(
        bytes32 requestId,
        uint8 cPos,
        string[] calldata operations,
        bytes[] calldata params
    ) external;
}

interface IUnifiedRouter is IRouter {

}