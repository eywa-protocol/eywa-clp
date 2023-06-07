const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

const parseToken = ethers.utils.parseEther;
const castToBytes32 = (address) => ethers.utils.hexZeroPad(ethers.utils.hexlify(address), 32);

const decodeEvent = async (tx, contract, eventName) => {
  const receipt = await tx.wait();
  const event = receipt.events.find((e) => e.address === contract.address);
  const decoded = contract.interface.decodeEventLog(eventName, event.data, event.topics);
  return decoded;
};

describe('Synthesis unit tests', () => {

  let xtoken, xsynth, bridge, gateKeeper, portal, synthesis, whitelist, addressBook, treasury, synthFactory;

  const zeroAddress = ethers.constants.AddressZero;
  const chainId = network.config.chainId;

  let owner, alice, bob, carol, charly, mallory;

  // Deploy all contracts before each test suite
  before(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, bob, carol, charly, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('BridgeMock');
    bridge = await factory.deploy();
    await bridge.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridge.address);
    await gateKeeper.deployed();

    await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);

    factory = await ethers.getContractFactory('TestTokenPermit');
    xtoken = await factory.deploy('TestToken', 'TUSD');
    await xtoken.deployed();

    factory = await ethers.getContractFactory('Whitelist');
    whitelist = await factory.deploy();
    await whitelist.deployed();

    await whitelist.addTokenToWhitelist(xtoken.address);
    await whitelist.changeTokenMin(xtoken.address, parseToken('0.1'));
    await whitelist.changeTokenMax(xtoken.address, parseToken('1000000'));
    await whitelist.changeTokenFee(xtoken.address, 1000); // bridge fee 10%

    factory = await ethers.getContractFactory('EywaTreasury');
    treasury = await factory.deploy();
    await treasury.deployed();

    factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();

    factory = await ethers.getContractFactory('SynthFactory');
    synthFactory = await factory.deploy(addressBook.address);
    await synthFactory.deployed();

    factory = await ethers.getContractFactory('PortalV2');
    portal = await factory.deploy(gateKeeper.address, whitelist.address, treasury.address, addressBook.address);
    await portal.deployed();

    await addressBook.setPortal([[chainId, portal.address]]);

    factory = await ethers.getContractFactory('SynthesisV2');
    synthesis = await factory.deploy(gateKeeper.address, whitelist.address, treasury.address, addressBook.address);
    await synthesis.deployed();

    await addressBook.setSynthesis([[chainId, synthesis.address]]);

    const synthParams = [
      xtoken.address,
      await xtoken.decimals(),
      await xtoken.name(),
      await xtoken.symbol(),
      chainId,
      'FTM'
    ];
    await synthFactory.deployDefaultSynth(...synthParams);
    const synth = await synthFactory.getDefaultSynth(...synthParams);
    
    await synthesis.setSynths([synth]);

    xsynth = await ethers.getContractAt('SynthERC20', synth);
  });

  beforeEach(async () => {

  });

  describe('mint', () => {
    beforeEach(async () => {
      await xtoken.mint(alice.address, parseToken('1000'));
    });

    it('should lock/mint tokens by portal request', async() => {
      const synthAmount = parseToken('1');
      await xtoken.connect(alice).transfer(portal.address, synthAmount);

      const tx = await portal.synthesize(xtoken.address, synthAmount, alice.address, bob.address, chainId);
      const requestSentEvent = await decodeEvent(tx, bridge, 'RequestSent');
      
      await bridge.receiveV2([[requestSentEvent.data, requestSentEvent.to]]);

      expect(await xsynth.balanceOf(bob.address)).to.equal(parseToken('0.9'));
    });

    describe('burn', () => {

      before(async () => {
        const synthAmount = parseToken('1');
        await xtoken.connect(alice).transfer(portal.address, synthAmount);

        let tx = await portal.synthesize(xtoken.address, synthAmount, alice.address, bob.address, chainId);
        let requestSentEvent = await decodeEvent(tx, bridge, 'RequestSent');
        
        await bridge.receiveV2([[requestSentEvent.data, requestSentEvent.to]]);
        expect(await xsynth.balanceOf(bob.address)).to.equal(parseToken('1.8'));
      });

      it('should burn and unlock original tokens by synthesis request', async() => {
        const burnAmount = parseToken('0.45');
        const tx = await synthesis.connect(bob).burn(xsynth.address, burnAmount, carol.address);
        const requestSentEvent = await decodeEvent(tx, bridge, 'RequestSent');
        
        await bridge.receiveV2([[requestSentEvent.data, requestSentEvent.to]]);
        expect(await xtoken.balanceOf(carol.address)).to.equal(parseToken('0.405'));
      });

      it('should burn and mint tokens by synthesis request', async() => {
        const burnAmount = parseToken('0.45');
        const tx = await synthesis.connect(bob).move(xsynth.address, burnAmount, charly.address, chainId);
        const requestSentEvent = await decodeEvent(tx, bridge, 'RequestSent');
        
        await bridge.receiveV2([[requestSentEvent.data, requestSentEvent.to]]);
        expect(await xtoken.balanceOf(charly.address)).to.equal(parseToken('0.405'));
      });
    });
  });

});