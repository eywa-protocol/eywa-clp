const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, parse6 } = require('../../utils/common');
const { shouldBehaveLikePoolAdapter } = require('./PoolAdapters.behavior');

describe('PoolAdapter unit tests', () => {

  let thirdSynth, thirdSynthY;
  let originalToken, synthToken, xSynthDecimals, originalDecimals;
  const cap = parse18('10000');
  const chainId = network.config.chainId;
  const chainSymbolFrom = 'FTM';
  const amount = parse18('1000');
  const amount6 = parse6('1000');

  contract('Stable1PoolAdapter', function () {
    const errorCode = 'Stable1PoolAdapter';
    beforeEach(async  function () {
      [this.owner, this.bob] = await ethers.getSigners();

      let factory = await ethers.getContractFactory('adapters/stable1/PoolAdapter.sol:PoolAdapter');
      const stable1 = await factory.deploy();
      await stable1.deployed();
    });

    shouldBehaveLikePoolAdapter(errorCode, amount, chainId, chainSymbolFrom, cap);
  
    // it('should mint synth (18 dec)', async function ()  {
    //   await this.xsynth.mint(this.adapter.address, amount);
    //   await this.adapter.connect(this.owner).mint(this.bob.address, amount);
    //   expect(await this.xsynth.balanceOf(this.bob.address)).to.be.equal(amount);
    // });
  });

  // contract('DifferentDecimalsAdapter', function () {
  //   const errorCode = 'DifferentDecimalsAdapter';
  //   beforeEach(async function () {
  //     [this.owner, this.bob] = await ethers.getSigners();
  //     factory = await ethers.getContractFactory('TestTokenPermit');
  //     const tokenX = await factory.deploy('TestToken', 'TUSD', 18);
  //     await tokenX.deployed();

  //     factory = await ethers.getContractFactory('SynthERC20');
  //     this.xsynth = await factory.deploy(
  //       await tokenX.name(), 
  //       await tokenX.symbol(), 
  //       await tokenX.decimals(), 
  //       tokenX.address, 
  //       chainId, 
  //       chainSymbolFrom,
  //       1
  //     );
  //     await this.xsynth.deployed();

  //     factory = await ethers.getContractFactory('TestTokenPermit');
  //     const tokenY = await factory.deploy('TestTokenY', 'YTUSD', 6);
  //     await tokenY.deployed();

  //     factory = await ethers.getContractFactory('SynthERC20');
  //     this.ysynth = await factory.deploy(
  //       await tokenY.name(), 
  //       await tokenY.symbol(), 
  //       await tokenY.decimals(), 
  //       tokenY.address, 
  //       chainId, 
  //       chainSymbolFrom,
  //       1
  //     );
  //     await this.ysynth.deployed();

  //     factory = await ethers.getContractFactory('TestTokenPermit');
  //     thirdSynth = await factory.deploy('ThirdSynth', 'ts', 18);
  //     await thirdSynth.deployed();

  //     factory = await ethers.getContractFactory('TestTokenPermit');
  //     thirdSynthY = await factory.deploy('ThirdSynthY', 'tsY', 6);
  //     await thirdSynthY.deployed();

  //     this.originalToken = thirdSynthY.address;
  //     this.synthToken = this.xsynth.address;
  //     originalDecimals = await thirdSynthY.decimals();

  //     factory = await ethers.getContractFactory('DifferentDecimalsAdapter');
  //     this.adapter = await factory.deploy(
  //       this.originalToken, 
  //       this.synthToken, 
  //       chainId, 
  //       chainSymbolFrom, 
  //       originalDecimals
  //     );
  //     await this.adapter.deployed();
  //     await this.adapter.setCap(cap);

  //     originalToken = thirdSynth.address;
  //     synthToken = this.ysynth.address;
  //     originalDecimals = await thirdSynth.decimals();

  //     factory = await ethers.getContractFactory('DifferentDecimalsAdapter');
  //     this.adapterY = await factory.deploy(
  //       originalToken, 
  //       synthToken, 
  //       chainId, 
  //       chainSymbolFrom, 
  //       originalDecimals
  //     );
  //     await this.adapterY.deployed();
  //     await this.adapterY.setCap(cap);

  //   });
  
  //   shouldBehaveLikeAdapter(errorCode, amount, chainId, chainSymbolFrom, cap);

  //   it('should mint synth (18 dec) by DifferentDecimalsAdapter (6 dec)', async function ()  {
  //     await this.xsynth.mint(this.adapter.address, amount);
  //     await this.adapter.connect(this.owner).mint(this.bob.address, amount6);
  //     expect(await this.xsynth.balanceOf(this.bob.address)).to.be.equal(amount);
  //   });
  
  //   it('should mint synth (6 dec) by DifferentDecimalsAdapter (18 dec)', async function ()  {
  //     await this.ysynth.mint(this.adapterY.address, amount6);
  //     await this.adapterY.connect(this.owner).mint(this.bob.address, amount);
  //     expect(await this.ysynth.balanceOf(this.bob.address)).to.be.equal(amount6);
  //   });
  

  });

});



