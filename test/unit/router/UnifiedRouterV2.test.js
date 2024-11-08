const { loadFixture, time, impersonateAccount, setBalance, impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, getReceipt } = require('../../../utils/common');
const abi = ethers.utils.defaultAbiCoder;
const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deployAddressBook,
  deployCurvePoolMock,
  deployPoolAdapter,
  deployUnifiedRouterV2,
  deployTestTokenPermit,
  deployWETH9,
  deployGateKeeperMock,
  deployBridgeMock,
  deployBridgeMock
} = require('../../setup/setup-contracts');


describe('UnifiedRouterV2 unit tests', () => {

  async function deploy(){

    let urouterV2, addressBook, gateKeeper, bridge, WETH, USDT;
    let urouterV2, addressBook, opsRegistrar, gateKeeper, bridge, WETH, USDT;
    let accountantRole, operatorRole, alice, malory, bridgeContract;

    const chainIdFrom = 13;
    const chainIdCurrent = network.config.chainId;
    const chainIdTo = 101;
    const someAddress = '0x0000000000000000000000000000000000000088';

    const tokenAmount = parse18('100');

    const executionPrice = parse18("0.1");
    const sendingEther =  parse18("1");

    const requestId = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const cPos = 0;
    const min10 = 60 * 10;

    [accountantRole, operatorRole, alice, malory] = await ethers.getSigners();
    [accountantRole, operatorRole, alice, malory] = await ethers.getSigners();

    // deployment contracts
    addressBook = await deployAddressBook();
    WETH = await deployWETH9();
    let tx = await addressBook.setWETH(WETH.address);
    await tx.wait();
    urouterV2 = await deployUnifiedRouterV2([addressBook.address]);
    USDT = await deployTestTokenPermit(['USDT', 'USDT', 18]);
    curveLPToken = await deployTestTokenPermit(['LP', 'LP', 18]);
    curvePoolMock = await deployCurvePoolMock([[USDT.address, WETH.address]]);
    poolAdapter = await deployPoolAdapter([curvePoolMock.address]);
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);


    // preparatory actions
    const ACCOUNTANT_ROLE = await urouterV2.ACCOUNTANT_ROLE();
    const OPERATOR_ROLE = await urouterV2.OPERATOR_ROLE();


    // setup roles
    tx = await urouterV2.grantRole(ACCOUNTANT_ROLE, accountantRole.address);
    await tx.wait();
    tx = await urouterV2.grantRole(OPERATOR_ROLE, operatorRole.address);
    await tx.wait();


    // setup pool
    tx = await urouterV2.connect(operatorRole).setPoolAdapter(curvePoolMock.address, poolAdapter.address);
    await tx.wait();


    // setup contracts to AddressBook
    tx = await addressBook.setGateKeeper(gateKeeper.address);
    await tx.wait();
    tx = await addressBook.setRouter([[chainIdFrom, urouterV2.address], [chainIdCurrent, urouterV2.address], [chainIdTo, urouterV2.address]]);
    await tx.wait();


    // setup WETH
    tx = await WETH.connect(alice).deposit({value: tokenAmount});
    await tx.wait();
    tx = await WETH.connect(alice).approve(urouterV2.address, tokenAmount);
    await tx.wait();
    tx = await WETH.deposit({value: tokenAmount});
    await tx.wait();
    tx = await WETH.transfer(curvePoolMock.address, tokenAmount);
    await tx.wait();


    // setup USDT
    tx = await USDT.mint(curvePoolMock.address, tokenAmount);
    await tx.wait();
    tx = await USDT.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await USDT.connect(alice).approve(urouterV2.address, tokenAmount);
    await tx.wait();


    // setup curvePoolMock
    tx = await curvePoolMock.mint(alice.address, tokenAmount);
    await tx.wait();


    // other setups
    const deadline = await time.latest() + min10;

    return {
      urouterV2, addressBook, gateKeeper, poolAdapter, curvePoolMock, USDT, WETH,
      owner, accountantRole, operatorRole, alice, malory, bridgeContract,
      urouterV2, addressBook, opsRegistrar, poolAdapter, curvePoolMock, USDT, WETH,
      accountantRole, operatorRole, alice, malory, bridgeContract,
      tokenAmount, executionPrice, sendingEther,
      someAddress, 
      chainIdCurrent, chainIdTo,
      requestId, cPos, deadline,
      OPERATOR_ROLE
    }
  }
  
  // describe("Should checking the correct operation of the constructor() function", () => {
  //   describe("Should checking the requires", () => {
  //     it('Should check require if WETH address is zero', async () => {

  //       const addressBook = await deployAddressBook();

  //       expect(await addressBook.WETH()).to.equal(AddressZero);

  //       await expect(deployUnifiedRouterV2([addressBook.address]))
  //         .revertedWith("Router: WETH incorrect");
  //     });
  //     describe("Should checking the correct changes state variables", () => {
  //       it("Should check correct set WETH", async () => {
  //         const { urouterV2, WETH } = await loadFixture(deploy);

  //         expect(await urouterV2.WETH()).to.equal(WETH.address);
  //       });
  //     });
  //   });
  // });

  // describe("Should checking the correct operation of the setPoolAdapter()", () => {
  //   describe("Should checking the requires", () => {
  //     it("Should check require if sender isn't OPERATOR_ROLE", async () => {
  //       const { urouterV2, malory, someAddress, OPERATOR_ROLE } = await loadFixture(deploy);

  //       expect(await urouterV2.hasRole(OPERATOR_ROLE, malory.address)).to.equal(false);

  //       const reason =`AccessControl: account ${malory.address.toLowerCase()} is missing role ${OPERATOR_ROLE}`;
            
  //       await expect(urouterV2.connect(malory).setPoolAdapter(someAddress, someAddress))
  //         .revertedWith(reason);
  //     });
  //   });
  //   describe("Should checking the correct changes state variables", () => {
  //     it("Should check change poolAdapter", async () => {
  //       const { urouterV2, operatorRole, someAddress, OPERATOR_ROLE } = await loadFixture(deploy);

  //       expect(await urouterV2.hasRole(OPERATOR_ROLE, operatorRole.address)).to.equal(true);

  //       const tx = await urouterV2.connect(operatorRole).setPoolAdapter(someAddress, someAddress);
  //       await tx.wait();

  //       expect(await urouterV2.poolAdapter(someAddress)).to.equal(someAddress);
  //     });
  //   });
  //   describe("Should checking the correct emit event", () => {
  //     it("Should check correct generate event PoolAdapterSet", async () => {
  //       const { urouterV2, operatorRole, someAddress } = await loadFixture(deploy);

  //       await expect(urouterV2.connect(operatorRole).setPoolAdapter(someAddress, someAddress))
  //         .emit(urouterV2, "PoolAdapterSet")
  //         .withArgs(someAddress, someAddress);
  //     });
  //   });
  // });

  describe("Should checking the correct operation of the start() function for ADD_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if sender isn't current from", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, malory, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(malory).start(['A'], [addParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          malory.address            // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp not zero and to not zero address", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        const { urouterV2, opsRegistrar, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A', 'A'], [addParams, addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A', 'A'], [addParams, addParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          AddressZero               // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
      it("Should check require if slippage", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          0,                        // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: executionPrice}))
          .revertedWith("UnifiedRouterV2: slippage");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should correct change tokens balance", async() => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            USDT,
            [alice],
            [tokenAmount.mul(-1)]
          )
          .changeTokenBalances(
            curvePoolMock,
            [alice],
            [tokenAmount]
          );
      });
      it("Should correct change Ether balance", async() => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // poolv
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, urouterV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // poolv
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['A'], [addParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await urouterV2.nonces(alice.address);

        const tx = await urouterV2.connect(alice).start(['A'], [addParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await urouterV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for ADD_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { urouterV2, addressBook, curvePoolMock, USDT, alice, malory, tokenAmount, requestId, cPos } = await loadFixture(deploy);

        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(urouterV2.connect(malory).resume(requestId, cPos, ['A'], [addParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations - ADD_CODE first", async () => {
        const { urouterV2, bridgeContract, curvePoolMock, USDT, alice, tokenAmount, requestId, cPos } = await loadFixture(deploy);

      it("Should check require if wrong current to", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, requestId, cPos } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['A'], [addParams]))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if wrong emergencyTo", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, cPos } = await loadFixture(deploy);
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, cPos } = await loadFixture(deploy);
        
        const addParams = getAddParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          AddressZero,              // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const zeroRequestId = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(urouterV2.connect(bridgeContract).resume(zeroRequestId, cPos, ['A'], [addParams]))
          .revertedWith("Router: wrong emergencyTo");
      });
          .revertedWith("Router: wrong sequence of operations");
      });
    });
  });

  describe("Should checking the correct operation of the start() function for REMOVE_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if sender isn't current from", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, malory, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(malory).start(['R'], [removeParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          malory.address            // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp not zero and to not zero address", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        const { urouterV2, opsRegistrar, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R', 'R'], [removeParams, removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R', 'R'], [removeParams, removeParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
      it("Should check require if emergencyTo is zero address", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          AddressZero               // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
      it("Should check require if slippage", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          0,                        // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: executionPrice}))
          .revertedWith("UnifiedRouterV2: slippage");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should correct change tokens balance", async() => {
        const { urouterV2, poolAdapter, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            USDT,
            [alice, curvePoolMock],
            [tokenAmount, tokenAmount.mul(-1)]
          )
          .changeTokenBalances(
            curvePoolMock,
            [alice, poolAdapter],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it("Should correct change Ether balance", async() => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, urouterV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { urouterV2, curvePoolMock, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          curvePoolMock.address,    // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['R'], [removeParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await urouterV2.nonces(alice.address);

        const tx = await urouterV2.connect(alice).start(['R'], [removeParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await urouterV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for REMOVE_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { urouterV2, addressBook, curvePoolMock, USDT, alice, malory, tokenAmount, requestId, cPos } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(urouterV2.connect(malory).resume(requestId, cPos, ['R'], [removeParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations - REMOVE_CODE first", async () => {
        const { urouterV2, gateKeeper, bridgeContract, curvePoolMock, USDT, alice, tokenAmount, requestId, cPos } = await loadFixture(deploy);

      it("Should check require if wrong current to", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, requestId, cPos } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['R'], [removeParams]))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if wrong emergencyTo", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, cPos } = await loadFixture(deploy);
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, cPos } = await loadFixture(deploy);
        
        const removeParams = getRemoveParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          AddressZero,              // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          alice.address             // emergencyTo
        );

        const zeroRequestId = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(urouterV2.connect(bridgeContract).resume(zeroRequestId, cPos, ['R'], [removeParams]))
          .revertedWith("Router: wrong emergencyTo");
      });
    });
  });

  describe("Should checking the correct operation of the start() function for SWAP_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if sender isn't current from", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, malory, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(malory).start(['S'], [swapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          malory.address            // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if worng to - nextOp zero and to zero addres", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp not zero and to not zero address", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        const { urouterV2, opsRegistrar, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S', 'S'], [swapParams, swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S', 'S'], [swapParams, swapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
      it("Should check require if emergencyTo is zero address", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          AddressZero               // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
      it("Should check require if slippage", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          0,                        // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: executionPrice}))
          .revertedWith("UnifiedRouterV2: slippage");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should correct change tokens balance", async() => {
        const { urouterV2, curvePoolMock, USDT, WETH, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await USDT.connect(alice).approve(urouterV2.address, tokenAmount);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: sendingEther}))
        .changeTokenBalances(
          USDT,
          [alice],
          [tokenAmount.mul(-1)]
        )
        .changeTokenBalances(
          WETH,
          [alice],
          [tokenAmount]
        );
      });
      it("Should correct change Ether balance", async() => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, urouterV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { urouterV2, curvePoolMock, USDT, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['S'], [swapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await urouterV2.nonces(alice.address);

        const tx = await urouterV2.connect(alice).start(['S'], [swapParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await urouterV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for REMOVE_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { urouterV2, addressBook, curvePoolMock, USDT, alice, malory, tokenAmount, requestId, cPos } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(urouterV2.connect(malory).resume(requestId, cPos, ['S'], [swapParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations - ADD_CODE first", async () => {
        const { urouterV2, bridgeContract, curvePoolMock, USDT, alice, tokenAmount, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong current to", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, requestId, cPos } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['S'], [swapParams]))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if wrong emergencyTo", async () => {
        const { urouterV2, curvePoolMock, USDT, alice, bridgeContract, tokenAmount, cPos } = await loadFixture(deploy);
        
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          AddressZero,              // from
          alice.address,            // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

        const zeroRequestId = "0x0000000000000000000000000000000000000000000000000000000000000000";

        await expect(urouterV2.connect(bridgeContract).resume(zeroRequestId, cPos, ['S'], [swapParams]))
          .revertedWith("Router: wrong emergencyTo");
      });
          .revertedWith("Router: wrong sequence of operations");
      });
    });
  });

  function getAddParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        emergencyTo
    ]);
  }

  function getRemoveParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        emergencyTo
    ]);
  }

  function getSwapParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, j, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        j,
        emergencyTo
    ]);
  }
});
