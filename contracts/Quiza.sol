// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Quiza is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    address public cUSD;
    address public verifier;

    uint256 public nextRoundId = 1;
    uint256 public constant WIN_MULTIPLIER = 150; // 1.5x (basis 100)
    uint256 public constant MULTIPLIER_BASIS = 100;

    struct Round {
        address player;
        address token; // address(0) for CELO
        uint256 amount;
        bool resolved;
        bool won;
        uint256 createdAt;
    }

    mapping(uint256 => Round) public rounds;
    mapping(address => mapping(address => uint256)) public balances; // player => token => amount

    event Staked(uint256 indexed roundId, address indexed player, address token, uint256 amount);
    event Resolved(uint256 indexed roundId, address indexed player, bool won, uint256 payout);
    event Withdrawn(address indexed player, address token, uint256 amount);
    event VerifierUpdated(address newVerifier);
    event TimeoutClaimed(uint256 indexed roundId, address indexed player, uint256 amount);

    modifier onlyVerifier() {
        require(msg.sender == verifier, "Caller is not the verifier");
        _;
    }

    constructor(address _cUSD, address _verifier) Ownable(msg.sender) {
        require(_cUSD != address(0), "Invalid cUSD address");
        require(_verifier != address(0), "Invalid verifier address");
        cUSD = _cUSD;
        verifier = _verifier;
    }

    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid verifier address");
        verifier = _verifier;
        emit VerifierUpdated(_verifier);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Staking ---

    function stakeCelo() external payable whenNotPaused returns (uint256 roundId) {
        require(msg.value > 0, "Stake amount must be > 0");
        roundId = nextRoundId++;

        rounds[roundId] = Round({
            player: msg.sender,
            token: address(0),
            amount: msg.value,
            resolved: false,
            won: false,
            createdAt: block.timestamp
        });

        emit Staked(roundId, msg.sender, address(0), msg.value);
    }

    function stakeToken(address token, uint256 amount) external whenNotPaused returns (uint256 roundId) {
        require(token == cUSD, "Only cUSD supported");
        require(amount > 0, "Stake amount must be > 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        roundId = nextRoundId++;
        rounds[roundId] = Round({
            player: msg.sender,
            token: token,
            amount: amount,
            resolved: false,
            won: false,
            createdAt: block.timestamp
        });

        emit Staked(roundId, msg.sender, token, amount);
    }

    // --- Resolving ---
    // Can be called even when paused so players don't get trapped
    function resolve(uint256 roundId, bool won) external onlyVerifier nonReentrant {
        Round storage round = rounds[roundId];
        require(round.player != address(0), "Round does not exist");
        require(!round.resolved, "Round already resolved");

        round.resolved = true;
        round.won = won;

        uint256 payout = 0;
        if (won) {
            payout = (round.amount * WIN_MULTIPLIER) / MULTIPLIER_BASIS;
            balances[round.player][round.token] += payout;
        }

        emit Resolved(roundId, round.player, won, payout);
    }

    // --- Claim Timeout ---
    // Allows players to reclaim their stake if the backend fails to resolve within 2 hours
    function claimTimeout(uint256 roundId) external nonReentrant {
        Round storage round = rounds[roundId];
        require(round.player == msg.sender, "Not your round");
        require(!round.resolved, "Round already resolved");
        require(block.timestamp >= round.createdAt + 2 hours, "Timeout not reached");

        round.resolved = true;
        // Refund the original stake to the player's balance
        balances[round.player][round.token] += round.amount;

        emit TimeoutClaimed(roundId, msg.sender, round.amount);
    }

    // --- Withdrawing ---
    // Can be called even when paused
    function withdraw(address token) external nonReentrant {
        uint256 amount = balances[msg.sender][token];
        require(amount > 0, "No balance to withdraw");

        balances[msg.sender][token] = 0;

        if (token == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "CELO transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(msg.sender, token, amount);
    }

    // --- Admin Funding Pool ---
    function fundPoolCelo() external payable onlyOwner {}

    function fundPoolToken(uint256 amount) external onlyOwner {
        IERC20(cUSD).safeTransferFrom(msg.sender, address(this), amount);
    }

    // To receive plain CELO
    receive() external payable {}
}
