const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, parse6 } = require('../../utils/common');
const { shouldBehaveLikeAdapter } = require('./SynthAdapter.behavior');

describe('SynthAdapter unit tests', () => {
  let factory;
  let thirdSynth, thirdSynthY;
  let originalToken, synthToken, xSynthDecimals, originalDecimals;
  const cap = parse18('10000');
  const chainId = network.config.chainId;
  const chainSymbolFrom = 'FTM';
  const amount = parse18('1000');
  const amount6 = parse6('1000');

  contract('ThirdPartySynthAdapter', function () {
    const errorCode = 'ThirdPartySynthAdapter';
    beforeEach(async  function () {
      [this.owner, this.bob] = await ethers.getSigners();
      factory = await ethers.getContractFactory('TestTokenPermit');
      const tokenX = await factory.deploy('TestToken', 'TUSD', 18);
      await tokenX.deployed();

      factory = await ethers.getContractFactory('SynthERC20');
      this.xsynth = await factory.deploy(
        await tokenX.name(), 
        await tokenX.symbol(), 
        await tokenX.decimals(), 
        tokenX.address, 
        chainId, 
        'FTM',
        1
      );
      await this.xsynth.deployed();

      factory = await ethers.getContractFactory('TestTokenPermit');
      thirdSynth = await factory.deploy('ThirdSynth', 'ts', 18);
      await thirdSynth.deployed();

      factory = await ethers.getContractFactory('TestTokenPermit');
      thirdSynthY = await factory.deploy('ThirdSynthY', 'tsY', 6);
      await thirdSynthY.deployed();

      this.originalToken = thirdSynth.address;
      this.synthToken = this.xsynth.address;
      xSynthDecimals = await this.xsynth.decimals();

      factory = await ethers.getContractFactory('ThirdPartySynthAdapter');
      this.adapter = await factory.deploy(
        this.originalToken, 
        this.synthToken, 
        chainId, 
        chainSymbolFrom, 
        xSynthDecimals
      );
      await this.adapter.deployed();
    });

    shouldBehaveLikeAdapter(errorCode, amount, chainId, chainSymbolFrom, cap);
  
    it('should mint synth (18 dec)', async function ()  {
      await this.xsynth.mint(this.adapter.address, amount);
      await this.adapter.connect(this.owner).mint(this.bob.address, amount);
      expect(await this.xsynth.balanceOf(this.bob.address)).to.be.equal(amount);
    });
  });

});



