const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, parse6 } = require('../../utils/common');
const abi = ethers.utils.defaultAbiCoder;

describe('Synthesis unit tests', () => {

  let addressBook, whitelist, synthesis, treasury, router, sUSDT_BSC, sUSDC, sDAI, tokenX, tokenXAdapter;
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

    factory = await ethers.getContractFactory('WhitelistV2');
    whitelist = await factory.deploy();
    await whitelist.deployed();

    factory = await ethers.getContractFactory('SynthesisV2');
    synthesis = await factory.deploy(addressBook.address);
    await synthesis.deployed();

    await synthesis.grantRole(await synthesis.OPERATOR_ROLE(), operator.address);

    factory = await ethers.getContractFactory('FeesTreasury');
    treasury = await factory.deploy();
    await treasury.deployed();

    factory = await ethers.getContractFactory('RouterV2Mock');
    router = await factory.deploy(addressBook.address);
    await router.deployed();

    await addressBook.setWhitelist(whitelist.address);
    await addressBook.setSynthesis([[chainId, synthesis.address]]);
    await addressBook.setRouter([[chainId, router.address]]);
    await addressBook.setTreasury(treasury.address);

    factory = await ethers.getContractFactory('SynthERC20');
    sUSDT_BSC = await factory.deploy('sUSDT_BSC', 'sUSDT_BSC', 6, USDTAddress, 56, 'BSC', 1);
    await sUSDT_BSC.deployed();

    factory = await ethers.getContractFactory('TestTokenPermit');
    tokenX = await factory.deploy('TokenX', 'TOX', 18);
    await tokenX.deployed();

    factory = await ethers.getContractFactory('ThirdPartySynthAdapter');
    tokenXAdapter = await factory.deploy(tokenXAddress, tokenX.address, 56, 'BSC', 18);
    await tokenXAdapter.deployed();
  });

  describe('Setters and getters', () => {

    it('should set synth', async () => {
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      expect(await synthesis.getSynth(56, USDTAddress)).to.be.equal(sUSDT_BSC.address);
    });

    it('shouldn\'t set synth with zero address original token', async () => {
      const factory = await ethers.getContractFactory('SynthERC20');
      const synth = await factory.deploy('sUSDT_BSC', 'sUSDT_BSC', 6, ethers.constants.AddressZero, 56, 'BSC', 1);
      await synth.deployed();
  
      await expect(synthesis.connect(operator).setSynths([synth.address])).to.be.revertedWith('Synthesis: synth incorrect');
    });

    it('shouldn\'t reset synth', async () => {
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      await expect(synthesis.connect(operator).setSynths([sUSDT_BSC.address])).to.be.revertedWith('Synthesis: synth already set');
    });

    it('shouldn\'t set synth if caller is not an operator', async () => {
      const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await synthesis.OPERATOR_ROLE()}`;
      await expect(synthesis.connect(alice).setSynths([sUSDT_BSC.address])).to.be.revertedWith(reason);
    });

    it('shouldn\'t set synth if total supply > 0', async () => {
      await sUSDT_BSC.mint(owner.address, parse6('1'));
      await expect(synthesis.connect(operator).setSynths([sUSDT_BSC.address])).to.be.revertedWith('Synthesis: totalSupply incorrect');
    });

    it('shouldn\'t set synth with synth address assigned', async () => {
      await synthesis.connect(operator).setSynths([tokenXAdapter.address]);
      
      factory = await ethers.getContractFactory('ThirdPartySynthAdapter');
      const tokenXAdapter2 = await factory.deploy('0x0000000000000000000000000000000000000001', tokenX.address, 1, 'ETH', 18);
      await tokenXAdapter2.deployed();
    
      await expect(synthesis.connect(operator).setSynths([tokenXAdapter2.address])).to.be.revertedWith('Synthesis: adapter already set')
    });

    it('should set cap', async () => {
      await sUSDT_BSC.transferOwnership(synthesis.address);
      await synthesis.connect(operator).setCap(sUSDT_BSC.address, parse6('100'));
      expect(await sUSDT_BSC.cap()).to.be.equal(parse6('100'));
    });

    it('shouldn\'t set cap if caller is not an operator', async () => {
      const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await synthesis.OPERATOR_ROLE()}`;
      await expect(synthesis.connect(alice).setCap(sUSDT_BSC.address, parse6('100'))).to.be.revertedWith(reason);
    });

    it('should set addressBook', async () => {
      const address = '0x00000000000000000000000000000000000000Ad';
      await synthesis.setAddressBook(address);
      expect(await synthesis.addressBook()).to.be.equal(address);
    });

    it('shouldn\'t set addressBook if caller is not an owner', async () => {
      const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await synthesis.DEFAULT_ADMIN_ROLE()}`;
      const address = '0x00000000000000000000000000000000000000Ad';
      await expect(synthesis.connect(alice).setAddressBook(address)).to.be.revertedWith(reason);
    });

  });

  describe('Mint', () => {

    let data1;

    beforeEach(async () => {
      const s1 = [
        USDTAddress,
        parse6('100'),
        owner.address,
        owner.address,
        chainId, // chain id to 250
        56, // tokenIn origin
        owner.address
      ];
      data1 = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s1]);
    });

    it('should mint synth', async () => {
      await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 0]]);
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      await sUSDT_BSC.transferOwnership(synthesis.address);
      await router.resume(ethers.constants.HashZero, 0, ['LM'], [data1]);
      expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(parse6('100'));
    });

    it('shouldn\'t mint if synth is not set', async () => {
      await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 0]]);
      await sUSDT_BSC.transferOwnership(synthesis.address);
      await expect(router.resume(ethers.constants.HashZero, 0, ['LM'], [data1])).to.be.revertedWith('Synthesis: synth not set');
    });

    it('shouldn\'t mint if synth is not owned by synthesis', async () => {
      await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 0]]);
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      await expect(router.resume(ethers.constants.HashZero, 0, ['LM'], [data1])).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('shouldn\'t mint if synth is not whitelisted', async () => {
      await sUSDT_BSC.transferOwnership(synthesis.address);
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      await expect(router.resume(ethers.constants.HashZero, 0, ['LM'], [data1])).to.be.revertedWith('Whitelist: token not set');
    });

    it('shouldn\'t mint if caller is not a router', async () => {
      await expect(synthesis.connect(alice).mint(USDTAddress, parse6('100'), owner.address, owner.address, 56))
        .to.be.revertedWith('Synthesis: router only');
    });

    describe('Emergency mint', () => {
      let data2, data3, data4;
  
      beforeEach(async () => {
        const s2 = [
          sUSDT_BSC.address,
          parse6('100'),
          owner.address,
          owner.address,
          56, // chain id to
          56, // tokenIn origin
          owner.address
        ];
        data2 = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s2]);

        const s3 = [ // same as above, but after processing (synth tokenIn changed to original token address)
          USDTAddress,
          parse6('100'),
          owner.address,
          owner.address,
          56, // chain id to
          56, // tokenIn origin
          owner.address
        ];
        data3 = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s3]);
  
        const c1 = [
          ethers.constants.HashZero,
          250
        ];
        data4 = abi.encode(['bytes32', 'uint64'], [...c1]);
      });
  
      it('should emergency mint synth', async () => {
        await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 1]]);
        await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
        await sUSDT_BSC.transferOwnership(synthesis.address);
        await router.resume(ethers.constants.HashZero, 0, ['LM'], [data1]);
        expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(parse6('100'));
        await router.start(['BU'], [data2]);
        expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(0);
        await router.resume(ethers.constants.HashZero, 0, ['!U'], [data4]);
        expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(parse6('100'));
      });

      it('shouldn\'t emergency mint if caller is not a router', async () => {
        await expect(synthesis.connect(alice).emergencyMint(sUSDT_BSC.address, parse6('100'), owner.address, owner.address))
          .to.be.revertedWith('Synthesis: router only');
      });

      it('shouldn\'t emergency mint if synth is not set', async () => {
        await sUSDT_BSC.transferOwnership(synthesis.address);
        await router.put('BU', data3);
        await expect(router.resume(ethers.constants.HashZero, 0, ['!U'], [data4])).to.be.revertedWith('Synthesis: synth not set');
      });

      it('shouldn\'t emergency mint if synth is not set', async () => {
        await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 1]]);
        await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
        await router.put('BU', data3);
        await expect(router.resume(ethers.constants.HashZero, 0, ['!U'], [data4])).to.be.revertedWith('Ownable: caller is not the owner');
      });
  
    });

  });

  describe('Burn', () => {

    let data1, data2;

    beforeEach(async () => {
      const s1 = [
        USDTAddress,
        parse6('100'),
        owner.address,
        owner.address,
        250, // chain id to 250
        56, // tokenIn origin
        owner.address
      ];
      data1 = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s1]);

      const s2 = [
        sUSDT_BSC.address,
        parse6('100'),
        owner.address,
        owner.address,
        56, // chain id to
        56, // tokenIn origin
        owner.address
      ];
      data2 = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s2]);

      await whitelist.setTokens([[sUSDT_BSC.address, parse6('1'), parse6('10000'), 0, 0]]);
      await synthesis.connect(operator).setSynths([sUSDT_BSC.address]);
      await sUSDT_BSC.transferOwnership(synthesis.address);
      await router.resume(ethers.constants.HashZero, 0, ['LM'], [data1]);
    });

    it('should burn synth', async () => {
      expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(parse6('100'));
      await router.start(['BM'], [data2]);
      expect(await sUSDT_BSC.balanceOf(owner.address)).to.be.equal(0);
    });

    it('shouldn\'t burn if caller is not a router', async () => {
      await expect(synthesis.connect(alice).burn(USDTAddress, parse6('100'), owner.address, owner.address, 56))
        .to.be.revertedWith('Synthesis: router only');
    });

  });

});