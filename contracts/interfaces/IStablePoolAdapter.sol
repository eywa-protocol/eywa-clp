// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface IStablePoolAdapter {

    function addLiquidity(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 coinIndex,
        address to,
        uint256 coinsCount,
        address emergencyTo
    ) external returns(uint256 amountOut);

    function swap(
        address tokenIn,
        address pool,
        int128 i,
        int128 j,
        address tokenOut,
        address to,
        uint256 minAmountOut,
        address emergencyTo
    ) external returns(uint256 amountOut);

    function removeLiquidity(
        address pool,
        int128 i,
        address to,
        address tokenOut,
        uint256 minAmountOut,
        address emergencyTo
    ) external returns(uint256 amountOut);
}
