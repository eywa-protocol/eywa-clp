const { loadFixture, time, impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, getReceipt } = require('../../../utils/common');
const abi = ethers.utils.defaultAbiCoder;
const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deployAddressBook,
  deployRouterV2,
  deployGateKeeperMock
  deployOpsRegistrar,
  deployGateKeeperMock,
  deployBridgeMock
} = require('../../setup/setup-contracts');


describe('BaseRouter unit tests', () => {

  async function deploy(){

    let routerV2, addressBook, gateKeeper;
    let routerV2, addressBook, opsRegistrar, gateKeeper, bridge;
    let owner, accountantRole, alice, malory, bridgeContract;

    const chainIdFrom = network.config.chainId;
    const someAddress = '0x0000000000000000000000000000000000000088';

    const executionPrice = parse18("0.1");
    const anyOperation = 'AO';
    const anyParams = abi.encode(['address'], [someAddress]);
    const min10 = 60 * 10;

    const requestId = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const zeroRequestId = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const cPos = [anyParams].length - 1;

    [owner, accountantRole, operatorRole, alice, malory] = await ethers.getSigners();

    // deployment contracts
    addressBook = await deployAddressBook();
    let tx = await addressBook.setWETH(someAddress);
    await tx.wait();
    routerV2 = await deployRouterV2([addressBook.address]);
    gateKeeper = await deployGateKeeperMock([bridgeContract.address]);
    opsRegistrar = await deployOpsRegistrar();
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);

    // preparatory actions
    const DEFAULT_ADMIN_ROLE = await routerV2.DEFAULT_ADMIN_ROLE();
    const ACCOUNTANT_ROLE = await routerV2.ACCOUNTANT_ROLE();

    tx = await routerV2.grantRole(ACCOUNTANT_ROLE, accountantRole.address);
    await tx.wait();

    tx = await addressBook.setRouter([[network.config.chainId, routerV2.address], [chainIdFrom, routerV2.address]]);
    await tx.wait();
    tx = await addressBook.setGateKeeper(gateKeeper.address);
    await tx.wait();
    tx = await addressBook.setOpsRegistrar(opsRegistrar.address);
    await tx.wait();

    tx = await opsRegistrar.registerComplexOp([
      [anyOperation, true],
    ]);
    await tx.wait();
    
    // impersonate contracts
    await impersonateAccount(bridge.address);
    await setBalance(bridge.address, MaxUint256);
    bridgeContract = await ethers.getSigner(bridge.address);

    const deadline = await time.latest() + min10;

    return {
      routerV2, addressBook,
      owner, accountantRole, alice, malory, bridgeContract,
      chainIdFrom, someAddress, 
      executionPrice, anyOperation, anyParams, requestId, cPos, min10, deadline,
      DEFAULT_ADMIN_ROLE, ACCOUNTANT_ROLE
    }
  }

  describe("Should checking the values initialized on deploy", () => {
    it("Should check correct set addressBook", async () => {
      const { routerV2, addressBook } = await loadFixture(deploy);

      expect(await routerV2.addressBook()).to.equal(addressBook.address);
    });
  });

  describe("Should checking the correct operation of the setAddressBook() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't DEFAULT_ADMIN_ROLE", async () => {
        const { routerV2, malory, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;

        await expect(routerV2.connect(malory).setAddressBook(someAddress))
          .revertedWith(reason);
      });
      it("Should check require if new address is zero", async () => {
        const { routerV2, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        await expect(routerV2.setAddressBook(AddressZero))
          .revertedWith("EndPoint: zero address");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change addressBook", async () => {
        const { routerV2, owner, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        const tx = await routerV2.setAddressBook(someAddress);
        await tx.wait();

        expect(await routerV2.addressBook()).to.equal(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the pause() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't DEFAULT_ADMIN_ROLE", async () => {
        const { routerV2, malory, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;

        await expect(routerV2.connect(malory).pause())
          .revertedWith(reason);
      });
      it("Should check require if already set pause", async () => {
        const { routerV2, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        const tx = await routerV2.pause();
        await tx.wait();

        expect(await routerV2.paused()).to.equal(true);

        await expect(routerV2.pause())
          .revertedWith("Pausable: paused");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change paused", async () => {
        const { routerV2, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
        expect(await routerV2.paused()).to.equal(false);

        const tx = await routerV2.pause();
        await tx.wait();

        expect(await routerV2.paused()).to.equal(true);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Paused", async () => {
        const { routerV2, owner } = await loadFixture(deploy);

        await expect(routerV2.pause())
          .emit(routerV2, "Paused")
          .withArgs(owner.address);
      });
    });
  });

  describe("Should checking the correct operation of the unpause() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't DEFAULT_ADMIN_ROLE", async () => {
        const { routerV2, malory, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;

        await expect(routerV2.connect(malory).unpause())
          .revertedWith(reason);
      });
      it("Should check require if already set unpause", async () => {
        const { routerV2, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
        expect(await routerV2.paused()).to.equal(false);

        await expect(routerV2.unpause())
          .revertedWith("Pausable: not paused");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change paused", async () => {
        const { routerV2, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await routerV2.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        let tx = await routerV2.pause();
        await tx.wait();
        tx = await routerV2.unpause();
        await tx.wait();

        expect(await routerV2.paused()).to.equal(false);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Unpaused", async () => {
        const { routerV2, owner } = await loadFixture(deploy);

        const tx = await routerV2.pause();
        await tx.wait();

        await expect(routerV2.unpause())
          .emit(routerV2, "Unpaused")
          .withArgs(owner.address);
      });
    });
  });

  describe("Should checking the correct operation of the _start() function for all operations", () => {
    describe("Should checking the requires", () => {
      it("Should check require if more operations than 2**8", async () => {
        const { routerV2, accountantRole, alice, chainIdFrom, executionPrice, anyOperation, anyParams, deadline } = await loadFixture(deploy);

        const wrongOperations = Array(2 ** 8 + 1).fill(anyOperation)

        const receipt = await getReceipt(chainIdFrom, wrongOperations, [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(wrongOperations, [anyParams], receipt))
          .revertedWith("BaseRouter: wrong params count");
      });
      it("Should check require if operations and params has different length", async () => {
        const { routerV2, accountantRole, alice, chainIdFrom, executionPrice, anyOperation, anyParams, deadline } = await loadFixture(deploy);

        const receipt = await getReceipt(chainIdFrom, [anyOperation], [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start([anyOperation, anyOperation], [anyParams], receipt, {value: executionPrice}))
          .revertedWith("BaseRouter: wrong params");

        await expect(routerV2.connect(alice).start([anyOperation], [anyParams, anyParams], receipt, {value: executionPrice}))
          .revertedWith("BaseRouter: wrong params");
      });
      it("Should check require if operation not registered in opsRegistrar", async () => {
        const { routerV2, opsRegistrar, accountantRole, alice, chainIdFrom, executionPrice, anyParams, deadline } = await loadFixture(deploy);

        const worngOperation = "WO";
        const worngOperationHash = ethers.utils.solidityKeccak256(['string'], [worngOperation]);
        
        expect(await opsRegistrar.ops(worngOperationHash)).to.equal(false);

        const receipt = await getReceipt(chainIdFrom, [worngOperation], [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start([worngOperation], [anyParams], receipt, {value: executionPrice}))
          .revertedWith("BaseRouter: complex op not registered");
      });
      it("Should check require if current time more than deadline", async () => {
        const { routerV2, accountantRole, alice, chainIdFrom, executionPrice, anyOperation, anyParams, min10, deadline } = await loadFixture(deploy);

        const receipt = await getReceipt(chainIdFrom, [anyOperation], [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await time.increase(min10 + 1);

        await expect(routerV2.connect(alice).start([anyOperation], [anyParams], receipt, {value: executionPrice}))
          .revertedWith("BaseRouter: deadline");
      });
      it("Should check require if signer don't has ACCOUNTANT_ROLE", async () => {
        const { routerV2, alice, malory, chainIdFrom, executionPrice, anyOperation, anyParams, deadline, ACCOUNTANT_ROLE } = await loadFixture(deploy);

        const receipt = await getReceipt(chainIdFrom, [anyOperation], [anyParams], routerV2, alice, malory, executionPrice, deadline);

        expect(await routerV2.hasRole(ACCOUNTANT_ROLE, malory.address)).to.equal(false);

        await expect(routerV2.connect(alice).start([anyOperation], [anyParams], receipt, {value: executionPrice}))
          .revertedWith("BaseRouter: invalid signature from worker");
      });
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, accountantRole, alice, chainIdFrom, executionPrice, anyOperation, anyParams, deadline } = await loadFixture(deploy);

        const receipt = await getReceipt(chainIdFrom, [anyOperation], [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start([anyOperation], [anyParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if incorrect operation", async () => {
        const { routerV2, accountantRole, alice, chainIdFrom, executionPrice, anyOperation, anyParams, deadline} = await loadFixture(deploy);

        const receipt = await getReceipt(chainIdFrom, [anyOperation], [anyParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start([anyOperation], [anyParams], receipt, {value: executionPrice}))
          .revertedWith(`Router: op ${anyOperation} is not supported`);
      });
    });
  });

  describe("Should checking the correct operation of the _resume() function for all operations", () => {
    describe("Should checking the requires", () => {
      it("Should check require if requestId is zero", async () => {
        const { routerV2, bridgeContract, anyOperation, anyParams, cPos } = await loadFixture(deploy);

        const zeroRequestId = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(routerV2.connect(bridgeContract).resume(zeroRequestId, cPos, [anyOperation], [anyParams]))
          .revertedWith("BaseRouter: requestId is zero");
      });
      it("Should check require if more operations than 2**8", async () => {
        const { routerV2, bridgeContract, anyOperation, anyParams, requestId, cPos } = await loadFixture(deploy);

        const wrongOperations = Array(2 ** 8 + 1).fill(anyOperation)

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, wrongOperations, [anyParams]))
          .revertedWith("BaseRouter: wrong params count");
      });
      it("Should check require if operations and params has different length", async () => {
        const { routerV2, bridgeContract, anyOperation, anyParams, requestId, cPos } = await loadFixture(deploy);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, [anyOperation, anyOperation], [anyParams]))
          .revertedWith("BaseRouter: wrong params");

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, [anyOperation], [anyParams, anyParams]))
          .revertedWith("BaseRouter: wrong params");
      });
      it("Should check require if cPos bigger than params length", async () => {
        const { routerV2, bridgeContract, anyOperation, anyParams, requestId } = await loadFixture(deploy);

        const cPosWrong = anyParams.length;

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPosWrong, [anyOperation], [anyParams]))
          .revertedWith("BaseRouter: wrong params");
      });
      it("Should check require if incorrect operation execution result is failed", async () => {
        const { routerV2, bridgeContract, anyOperation, anyParams, requestId, cPos } = await loadFixture(deploy);

        expect(anyOperation).to.not.equal('LM');
        expect(anyOperation).to.not.equal('BU');
        expect(anyOperation).to.not.equal('BM');
        expect(anyOperation).to.not.equal('!M');
        expect(anyOperation).to.not.equal('!U');

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, [anyOperation], [anyParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
    });
  });
});