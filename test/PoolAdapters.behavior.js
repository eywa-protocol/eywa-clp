const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');

function shouldBehaveLikePoolAdapter(errorCode, amount, chainId, chainSymbolFrom, cap) {
  
  describe('should bahave like Adapter:', function () {

    it('has a original token', async function () {
      expect(await this.adapter.originalToken()).to.equal(this.originalToken);
    });
  
    it('has a chain ID from', async function () {
      expect(await this.adapter.chainIdFrom()).to.equal(chainId);
    });
  
    it('has a chain symbol from', async function () {
      expect(await this.adapter.chainSymbolFrom()).to.equal(chainSymbolFrom);
    });
  
    it('has a synth token', async function () {
      expect(await this.adapter.synthToken()).to.equal(this.synthToken);
    });
  
    it('can set cap', async function () {
      await this.adapter.setCap(cap);
      expect(await this.adapter.cap()).to.be.equal(cap);
    });

    it('should burn synth', async function ()  {
      await this.xsynth.mint(this.bob.address, amount);
      await this.xsynth.connect(this.bob).approve(this.adapter.address, amount);
      await this.adapter.connect(this.owner).burn(this.bob.address, amount);
      expect(await this.xsynth.balanceOf(this.adapter.address)).to.be.equal(amount);
    });

    it('should revert mint synth', async function ()  {
      const amount = parse18('1000');
      const mint_amount = parse18('100');
      await this.xsynth.mint(this.adapter.address, mint_amount);
      await expect(this.adapter.connect(this.owner).mint(this.bob.address, amount))
        .to.be.revertedWith(errorCode + ': wrong amount');
    });
  });
}


module.exports = {
  shouldBehaveLikePoolAdapter
};