const { ethers } = require("hardhat");
const PRICE = ethers.utils.parseEther("0.1");
async function mintAndList() {
  const nftMarketplace = await ethers.getContract("NftMarketPlace");
  const basicNft = await ethers.getContract("BasicNft");
  console.log("Minting Nft....");
  const mintTx = await basicNft.mintNft();
  const mintTxReceipt = await mintTx.wait(1);
  const tokenId = mintTxReceipt.events[0].args.tokenId;
  console.log("Nft Minted...");

  const approveTx = await basicNft.approve(nftMarketplace.address, tokenId);
  await approveTx.wait(1);
  console.log("Listing Nft...");
  const tx = await nftMarketplace.listItem(basicNft.address, tokenId, PRICE);
  await tx.wait(1);
  console.log("Nft listed...");
}

mintAndList()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
