// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

interface IZap {
    function add_liquidity(address pool, uint256[6] memory amounts, uint256 min_mint_amount) external;

    function remove_liquidity(address pool, uint256 amounts, uint256[6] memory min_amounts) external;

    function remove_liquidity_one_coin(address pool, uint256 token_amount, uint256 i, uint256 min_amount) external returns (uint256);

    function exchange(address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) external returns (uint256);

    function get_dy(address pool, uint256 i, uint256 j, uint256 dx) external view returns (uint256);

    function calc_withdraw_one_coin(address pool, uint256 token_amount, uint256 i) external view returns (uint256);

    function calc_token_amount(address pool, uint256[6] memory amounts) external view returns (uint256);

}

interface ICryptoPool {
    function coins(uint256 i) external view returns (address);

    function balances(uint256 i) external view returns (uint256);

    function token() external view returns (address);
}
