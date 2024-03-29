const { ethers, contract } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');


describe('VirtualPriceReceiver unit tests', () => {
  let owner, alice, bob;
  const chainId = network.config.chainId;
  const randomAddress = '0x0000000000000000000000000000000000000042';

  beforeEach(async () => {
    [owner, operator, alice, bob, router] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('BridgeMock');
    bridge = await factory.deploy();
    await bridge.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridge.address);
    await gateKeeper.deployed();
    await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);
    await gateKeeper.setBridge(owner.address);

    factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();
    await addressBook.setGateKeeper(gateKeeper.address);

    factory = await ethers.getContractFactory('PriceOraclePoolMock');
    cryptoPool = await factory.deploy();

    factory = await ethers.getContractFactory('VirtualPriceReceiver');
    virtualPriceReceiver = await factory.deploy(addressBook.address, [chainId], [bridge.address]);
    await virtualPriceReceiver.deployed();

    await virtualPriceReceiver.grantRole(await virtualPriceReceiver.OPERATOR_ROLE(), operator.address);
  });

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

  it('should return correct price', async () => {
    const virtualPriceEth = parse18('0.01');
    const virtualPriceBsc = parse18('0.56');
    const virtualPricePol = parse18('0.137');
    const virtualPriceOp = parse18('0.1');
    const virtualPriceArb = parse18('0.42161');
    const virtualPriceAvax = parse18('0.43114');
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceEth, 1);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceBsc, 56);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPricePol, 137);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceOp, 10);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceArb, 42161);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceAvax, 43114);
    expect(await virtualPriceReceiver.getVirtualPriceEth()).to.equal(virtualPriceEth);
    expect(await virtualPriceReceiver.getVirtualPriceBsc()).to.equal(virtualPriceBsc);
    expect(await virtualPriceReceiver.getVirtualPricePol()).to.equal(virtualPricePol);
    expect(await virtualPriceReceiver.getVirtualPriceOpt()).to.equal(virtualPriceOp);
    expect(await virtualPriceReceiver.getVirtualPriceArb()).to.equal(virtualPriceArb);
    expect(await virtualPriceReceiver.getVirtualPriceAvax()).to.equal(virtualPriceAvax);
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

})