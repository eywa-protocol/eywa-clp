const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deployAddressBook,
  deploySynthFactory
} = require('../setup/setup-contracts');


describe('SynthFactory unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    let synthFactory, addressBook;
    let owner, operator, malory, synthesisContract;

    const originalTokenAddress = '0x55d398326f99059ff775485246999027b3197955';
    const someAddress = '0x0000000000000000000000000000000000000088';

    const chainIdCurrent = network.config.chainId;
    const chainIdFrom = 56;

    const originalChainSymbol = 'BSC';
    const originalTokenName = 'OriginalTokenName';
    const originalTokenSymbol = 'OTN';
    const decimals = 18;
    
    [owner, operator, malory, synthesisContract] = await ethers.getSigners();


    // deployment contracts
    addressBook = await deployAddressBook();
    synthFactory = await deploySynthFactory([addressBook.address]);


    // preparatory actions
    const DEFAULT_ADMIN_ROLE = await synthFactory.DEFAULT_ADMIN_ROLE();
    const OPERATOR_ROLE = await synthFactory.OPERATOR_ROLE();

    let tx = await synthFactory.grantRole(OPERATOR_ROLE, operator.address);
    await tx.wait();


    // contrats emulation
    tx = await addressBook.setSynthesis([[chainIdCurrent, synthesisContract.address]]);
    await tx.wait();


    return {
      synthFactory, addressBook,
      owner, operator, malory, someAddress, 
      originalTokenAddress, originalTokenName, originalTokenSymbol, decimals,
      chainIdCurrent, chainIdFrom, originalChainSymbol,  
      SynthType, DEFAULT_ADMIN_ROLE, OPERATOR_ROLE
    }
  }

  describe("Should checking the correct operation of the setAddressBook() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if address in argument is zero", async () => {
        await expect(deploySynthFactory([AddressZero]))
          .revertedWith("SynthFactory: zero address");
      });
    });
    describe("Should checking the values initialized on deploy", () => {
      it("Should check correct set addressBook", async () => {
        const { synthFactory, addressBook } = await loadFixture(deploy);
  
        expect(await synthFactory.addressBook()).to.equal(addressBook.address);
      });
    });
  });


  describe("Should checking the correct operation of the setAddressBook() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't DEFAULT_ADMIN_ROLE", async () => {
        const { synthFactory, malory, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await synthFactory.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;

        await expect(synthFactory.connect(malory).setAddressBook(someAddress))
          .revertedWith(reason);
      });
      it("Should check require if new address is zero", async () => {
        const { synthFactory, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);
          
        expect(await synthFactory.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        await expect(synthFactory.setAddressBook(AddressZero))
          .revertedWith("SynthFactory: zero address");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change addressBook", async () => {
        const { synthFactory, owner, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await synthFactory.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        const tx = await synthFactory.setAddressBook(someAddress);
        await tx.wait();

        expect(await synthFactory.addressBook()).to.equal(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the deployCustomSynth() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an operator", async () => {
        const { synthFactory, malory, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals,chainIdFrom, originalChainSymbol, OPERATOR_ROLE } = await loadFixture(deploy);

        expect(await synthFactory.hasRole(OPERATOR_ROLE, malory.address)).to.equal(false);

        const reason =`AccessControl: account ${malory.address.toLowerCase()} is missing role ${OPERATOR_ROLE}`;
        
        await expect(synthFactory.connect(malory).deployCustomSynth(originalTokenAddress, decimals, originalTokenName, originalTokenSymbol, chainIdFrom, originalChainSymbol))
          .revertedWith(reason);
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct deploy and set values for custom synth token", async () => {
        const { synthFactory, operator, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals, chainIdFrom, originalChainSymbol, SynthType } = await loadFixture(deploy);

        const tx = await synthFactory.connect(operator).deployCustomSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom, 
          originalChainSymbol
        );
        await tx.wait();

        const synthTokenAddress = await synthFactory.getCustomSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom,
          originalChainSymbol
        );
        const customSynthToken = await ethers.getContractAt('SynthERC20', synthTokenAddress);

        expect((await customSynthToken.originalToken()).toLowerCase()).to.equal(originalTokenAddress.toLowerCase());
        expect(await customSynthToken.decimals()).to.equal(decimals);
        expect(await customSynthToken.name()).to.equal(originalTokenName);
        expect(await customSynthToken.symbol()).to.equal(originalTokenSymbol);
        expect(await customSynthToken.chainIdFrom()).to.equal(chainIdFrom);
        expect(await customSynthToken.chainSymbolFrom()).to.equal(originalChainSymbol);
        expect(await customSynthToken.cap()).to.equal(MaxUint256);
        expect(await customSynthToken.synthType()).to.equal(SynthType.CustomSynth);
        expect(await customSynthToken.synthToken()).to.equal(customSynthToken.address);
      });
      it("Should check correct transfer ownership after deploy for custom synth token", async () => {
        const { synthFactory, addressBook, operator, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals, chainIdCurrent, chainIdFrom, originalChainSymbol } = await loadFixture(deploy);

        const tx = await synthFactory.connect(operator).deployCustomSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom, 
          originalChainSymbol
        );
        await tx.wait();

        const synthTokenAddress = await synthFactory.getCustomSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom,
          originalChainSymbol
        );
        const customSynthToken = await ethers.getContractAt('SynthERC20', synthTokenAddress);

        expect(await customSynthToken.owner()).to.equal(await addressBook.synthesis(chainIdCurrent));
      });
    });
  });

  describe("Should checking the correct operation of the deployDefaultSynth() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an operator", async () => {
        const { synthFactory, malory, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals, chainIdFrom, originalChainSymbol, OPERATOR_ROLE } = await loadFixture(deploy);

        expect(await synthFactory.hasRole(OPERATOR_ROLE, malory.address)).to.equal(false);

        const reason =`AccessControl: account ${malory.address.toLowerCase()} is missing role ${OPERATOR_ROLE}`;

        await expect(synthFactory.connect(malory).deployDefaultSynth(originalTokenAddress, decimals, originalTokenName, originalTokenSymbol, chainIdFrom, originalChainSymbol))
          .revertedWith(reason);
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct deploy and set values for default synth token", async () => {
        const { synthFactory, operator, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals, chainIdFrom, originalChainSymbol, SynthType } = await loadFixture(deploy);

        const tx = await synthFactory.connect(operator).deployDefaultSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom, 
          originalChainSymbol
        );
        await tx.wait();

        const synthTokenAddress = await synthFactory.getDefaultSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom,
          originalChainSymbol
        );
        const defaultSynthToken = await ethers.getContractAt('SynthERC20', synthTokenAddress);

        expect((await defaultSynthToken.originalToken()).toLowerCase()).to.equal(originalTokenAddress.toLowerCase());
        expect(await defaultSynthToken.decimals()).to.equal(decimals);
        expect(await defaultSynthToken.name()).to.equal(`s ${originalTokenName} ${originalChainSymbol}`);
        expect(await defaultSynthToken.symbol()).to.equal(`s${originalTokenSymbol}_${originalChainSymbol}`);
        expect(await defaultSynthToken.chainIdFrom()).to.equal(chainIdFrom);
        expect(await defaultSynthToken.chainSymbolFrom()).to.equal(originalChainSymbol);
        expect(await defaultSynthToken.cap()).to.equal(MaxUint256);
        expect(await defaultSynthToken.synthType()).to.equal(SynthType.DefaultSynth);
        expect(await defaultSynthToken.synthToken()).to.equal(defaultSynthToken.address);
      });
      it("Should check correct transfer ownership after deploy for default synth token", async () => {
        const { synthFactory, addressBook, operator, originalTokenAddress, originalTokenName, originalTokenSymbol, decimals, chainIdCurrent, chainIdFrom, originalChainSymbol } = await loadFixture(deploy);

        const tx = await synthFactory.connect(operator).deployDefaultSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom, 
          originalChainSymbol
        );
        await tx.wait();

        const synthTokenAddress = await synthFactory.getDefaultSynth(
          originalTokenAddress,
          decimals,
          originalTokenName,
          originalTokenSymbol,
          chainIdFrom,
          originalChainSymbol
        );
        const defaultSynthToken = await ethers.getContractAt('SynthERC20', synthTokenAddress);

        expect(await defaultSynthToken.owner()).to.equal(await addressBook.synthesis(chainIdCurrent));
      });
    });
  });
});