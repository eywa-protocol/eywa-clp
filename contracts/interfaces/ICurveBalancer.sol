// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

interface ICurveBalancer {

    function addLiqBalancedOut(
        address pool,
        uint256 slotsCount,
        uint256 incomePosition,
        uint256 amountIn,
        bool forceAdd
    ) external returns (bool success);

    function removeLiqBalancedOut(
        address pool,
        address lp,
        uint256 slotsCount,
        uint256 incomePosition,
        uint256 amountInLp
    ) external returns (bool success);

}
