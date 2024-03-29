const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, parse6 } = require('../../utils/common');
const abi = ethers.utils.defaultAbiCoder;

describe('Synthesis unit tests', () => {

  const SynthType = { Unknown: 0, DefaultSynth: 1, CustomSynth: 2, ThirdPartySynth: 3, ThirdPartyToken: 4 };

  let addressBook, synthesis, synthFactory, sUSDT_BSC, sUSDC, sDAI, tokenX, tokenXAdapter;
  let owner, operator, alice, mallory;

  const chainId = network.config.chainId;
  const someAddress = '0x0000000000000000000000000000000000000088';

  // origin chain
  const USDTAddress = '0x55d398326f99059ff775485246999027b3197955';
  // origin chain
  const tokenXAddress = '0x0000000000000000000000000000000000000056';

  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, operator, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();

    factory = await ethers.getContractFactory('SynthesisV2');
    synthesis = await factory.deploy(addressBook.address);
    await synthesis.deployed();

    await synthesis.grantRole(await synthesis.OPERATOR_ROLE(), operator.address);

    await addressBook.setSynthesis([[chainId, synthesis.address]]);

    factory = await ethers.getContractFactory('SynthFactory');
    synthFactory = await factory.deploy(addressBook.address);
    await synthFactory.deployed();

    await synthFactory.grantRole(await synthesis.OPERATOR_ROLE(), operator.address);
  });

  describe('Setters and getters', () => {

    it('should set addressBook', async () => {
      const address = '0x00000000000000000000000000000000000000Ad';
      await synthFactory.setAddressBook(address);
      expect(await synthFactory.addressBook()).to.be.equal(address);
    });

    it('shouldn\'t set addressBook if caller is not an owner', async () => {
      const reason =`AccessControl: account ${mallory.address.toLowerCase()} is missing role ${await synthesis.DEFAULT_ADMIN_ROLE()}`;
      const address = '0x00000000000000000000000000000000000000Ad';
      await expect(synthFactory.connect(mallory).setAddressBook(address)).to.be.revertedWith(reason);
    });

  });

  describe('Deploy synth', () => {

    it('should deploy default synth', async () => {
      await synthFactory.connect(operator).deployDefaultSynth(USDTAddress, 6, 'USDT', 'USDT', 56, 'BSC');
      const sUSDT_BSC = await ethers.getContractAt(
        'SynthERC20',
        await synthFactory.getDefaultSynth(USDTAddress, 6, 'USDT', 'USDT', 56, 'BSC')
      );
      expect((await sUSDT_BSC.originalToken()).toLowerCase()).to.be.equal(USDTAddress.toLowerCase());
      expect(await sUSDT_BSC.chainIdFrom()).to.be.equal(56);
      expect(await sUSDT_BSC.chainSymbolFrom()).to.be.equal('BSC');
      expect(await sUSDT_BSC.decimals()).to.be.equal(6);
      expect(await sUSDT_BSC.name()).to.be.equal('s USDT BSC');
      expect(await sUSDT_BSC.symbol()).to.be.equal('sUSDT_BSC');
      expect(await sUSDT_BSC.cap()).to.be.equal(ethers.constants.MaxUint256);
      expect(await sUSDT_BSC.synthType()).to.be.equal(SynthType.DefaultSynth);
      expect(await sUSDT_BSC.synthToken()).to.be.equal(sUSDT_BSC.address);
    });

    it('should deploy custom synth', async () => {
      await synthFactory.connect(operator).deployCustomSynth(USDTAddress, 6, 'sUSDT_BSC', 'sUSDT_BSC', 56, 'BSC');
      const sUSDT_BSC = await ethers.getContractAt(
        'SynthERC20',
        await synthFactory.getCustomSynth(USDTAddress, 6, 'sUSDT_BSC', 'sUSDT_BSC', 56, 'BSC')
      );
      expect((await sUSDT_BSC.originalToken()).toLowerCase()).to.be.equal(USDTAddress.toLowerCase());
      expect(await sUSDT_BSC.chainIdFrom()).to.be.equal(56);
      expect(await sUSDT_BSC.chainSymbolFrom()).to.be.equal('BSC');
      expect(await sUSDT_BSC.decimals()).to.be.equal(6);
      expect(await sUSDT_BSC.name()).to.be.equal('sUSDT_BSC');
      expect(await sUSDT_BSC.symbol()).to.be.equal('sUSDT_BSC');
      expect(await sUSDT_BSC.cap()).to.be.equal(ethers.constants.MaxUint256);
      expect(await sUSDT_BSC.synthType()).to.be.equal(SynthType.CustomSynth);
      expect(await sUSDT_BSC.synthToken()).to.be.equal(sUSDT_BSC.address);
    });

    it('shouldn\'t deploy default synth if caller is not an operator', async () => {
      const reason =`AccessControl: account ${mallory.address.toLowerCase()} is missing role ${await synthFactory.OPERATOR_ROLE()}`;
      await expect(synthFactory.connect(mallory).deployDefaultSynth(USDTAddress, 6, 'USDT', 'USDT', 56, 'BSC'))
        .to.be.revertedWith(reason);
    });

    it('shouldn\'t deploy custom synth if caller is not an operator', async () => {
      const reason =`AccessControl: account ${mallory.address.toLowerCase()} is missing role ${await synthFactory.OPERATOR_ROLE()}`;
      await expect(synthFactory.connect(mallory).deployCustomSynth(USDTAddress, 6, 'sUSDT_BSC', 'sUSDT_BSC', 56, 'BSC'))
        .to.be.revertedWith(reason);
    });

  });

});