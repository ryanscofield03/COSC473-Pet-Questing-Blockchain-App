use std::ops::Mul;
use cosmwasm_std::{entry_point, to_binary, Binary, Coin, CosmosMsg, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Storage, Timestamp, Uint128, WasmMsg};
use rand::rngs::SmallRng;
use rand::{SeedableRng};
use secret_toolkit::permit::Permit;
use crate::loot20::{Loot20ExecuteMsg, Loot20QueryAnswer, Loot20QueryMsg, Loot20QueryWithPermit};
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryAnswer, QueryMsg, QueryWithPermits};
use crate::pet721::{Pet721ExecuteMsg, Pet721QueryAnswer, Pet721QueryMsg, Pet721QueryWithPermit};
use crate::pet721::Pet721QueryWithPermit::OwnerOf;
use crate::randomness::generate_seed;
use crate::state::{calculate_loot, calculate_outcome, check_pet_availability, check_quest_availability, check_quest_awaiting_claim, generate_new_pet, generate_new_quests_for_addr, insert_quest_history, update_pet_on_quest, update_quest_after_claiming, update_quest_after_starting_explore, Config, ContractData, PetState, Quest, QuestHistory, QuestOutcome, Stat, CONFIG, LOOT20_DATA, PET721_DATA, PETS, PET_COUNTER, QUESTS, get_quest_history, QUEST_EXPLORE_TIME_SECONDS, get_cost_of_stat_upgrade, get_quest, Loot, QuestSummary, remove_pet_on_quest, BattleInfo, BATTLE_COUNTER, BATTLES, insert_battle_for_pet, remove_battle_for_pet, PET_BATTLES, BattleInfoWithoutInitiator};

#[entry_point]
pub(crate) fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let admin = msg.clone().admin;
    let config = Config {
        admin: admin.clone(),
        max_stats: msg.clone().max_stats,
        entropy: msg.clone().entropy
    };
    CONFIG.save(deps.storage, &config)?;
    LOOT20_DATA.save(deps.storage, &msg.clone().loot_contract)?;
    PET721_DATA.save(deps.storage, &msg.clone().pet_contract)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("creator", info.sender.to_string()))
}

#[entry_point]
pub(crate) fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::MintPet { .. } => {
            let funds = vec![];

            let next_pet_id = PET_COUNTER.may_load(deps.storage)?.unwrap_or(0);
            let token_id = format!("PET_{}", next_pet_id);
            PET_COUNTER.save(deps.storage, &(next_pet_id + 1))?;

            let config = CONFIG.load(deps.storage)?;
            let seed = generate_seed(
                &info.sender,
                env.block.time.seconds(),
                config.entropy.as_bytes()
            );
            let rng = SmallRng::seed_from_u64(seed);
            generate_new_pet(token_id.clone(), deps.storage, rng.clone())?;

            let nft_msg = Pet721ExecuteMsg::from_execute_msg(msg, Some(token_id.clone()));
            let binary = Binary::from(to_binary(&nft_msg)?);
            let contract_data = PET721_DATA.load(deps.storage)?;
            let cosmos_msg = handle_pet_nft_execute(contract_data, binary, funds);

            let mut response = Response::new()
                .add_message(cosmos_msg)
                .add_attribute("action", "mint_pet")
                .add_attribute("pet_id", token_id);

            let addr = deps.api.addr_canonicalize(info.sender.as_str())?;
            let quests: Option<Vec<Quest>> = QUESTS.get(deps.storage, &addr);
            if quests.is_none() {
                generate_new_quests_for_addr(addr, deps.storage, rng)?;
                response = response.add_attribute("action", "generate_user_quests");
            }

            Ok(response)
        }
        ExecuteMsg::ReleasePet { pet_id, permit: _, pet_permit, loot_permit: _ } => {
            // check that we own the pet
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit.clone()
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to burn it",
                ));
            }

            let pet = match PETS.get(deps.storage, &pet_id) {
                Some(pet) => pet,
                None => {
                    return Err(StdError::generic_err(
                        "Could not find pet",
                    ));
                }
            };

            if pet.on_quest.is_some() && pet.clone().on_quest.unwrap().finished_exploring.is_some() {
                if pet.on_quest.unwrap().finished_exploring.unwrap() > Timestamp::from_seconds(env.block.time.seconds()) {
                    return Err(StdError::generic_err(
                        "Cannot release a pet when it is on a quest",
                    ));
                }
            }

            // remove pet data from this contract
            PETS.remove(deps.storage, &pet_id)?;

            Ok(Response::new()
                .add_attribute("action", "release_pet")
                .add_attribute("pet_id", pet_id))
        }
        ExecuteMsg::UpgradePetStats { pet_id, stat,
            permit: _, pet_permit, loot_permit } => {
            // check that we own the pet
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to upgrade stats",
                ));
            }

            // early return if stat is maxed
            let pet_state: Option<PetState> = PETS.get(deps.storage, &pet_id.clone());
            if pet_state.is_none() {
                return Err(StdError::generic_err(
                    format!("Could not find any stat data for {pet_id}"),
                ));
            }
            let pet_state = pet_state.unwrap();

            let stat = Stat::from_string(stat);
            if pet_state.current.get_stat(stat.clone()) >= pet_state.max.get_stat(stat.clone()) {
                return Err(StdError::generic_err(
                    "Already maxed this stat for this pet"
                ));
            }

            // check if we have the funds
            let query = Loot20QueryWithPermit::Balance {};
            let query_with_permit = Loot20QueryMsg::WithPermit { query, permit: loot_permit };
            let balance = get_loot_balance(deps.as_ref(), query_with_permit)?;

            // early return if balance is insufficient
            let cost_of_upgrade = get_cost_of_stat_upgrade(&pet_state.current, stat.clone())? as u64;
            if balance < cost_of_upgrade {
                return Err(StdError::generic_err(
                    "You do not have sufficient funds to upgrade this pet",
                ));
            }

            // burn the funds
            let burn_msg = burn_loot(info.sender.to_string(), deps.as_ref(), cost_of_upgrade, info.funds)?;

            // update own storage to have increased stat
            upgrade_pets_stat(deps, pet_id, stat)?;

            Ok(Response::default()
                .add_attribute("action", "upgrade_pet")
                .add_message(burn_msg))
        }
        ExecuteMsg::SendPetOnQuest { pet_id, quest_type,
            permit: _, pet_permit, loot_permit: _ } => {
            // check that we own the pet
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to send it on a quest",
                ));
            }

            // check that the pet is available
            let pet_availability = check_pet_availability(pet_id.clone(), deps.storage);
            if !pet_availability {
                return Err(StdError::generic_err(
                    "Pet is already on a quest",
                ));
            }

            // check that the quest is available
            let address = deps.api.addr_canonicalize(info.sender.as_str())?;
            let quest_available = check_quest_availability(
                address.clone(), quest_type.clone(), deps.storage, env.block.time);
            if !quest_available {
                return Err(StdError::generic_err(
                    "Quest is not available yet",
                ));
            }

            // update storage to reflect that pet is on quest and quest has been started
            update_quest_after_starting_explore(
                pet_id.clone(), address.clone(), quest_type.clone(), deps.storage, env.block.time)?;
            update_pet_on_quest(address, pet_id, deps.storage, Some(quest_type))?;

            Ok(Response::default())
        }
        ExecuteMsg::ClaimQuestRewards { quest_type} => {
            let addr_string = info.sender.to_string();

            // check that quest is awaiting claiming
            let address = deps.api.addr_canonicalize(info.sender.as_str())?;
            let quest_awaiting_claim = check_quest_awaiting_claim(
                address.clone(), quest_type.clone(), deps.storage, env.block.time);
            if !quest_awaiting_claim {
                return Err(StdError::generic_err(
                    "Quest is not ready to be claimed yet",
                ));
            }
            // get quest
            let quest = get_quest(address.clone(), quest_type.clone(), deps.storage);
            let quest = match quest {
                Ok(quest) => quest,
                _ => return Err(StdError::generic_err(
                    "Could not find given quest for pet",
                ))
            };

            // get pet_id
            let pet_id = match quest.pet_id {
                Some(pet_id) => pet_id,
                None => {
                    // if this happens, there's a bug
                    return Err(StdError::generic_err(
                        "Quest did not have a pet attached to it",
                    ))
                }
            };

            // calculate outcome
            let outcome: QuestOutcome = calculate_outcome(
                address.clone(), pet_id.clone(), quest_type.clone(), deps.storage)?;

            // calculate winnings
            let loot: Loot = calculate_loot(
                address.clone(), quest_type.clone(), deps.storage)?;
            let loot_collected = match outcome {
                QuestOutcome::Fail => { loot.fail }
                QuestOutcome::Pass => { loot.pass}
                QuestOutcome::ExceptionalPass => { loot.exceptional_pass}
            };

            // update storage for quest history
            let quest_history = QuestHistory {
                pet_id: pet_id.clone(),
                quest_type: quest.quest_type.to_string(),
                time_started: quest.finished_exploring.unwrap().minus_seconds(QUEST_EXPLORE_TIME_SECONDS),
                time_ended: quest.finished_exploring.unwrap(),
                loot_collected: loot_collected.clone(),
                outcome: outcome.clone().to_string()
            };
            insert_quest_history(address.clone(), quest_history, deps.storage)?;

            // update storage to show that pet is available
            remove_pet_on_quest(pet_id.clone(), deps.storage)?;

            let config = CONFIG.load(deps.storage)?;
            let seed = generate_seed(
                &info.sender,
                env.block.time.seconds(),
                config.entropy.as_bytes()
            );
            let rng = SmallRng::seed_from_u64(seed);
            update_quest_after_claiming(address.clone(), quest_type.clone(), deps.storage, rng, outcome)?;

            // mint loot tokens
            let mint_msg = mint_loot(deps.as_ref(), addr_string, loot_collected, info.funds)?;
            Ok(Response::default()
                .add_attribute("action", "claim_rewards")
                .add_message(mint_msg))
        }
        ExecuteMsg::BattlePet { pet_id, other_pet_id, wager, permit: _,
            pet_permit, loot_permit } => {
            // check that we own the pet
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to send it on a quest",
                ));
            };

            // remove funds from the user
            // check if we have the funds
            let query = Loot20QueryWithPermit::Balance {};
            let query_with_permit = Loot20QueryMsg::WithPermit { query, permit: loot_permit };
            let balance = get_loot_balance(deps.as_ref(), query_with_permit)?;

            // early return if balance is insufficient
            if balance < wager {
                return Err(StdError::generic_err(
                    "You do not have sufficient funds to upgrade this pet",
                ));
            }

            // burn the funds
            let burn_msg = burn_loot(info.sender.to_string(), deps.as_ref(), wager, info.funds)?;

            // store two sets of data
            let next_battle_id = BATTLE_COUNTER.may_load(deps.storage)?.unwrap_or(0);
            let initiator_address = deps.api.addr_canonicalize(info.sender.as_str())?;

            BATTLE_COUNTER.save(deps.storage, &(next_battle_id + 1))?;
            let battle_info = BattleInfo {
                id: next_battle_id,
                initiator_address,
                pet_id: pet_id.clone(),
                other_pet_id: other_pet_id.clone(),
                wager,
                status: "pending".to_string(),
                outcome: None,
            };
            BATTLES.insert(deps.storage, &next_battle_id, &battle_info)?;

            insert_battle_for_pet(pet_id, next_battle_id, deps.storage)?;
            insert_battle_for_pet(other_pet_id, next_battle_id, deps.storage)?;

            // store some data
            Ok(Response::default()
                .add_attribute("action", "battle_pet")
                .add_message(burn_msg)
            )
        }
        ExecuteMsg::AcceptBattle { battle_id, permit: _, loot_permit, pet_permit} => {
            let battle = match BATTLES.get(deps.storage, &battle_id) {
                Some(battle) => battle,
                None => {
                    return Err(StdError::generic_err(
                        "Could not find a battle for the given id",
                    ));
                }
            };

            // check that we own the pet
            let pet_id = battle.other_pet_id;
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to accept its battle",
                ));
            };

            // remove funds from the user
            // check if we have the funds
            let query = Loot20QueryWithPermit::Balance {};
            let query_with_permit = Loot20QueryMsg::WithPermit { query, permit: loot_permit };
            let balance = get_loot_balance(deps.as_ref(), query_with_permit)?;

            // early return if balance is insufficient
            let wager = battle.wager;
            if balance < wager {
                return Err(StdError::generic_err(
                    "You do not have sufficient funds to upgrade this pet",
                ));
            }

            // burn the funds
            let burn_msg = burn_loot(info.sender.to_string(), deps.as_ref(), wager, info.funds)?;

            let outcome = battle_pets(battle.pet_id.clone(), pet_id.clone(), deps.storage)?;
            // update the battle
            let updated_battle = BattleInfo {
                id: battle_id,
                initiator_address: battle.initiator_address,
                pet_id: battle.pet_id,
                other_pet_id: pet_id,
                wager,
                status: "accepted".to_string(),
                outcome: Some(outcome),
            };
            BATTLES.insert(deps.storage, &battle_id, &updated_battle)?;

            Ok(Response::default()
                .add_attribute("action", "accept_battle_pet")
                .add_message(burn_msg)
            )
        },
        ExecuteMsg::DeclineBattle { battle_id, permit: _, pet_permit} => {
            let battle = match BATTLES.get(deps.storage, &battle_id) {
                Some(battle) => battle,
                None => {
                    return Err(StdError::generic_err(
                        "Could not find a battle for the given id",
                    ));
                }
            };

            // check that we own the pet
            let pet_id = battle.other_pet_id.clone();
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id, include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to decline its battle",
                ));
            };

            BATTLES.remove(deps.storage, &battle_id)?;
            remove_battle_for_pet(battle.pet_id, battle_id, deps.storage)?;
            remove_battle_for_pet(battle.other_pet_id, battle_id, deps.storage)?;

            // return wager
            let initiator_address = match deps.api.addr_humanize(&battle.initiator_address) {
                Ok(address) => address.to_string(),
                Err(_) => {
                    return Err(StdError::generic_err(
                        "Unable to parse the initiator address for returning wager",
                    ));
                }
            };
            let mint_msg = mint_loot(deps.as_ref(), initiator_address, battle.wager as u16, info.funds)?;

            Ok(Response::default()
                .add_attribute("action", "decline_battle_pet")
                .add_message(mint_msg)
            )
        },
        ExecuteMsg::CancelBattle { battle_id, permit: _, pet_permit} => {
            let battle = match BATTLES.get(deps.storage, &battle_id) {
                Some(battle) => battle,
                None => {
                    return Err(StdError::generic_err(
                        "Could not find a battle for the given id",
                    ));
                }
            };

            // check that we own the pet
            let pet_id = battle.pet_id.clone();
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id, include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to cancel its battle",
                ));
            };

            BATTLES.remove(deps.storage, &battle_id)?;
            remove_battle_for_pet(battle.pet_id, battle_id, deps.storage)?;
            remove_battle_for_pet(battle.other_pet_id, battle_id, deps.storage)?;

            // return wager
            let initiator_address = match deps.api.addr_humanize(&battle.initiator_address) {
                Ok(address) => address.to_string(),
                Err(_) => {
                    return Err(StdError::generic_err(
                        "Unable to parse the initiator address for returning wager",
                    ));
                }
            };
            let mint_msg = mint_loot(deps.as_ref(), initiator_address, battle.wager as u16, info.funds)?;

            Ok(Response::default()
                .add_attribute("action", "cancel_battle_pet")
                .add_message(mint_msg)
            )
        }
        ExecuteMsg::ClaimBattle { battle_id, pet_id, pet_permit } => {
            let battle = match BATTLES.get(deps.storage, &battle_id) {
                Some(battle) => battle,
                None => {
                    return Err(StdError::generic_err(
                        "Could not find a battle for the given id",
                    ));
                }
            };

            // check that we own the pet
            let addr = info.sender.to_string();
            let owner_msg = Pet721QueryMsg::WithPermit {
                query: OwnerOf { token_id: pet_id.clone(), include_expired: None },
                permit: pet_permit
            };
            let owner = get_pet_owner(deps.as_ref(), owner_msg)?;
            if owner != addr {
                return Err(StdError::generic_err(
                    "You must be the owner of this pet to collect its battle claim",
                ));
            };

            // check if they won
            let did_win = match battle.outcome {
                Some(true) => battle.pet_id == pet_id,
                Some(false) => battle.other_pet_id == pet_id,
                _ => {
                    return Err(StdError::generic_err(
                        "Battle is not ready to be claimed",
                    ));
                }
            };

            let mut res = Response::default().add_attribute("action", "claim_battle_pet");

            // if they won, award them 2x the wager
            if did_win {
                let addr_string = info.sender.to_string();
                let mint_msg = mint_loot(deps.as_ref(), addr_string,
                                         battle.wager.mul(2) as u16, info.funds)?;
                res = res.add_message(mint_msg);
            };

            // remove the battle from their pet
            remove_battle_for_pet(pet_id, battle_id, deps.storage)?;

            Ok(res)
        }
    }
}

#[entry_point]
pub(crate) fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    let msg_to_send = msg.clone();
    match msg {
        QueryMsg::AllPets { .. } => {
            // query pet contract for ids
            let contract_data = PET721_DATA.load(deps.storage)?;
            let msg = Pet721QueryMsg::from_query_message(msg);
            let answer = handle_pet721_query(deps, contract_data, msg)?;
            Ok(to_binary(&answer)?)
        }
        QueryMsg::AllLoot { .. } => {
            // query loot contract for ids
            let contract_data = LOOT20_DATA.load(deps.storage)?;
            let msg = Loot20QueryMsg::from_query_message(msg);
            let answer = handle_loot20_query(deps, contract_data, msg)?;
            Ok(to_binary(&answer)?)
        }
        QueryMsg::WithPermits { query, permit,
            loot_permit, pet_permit } => {
            permit_queries(deps, env, msg_to_send, query, permit, loot_permit, pet_permit)
        }
    }
}

pub(crate) fn permit_queries(
    deps: Deps,
    env: Env,
    msg: QueryMsg,
    query: QueryWithPermits,
    permit: Permit,
    _loot_permit: Permit,
    _pet_permit: Permit
) -> StdResult<Binary> {
    let addr = secret_toolkit::permit::validate(
        deps,
        "revoked_permits",
        &permit,
        env.contract.address.to_string(),
        None,
    )?;

    // permit validated, process query
    match query {
        QueryWithPermits::MyPets { .. } => {
            // query NFT contract
            let contract_data = PET721_DATA.load(deps.storage)?;
            let msg = Pet721QueryMsg::from_query_message(msg);
            let answer = handle_pet721_query(deps, contract_data, msg)?;

            let mut pet_data: Vec<PetState> = vec![];
            if let Pet721QueryAnswer::TokenList{ tokens: pet_ids} = answer.clone() {
                for pet_id in pet_ids {
                    let pet_state: Option<PetState> = PETS.get(deps.storage, &pet_id.clone());
                    if pet_state.is_none() {
                        return Err(StdError::generic_err(
                            format!("Could not find any stat data for {pet_id}"),
                        ));
                    }
                    pet_data.push(pet_state.unwrap())
                }
            }
            let answer = QueryAnswer::Pets { pets: pet_data };
            Ok(to_binary(&answer)?)
        }
        QueryWithPermits::MyBalance { .. } => {
            // query loot contract
            let msg = Loot20QueryMsg::from_query_message(msg);
            let balance = get_loot_balance(deps, msg)?;
            let answer = QueryAnswer::Balance { amount: Uint128::from(balance) };
            Ok(to_binary(&answer)?)
        }
        QueryWithPermits::MyQuests { } => {
            // if we have quests, then return the quest data
            let address = deps.api.addr_canonicalize(addr.as_str())?;
            let quests: Option<Vec<Quest>> = QUESTS.get(deps.storage, &address);
            if quests.is_none() {
                return Err(StdError::generic_err(
                    "Could not find any quest data".to_string(),
                ));
            }

            let mut quests_summary: Vec<QuestSummary> = vec![];
            for quest in quests.unwrap() {
                let mut outcome: Option<String> = None;
                let status: String;

                if quest.finished_exploring.is_some() &&
                    quest.finished_exploring.unwrap() > Timestamp::from_seconds(env.block.time.seconds()) {
                    status = "in_progress".to_string();
                }
                else if quest.awaiting_claiming && quest.pet_id.is_some() {
                    status = "claimable".to_string();
                    let outcome_ = calculate_outcome(
                        address.clone(), quest.clone().pet_id.unwrap(), quest.clone().quest_type, deps.storage)?;
                    outcome = Some(outcome_.to_string());
                }
                else if quest.finished_cooldown.is_some() &&
                    quest.finished_cooldown.unwrap() > Timestamp::from_seconds(env.block.time.seconds()) {
                    status = "on_cooldown".to_string();
                }
                else {
                    status = "available".to_string();
                }

                let quest_summary = QuestSummary {
                    status,
                    quest_type: quest.quest_type.clone(),
                    finished_exploring: quest.finished_exploring,
                    finished_cooldown: quest.finished_cooldown,
                    outcome,
                    loot: calculate_loot(address.clone(), quest.quest_type, deps.storage)?,
                };

                quests_summary.push(quest_summary);
            };

            let msg_answer = QueryAnswer::Quests {
                quests: quests_summary,
            };
            Ok(to_binary(&msg_answer)?)
        }
        QueryWithPermits::MyQuestHistory { } => {
            // get pet quest history
            let address = deps.api.addr_canonicalize(addr.as_str())?;
            let quest_history = get_quest_history(address.clone(), deps.storage)?;
            let msg_answer = QueryAnswer::History { quest_history };
            Ok(to_binary(&msg_answer)?)
        }
        QueryWithPermits::MyBattles { pet_permit } => {
            // query NFT contract for all pets
            let contract_data = PET721_DATA.load(deps.storage)?;
            let msg = Pet721QueryMsg::WithPermit {
                query: Pet721QueryWithPermit::Tokens {
                    owner: addr,
                    viewer: None,
                    limit: None,
                    start_after: None,
                },
                permit: pet_permit,
            };
            let answer = handle_pet721_query(deps, contract_data, msg)?;

            let mut battles: Vec<BattleInfoWithoutInitiator> = vec![];
            if let Pet721QueryAnswer::TokenList{ tokens: pet_ids} = answer.clone() {
                // get battles for each pet
                for pet_id in pet_ids {
                    match PET_BATTLES.get(deps.storage, &pet_id) {
                        Some(battle_ids) => {
                            for battle_id in battle_ids {
                                match BATTLES.get(deps.storage, &battle_id) {
                                    Some(battle_info) => {
                                        // could make a ::toBattleInfoWithoutInitiator method
                                        let battle_info_without_initiator = BattleInfoWithoutInitiator {
                                            id: battle_info.id,
                                            pet_id: battle_info.pet_id,
                                            other_pet_id: battle_info.other_pet_id,
                                            wager: battle_info.wager,
                                            status: battle_info.status,
                                            outcome: battle_info.outcome,
                                        };
                                        battles.push(battle_info_without_initiator)
                                    },
                                    _ => {}
                                }
                            }
                        }
                        None => {}
                    };
                }
            }

            // return as answer
            let answer = QueryAnswer::Battles { battles };
            Ok(to_binary(&answer)?)
        }
    }
}

fn handle_pet_nft_execute(
    contract_data: ContractData,
    binary: Binary,
    funds: Vec<Coin>
) -> CosmosMsg {
    CosmosMsg::Wasm(WasmMsg::Execute {
        code_hash: contract_data.clone().hash,
        contract_addr: contract_data.clone().addr,
        msg: binary,
        funds
    })
}

fn handle_pet721_query(
    deps: Deps,
    contract_data: ContractData,
    msg: Pet721QueryMsg
) -> Result<Pet721QueryAnswer, StdError> {
    let response: Pet721QueryAnswer = deps.querier.query_wasm_smart(
        contract_data.clone().hash,
        contract_data.clone().addr,
        &msg
    )?;

    Ok(response)
}

fn handle_loot20_query(
    deps: Deps,
    contract_data: ContractData,
    msg: Loot20QueryMsg
) -> Result<Loot20QueryAnswer, StdError> {
    let response: Loot20QueryAnswer = deps.querier.query_wasm_smart(
        contract_data.clone().hash,
        contract_data.clone().addr,
        &msg
    )?;

    Ok(response)
}

fn handle_loot20_execute(
    contract_data: ContractData,
    binary: Binary,
    funds: Vec<Coin>
) -> CosmosMsg{
    CosmosMsg::Wasm(WasmMsg::Execute {
        code_hash: contract_data.clone().hash,
        contract_addr: contract_data.clone().addr,
        msg: binary,
        funds
    })
}

fn get_pet_owner(
    deps: Deps,
    msg: Pet721QueryMsg
) -> Result<String, StdError> {
    let contract_data = PET721_DATA.load(deps.storage)?;
    let owner = handle_pet721_query(deps, contract_data, msg)?;

    match owner {
        Pet721QueryAnswer::OwnerOf { owner, .. } => Ok(owner.to_string()),
        _ => Err(StdError::generic_err("Unexpected response type when querying owner")),
    }
}

fn get_loot_balance(
    deps: Deps,
    msg: Loot20QueryMsg
) -> Result<u64, StdError>  {
    let contract_data = LOOT20_DATA.load(deps.storage)?;
    let tokens = handle_loot20_query(deps, contract_data, msg)?;

    match tokens {
        Loot20QueryAnswer::Balance { amount } => Ok(amount.u128() as u64)
    }
}

fn upgrade_pets_stat(
    deps_mut: DepsMut,
    pet_id: String,
    stat: Stat
) -> Result<(), StdError> {
    // get current state
    let pet_state: Option<PetState> = PETS.get(deps_mut.storage, &pet_id.clone());
    let mut pet_state = match pet_state {
        Some(pet_state) => pet_state,
        None => return Err(StdError::generic_err("Cannot find pet data"))
    };
    let current_value = pet_state.current.get_stat(stat.clone());

    // update the stat and save it
    pet_state.current.set_stat(stat.clone(), current_value + 1);
    PETS.insert(deps_mut.storage, &pet_id, &pet_state)?;
    Ok(())
}

fn mint_loot(
    deps: Deps,
    recipient: String,
    amount: u16,
    funds: Vec<Coin>
) -> Result<CosmosMsg, StdError> {
    let msg: Loot20ExecuteMsg = Loot20ExecuteMsg::Mint {
        recipient,
        amount: Uint128::from(amount),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None,
    };
    let binary= Binary::from(to_binary(&msg)?);

    let contract_data = LOOT20_DATA.load(deps.storage)?;
    let cosmos_msg = handle_loot20_execute(contract_data, binary, funds);
    Ok(cosmos_msg)
}

fn burn_loot(
    owner: String,
    deps: Deps,
    amount: u64,
    funds: Vec<Coin>
) -> Result<CosmosMsg, StdError> {
    let msg: Loot20ExecuteMsg = Loot20ExecuteMsg::BurnFrom {
        owner,
        amount: Uint128::from(amount),
        memo: None,
        decoys: None,
        entropy: None,
        padding: None,
    };
    let binary= Binary::from(to_binary(&msg)?);
    let contract_data = LOOT20_DATA.load(deps.storage)?;
    let cosmos_msg = handle_loot20_execute(contract_data, binary, funds);
    Ok(cosmos_msg)
}

fn battle_pets(
    pet_id: String,
    other_pet_id: String,
    storage: & dyn Storage
) -> Result<bool, StdError> {
    let pet = match PETS.get(storage, &pet_id) {
        Some(pet) => pet,
        None => {
            return Err(StdError::generic_err(
                "Could not find any quest data".to_string(),
            ));
        }
    };

    let other_pet = match PETS.get(storage, &other_pet_id) {
        Some(pet) => pet,
        None => {
            return Err(StdError::generic_err(
                "Could not find any quest data".to_string(),
            ));
        }
    };

    Ok(
        {
            let mut pet_wins = 0;
            let mut other_wins = 0;

            if pet.current.strength > other_pet.current.strength {
                pet_wins += 1;
            } else if pet.current.strength < other_pet.current.strength {
                other_wins += 1;
            }

            if pet.current.stamina > other_pet.current.stamina {
                pet_wins += 1;
            } else if pet.current.stamina < other_pet.current.stamina {
                other_wins += 1;
            }

            if pet.current.intelligence > other_pet.current.intelligence {
                pet_wins += 1;
            } else if pet.current.intelligence < other_pet.current.intelligence {
                other_wins += 1;
            }

            if pet.current.health > other_pet.current.health {
                pet_wins += 1;
            } else if pet.current.health < other_pet.current.health {
                other_wins += 1;
            }

            if pet.current.luck > other_pet.current.luck {
                pet_wins += 1;
            } else if pet.current.luck < other_pet.current.luck {
                other_wins += 1;
            }

            pet_wins > other_wins
        }
    )
}