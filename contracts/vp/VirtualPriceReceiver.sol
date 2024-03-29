// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "../interfaces/IGateKeeper.sol";
import "../interfaces/IValidatedDataReciever.sol";
import "../interfaces/IAddressBook.sol";
import "../interfaces/IVirtualPriceReceiver.sol";


contract VirtualPriceReceiver is AccessControlEnumerable, IValidatedDataReciever, IVirtualPriceReceiver {

    /// @dev operator role id
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @dev addressBook contract
    address public addressBook;
    /// @dev virtual price senders
    mapping (uint64 => address) public senders;
    /// @dev virtual price of stable pool for each chainId
    mapping (uint64 => uint256) public virtualPrice;

    modifier onlyBridge() {
        address bridge = IAddressBook(addressBook).bridge();
        require(bridge == msg.sender, "VirtualPriceReceiver: bridge only");
        _;
    }

    constructor(address addressBook_, uint64[] memory chainIds_, address[] memory senders_) {
        require(addressBook_ != address(0), "VirtualPriceReceiver: zero addressBook address");
        require(chainIds_.length == senders_.length, "VirtualPriceReceiver: wrong lengths");
        addressBook = addressBook_;
        for (uint i = 0; i < chainIds_.length; i++) {
            senders[chainIds_[i]] = senders_[i];
        }
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function receiveValidatedData(bytes4 selector, address from, uint64 chainIdFrom) external view onlyBridge returns (bool) {
        require(selector == this.receiveVirtualPrice.selector, "VirtualPriceReceiver: wrong selector");
        require(senders[chainIdFrom] == from, "VirtualPriceReceiver: wrong virtual price sender");
        return true;
    }

    function setAddressBook(address addressBook_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        addressBook = addressBook_;
    }

    function setVirtualPriceSender(uint64 chainId_, address virtualPriceSender_) external onlyRole(OPERATOR_ROLE) {
        senders[chainId_] = virtualPriceSender_;
    }

    function receiveVirtualPrice(uint256 virtualPrice_, uint64 chainIdFrom) external onlyBridge {
        virtualPrice[chainIdFrom] = virtualPrice_;
    }

    function getVirtualPriceEth() public view returns (uint256) {
        return virtualPrice[1];
    }

    function getVirtualPriceArb() public view returns (uint256) {
        return virtualPrice[42161];
    }

    function getVirtualPriceBsc() public view returns (uint256) {
        return virtualPrice[56];
    }

    function getVirtualPricePol() public view returns (uint256) {
        return virtualPrice[137];
    }

    function getVirtualPriceAvax() public view returns (uint256) {
        return virtualPrice[43114];
    }

    function getVirtualPriceOpt() public view returns (uint256) {
        return virtualPrice[10];
    }

}
