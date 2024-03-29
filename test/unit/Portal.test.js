const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('Portal unit tests', () => {

  let addressBook, whitelist, portal, usdt, treasury, owner, alice, newAddressBook, router;

  const chainId = network.config.chainId;

  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, newAddressBook, router] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();

    factory = await ethers.getContractFactory('WhitelistV2');
    whitelist = await factory.deploy();
    await whitelist.deployed();

    factory = await ethers.getContractFactory('PortalV2');
    portal = await factory.deploy(addressBook.address);
    await portal.deployed();

    factory = await ethers.getContractFactory('FeesTreasury');
    treasury = await factory.deploy();
    await treasury.deployed();

    await addressBook.setWhitelist(whitelist.address);
    await addressBook.setPortal([[chainId, portal.address]]);
    await addressBook.setRouter([[chainId, router.address]]);
    await addressBook.setTreasury(treasury.address);

    factory = await ethers.getContractFactory('TestTokenPermit');
    usdt = await factory.deploy('USDT', 'USDT', 18);
    await usdt.deployed();
  });

  it('should lock tokens', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, alice.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
  });

  it('shouldn\'t lock tokens if no tokens on portal', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await expect(portal.connect(router).lock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: insufficient balance')
  });

  it('shouldn\'t lock tokens if caller is not a router', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await expect(portal.lock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: router only')
  });

  it('shouldn\'t lock tokens if token amount is wrong', async () => {
    await whitelist.setTokens([[usdt.address, 10, 100000, 0, 1]]);
    await usdt.mint(owner.address, 5);
    await usdt.approve(portal.address, 5);
    await usdt.transfer(portal.address, 5);
    await expect(portal.connect(router).lock(usdt.address, 5, owner.address, alice.address)).to.be.revertedWith('Portal: wrong amount')
  });

  it('shouldn\'t lock tokens if token bridging locked', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 0]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await expect(portal.connect(router).lock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: token must be whitelisted')
  });

  it('should unlock tokens', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await portal.connect(router).unlock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(0)
  });

  it('shouldn\'t unlock tokens if caller is not a router', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await expect(portal.unlock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: router only')
  });

  it('shouldn\'t unlock tokens if token bridging locked', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 0]]);
    await expect(portal.connect(router).unlock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: token must be whitelisted')
  });

  it('should emergency unlock tokens', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await portal.connect(router).emergencyUnlock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(0)
  });

  it('shouldn\'t emergency unlock tokens if caller is not a router', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await expect(portal.emergencyUnlock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: router only')
  });

  it('shouldn\'t emergency unlock tokens if token bridging locked', async () => {
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 1]]);
    await usdt.mint(owner.address, 100);
    await usdt.approve(portal.address, 100);
    await usdt.transfer(portal.address, 100);
    await portal.connect(router).lock(usdt.address, 100, owner.address, owner.address);
    expect(await portal.balanceOf(usdt.address)).to.be.equal(100)
    await whitelist.setTokens([[usdt.address, 1, 100000, 0, 0]]);
    await expect(portal.connect(router).emergencyUnlock(usdt.address, 100, owner.address, alice.address)).to.be.revertedWith('Portal: token must be whitelisted')
  });

  it('should set address book', async () => {
    await portal.connect(owner).setAddressBook(newAddressBook.address)
    await expect(await portal.addressBook()).to.be.equal(newAddressBook.address)
  });

  it('shouldn\'t set address book if caller is not an owner', async () => {
    expect(portal.connect(router).setAddressBook(newAddressBook.address)).to.be.revertedWith('Ownable: caller is not the owner')
  });
})