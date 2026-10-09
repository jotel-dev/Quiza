#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
};

pub const TIMEOUT_SECONDS: u64 = 7200; // 2 hours
pub const MULTIPLIER_BASIS: i128 = 100;

// Ledger TTL parameters (~5s per ledger on Stellar)
// 17,280 ledgers ≈ 1 day (threshold before extension)
// 518,400 ledgers ≈ 30 days (extended lifetime)
pub const INSTANCE_TTL_THRESHOLD: u32 = 17_280;
pub const INSTANCE_TTL_EXTEND: u32 = 518_400;
pub const PERSISTENT_TTL_THRESHOLD: u32 = 17_280;
pub const PERSISTENT_TTL_EXTEND: u32 = 518_400;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    InvalidScore = 4,
    InvalidAmount = 5,
    RoundNotFound = 6,
    Unauthorized = 7,
    AlreadyResolved = 8,
    TimeoutNotReached = 9,
    ZeroBalance = 10,
    InsufficientPoolLiquidity = 11,
    TokenNotAllowed = 12,
    ScoreResultMismatch = 13,
    StakeExceedsLimit = 14,
    StakeBelowLimit = 15,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Round {
    pub player: Address,
    pub token: Address,
    pub amount: i128,
    pub resolved: bool,
    pub won: bool,
    pub score: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct PoolAccounting {
    pub pool: i128,
    pub locked: i128,
    pub owed: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Verifier,
    IsPaused,
    NextRoundId,
    MinStake,
    MaxStake,
    Round(u64),
    Balance(Address, Address), // (player, token)
    PoolAccounting(Address),    // token
    TokenAllowed(Address),     // token
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);
}

fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
    }
}

fn get_admin(env: &Env) -> Result<Address, Error> {
    extend_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

fn get_verifier(env: &Env) -> Result<Address, Error> {
    extend_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::Verifier)
        .ok_or(Error::NotInitialized)
}

fn is_paused(env: &Env) -> bool {
    extend_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false)
}

fn get_next_round_id(env: &Env) -> u64 {
    extend_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::NextRoundId)
        .unwrap_or(1)
}

fn set_next_round_id(env: &Env, id: u64) {
    env.storage().instance().set(&DataKey::NextRoundId, &id);
    extend_instance_ttl(env);
}

fn get_pool_accounting(env: &Env, token: &Address) -> PoolAccounting {
    let key = DataKey::PoolAccounting(token.clone());
    let acct = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(PoolAccounting {
            pool: 0,
            locked: 0,
            owed: 0,
        });
    extend_persistent_ttl(env, &key);
    acct
}

fn set_pool_accounting(env: &Env, token: &Address, accounting: &PoolAccounting) {
    let key = DataKey::PoolAccounting(token.clone());
    env.storage().persistent().set(&key, accounting);
    extend_persistent_ttl(env, &key);
}

#[contract]
pub struct QuizaContract;

#[contractimpl]
impl QuizaContract {
    /// Atomic constructor setting up admin and verifier.
    pub fn __constructor(env: Env, admin: Address, verifier: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.storage().instance().set(&DataKey::NextRoundId, &1u64);
        env.storage().instance().set(&DataKey::MinStake, &1i128);
        env.storage().instance().set(&DataKey::MaxStake, &0i128); // 0 = unlimited
        extend_instance_ttl(&env);
    }

    /// Stake a token to open a new trivia round.
    /// Invariant: locked += amount
    pub fn stake(env: Env, player: Address, token: Address, amount: i128) -> Result<u64, Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        if !Self::is_token_allowed(env.clone(), token.clone()) {
            return Err(Error::TokenNotAllowed);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let (min_stake, max_stake) = Self::get_stake_limits(env.clone());
        if min_stake > 0 && amount < min_stake {
            return Err(Error::StakeBelowLimit);
        }
        if max_stake > 0 && amount > max_stake {
            return Err(Error::StakeExceedsLimit);
        }

        player.require_auth();

        // Transfer tokens from player to contract
        let client = token::Client::new(&env, &token);
        client.transfer(&player, env.current_contract_address(), &amount);

        // Update pool accounting: locked += amount
        let mut accounting = get_pool_accounting(&env, &token);
        accounting.locked = accounting
            .locked
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        set_pool_accounting(&env, &token, &accounting);

        // Record round
        let round_id = get_next_round_id(&env);
        set_next_round_id(&env, round_id + 1);

        let round = Round {
            player: player.clone(),
            token: token.clone(),
            amount,
            resolved: false,
            won: false,
            score: 0,
            created_at: env.ledger().timestamp(),
        };

        let round_key = DataKey::Round(round_id);
        env.storage().persistent().set(&round_key, &round);
        extend_persistent_ttl(&env, &round_key);

        env.events().publish(
            (symbol_short!("staked"), round_id, player),
            (token, amount),
        );

        Ok(round_id)
    }

    /// Resolve an open round with score and outcome. Only callable by verifier.
    /// Can execute even when paused.
    pub fn resolve(env: Env, round_id: u64, won: bool, score: u32) -> Result<(), Error> {
        let verifier = get_verifier(&env)?;
        verifier.require_auth();

        if score > 10 {
            return Err(Error::InvalidScore);
        }
        let expected_won = score >= 7;
        if won != expected_won {
            return Err(Error::ScoreResultMismatch);
        }

        let round_key = DataKey::Round(round_id);
        let mut round: Round = env
            .storage()
            .persistent()
            .get(&round_key)
            .ok_or(Error::RoundNotFound)?;
        extend_persistent_ttl(&env, &round_key);

        if round.resolved {
            return Err(Error::AlreadyResolved);
        }

        round.resolved = true;
        round.won = won;
        round.score = score;

        let mut accounting = get_pool_accounting(&env, &round.token);

        let payout = if won {
            let multiplier: i128 = if score >= 10 {
                200
            } else if score >= 8 {
                150
            } else {
                120
            };

            let gross_payout = round
                .amount
                .checked_mul(multiplier)
                .ok_or(Error::InvalidAmount)?
                .checked_div(MULTIPLIER_BASIS)
                .ok_or(Error::InvalidAmount)?;

            let net_profit = gross_payout
                .checked_sub(round.amount)
                .ok_or(Error::InvalidAmount)?;

            if accounting.pool < net_profit {
                return Err(Error::InsufficientPoolLiquidity);
            }

            // Invariant transition:
            // locked -= stake
            // pool -= (payout - stake)
            // owed += payout
            accounting.locked = accounting
                .locked
                .checked_sub(round.amount)
                .ok_or(Error::InvalidAmount)?;
            accounting.pool = accounting
                .pool
                .checked_sub(net_profit)
                .ok_or(Error::InvalidAmount)?;
            accounting.owed = accounting
                .owed
                .checked_add(gross_payout)
                .ok_or(Error::InvalidAmount)?;

            // Credit player withdrawable balance
            let bal_key = DataKey::Balance(round.player.clone(), round.token.clone());
            let current_bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
            let new_bal = current_bal
                .checked_add(gross_payout)
                .ok_or(Error::InvalidAmount)?;
            env.storage().persistent().set(&bal_key, &new_bal);
            extend_persistent_ttl(&env, &bal_key);

            gross_payout
        } else {
            // Loss: locked -= stake, pool += stake
            accounting.locked = accounting
                .locked
                .checked_sub(round.amount)
                .ok_or(Error::InvalidAmount)?;
            accounting.pool = accounting
                .pool
                .checked_add(round.amount)
                .ok_or(Error::InvalidAmount)?;
            0i128
        };

        set_pool_accounting(&env, &round.token, &accounting);
        env.storage().persistent().set(&round_key, &round);

        env.events().publish(
            (symbol_short!("resolved"), round_id, round.player),
            (won, payout, score),
        );

        Ok(())
    }

    /// Claim refund if verifier failed to resolve within TIMEOUT_SECONDS (2 hours).
    /// Can execute even when paused.
    pub fn claim_timeout(env: Env, round_id: u64) -> Result<(), Error> {
        let round_key = DataKey::Round(round_id);
        let mut round: Round = env
            .storage()
            .persistent()
            .get(&round_key)
            .ok_or(Error::RoundNotFound)?;
        extend_persistent_ttl(&env, &round_key);

        round.player.require_auth();

        if round.resolved {
            return Err(Error::AlreadyResolved);
        }

        let elapsed = env
            .ledger()
            .timestamp()
            .saturating_sub(round.created_at);
        if elapsed < TIMEOUT_SECONDS {
            return Err(Error::TimeoutNotReached);
        }

        round.resolved = true;
        round.won = false;

        // Invariant transition:
        // locked -= stake
        // owed += stake
        let mut accounting = get_pool_accounting(&env, &round.token);
        accounting.locked = accounting
            .locked
            .checked_sub(round.amount)
            .ok_or(Error::InvalidAmount)?;
        accounting.owed = accounting
            .owed
            .checked_add(round.amount)
            .ok_or(Error::InvalidAmount)?;
        set_pool_accounting(&env, &round.token, &accounting);

        // Refund 100% of stake to player withdrawable balance
        let bal_key = DataKey::Balance(round.player.clone(), round.token.clone());
        let current_bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        let new_bal = current_bal
            .checked_add(round.amount)
            .ok_or(Error::InvalidAmount)?;
        env.storage().persistent().set(&bal_key, &new_bal);
        extend_persistent_ttl(&env, &bal_key);

        env.storage().persistent().set(&round_key, &round);

        env.events().publish(
            (symbol_short!("timeout"), round_id, round.player),
            (round.token, round.amount),
        );

        Ok(())
    }

    /// Withdraw player winnings/refunds for a given token.
    /// Can execute even when paused.
    pub fn withdraw(env: Env, player: Address, token: Address) -> Result<i128, Error> {
        player.require_auth();

        let bal_key = DataKey::Balance(player.clone(), token.clone());
        let current_bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        extend_persistent_ttl(&env, &bal_key);

        if current_bal <= 0 {
            return Err(Error::ZeroBalance);
        }

        // Reset balance
        env.storage().persistent().set(&bal_key, &0i128);

        // Invariant transition: owed -= current_bal
        let mut accounting = get_pool_accounting(&env, &token);
        accounting.owed = accounting
            .owed
            .checked_sub(current_bal)
            .ok_or(Error::InvalidAmount)?;
        set_pool_accounting(&env, &token, &accounting);

        // Transfer funds from contract to player
        let client = token::Client::new(&env, &token);
        client.transfer(&env.current_contract_address(), &player, &current_bal);

        env.events().publish(
            (symbol_short!("withdraw"), player, token),
            current_bal,
        );

        Ok(current_bal)
    }

    /// Admin: Add token to allowlist.
    pub fn add_token(env: Env, token: Address) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let key = DataKey::TokenAllowed(token.clone());
        env.storage().persistent().set(&key, &true);
        extend_persistent_ttl(&env, &key);

        env.events()
            .publish((symbol_short!("tok_add"), token), ());
        Ok(())
    }

    /// Admin: Remove token from allowlist. Does not block withdraw/claim_timeout.
    pub fn remove_token(env: Env, token: Address) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let key = DataKey::TokenAllowed(token.clone());
        env.storage().persistent().set(&key, &false);
        extend_persistent_ttl(&env, &key);

        env.events()
            .publish((symbol_short!("tok_rem"), token), ());
        Ok(())
    }

    /// Admin: Fund liquidity pool for house payouts.
    /// Invariant: pool += amount
    pub fn fund_pool(env: Env, token: Address, amount: i128) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if !Self::is_token_allowed(env.clone(), token.clone()) {
            return Err(Error::TokenNotAllowed);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let client = token::Client::new(&env, &token);
        client.transfer(&admin, env.current_contract_address(), &amount);

        let mut accounting = get_pool_accounting(&env, &token);
        accounting.pool = accounting
            .pool
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        set_pool_accounting(&env, &token, &accounting);

        env.events().publish(
            (symbol_short!("funded"), admin, token),
            amount,
        );

        Ok(())
    }

    /// Admin: Withdraw unused house liquidity from pool.
    /// May only withdraw from pool, never touching locked or owed.
    pub fn withdraw_pool(env: Env, token: Address, amount: i128) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut accounting = get_pool_accounting(&env, &token);
        if accounting.pool < amount {
            return Err(Error::InsufficientPoolLiquidity);
        }

        accounting.pool = accounting
            .pool
            .checked_sub(amount)
            .ok_or(Error::InvalidAmount)?;
        set_pool_accounting(&env, &token, &accounting);

        let client = token::Client::new(&env, &token);
        client.transfer(&env.current_contract_address(), &admin, &amount);

        env.events().publish(
            (symbol_short!("pool_out"), admin, token),
            amount,
        );

        Ok(())
    }

    /// Admin: Update verifier address.
    pub fn set_verifier(env: Env, new_verifier: Address) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Verifier, &new_verifier);
        extend_instance_ttl(&env);

        env.events()
            .publish((symbol_short!("verifier"),), new_verifier);
        Ok(())
    }

    /// Admin: Pause staking.
    pub fn pause(env: Env) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::IsPaused, &true);
        extend_instance_ttl(&env);

        env.events().publish((symbol_short!("pause"),), true);
        Ok(())
    }

    /// Admin: Unpause staking.
    pub fn unpause(env: Env) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::IsPaused, &false);
        extend_instance_ttl(&env);

        env.events().publish((symbol_short!("pause"),), false);
        Ok(())
    }

    /// Admin: Set min and max stake limits (0 max = unlimited).
    pub fn set_stake_limits(env: Env, min_stake: i128, max_stake: i128) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if min_stake < 0 || (max_stake > 0 && max_stake < min_stake) {
            return Err(Error::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::MinStake, &min_stake);
        env.storage().instance().set(&DataKey::MaxStake, &max_stake);
        extend_instance_ttl(&env);

        Ok(())
    }

    // --- View / Read Getters ---

    pub fn get_round(env: Env, round_id: u64) -> Option<Round> {
        let key = DataKey::Round(round_id);
        let round: Option<Round> = env.storage().persistent().get(&key);
        if round.is_some() {
            extend_persistent_ttl(&env, &key);
        }
        round
    }

    pub fn get_balance(env: Env, player: Address, token: Address) -> i128 {
        let key = DataKey::Balance(player, token);
        let bal = env.storage().persistent().get(&key).unwrap_or(0);
        extend_persistent_ttl(&env, &key);
        bal
    }

    pub fn get_accounting(env: Env, token: Address) -> PoolAccounting {
        get_pool_accounting(&env, &token)
    }

    pub fn is_token_allowed(env: Env, token: Address) -> bool {
        let key = DataKey::TokenAllowed(token);
        let allowed = env.storage().persistent().get(&key).unwrap_or(false);
        extend_persistent_ttl(&env, &key);
        allowed
    }

    pub fn get_admin(env: Env) -> Address {
        get_admin(&env).unwrap()
    }

    pub fn get_verifier(env: Env) -> Address {
        get_verifier(&env).unwrap()
    }

    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    pub fn get_stake_limits(env: Env) -> (i128, i128) {
        extend_instance_ttl(&env);
        let min_stake = env.storage().instance().get(&DataKey::MinStake).unwrap_or(1);
        let max_stake = env.storage().instance().get(&DataKey::MaxStake).unwrap_or(0);
        (min_stake, max_stake)
    }
}

#[cfg(test)]
mod test;
