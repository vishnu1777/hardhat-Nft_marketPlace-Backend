// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// imports from openzepplein 
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// This below file is for securing the reentrancy attack showed by patrick
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
/* Errors */
error NftMarketPlace__PriceMustBeAboveZero();
error  NftMarketPlace__NotApprovedForMarketPlace();
error NftMarketPlace__AlreadyListed(address nftAddress,uint256 tokenId);
error NftMarketPlace__NotOwner();
error NftMarketPlace__NotListed(address nftAddress,uint256 tokenId);
error NftMarketPlace__PriceNotMet(address nftAddress,uint256 tokenId,uint256 price);
error NftMarketPlace__NoProceeds();
error NftMarketPlace__TransferFailed();
contract NftMarketPlace is ReentrancyGuard{
    // State variables
    struct Listing{
        /* we list the price of the nft And also the seller address */
        uint256 price;
        address seller;
    }

    //Nft contract Addresses-> Nft TokenId-> Lists
    mapping (address => mapping (uint256 => Listing)) private s_listing;

    // Nft Address ->price Earned
    mapping (address => uint256) private s_proceeds;

    /* Events */
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
        );
    event ItemBought(
    address indexed buyer,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
    );
    
    event ItemCanceled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );
    
    /* modifier for listItem*/
    modifier notListed(address nftAddress,uint256 tokenId,address owner) {
        Listing memory listing = s_listing[nftAddress][tokenId];
        if(listing.price>0)
        {
            revert NftMarketPlace__AlreadyListed(nftAddress,tokenId);
        }
        _;
        
    }
    modifier isOwner(address nftAddress,uint256 tokenId,address spender) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if(spender != owner)
        {
            revert NftMarketPlace__NotOwner();
        }
        
        _;
    }
    /* Modifier for buyItem */
    modifier isListed(address nftAddress,uint256 tokenId){
        Listing memory listing = s_listing[nftAddress][tokenId];
        if(listing.price <= 0)
        {
            revert NftMarketPlace__NotListed(nftAddress,tokenId);
        }
        _;
    }

    /*     Main Function    */
    /* external is used beacuse this function is called by outside or external accounts not by us */

    function listItem(address nftAddress, uint256 tokenId,uint256 price)
    external notListed(nftAddress,tokenId,msg.sender)// notListed modifier checkPost
    isOwner(nftAddress,tokenId,msg.sender){// isOwner or not Modifier checkPost
        if(price<=0)
        {
            revert NftMarketPlace__PriceMustBeAboveZero();
        }
        /* Heres owners can still own their Nft And they can give the approval for the 
        MarketPlace to sell The Nft for them*/
        IERC721 nft = IERC721(nftAddress);
        if(nft.getApproved(tokenId) != (address(this)))
        {
            revert NftMarketPlace__NotApprovedForMarketPlace();

        }
        s_listing[nftAddress][tokenId] = Listing(price,msg.sender);
        /* Best practice to update mappings is emmit an event */
        emit ItemListed(msg.sender,nftAddress,tokenId,price);

    }

    /* Function for buying Nft */
    /* This function goes through transaction so it is marked as payable */
    function buyItem(address nftAddress,uint256 tokenId)external 
    payable
    isListed(nftAddress,tokenId){
        Listing memory listedItem = s_listing[nftAddress][tokenId];
        if(msg.value < listedItem.price)
        {
            revert NftMarketPlace__PriceNotMet(nftAddress,tokenId,listedItem.price);
        }
        /* we are going to make our s_proceeds state change and then we are going
        to transfer because of reentrancy attack */
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller]+ msg.value;
        delete(s_listing[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listedItem.seller,msg.sender,tokenId);
        
        emit ItemBought(msg.sender,nftAddress,tokenId,listedItem.price);
    }

    function cancelListing(address nftAddress, uint256 tokenId)
    external isOwner(nftAddress,tokenId,msg.sender)
    isListed(nftAddress,tokenId){
        delete(s_listing[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender,nftAddress,tokenId);
    }

    function updateListing(address nftAddress,uint256 tokenId,uint256 newPrice)
    external isListed(nftAddress,tokenId)
    isOwner(nftAddress,tokenId,msg.sender){
        s_listing[nftAddress][tokenId].price = newPrice;
        /* we are agoin going to use the same event because basically we are relisting 
        our Lists by updating */
        emit ItemListed(msg.sender,nftAddress,tokenId,newPrice);
    }

    function withdrawProceeds()external{
        uint256 proceeds = s_proceeds[msg.sender];
        if(proceeds <= 0)
        {
            revert NftMarketPlace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value:proceeds}("");
        if(!success)
        {
            revert NftMarketPlace__TransferFailed();
        }
    }


    /* Getter functions */
    function getListing(address nftAddress,uint256 tokenId)external view returns(Listing memory){
        return s_listing[nftAddress][tokenId];
    }
    function getProceeds(address seller)external view returns(uint256){
        return s_proceeds[seller];
    }

}