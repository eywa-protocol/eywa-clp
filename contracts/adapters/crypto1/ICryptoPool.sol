// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

interface ICryptoPool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external;

    function remove_liquidity(uint256 amounts, uint256[2] memory min_amounts) external;

    function remove_liquidity(uint256 amounts, uint256[3] memory min_amounts) external;

    function remove_liquidity_one_coin(uint256 token_amount, uint256 i, uint256 min_amount) external;

    function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external;

    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 token_amount, uint256 i) external view returns (uint256);

    function calc_token_amount(uint256[2] memory amounts, bool deposit) external view returns (uint256);

    function calc_token_amount(uint256[3] memory amounts, bool deposit) external view returns (uint256);

    function coins(uint256 i) external view returns (address);

    function balances(uint256 i) external view returns (uint256);

    function token() external view returns (address);
}
