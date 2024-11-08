const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const zeroAddress = ethers.constants.AddressZero;

const {
  deployAddressBook,
  deployGateKeeperMock
} = require('../setup/setup-contracts');


describe('AddressBook unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    let addressBook, gateKeeper;
    let owner, malory;
  
    const chainId = network.config.chainId;
    const bridgeAddress = '0x0000000000000000000000000000000000000042';
    const someAddress = '0x0000000000000000000000000000000000000088';
  
    [owner, malory] = await ethers.getSigners();


    // deployment contracts
    addressBook = await deployAddressBook();
    gateKeeper = await deployGateKeeperMock([bridgeAddress]);

    return {
      addressBook, gateKeeper,
      owner, malory,
      chainId, someAddress
    }
  }

  describe("Should checking the correct operation of the setPortal() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, chainId, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setPortal([[chainId, someAddress]]))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook, chainId } = await loadFixture(deploy);

        await expect(addressBook.setPortal([[chainId, zeroAddress]]))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set portal for given chain", async() => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setPortal([[chainId, someAddress]]);
        await tx.wait();

        expect(await addressBook.portal(chainId)).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event PortalSet", async () => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setPortal([[chainId, someAddress]]))
          .emit(addressBook, "PortalSet")
          .withArgs(someAddress, chainId);
      });
    });
  });

  describe("Should checking the correct operation of the setSynthesis() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, chainId, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setSynthesis([[chainId, someAddress]]))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook, chainId } = await loadFixture(deploy);

        await expect(addressBook.setSynthesis([[chainId, zeroAddress]]))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set synthesis for given chain", async() => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setSynthesis([[chainId, someAddress]]);
        await tx.wait();
        
        expect(await addressBook.synthesis(chainId)).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event SynthesisSet", async () => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);
        
        await expect(addressBook.setSynthesis([[chainId, someAddress]]))
          .emit(addressBook, "SynthesisSet")
          .withArgs(someAddress, chainId);
      });
    });
  });

  describe("Should checking the correct operation of the setRouter() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, chainId, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setRouter([[chainId, someAddress]]))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook, chainId } = await loadFixture(deploy);

        await expect(addressBook.setRouter([[chainId, zeroAddress]]))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set router for given chain", async() => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setRouter([[chainId, someAddress]]);
        await tx.wait();
        
        expect(await addressBook.router(chainId)).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event RouterSet", async () => {
        const { addressBook, chainId, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setRouter([[chainId, someAddress]]))
          .emit(addressBook, "RouterSet")
          .withArgs(someAddress, chainId);
      });
    });
  });

  describe("Should checking the correct operation of the setTreasury() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setTreasury(someAddress))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook } = await loadFixture(deploy);

        await expect(addressBook.setTreasury(zeroAddress))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set treasury for given chain", async() => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setTreasury(someAddress);
        await tx.wait();

        expect(await addressBook.treasury()).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event TreasurySet", async () => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setTreasury(someAddress))
          .emit(addressBook, "TreasurySet")
          .withArgs(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the setGateKeeper() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setGateKeeper(someAddress))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook } = await loadFixture(deploy);

        await expect(addressBook.setGateKeeper(zeroAddress))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set gateKeeper", async() => {
        const { addressBook, gateKeeper } = await loadFixture(deploy);

        expect(await addressBook.bridge()).to.equal(zeroAddress);

        const tx = await addressBook.setGateKeeper(gateKeeper.address);
        await tx.wait();

        expect(await addressBook.gateKeeper()).to.equal(gateKeeper.address);
        expect(await addressBook.bridge()).to.equal(await gateKeeper.bridge());
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event GateKeeperSet", async () => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setGateKeeper(someAddress))
          .emit(addressBook, "GateKeeperSet")
          .withArgs(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the setWhitelist() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setWhitelist(someAddress))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook } = await loadFixture(deploy);

        await expect(addressBook.setWhitelist(zeroAddress))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set whitelist", async() => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setWhitelist(someAddress);
        await tx.wait();
        
        expect(await addressBook.whitelist()).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event WhitelistSet", async () => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setWhitelist(someAddress))
          .emit(addressBook, "WhitelistSet")
          .withArgs(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the setWETH() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not an owner", async() => {
        const { addressBook, malory, someAddress } = await loadFixture(deploy);

        await expect(addressBook.connect(malory).setWETH(someAddress))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if address is zero", async() => {
        const { addressBook } = await loadFixture(deploy);

        await expect(addressBook.setWETH(zeroAddress))
          .revertedWith('AddressBook: zero address');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct set WETH", async() => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        const tx = await addressBook.setWETH(someAddress);
        await tx.wait();
        
        expect(await addressBook.WETH()).to.equal(someAddress);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event WETHSet", async () => {
        const { addressBook, someAddress } = await loadFixture(deploy);

        await expect(addressBook.setWETH(someAddress))
          .emit(addressBook, "WETHSet")
          .withArgs(someAddress);
      });
    });
  });
});