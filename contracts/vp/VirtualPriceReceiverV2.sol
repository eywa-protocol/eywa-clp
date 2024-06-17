// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;

import "./VirtualPriceReceiver.sol";


contract VirtualPriceReceiverV2 is VirtualPriceReceiver {

    constructor(address addressBook_, uint64[] memory chainIds_, address[] memory senders_) VirtualPriceReceiver(addressBook_, chainIds_, senders_) {
    }

    function getVirtualPriceBase() public view returns (uint256) {
        return virtualPrice[8453];
    }

    function getVirtualPriceGnosis() public view returns (uint256) {
        return virtualPrice[100];
    }

    function getVirtualPriceCelo() public view returns (uint256) {
        return virtualPrice[42220];
    }

    function getVirtualPriceMoonbeam() public view returns (uint256) {
        return virtualPrice[1284];
    }

    function getVirtualPriceXlayer() public view returns (uint256) {
        return virtualPrice[196];
    }
}
