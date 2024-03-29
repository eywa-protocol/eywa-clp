const { ethers, contract } = require('hardhat');
const { expect } = require('chai');


describe('VirtualPriceSender unit tests', () => {
  let owner, alice, bob;
  const chainId = network.config.chainId;
  const randomAddress = '0x0000000000000000000000000000000000000042';

  beforeEach(async () => {
    [owner, operator, sender, alice, bob, router] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('BridgeMock');
    bridge = await factory.deploy();
    await bridge.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridge.address);
    await gateKeeper.deployed();
    await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);

    factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();
    await addressBook.setGateKeeper(gateKeeper.address);

    factory = await ethers.getContractFactory('PriceOraclePoolMock');
    cryptoPool = await factory.deploy();

    factory = await ethers.getContractFactory('VirtualPriceReceiver');
    virtualPriceReceiver = await factory.deploy(addressBook.address, [chainId], [bridge.address]);
    await virtualPriceReceiver.deployed();

    factory = await ethers.getContractFactory('VirtualPriceSender');
    virtualPriceSender = await factory.deploy(addressBook.address);
    await virtualPriceSender.deployed();

    await virtualPriceSender.grantRole(await virtualPriceSender.OPERATOR_ROLE(), operator.address);
    await virtualPriceSender.grantRole(await virtualPriceSender.SENDER_ROLE(), sender.address);
  });

  it('should set address book', async () => {
    await virtualPriceSender.setAddressBook(randomAddress);
    expect(await virtualPriceSender.addressBook()).to.be.equal(randomAddress);
  });

  it('shouldn\'t set addressBook if caller is not an admin', async () => {
    const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await virtualPriceSender.DEFAULT_ADMIN_ROLE()}`;
    const address = '0x00000000000000000000000000000000000000Ad';
    await expect(virtualPriceSender.connect(alice).setAddressBook(address)).to.be.revertedWith(reason);
  });

  it('should set vp receiver', async () => {
    await virtualPriceSender.connect(operator).setReceiver(cryptoPool.address, chainId, randomAddress);
    expect(await virtualPriceSender.receivers(cryptoPool.address, chainId)).to.be.equal(randomAddress);
  });

  it('shouldn\'t set receiver if caller is not an operator', async () => {
    const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await virtualPriceSender.OPERATOR_ROLE()}`;
    await expect(virtualPriceSender.connect(alice).setReceiver(cryptoPool.address, chainId, randomAddress))
      .to.be.revertedWith(reason);
  });

  it('should send virtual price', async () => {
    await virtualPriceSender.connect(operator).setReceiver(cryptoPool.address, chainId, randomAddress);
    
    await expect(virtualPriceSender.connect(sender)['sendVirtualPrice(address,uint64)'](cryptoPool.address, chainId))
      .to.emit(virtualPriceSender, 'PriceSent').withArgs('42', cryptoPool.address, chainId);
  });

  it('should send virtual price few times', async () => {
    await virtualPriceSender.connect(operator).setReceiver(cryptoPool.address, chainId, randomAddress);
    await virtualPriceSender.connect(sender)['sendVirtualPrice(address[],uint64[])']([cryptoPool.address], [chainId]);
  });

  it('shouldn\'t send virtual price if receiver not set', async () => {
    await expect(virtualPriceSender.connect(sender)['sendVirtualPrice(address,uint64)'](cryptoPool.address, chainId))
      .to.be.revertedWith('VirtualPriceSender: wrong receiver');
  });

  it('shouldn\'t set receiver if caller is not a sender', async () => {
    await virtualPriceSender.connect(operator).setReceiver(cryptoPool.address, chainId, randomAddress);
    const reason =`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await virtualPriceSender.SENDER_ROLE()}`;
    await expect(virtualPriceSender.connect(alice)['sendVirtualPrice(address,uint64)'](cryptoPool.address, chainId))
      .to.be.revertedWith(reason);
  });

})