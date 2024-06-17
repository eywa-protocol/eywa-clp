const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');


function shouldBehaveLikeVirtualPriceReceiver() {

  const randomAddress = '0x0000000000000000000000000000000000000042';

  describe('should behave like VirtualPriceReceiver:', function () {

    it('should update virtual price at virtual price receiver', async () => {
      const virtualPrice = await cryptoPool.get_virtual_price();
      await virtualPriceReceiver.receiveVirtualPrice(virtualPrice, chainId);
      expect(await virtualPriceReceiver.virtualPrice(chainId)).to.equal(virtualPrice);
    });
  
    it('should not update virtual price if caller is not a bridge', async () => {
      const virtualPrice = await cryptoPool.get_virtual_price();
      await expect(virtualPriceReceiver.connect(alice).receiveVirtualPrice(virtualPrice, chainId)).to.be.revertedWith('VirtualPriceReceiver: bridge only');
    });
  
    it('should receive validated data', async () => {
      const selector = virtualPriceReceiver.interface.getSighash('receiveVirtualPrice');
      await virtualPriceReceiver.receiveValidatedData(selector, bridge.address, chainId);
    });
  
    it('should not receive validated data if wrong selector', async () => {
      const selector = virtualPriceReceiver.interface.getSighash('virtualPrice');
      await expect(virtualPriceReceiver.receiveValidatedData(selector, randomAddress, chainId)).to.be.revertedWith('VirtualPriceReceiver: wrong selector');
    });
  
    it('should not receive validated data if wrong selector', async () => {
      const selector = virtualPriceReceiver.interface.getSighash('receiveVirtualPrice');
      await expect(virtualPriceReceiver.receiveValidatedData(selector, randomAddress, chainId)).to.be.revertedWith('VirtualPriceReceiver: wrong virtual price sender');
    });
  
    it('should not receive validated data if caller is not a bridge', async () => {
      const selector = virtualPriceReceiver.interface.getSighash('receiveVirtualPrice');
      await expect(virtualPriceReceiver.connect(alice).receiveValidatedData(selector, randomAddress, chainId)).to.be.revertedWith('VirtualPriceReceiver: bridge only');
    });

    it('should set address book', async () => {
      await virtualPriceReceiver.setAddressBook(randomAddress);
      expect(await virtualPriceReceiver.addressBook()).to.be.equal(randomAddress);
    });
  
    it('shouldn\'t set addressBook if caller is not an owner', async () => {
      const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await virtualPriceReceiver.DEFAULT_ADMIN_ROLE()}`;
      const address = '0x00000000000000000000000000000000000000Ad';
      await expect(virtualPriceReceiver.connect(alice).setAddressBook(address)).to.be.revertedWith(reason);
    });
  
    it('should set vp sender', async () => {
      await virtualPriceReceiver.connect(operator).setVirtualPriceSender(42, randomAddress);
      expect(await virtualPriceReceiver.senders(42)).to.be.equal(randomAddress);
    });
    
    it('shouldn\'t set sender if caller is not an operator', async () => {
      const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await virtualPriceReceiver.OPERATOR_ROLE()}`;
      await expect(virtualPriceReceiver.connect(alice).setVirtualPriceSender(42, randomAddress)).to.be.revertedWith(reason);
    });
  });
}

module.exports = {
  shouldBehaveLikeVirtualPriceReceiver
};