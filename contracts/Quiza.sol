// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract Quiza is ERC2771Context, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    address public cUSD;
    address public verifier;

    uint256 public nextRoundId = 1;
    uint256 public constant MULTIPLIER_BASIS = 100;

    struct Round {
        address player;
        address token; // address(0) for CELO
        uint256 amount;
        bool resolved;
        bool won;
        uint8 score; // 0-10 correct answers
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
        require(_msgSender() == verifier, "Caller is not the verifier");
        _;
    }

    constructor(address _cUSD, address _verifier, address _trustedForwarder) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
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
            player: _msgSender(),
            token: address(0),
            amount: msg.value,
            resolved: false,
            won: false,
            score: 0,
            createdAt: block.timestamp
        });

        emit Staked(roundId, _msgSender(), address(0), msg.value);
    }

    function stakeToken(address token, uint256 amount) external whenNotPaused returns (uint256 roundId) {
        require(token == cUSD, "Only cUSD supported");
        require(amount > 0, "Stake amount must be > 0");

        IERC20(token).safeTransferFrom(_msgSender(), address(this), amount);

        roundId = nextRoundId++;
        rounds[roundId] = Round({
            player: _msgSender(),
            token: token,
            amount: amount,
            resolved: false,
            won: false,
            score: 0,
            createdAt: block.timestamp
        });

        emit Staked(roundId, _msgSender(), token, amount);
    }

    // --- Resolving ---
    // Can be called even when paused so players don't get trapped
    function resolve(uint256 roundId, bool won, uint8 score) external onlyVerifier nonReentrant {
        Round storage round = rounds[roundId];
        require(round.player != address(0), "Round does not exist");
        require(!round.resolved, "Round already resolved");
        require(score <= 10, "Invalid score");

        round.resolved = true;
        round.won = won;
        round.score = score;

        uint256 payout = 0;
        if (won) {
            // Tiered progressive payouts based on score
            uint256 multiplier;
            if (score >= 10) {
                multiplier = 200; // 2.0x for perfect score
            } else if (score >= 8) {
                multiplier = 150; // 1.5x for 8-9 correct
            } else if (score >= 7) {
                multiplier = 120; // 1.2x for 7 correct
            } else {
                multiplier = 100; // 1.0x (shouldn't happen with win threshold)
            }
            payout = (round.amount * multiplier) / MULTIPLIER_BASIS;
            balances[round.player][round.token] += payout;
        }

        emit Resolved(roundId, round.player, won, payout);
    }

    // --- Claim Timeout ---
    // Allows players to reclaim their stake if the backend fails to resolve within 2 hours
    function claimTimeout(uint256 roundId) external nonReentrant {
        Round storage round = rounds[roundId];
        require(round.player == _msgSender(), "Not your round");
        require(!round.resolved, "Round already resolved");
        require(block.timestamp >= round.createdAt + 2 hours, "Timeout not reached");

        round.resolved = true;
        // Refund the original stake to the player's balance
        balances[round.player][round.token] += round.amount;

        emit TimeoutClaimed(roundId, _msgSender(), round.amount);
    }

    // --- Withdrawing ---
    // Can be called even when paused
    function withdraw(address token) external nonReentrant {
        uint256 amount = balances[_msgSender()][token];
        require(amount > 0, "No balance to withdraw");

        balances[_msgSender()][token] = 0;

        if (token == address(0)) {
            (bool success, ) = _msgSender().call{value: amount}("");
            require(success, "CELO transfer failed");
        } else {
            IERC20(token).safeTransfer(_msgSender(), amount);
        }

        emit Withdrawn(_msgSender(), token, amount);
    }

    // --- Admin Funding Pool ---
    function fundPoolCelo() external payable onlyOwner {}

    function fundPoolToken(uint256 amount) external onlyOwner {
        IERC20(cUSD).safeTransferFrom(_msgSender(), address(this), amount);
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    // To receive plain CELO
    receive() external payable {}
}
