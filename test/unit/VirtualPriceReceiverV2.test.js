const { ethers, contract } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const { shouldBehaveLikeVirtualPriceReceiver } = require('./VirtualPriceReceiver.behavior');


describe('VirtualPriceReceiverV2 unit tests', () => {

  chainId = network.config.chainId;

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

    factory = await ethers.getContractFactory('VirtualPriceReceiverV2');
    virtualPriceReceiver = await factory.deploy(addressBook.address, [chainId], [bridge.address]);
    await virtualPriceReceiver.deployed();

    await virtualPriceReceiver.grantRole(await virtualPriceReceiver.OPERATOR_ROLE(), operator.address);
  });

  shouldBehaveLikeVirtualPriceReceiver.call(this);

  it('should return correct price', async () => {
    const virtualPriceBase = parse18('0.8453');
    const virtualPriceCelo = parse18('0.42220');
    const virtualPriceMoonbeam = parse18('0.1284');
    const virtualPriceGnosis = parse18('0.001');
    const virtualPriceXLayer = parse18('0.196');
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceBase, 8453);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceCelo, 42220);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceMoonbeam, 1284);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceGnosis, 100);
    await virtualPriceReceiver.receiveVirtualPrice(virtualPriceXLayer, 196);
    expect(await virtualPriceReceiver.getVirtualPriceBase()).to.equal(virtualPriceBase);
    expect(await virtualPriceReceiver.getVirtualPriceCelo()).to.equal(virtualPriceCelo);
    expect(await virtualPriceReceiver.getVirtualPriceMoonbeam()).to.equal(virtualPriceMoonbeam);
    expect(await virtualPriceReceiver.getVirtualPriceGnosis()).to.equal(virtualPriceGnosis);
    expect(await virtualPriceReceiver.getVirtualPriceXlayer()).to.equal(virtualPriceXLayer);
  });

});