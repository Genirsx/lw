// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CharityDonationRegistry {
    error Unauthorized();
    error ProjectAlreadyExists();
    error ProjectNotFound();
    error DonationAlreadyExists();
    error DisbursementAlreadyExists();
    error InvalidProjectReference();

    struct ProjectProof {
        uint256 projectId;
        bytes32 projectHash;
        uint256 createdAt;
        address operator;
    }

    struct DonationProof {
        uint256 donationId;
        uint256 projectId;
        bytes32 recordHash;
        uint256 amount;
        uint256 createdAt;
        address operator;
    }

    struct DisbursementProof {
        uint256 disbursementId;
        uint256 projectId;
        bytes32 recordHash;
        uint256 amount;
        uint256 createdAt;
        address operator;
    }

    address public owner;
    mapping(address => bool) public operators;
    mapping(uint256 => ProjectProof) private projectProofs;
    mapping(uint256 => DonationProof) private donationProofs;
    mapping(uint256 => DisbursementProof) private disbursementProofs;

    event OperatorUpdated(address indexed operator, bool enabled);
    event ProjectRegistered(uint256 indexed projectId, bytes32 indexed projectHash, address indexed operator);
    event ProjectUpdated(uint256 indexed projectId, bytes32 indexed projectHash, address indexed operator);
    event DonationRecorded(uint256 indexed donationId, uint256 indexed projectId, bytes32 indexed recordHash, uint256 amount);
    event DisbursementRecorded(uint256 indexed disbursementId, uint256 indexed projectId, bytes32 indexed recordHash, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedOperator() {
        if (msg.sender != owner && !operators[msg.sender]) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function projectExists(uint256 projectId) public view returns (bool) {
        return projectProofs[projectId].projectId != 0;
    }

    function donationExists(uint256 donationId) external view returns (bool) {
        return donationProofs[donationId].donationId != 0;
    }

    function disbursementExists(uint256 disbursementId) external view returns (bool) {
        return disbursementProofs[disbursementId].disbursementId != 0;
    }

    function registerProject(uint256 projectId, bytes32 projectHash) external onlyAuthorizedOperator {
        if (projectExists(projectId)) revert ProjectAlreadyExists();

        projectProofs[projectId] = ProjectProof({
            projectId: projectId,
            projectHash: projectHash,
            createdAt: block.timestamp,
            operator: msg.sender
        });

        emit ProjectRegistered(projectId, projectHash, msg.sender);
    }

    function updateProjectHash(uint256 projectId, bytes32 projectHash) external onlyAuthorizedOperator {
        if (!projectExists(projectId)) revert ProjectNotFound();

        projectProofs[projectId].projectHash = projectHash;
        projectProofs[projectId].createdAt = block.timestamp;
        projectProofs[projectId].operator = msg.sender;

        emit ProjectUpdated(projectId, projectHash, msg.sender);
    }

    function recordDonation(
        uint256 donationId,
        uint256 projectId,
        bytes32 recordHash,
        uint256 amount
    ) external onlyAuthorizedOperator {
        if (!projectExists(projectId)) revert InvalidProjectReference();
        if (donationProofs[donationId].donationId != 0) revert DonationAlreadyExists();

        donationProofs[donationId] = DonationProof({
            donationId: donationId,
            projectId: projectId,
            recordHash: recordHash,
            amount: amount,
            createdAt: block.timestamp,
            operator: msg.sender
        });

        emit DonationRecorded(donationId, projectId, recordHash, amount);
    }

    function recordDisbursement(
        uint256 disbursementId,
        uint256 projectId,
        bytes32 recordHash,
        uint256 amount
    ) external onlyAuthorizedOperator {
        if (!projectExists(projectId)) revert InvalidProjectReference();
        if (disbursementProofs[disbursementId].disbursementId != 0) revert DisbursementAlreadyExists();

        disbursementProofs[disbursementId] = DisbursementProof({
            disbursementId: disbursementId,
            projectId: projectId,
            recordHash: recordHash,
            amount: amount,
            createdAt: block.timestamp,
            operator: msg.sender
        });

        emit DisbursementRecorded(disbursementId, projectId, recordHash, amount);
    }

    function getProjectProof(uint256 projectId) external view returns (ProjectProof memory) {
        return projectProofs[projectId];
    }

    function getDonationProof(uint256 donationId) external view returns (DonationProof memory) {
        return donationProofs[donationId];
    }

    function getDisbursementProof(uint256 disbursementId) external view returns (DisbursementProof memory) {
        return disbursementProofs[disbursementId];
    }
}
