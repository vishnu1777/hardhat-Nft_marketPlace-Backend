const { network, deployments, ethers, getNamedAccounts } = require("hardhat");

const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Nft Marketplace Unit Tests", function () {
      let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;

      beforeEach(async () => {
        accounts = await ethers.getSigners(); // could also do with getNamedAccounts
        deployer = accounts[0];
        user = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketplaceContract = await ethers.getContract("NftMarketPlace");
        nftMarketplace = nftMarketplaceContract.connect(deployer);
        basicNftContract = await ethers.getContract("BasicNft");
        basicNft = await basicNftContract.connect(deployer);
        await basicNft.mintNft();
        await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID);
      });
      describe("listItem", function () {
        it("emits an event after listing an item", async function () {
          expect(
            await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.emit("ItemListed");
        });
        it("exclusively items that haven't been listed", async function () {
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.reverted;
        });
        it("exclusively allows owners to list", async function () {
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.reverted;
        });
        it("needs approvals to list item", async function () {
          await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID);
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.reverted;
        });
        it("Updates listing with seller and price", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          const listing = await nftMarketplace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert(listing.price.toString() == PRICE.toString());
          assert(listing.seller.toString() == deployer.address);
        });
      });
      describe("Buy Items", () => {
        it("Checks whether the nft is listed in the market", async () => {
          await expect(nftMarketplace.buyItem(basicNft.address, TOKEN_ID)).to.be
            .reverted;
        });
        it("reverts if the price sent buy the user is less than the specified price", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          await expect(nftMarketplace.buyItem(basicNft.address, TOKEN_ID)).to.be
            .reverted;
        });
        it("Transfer the price to the owner and The new owner should be the current user who bought the nft", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketplace = nftMarketplaceContract.connect(user);
          expect(
            await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
              value: PRICE,
            })
          ).to.emit("ItemBought");
          const deployerProceeds = await nftMarketplace.getProceeds(
            deployer.address
          );
          const newOwner = await basicNft.ownerOf(TOKEN_ID);
          assert(deployerProceeds.toString() === PRICE.toString());
          assert(newOwner.toString() === user.address.toString());
        });
      });
      describe("cancel Items", () => {
        it("Cancels items in the list", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          expect(
            await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.emit("ItemCanceled");
        });
        it("reverts if other than owner tries to cancel", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
            .to.be.reverted;
        });
        it("To cancel the item It should be pre listed otherwise it reverts", async () => {
          await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
            .to.be.reverted;
        });
      });

      describe("Update the list", () => {
        it("Emits an event when the item is updated", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          expect(
            await nftMarketplace.updateListing(
              basicNft.address,
              TOKEN_ID,
              ethers.utils.parseEther("0.2")
            )
          ).to.emit("ItemListed");
        });
        it("Update only if there is an item first", async () => {
          await expect(
            nftMarketplace.updateListing(
              basicNft.address,
              TOKEN_ID,
              ethers.utils.parseEther("0.2")
            )
          ).to.be.reverted;
        });
        it("Only the owner can make updates to the lists or else it reverts", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketplace.updateListing(
              basicNft.address,
              TOKEN_ID,
              ethers.utils.parseEther("0.2")
            )
          ).to.be.reverted;
        });
      });
      describe("WithDrawProceeds", () => {
        it("Doesn't allow 0 proceeds", async () => {
          await expect(nftMarketplace.withdrawProceeds()).to.be.reverted;
        });
        it("Withdraw procees", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketplace = nftMarketplaceContract.connect(user);
          await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });
          nftMarketplace = nftMarketplaceContract.connect(deployer);
          const deployerProceedsBefore = await nftMarketplace.getProceeds(
            deployer.address
          );
          const deployerBalanceBefore = await deployer.getBalance();
          const txResponse = await nftMarketplace.withdrawProceeds();
          const txReceipt = await txResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = txReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);
          const deployerBalanceAfter = await deployer.getBalance();
          assert(
            deployerBalanceAfter.add(gasCost).toString() ==
              deployerProceedsBefore.add(deployerBalanceBefore).toString()
          );
        });
      });
    });
