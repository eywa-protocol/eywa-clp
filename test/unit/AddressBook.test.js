const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

describe('AddressBook unit tests', () => {

  let addressBook, gateKeeper;

  const zeroAddress = ethers.constants.AddressZero;
  const chainId = network.config.chainId;
  const bridgeAddress = '0x0000000000000000000000000000000000000042';
  const someAddress = '0x0000000000000000000000000000000000000088';

  let owner, alice, mallory;

  // Deploy all contracts before each test suite
  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridgeAddress);
    await gateKeeper.deployed();
  });

  it('should set portal for given chain', async() => {
    await addressBook.setPortal([[chainId, someAddress]]);
    expect(await addressBook.portal(chainId)).to.equal(someAddress);
  });

  it('shouldn\'t set portal if address wrong', async() => {
    // const message = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${await govBridge.DEFAULT_ADMIN_ROLE()}`;
    await expect(addressBook.setPortal([[chainId, zeroAddress]])).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set portal if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setPortal([[chainId, someAddress]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set synthesis for given chain', async() => {
    await addressBook.setSynthesis([[chainId, someAddress]]);
    expect(await addressBook.synthesis(chainId)).to.equal(someAddress);
  });

  it('shouldn\'t set synthesis if address wrong', async() => {
    await expect(addressBook.setSynthesis([[chainId, zeroAddress]])).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set synthesis if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setSynthesis([[chainId, someAddress]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set router for given chain', async() => {
    await addressBook.setRouter([[chainId, someAddress]]);
    expect(await addressBook.router(chainId)).to.equal(someAddress);
  });

  it('shouldn\'t set router if address wrong', async() => {
    await expect(addressBook.setRouter([[chainId, zeroAddress]])).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set router if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setRouter([[chainId, someAddress]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set treasury for given chain', async() => {
    await addressBook.setTreasury(someAddress);
    expect(await addressBook.treasury()).to.equal(someAddress);
  });

  it('shouldn\'t set treasury if address wrong', async() => {
    await expect(addressBook.setTreasury(zeroAddress)).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set treasury if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setTreasury(someAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set gateKeeper for given chain', async() => {
    expect(await addressBook.bridge()).to.equal(zeroAddress);
    await addressBook.setGateKeeper(gateKeeper.address);
    expect(await addressBook.gateKeeper()).to.equal(gateKeeper.address);
    expect(await addressBook.bridge()).to.equal(bridgeAddress);
  });

  it('shouldn\'t set gateKeeper if address wrong', async() => {
    await expect(addressBook.setGateKeeper(zeroAddress)).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set gateKeeper if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setGateKeeper(someAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set router for given chain', async() => {
    await addressBook.setWhitelist(someAddress);
    expect(await addressBook.whitelist()).to.equal(someAddress);
  });

  it('shouldn\'t set whitelist if address wrong', async() => {
    await expect(addressBook.setWhitelist(zeroAddress)).to.be.revertedWith('AddressBook: zero address');
  });

  it('shouldn\'t set whitelist if caller is not an owner', async() => {
    await expect(addressBook.connect(mallory).setWhitelist(someAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

});