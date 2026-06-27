// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrustLedger {
    struct ScoreRecord {
        uint16 score;
        uint256 timestamp;
        string factor1;
        string factor2;
        string factor3;
        bool exists;
    }

    struct LoanOffer {
        uint256 id;
        address lender;
        address merchant;
        uint256 amount;
        uint256 interestRate; // e.g. 1250 for 12.50%
        uint256 tenure;       // in months
        uint256 monthlyEMI;
        string status;        // "Pending", "Accepted", "Declined"
        uint256 timestamp;
    }

    // Mapping from merchant wallet address to their credit score record
    mapping(address => ScoreRecord) public scores;
    
    // Contract owner
    address public owner;
    
    // Mapping of authorized addresses (like our backend server) that can mint scores
    mapping(address => bool) public authorizedIssuers;

    // Array of all loan offers
    LoanOffer[] public loanOffers;

    // Mapping of merchant address to their loan offer IDs
    mapping(address => uint256[]) public merchantToOfferIds;

    event ScoreMinted(
        address indexed merchant,
        uint16 score,
        uint256 timestamp,
        string factor1,
        string factor2,
        string factor3
    );
    event IssuerStatusChanged(address indexed issuer, bool status);

    event LoanOfferSubmitted(
        uint256 indexed offerId,
        address indexed lender,
        address indexed merchant,
        uint256 amount,
        uint256 interestRate,
        uint256 tenure,
        uint256 monthlyEMI
    );

    event LoanOfferStatusChanged(
        uint256 indexed offerId,
        string status
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustLedger: Caller is not the owner");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "TrustLedger: Caller is not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerStatusChanged(msg.sender, true);
    }

    /**
     * @dev Authorizes or revokes an issuer address. Only owner can call this.
     */
    function setIssuer(address issuer, bool status) external onlyOwner {
        authorizedIssuers[issuer] = status;
        emit IssuerStatusChanged(issuer, status);
    }

    /**
     * @dev Mints or updates a credit score for a merchant wallet. Only authorized issuers (backend) can call this.
     */
    function mintScore(
        address merchant,
        uint16 score,
        string calldata f1,
        string calldata f2,
        string calldata f3
    ) external onlyIssuer {
        require(score >= 300 && score <= 900, "TrustLedger: Credit score must be between 300 and 900");
        require(merchant != address(0), "TrustLedger: Merchant address cannot be zero address");

        scores[merchant] = ScoreRecord({
            score: score,
            timestamp: block.timestamp,
            factor1: f1,
            factor2: f2,
            factor3: f3,
            exists: true
        });

        emit ScoreMinted(merchant, score, block.timestamp, f1, f2, f3);
    }

    /**
     * @dev Public view function for Lenders to lookup a merchant's credit score.
     */
    function getScore(address merchant) external view returns (
        uint16 score,
        uint256 timestamp,
        string memory factor1,
        string memory factor2,
        string memory factor3,
        bool exists
    ) {
        ScoreRecord memory record = scores[merchant];
        return (
            record.score,
            record.timestamp,
            record.factor1,
            record.factor2,
            record.factor3,
            record.exists
        );
    }

    /**
     * @dev Submits a new loan offer for a merchant. Anyone (representing a lender) can submit.
     */
    function submitLoanOffer(
        address merchant,
        uint256 amount,
        uint256 interestRate,
        uint256 tenure,
        uint256 monthlyEMI
    ) external returns (uint256) {
        require(merchant != address(0), "TrustLedger: Merchant address cannot be zero");
        require(amount > 0, "TrustLedger: Amount must be greater than zero");

        uint256 offerId = loanOffers.length;
        loanOffers.push(LoanOffer({
            id: offerId,
            lender: msg.sender,
            merchant: merchant,
            amount: amount,
            interestRate: interestRate,
            tenure: tenure,
            monthlyEMI: monthlyEMI,
            status: "Pending",
            timestamp: block.timestamp
        }));

        merchantToOfferIds[merchant].push(offerId);

        emit LoanOfferSubmitted(offerId, msg.sender, merchant, amount, interestRate, tenure, monthlyEMI);
        return offerId;
    }

    /**
     * @dev Updates the status of a loan offer. Only the merchant of the offer can accept/decline.
     */
    function updateOfferStatus(uint256 offerId, string calldata newStatus) external {
        require(offerId < loanOffers.length, "TrustLedger: Invalid offer ID");
        LoanOffer storage offer = loanOffers[offerId];
        require(
            msg.sender == offer.merchant || authorizedIssuers[msg.sender],
            "TrustLedger: Only merchant or authorized issuer can update status"
        );
        
        bytes32 statusHash = keccak256(abi.encodePacked(newStatus));
        require(
            statusHash == keccak256(abi.encodePacked("Accepted")) || 
            statusHash == keccak256(abi.encodePacked("Declined")), 
            "TrustLedger: Invalid status"
        );

        offer.status = newStatus;
        emit LoanOfferStatusChanged(offerId, newStatus);
    }

    /**
     * @dev Retrieves all loan offer IDs for a merchant.
     */
    function getMerchantOfferIds(address merchant) external view returns (uint256[] memory) {
        return merchantToOfferIds[merchant];
    }

    /**
     * @dev Retrieves details of a specific loan offer.
     */
    function getLoanOffer(uint256 offerId) external view returns (
        uint256 id,
        address lender,
        address merchant,
        uint256 amount,
        uint256 interestRate,
        uint256 tenure,
        uint256 monthlyEMI,
        string memory status,
        uint256 timestamp
    ) {
        require(offerId < loanOffers.length, "TrustLedger: Invalid offer ID");
        LoanOffer memory offer = loanOffers[offerId];
        return (
            offer.id,
            offer.lender,
            offer.merchant,
            offer.amount,
            offer.interestRate,
            offer.tenure,
            offer.monthlyEMI,
            offer.status,
            offer.timestamp
        );
    }
}
