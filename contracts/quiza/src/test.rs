#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn setup_test_env() -> (
    Env,
    Address, // admin
    Address, // verifier
    Address, // token
    Address, // contract_id
    QuizaContractClient<'static>,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    let contract_id = env.register(QuizaContract, (&admin, &verifier));
    let client = QuizaContractClient::new(&env, &contract_id);

    // Allow token for gameplay
    client.add_token(&token_address);

    (
        env,
        admin,
        verifier,
        token_address,
        contract_id,
        client,
        token_client,
        token_admin_client,
    )
}

fn assert_invariant(
    contract_id: &Address,
    token_address: &Address,
    client: &QuizaContractClient,
    token_client: &token::Client,
) {
    let real_bal = token_client.balance(contract_id);
    let acct = client.get_accounting(token_address);
    assert_eq!(
        real_bal,
        acct.pool + acct.locked + acct.owed,
        "Invariant violated! Real: {}, Pool: {}, Locked: {}, Owed: {}",
        real_bal,
        acct.pool,
        acct.locked,
        acct.owed
    );
}

#[test]
fn test_stake_basic() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    let player = Address::generate(&env);
    token_admin.mint(&player, &1000);
    token_admin.mint(&admin, &5000);
    client.fund_pool(&token, &5000);

    assert_invariant(&contract_id, &token, &client, &token_client);

    let round_id = client.stake(&player, &token, &100);
    assert_eq!(round_id, 1);

    let round = client.get_round(&round_id).expect("round should exist");
    assert_eq!(round.player, player);
    assert_eq!(round.token, token);
    assert_eq!(round.amount, 100);
    assert!(!round.resolved);
    assert!(!round.won);
    assert_eq!(round.score, 0);

    let acct = client.get_accounting(&token);
    assert_eq!(acct.pool, 5000);
    assert_eq!(acct.locked, 100);
    assert_eq!(acct.owed, 0);

    assert_invariant(&contract_id, &token, &client, &token_client);
}

#[test]
fn test_payout_tiers() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &50_000);
    client.fund_pool(&token, &50_000);

    let test_cases = [
        (6, false, 0),   // loss (< 7)
        (7, true, 120),  // 1.2x (100 * 1.2 = 120)
        (8, true, 150),  // 1.5x (100 * 1.5 = 150)
        (9, true, 150),  // 1.5x (100 * 1.5 = 150)
        (10, true, 200), // 2.0x (100 * 2.0 = 200)
    ];

    for (score, won, expected_payout) in test_cases {
        let player = Address::generate(&env);
        token_admin.mint(&player, &100);

        let round_id = client.stake(&player, &token, &100);
        assert_invariant(&contract_id, &token, &client, &token_client);

        client.resolve(&round_id, &won, &score);

        let round = client.get_round(&round_id).unwrap();
        assert!(round.resolved);
        assert_eq!(round.won, won);
        assert_eq!(round.score, score);

        let player_bal = client.get_balance(&player, &token);
        assert_eq!(player_bal, expected_payout);

        assert_invariant(&contract_id, &token, &client, &token_client);
    }
}

#[test]
fn test_resolve_score_validation() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    // Score > 10 rejected
    let res = client.try_resolve(&round_id, &true, &11);
    assert_eq!(res.err(), Some(Ok(Error::InvalidScore)));

    // Won=true but score=6 (mismatch)
    let res = client.try_resolve(&round_id, &true, &6);
    assert_eq!(res.err(), Some(Ok(Error::ScoreResultMismatch)));

    // Won=false but score=8 (mismatch)
    let res = client.try_resolve(&round_id, &false, &8);
    assert_eq!(res.err(), Some(Ok(Error::ScoreResultMismatch)));
}

#[test]
fn test_double_resolve_rejected() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    client.resolve(&round_id, &true, &8);

    // Second resolve must fail
    let res = client.try_resolve(&round_id, &true, &8);
    assert_eq!(res.err(), Some(Ok(Error::AlreadyResolved)));
}

#[test]
fn test_timeout_refund_success() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    // Advance time by 7200 seconds
    env.ledger().set_timestamp(7200);

    client.claim_timeout(&round_id);

    let round = client.get_round(&round_id).unwrap();
    assert!(round.resolved);
    assert!(!round.won);

    let player_bal = client.get_balance(&player, &token);
    assert_eq!(player_bal, 100); // 100% refund

    assert_invariant(&contract_id, &token, &client, &token_client);
}

#[test]
fn test_timeout_rejected_before_7200s() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    // At 7199s, timeout is not yet reached
    env.ledger().set_timestamp(7199);
    let res = client.try_claim_timeout(&round_id);
    assert_eq!(res.err(), Some(Ok(Error::TimeoutNotReached)));
}

#[test]
fn test_timeout_rejected_after_resolve() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    client.resolve(&round_id, &true, &10);

    env.ledger().set_timestamp(10_000);
    let res = client.try_claim_timeout(&round_id);
    assert_eq!(res.err(), Some(Ok(Error::AlreadyResolved)));
}

#[test]
fn test_resolve_rejected_after_timeout() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    env.ledger().set_timestamp(7200);
    client.claim_timeout(&round_id);

    let res = client.try_resolve(&round_id, &true, &8);
    assert_eq!(res.err(), Some(Ok(Error::AlreadyResolved)));
}

#[test]
fn test_withdraw_success_and_zero_balance() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    client.resolve(&round_id, &true, &10); // 2.0x -> 200 payout
    assert_eq!(client.get_balance(&player, &token), 200);

    let withdrawn = client.withdraw(&player, &token);
    assert_eq!(withdrawn, 200);
    assert_eq!(token_client.balance(&player), 200);
    assert_eq!(client.get_balance(&player, &token), 0);

    assert_invariant(&contract_id, &token, &client, &token_client);

    // Second withdraw must fail with ZeroBalance
    let res = client.try_withdraw(&player, &token);
    assert_eq!(res.err(), Some(Ok(Error::ZeroBalance)));
}

#[test]
fn test_pool_underfunded_payout() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    // Pool funded with only 5 tokens profit capability
    token_admin.mint(&admin, &5);
    client.fund_pool(&token, &5);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    // 10/10 requires 200 payout (100 profit from pool), but pool only has 5
    let res = client.try_resolve(&round_id, &true, &10);
    assert_eq!(res.err(), Some(Ok(Error::InsufficientPoolLiquidity)));
}

#[test]
fn test_pause_semantics() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player1 = Address::generate(&env);
    token_admin.mint(&player1, &100);
    let round_id1 = client.stake(&player1, &token, &100);

    let player2 = Address::generate(&env);
    token_admin.mint(&player2, &100);
    let round_id2 = client.stake(&player2, &token, &100);

    // Pause contract
    client.pause();
    assert!(client.is_paused());

    // 1. Stake must be BLOCKED when paused
    let player3 = Address::generate(&env);
    token_admin.mint(&player3, &100);
    let res = client.try_stake(&player3, &token, &100);
    assert_eq!(res.err(), Some(Ok(Error::Paused)));

    // 2. Resolve must WORK when paused
    client.resolve(&round_id1, &true, &8);
    assert_eq!(client.get_balance(&player1, &token), 150);

    // 3. Withdraw must WORK when paused
    let withdrawn = client.withdraw(&player1, &token);

    
    assert_eq!(withdrawn, 150);

    // 4. Claim timeout must WORK when paused
    env.ledger().set_timestamp(7200);
    client.claim_timeout(&round_id2);
    assert_eq!(client.get_balance(&player2, &token), 100);

    // 5. Admin methods must WORK when paused
    client.withdraw_pool(&token, &500);
    let new_token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    client.add_token(&new_token);
    assert!(client.is_token_allowed(&new_token));
    client.remove_token(&new_token);
    assert!(!client.is_token_allowed(&new_token));

    // 6. Unpause restores staking
    client.unpause();
    assert!(!client.is_paused());
    let round_id3 = client.stake(&player3, &token, &100);
    assert_eq!(round_id3, 3);

    assert_invariant(&contract_id, &token, &client, &token_client);
}

#[test]
fn test_token_allowlist() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    let unallowed_token = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let player = Address::generate(&env);
    let res = client.try_stake(&player, &unallowed_token, &100);
    assert_eq!(res.err(), Some(Ok(Error::TokenNotAllowed)));

    let res = client.try_fund_pool(&unallowed_token, &100);
    assert_eq!(res.err(), Some(Ok(Error::TokenNotAllowed)));

    // Removing an existing token does not block withdraw of existing balance
    token_admin.mint(&admin, &1000);
    client.fund_pool(&token, &1000);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);
    client.resolve(&round_id, &true, &7); // balance = 120

    // Remove token from allowlist
    client.remove_token(&token);
    assert!(!client.is_token_allowed(&token));

    // Player can still withdraw their existing balance
    let withdrawn = client.withdraw(&player, &token);
    assert_eq!(withdrawn, 120);
}

#[test]
fn test_all_admin_methods_reject_non_admin_without_mock_all_auths() {
    let env = Env::default();
    // Intentionally DO NOT call env.mock_all_auths()

    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let attacker = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();

    let contract_id = env.register(QuizaContract, (&admin, &verifier));
    let client = QuizaContractClient::new(&env, &contract_id);

    // 1. add_token
    assert!(client.try_add_token(&token).is_err());
    // 2. remove_token
    assert!(client.try_remove_token(&token).is_err());
    // 3. set_verifier
    assert!(client.try_set_verifier(&attacker).is_err());
    // 4. pause
    assert!(client.try_pause().is_err());
    // 5. unpause
    assert!(client.try_unpause().is_err());
    // 6. fund_pool
    assert!(client.try_fund_pool(&token, &100).is_err());
    // 7. withdraw_pool
    assert!(client.try_withdraw_pool(&token, &100).is_err());
    // 8. set_stake_limits
    assert!(client.try_set_stake_limits(&10, &100).is_err());
}

#[test]
fn test_stake_limits_enforcement() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &2_000);

    // Verify constructor defaults: min = 1, max = 0 (unlimited)
    let (default_min, default_max) = client.get_stake_limits();
    assert_eq!(default_min, 1);
    assert_eq!(default_max, 0);

    // Set custom limits: min 50, max 500
    client.set_stake_limits(&50, &500);
    let (min, max) = client.get_stake_limits();
    assert_eq!(min, 50);
    assert_eq!(max, 500);

    // Below min
    let res = client.try_stake(&player, &token, &49);
    assert_eq!(res.err(), Some(Ok(Error::StakeBelowLimit)));

    // Above max
    let res = client.try_stake(&player, &token, &501);
    assert_eq!(res.err(), Some(Ok(Error::StakeExceedsLimit)));

    // Exact min succeeds
    let r1 = client.stake(&player, &token, &50);
    assert_eq!(r1, 1);

    // Exact max succeeds
    let r2 = client.stake(&player, &token, &500);
    assert_eq!(r2, 2);
}

#[test]
fn test_claim_timeout_called_twice() {
    let (env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &10_000);
    client.fund_pool(&token, &10_000);

    let player = Address::generate(&env);
    token_admin.mint(&player, &100);
    let round_id = client.stake(&player, &token, &100);

    env.ledger().set_timestamp(7200);

    // First claim timeout succeeds
    client.claim_timeout(&round_id);
    assert_eq!(client.get_balance(&player, &token), 100);

    // Second claim timeout fails with AlreadyResolved
    let res = client.try_claim_timeout(&round_id);
    assert_eq!(res.err(), Some(Ok(Error::AlreadyResolved)));
}

#[test]
fn test_withdraw_pool_exceeding_balance() {
    let (_env, admin, _verifier, token, _contract_id, client, _token_client, token_admin) =
        setup_test_env();

    token_admin.mint(&admin, &1_000);
    client.fund_pool(&token, &1_000);

    let acct = client.get_accounting(&token);
    assert_eq!(acct.pool, 1_000);

    // Trying to withdraw more than pool liquidity fails with InsufficientPoolLiquidity
    let res = client.try_withdraw_pool(&token, &1_001);
    assert_eq!(res.err(), Some(Ok(Error::InsufficientPoolLiquidity)));

    // Withdrawing exact pool balance succeeds
    client.withdraw_pool(&token, &1_000);
    let acct = client.get_accounting(&token);
    assert_eq!(acct.pool, 0);
}

#[test]
fn test_pool_accounting_invariant_mixed_scenario() {
    let (env, admin, _verifier, token, contract_id, client, token_client, token_admin) =
        setup_test_env();

    // 1. Initial State
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 2. Fund pool
    token_admin.mint(&admin, &100_000);
    client.fund_pool(&token, &20_000);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 3. Multiple players stake
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    let p3 = Address::generate(&env);
    let p4 = Address::generate(&env);

    token_admin.mint(&p1, &500);
    token_admin.mint(&p2, &500);
    token_admin.mint(&p3, &500);
    token_admin.mint(&p4, &500);

    let r1 = client.stake(&p1, &token, &100);
    assert_invariant(&contract_id, &token, &client, &token_client);

    let r2 = client.stake(&p2, &token, &200);
    assert_invariant(&contract_id, &token, &client, &token_client);

    let r3 = client.stake(&p3, &token, &300);
    assert_invariant(&contract_id, &token, &client, &token_client);

    let r4 = client.stake(&p4, &token, &400);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 4. Resolve r1 as a loss (score 4)
    client.resolve(&r1, &false, &4);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 5. Resolve r2 as a 10/10 perfect win (2.0x -> 400 payout)
    client.resolve(&r2, &true, &10);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 6. Resolve r3 as a 7/10 win (1.2x -> 360 payout)
    client.resolve(&r3, &true, &7);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 7. Time out r4
    env.ledger().set_timestamp(7200);
    client.claim_timeout(&r4);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 8. Player 2 withdraws part of system owed
    let w2 = client.withdraw(&p2, &token);
    assert_eq!(w2, 400);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 9. Player 4 withdraws refund
    let w4 = client.withdraw(&p4, &token);
    assert_eq!(w4, 400);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 10. Admin funds more into the pool
    client.fund_pool(&token, &5_000);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 11. Admin withdraws some pool liquidity
    client.withdraw_pool(&token, &3_000);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // 12. Player 3 withdraws
    let w3 = client.withdraw(&p3, &token);
    assert_eq!(w3, 360);
    assert_invariant(&contract_id, &token, &client, &token_client);

    // Final check
    let acct = client.get_accounting(&token);
    assert_eq!(acct.locked, 0);
    assert_eq!(acct.owed, 0);
    assert_eq!(acct.pool, token_client.balance(&contract_id));
}
