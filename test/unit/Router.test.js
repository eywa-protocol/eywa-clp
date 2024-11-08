const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse6, parse18, signInvoice, getReceipt } = require('../../utils/common');
const { getRequestId } = require('../../utils/helper');
const abi = ethers.utils.defaultAbiCoder;


const getPermitSignature = async (signer, token, spender, value, deadline) => {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    'EYWA',
    '1',
    signer.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {name, version, chainId, verifyingContract: token.address },
      {
        Permit: [
          {name: 'owner', type: 'address'},
          {name: 'spender', type: 'address'},
          {name: 'value', type: 'uint256'},
          {name: 'nonce', type: 'uint256'},
          {name: 'deadline', type: 'uint256'},
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
};

describe('Router unit tests', () => {

  let addressBook, whitelist, opsRegistrar, portal, synthesis, treasury, router, bridge, gateKeeper, USDT, sUSDT_BSC;
  let owner, accountant, alice, mallory;

  // origin chain
  let USDTAddress; // '0x55d398326f99059ff775485246999027b3197955';

  let counter = 0;

  before(async () => {
    [owner, accountant, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('AddressBook');
    addressBook = await factory.deploy();
    await addressBook.deployed();

    factory = await ethers.getContractFactory('WhitelistV2Mock');
    whitelist = await factory.deploy();
    await whitelist.deployed();

    factory = await ethers.getContractFactory('OpsRegistrar');
    opsRegistrar = await factory.deploy();
    await opsRegistrar.deployed();

    factory = await ethers.getContractFactory('SynthesisV2Mock');
    synthesis = await factory.deploy(addressBook.address);
    await synthesis.deployed();

    factory = await ethers.getContractFactory('PortalV2Mock');
    portal = await factory.deploy(addressBook.address);
    await portal.deployed();

    factory = await ethers.getContractFactory('FeesTreasury');
    treasury = await factory.deploy();
    await treasury.deployed();

    factory = await ethers.getContractFactory('RouterV2');
    router = await factory.deploy(addressBook.address);
    await router.deployed();
    
    factory = await ethers.getContractFactory('BridgeMock');
    bridge = await factory.deploy();
    await bridge.deployed();

    factory = await ethers.getContractFactory('GateKeeperMock');
    gateKeeper = await factory.deploy(bridge.address);
    await gateKeeper.deployed();

    await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);

    await addressBook.setOpsRegistrar(opsRegistrar.address);
    await addressBook.setWhitelist(whitelist.address);
    await addressBook.setSynthesis([[network.config.chainId, synthesis.address], [56, synthesis.address]]);
    await addressBook.setPortal([[network.config.chainId, portal.address], [56, portal.address]]);
    await addressBook.setRouter([[network.config.chainId, router.address], [56, router.address]]);
    await addressBook.setTreasury(treasury.address);
    await addressBook.setGateKeeper(gateKeeper.address);

    await router.grantRole(await router.ACCOUNTANT_ROLE(), accountant.address);
    await router.grantRole(await router.OPERATOR_ROLE(), owner.address);

    await synthesis.grantRole(await synthesis.OPERATOR_ROLE(), owner.address);

    await opsRegistrar.registerComplexOp([
      ['LM', true],
      ['BM', true],
      ['BU', true],
      ['PLMW', true],
      ['PLM', true],
    ]);
  });

  beforeEach(async () => {
    factory = await ethers.getContractFactory('TestTokenPermit');
    USDT = await factory.deploy('ThetherToken', 'USDT', 6);
    await USDT.deployed();

    ++counter;
    USDTAddress = ethers.utils.hexZeroPad('0x' + counter.toString(16), 20);

    factory = await ethers.getContractFactory('SynthERC20');
    sUSDT_BSC = await factory.deploy('sUSDT_BSC', 'sUSDT_BSC', 6, USDTAddress, 56, 'BSC', 1);
    await sUSDT_BSC.deployed();

    await synthesis.setSynths([sUSDT_BSC.address]);
    await sUSDT_BSC.transferOwnership(synthesis.address);
  });

  describe('LM', () => {

    let data1s, data1r;

    beforeEach(async () => {
      const s1 = [
        USDT.address,
        parse6('100'),
        alice.address,
        alice.address,
        56, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1s = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s1]);

      const s2 = [
        USDTAddress,
        parse6('100'),
        alice.address,
        alice.address,
        250, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1r = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s2]);

      await USDT.mint(alice.address, parse6('100'));
    });

    it("should start LM", async function () {
      const receipt = await getReceipt(250, ['LM'], data1s, router, alice, accountant);
      await USDT.connect(alice).approve(router.address, parse6('100'));
      await router.connect(alice).start(['LM'], [data1s], receipt);
      expect(await USDT.balanceOf(portal.address)).to.be.equal(parse6('100'));
    });

    it("should not start LM", async function () {
      const hAddress = '0x000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      const { v, r, s } = await getPermitSignature(
        alice,
        USDT,
        router.address,
        parse6('100'),
        2272122000
      );

      const maliciousPermit = [
        // permit
        USDT.address,
        alice.address,
        parse6('100'),
        2272122000,
        v,
        r,
        s
      ];

      const maliciousSwap = [
        // cs
        USDT.address,
        hAddress,//parse6('100'),
        alice.address,
        ethers.constants.AddressZero,
        56, // chain id to
        56, // tokenIn origin
        alice.address
      ];

      const data = abi.encode(
        [
          // permit
          'address',
          'address',
          'uint256',
          'uint256',
          'uint8',
          'bytes32',
          'bytes32',
        ],
        [...maliciousPermit]
      ) + '2c' + abi.encode(
        [
          // swap
          'address',
          'uint256',
          'address',
          'address',
          'uint64',
          'uint64',
          'address'
        ],
        [...maliciousSwap]
      ).replace('0x', '');

      maliciousPermit.push(maliciousSwap.shift());

      const maliciousPermitData = abi.encode([
        // permit
        'address',
        'address',
        'uint256',
        'uint256',
        'uint8',
        'bytes32',
        'bytes32',
        'address', // wrong
      ], [...maliciousPermit]);

      const maliciousSwapData = abi.encode([
        // swap
        'uint256',
        'address',
        'address',
        'uint64',
        'uint64',
        'address',
        // 'address',
      ], [...maliciousSwap]);

      const receipt = await getReceipt(250, ['PLM'], data, router, alice, accountant);
      await expect(router.connect(alice).start(['P', 'LM'], [maliciousPermitData, maliciousSwapData], receipt))
        .to.be.revertedWith('BaseRouter: invalid signature from worker');
    });

    it("should resume LM", async function () {
      const selector = router.interface.getSighash('resume');
      const nextRequestId = getRequestId(router.address, 250, router.address, 56, (await bridge.nonces(router.address)).toString());
      const data1rs = router.interface.encodeFunctionData('resume', [nextRequestId, 0, ['LM'], [data1r]]);
      const data = await gateKeeper.prepareData(data1rs, router.address, 250, router.address, 56);
      await bridge.receiveV2([[data, router.address]]);
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(parse6('100'));
    });

  });

  describe('BM', () => {

    let data1s, data1r;

    beforeEach(async () => {
      const s1 = [
        sUSDT_BSC.address,
        parse6('100'),
        alice.address,
        alice.address,
        56, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1s = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s1]);

      const s2 = [
        USDTAddress,
        parse6('100'),
        alice.address,
        alice.address,
        250, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1r = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s2]);

      await synthesis.mintSynth(sUSDT_BSC.address, alice.address, parse6('100'));
    });

    it("should start BM", async function () {
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(parse6('100'));
      const receipt = await getReceipt(250, ['BM'], data1s, router, alice, accountant);
      await router.connect(alice).start(['BM'], [data1s], receipt);
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(0);
    });

    it("should resume BM", async function () {
      const selector = router.interface.getSighash('resume');
      const nextRequestId = getRequestId(router.address, 250, router.address, 56, (await bridge.nonces(router.address)).toString());
      const data1rs = router.interface.encodeFunctionData('resume', [nextRequestId, 0, ['BM'], [data1r]]);
      const data = await gateKeeper.prepareData(data1rs, router.address, 250, router.address, 56);
      await bridge.receiveV2([[data, router.address]]);
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(parse6('200'));
    });

  });

  describe('BU', () => {

    let data1s, data1r;

    beforeEach(async () => {
      const s1 = [
        sUSDT_BSC.address,
        parse6('100'),
        alice.address,
        alice.address,
        56, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1s = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s1]);

      const s2 = [
        USDT.address,
        parse6('100'),
        alice.address,
        alice.address,
        250, // chain id to
        56, // tokenIn origin
        alice.address
      ];
      data1r = abi.encode(['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'], [...s2]);

      await synthesis.mintSynth(sUSDT_BSC.address, alice.address, parse6('100'));
      await USDT.mint(portal.address, parse6('100'));
      await portal.lock(USDT.address, parse6('100'), router.address, router.address);
    });

    it("should start BU", async function () {
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(parse6('100'));
      const receipt = await getReceipt(250, ['BU'], data1s, router, alice, accountant);
      await router.connect(alice).start(['BU'], [data1s], receipt);
      expect(await sUSDT_BSC.balanceOf(alice.address)).to.be.equal(0);
    });

    it("should resume BU", async function () {
      const selector = router.interface.getSighash('resume');
      const nextRequestId = getRequestId(router.address, 250, router.address, 56, (await bridge.nonces(router.address)).toString());
      const data1rs = router.interface.encodeFunctionData('resume', [nextRequestId, 0, ['BU'], [data1r]]);
      const data = await gateKeeper.prepareData(data1rs, router.address, 250, router.address, 56);
      await bridge.receiveV2([[data, router.address]]);
      expect(await USDT.balanceOf(alice.address)).to.be.equal(parse6('100'));
      expect(await USDT.balanceOf(portal.address)).to.be.equal(0);
    });

  });
  
});
