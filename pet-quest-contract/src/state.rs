use std::cmp::PartialEq;
use std::ops::Mul;
use schemars::JsonSchema;
use secret_toolkit::storage::{Item, Keymap};
use serde::{Deserialize, Serialize};
use cosmwasm_std::{Addr, StdResult, Storage, Timestamp, StdError, CanonicalAddr};
use rand::{Rng};
use rand::rngs::SmallRng;

pub(crate) static QUEST_COOLDOWN_SECONDS: u64 = 60;
pub(crate) static QUEST_EXPLORE_TIME_SECONDS: u64 = 30;


pub(crate) static CONFIG_KEY: &[u8] = b"config";
pub(crate) static PETS_KEY: &[u8] = b"pets";
pub(crate) static QUESTS_KEY: &[u8] = b"quests";
pub(crate) static QUEST_HISTORY_KEY: &[u8] = b"quest_history";
pub(crate) static PET_COUNTER_KEY: &[u8] = b"pet_counter";
pub(crate) static BATTLE_COUNTER_KEY: &[u8] = b"battle_counter";
pub(crate) static PET_BATTLES_KEY: &[u8] = b"pet_battles";
pub(crate) static BATTLE_KEY: &[u8] = b"battles";
pub(crate) static LOOT20_KEY: &[u8] = b"loot_20";
pub(crate) static PET721_KEY: &[u8] = b"pet_721";

pub(crate) static CONFIG: Item<Config> = Item::new(CONFIG_KEY);

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) struct Config {
    pub(crate) admin: Addr,
    pub(crate) max_stats: u16,
    pub(crate) entropy: String
}

#[derive(Serialize, Deserialize, JsonSchema, Clone, Debug, Eq, PartialEq)]
pub(crate) struct ContractData {
    pub(crate) hash: String,
    pub(crate) addr: String
}

pub(crate) static PET_COUNTER: Item<u64> = Item::new(PET_COUNTER_KEY);
pub(crate) static BATTLE_COUNTER: Item<u64> = Item::new(BATTLE_COUNTER_KEY);

pub(crate) static LOOT20_DATA: Item<ContractData> = Item::new(LOOT20_KEY);
pub(crate) static PET721_DATA: Item<ContractData> = Item::new(PET721_KEY);

pub(crate) static PETS: Keymap<String, PetState> = Keymap::new(PETS_KEY);
pub(crate) static BATTLES: Keymap<u64, BattleInfo> = Keymap::new(BATTLE_KEY);
pub(crate) static PET_BATTLES: Keymap<String, Vec<u64>> = Keymap::new(PET_BATTLES_KEY);

pub(crate) static QUESTS: Keymap<CanonicalAddr, Vec<Quest>> = Keymap::new(QUESTS_KEY);
pub(crate) static QUEST_HISTORY: Keymap<CanonicalAddr, Vec<QuestHistory>> = Keymap::new(QUEST_HISTORY_KEY);


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub(crate) struct BattleInfo {
    pub(crate) id: u64,
    pub(crate) initiator_address: CanonicalAddr,
    pub(crate) pet_id: String,
    pub(crate) other_pet_id: String,
    pub(crate) wager: u64,
    pub(crate) status: String,

    // true if pet_id wins
    pub(crate) outcome: Option<bool>
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub(crate) struct BattleInfoWithoutInitiator {
    pub(crate) id: u64,
    pub(crate) pet_id: String,
    pub(crate) other_pet_id: String,
    pub(crate) wager: u64,
    pub(crate) status: String,

    // true if pet_id wins
    pub(crate) outcome: Option<bool>
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub(crate) struct PetState {
    pub(crate) pet_id: String,
    pub(crate) on_quest: Option<Quest>,
    pub(crate) current: PetStats,
    pub(crate) max: PetStats,
    pub(crate) upgrade_costs: PetStats
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub(crate) struct PetStats {
    pub(crate) health: u16,
    pub(crate) strength: u16,
    pub(crate) stamina: u16,
    pub(crate) intelligence: u16,
    pub(crate) luck: u16,
}

impl PetStats {
    pub(crate) fn new(
        health: u16,
        strength: u16,
        stamina: u16,
        intelligence: u16,
        luck: u16,
    ) -> Self {
        PetStats {
            health,
            strength,
            stamina,
            intelligence,
            luck
        }
    }

    pub fn get_stat(&self, stat: Stat) -> u16 {
        match stat {
            Stat::Health => self.health,
            Stat::Strength => self.strength,
            Stat::Stamina => self.stamina,
            Stat::Intelligence => self.intelligence,
            Stat::Luck => self.luck,
        }
    }

    pub fn set_stat(&mut self, stat: Stat, new_value: u16) {
        match stat {
            Stat::Health => self.health = new_value,
            Stat::Strength => self.strength = new_value,
            Stat::Stamina => self.stamina = new_value,
            Stat::Intelligence => self.intelligence = new_value,
            Stat::Luck => self.luck = new_value,
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub(crate) enum Stat {
    Health,
    Strength,
    Stamina,
    Intelligence,
    Luck
}

impl Stat {
    pub(crate) fn from_string(str: String) -> Self {
        match str.as_str() {
            "Health" => Stat::Health,
            "Strength" => Stat::Strength,
            "Stamina" => Stat::Stamina,
            "Intelligence" => Stat::Intelligence,
            "Luck" => Stat::Luck,
            _ => Stat::Health
        }
    }
}

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) struct QuestSummary {
    pub(crate) status: String,
    pub(crate) quest_type: String,
    pub(crate) finished_exploring: Option<Timestamp>,
    pub(crate) finished_cooldown: Option<Timestamp>,
    pub(crate) outcome: Option<String>,
    pub(crate) loot: Loot,
}

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) struct Loot {
    pub(crate) fail: u16,
    pub(crate) pass: u16,
    pub(crate) exceptional_pass: u16,
}

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) struct Quest {
    pub(crate) pet_id: Option<String>,
    pub(crate) quest_type: String,
    pub(crate) awaiting_claiming: bool,
    pub(crate) finished_exploring: Option<Timestamp>,
    pub(crate) finished_cooldown: Option<Timestamp>,
    pub(crate) base_loot: u16,
    pub(crate) difficulty: u16,
    pub(crate) difficulty_increment: u16
}

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) struct QuestHistory {
    pub(crate) pet_id: String,
    pub(crate) quest_type: String,
    pub(crate) time_started: Timestamp,
    pub(crate) time_ended: Timestamp,
    pub(crate) loot_collected: u16,
    pub(crate) outcome: String
}

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, Eq, PartialEq)]
pub(crate) enum QuestOutcome {
    Fail,
    Pass,
    ExceptionalPass
}

impl QuestOutcome {
    pub(crate) fn to_string(self) -> String {
        match self {
            QuestOutcome::Fail => "Fail".to_string(),
            QuestOutcome::Pass => "Pass".to_string(),
            QuestOutcome::ExceptionalPass => "Exceptional Pass".to_string(),
        }
    }
}

pub(crate) enum QuestType {
    TrialOfResilience,
    TrialOfTitans,
    TrialOfEndurance,
    TrialOfWisdom
}

impl QuestType {
    fn to_string(self) -> String {
        match self {
            QuestType::TrialOfResilience => {
                "Trial Of Resilience".to_string()
            }
            QuestType::TrialOfTitans => {
                "Trial Of Titans".to_string()
            }
            QuestType::TrialOfEndurance => {
                "Trial Of Endurance".to_string()
            }
            QuestType::TrialOfWisdom => {
                "Trial Of Wisdom".to_string()
            }
        }
    }

    fn from_string(string: String) -> Self {
        match string.as_str() {
            "Trial Of Resilience" => QuestType::TrialOfResilience,
            "Trial Of Titans" => QuestType::TrialOfTitans,
            "Trial Of Endurance" => QuestType::TrialOfEndurance,
            "Trial Of Wisdom" => QuestType::TrialOfWisdom,
            _ => QuestType::TrialOfTitans
        }
    }
}

pub(crate) struct QuestData {
    stat: Stat
}

impl QuestType {
    fn get_quest_data(self) -> QuestData {
        match self {
            QuestType::TrialOfResilience => {
                QuestData { stat: Stat::Health}
            }
            QuestType::TrialOfTitans => {
                QuestData { stat: Stat::Strength}
            }
            QuestType::TrialOfEndurance => {
                QuestData { stat: Stat::Stamina}
            }
            QuestType::TrialOfWisdom => {
                QuestData { stat: Stat::Intelligence}
            }
        }
    }
}

pub(crate) fn generate_new_pet(
    pet_id: String,
    storage: &mut dyn Storage,
    mut rng: SmallRng
) -> StdResult<()> {
    let max_stat_value = CONFIG.load(storage)?.max_stats;
    let pet_stats = PetStats::new(
        rng.gen_range(5..=8),
        rng.gen_range(5..=8),
        rng.gen_range(5..=8),
        rng.gen_range(5..=8),
        rng.gen_range(5..=8)
    );

    let pet_maxes = PetStats::new(
        rng.gen_range(12..=max_stat_value),
        rng.gen_range(12..=max_stat_value),
        rng.gen_range(12..=max_stat_value),
        rng.gen_range(12..=max_stat_value),
        rng.gen_range(12..=max_stat_value),
    );

    let pet_state = PetState {
        pet_id: pet_id.clone(),
        on_quest: None,
        current: pet_stats.clone(),
        max: pet_maxes,
        upgrade_costs: PetStats {
            health: get_cost_of_stat_upgrade(&pet_stats, Stat::Health)?,
            strength: get_cost_of_stat_upgrade(&pet_stats, Stat::Strength)?,
            stamina: get_cost_of_stat_upgrade(&pet_stats, Stat::Stamina)?,
            intelligence: get_cost_of_stat_upgrade(&pet_stats, Stat::Intelligence)?,
            luck: get_cost_of_stat_upgrade(&pet_stats, Stat::Luck)?,
        }
    };

    PETS.insert(storage, &pet_id, &pet_state)
}

pub(crate) fn get_cost_of_stat_upgrade(
    pet_stats: &PetStats,
    stat: Stat
) -> StdResult<u16> {
    let pet_stat = pet_stats.get_stat(stat);
    let cost_of_upgrade = pet_stat * 5;
    Ok(cost_of_upgrade)
}

pub(crate) fn generate_new_quests_for_addr(
    addr: CanonicalAddr,
    storage: &mut dyn Storage,
    mut rng: SmallRng
) -> StdResult<()> {
    let mut quests = Vec::with_capacity(4);
    quests.push(Quest {
        quest_type: QuestType::TrialOfResilience.to_string(),
        awaiting_claiming: false,
        pet_id: None,
        finished_exploring: None,
        finished_cooldown: None,
        base_loot: rng.gen_range(1..=5),
        difficulty: rng.gen_range(1..=3),
        difficulty_increment: 0,
    });
    quests.push(Quest {
        quest_type: QuestType::TrialOfEndurance.to_string(),
        awaiting_claiming: false,
        pet_id: None,
        finished_exploring: None,
        finished_cooldown: None,
        base_loot: rng.gen_range(1..=5),
        difficulty: rng.gen_range(1..=3),
        difficulty_increment: 0,
    });
    quests.push(Quest {
        quest_type: QuestType::TrialOfTitans.to_string(),
        awaiting_claiming: false,
        pet_id: None,
        finished_exploring: None,
        finished_cooldown: None,
        base_loot: rng.gen_range(1..=5),
        difficulty: rng.gen_range(1..=3),
        difficulty_increment: 0,
    });
    quests.push(Quest {
        quest_type: QuestType::TrialOfWisdom.to_string(),
        awaiting_claiming: false,
        pet_id: None,
        finished_exploring: None,
        finished_cooldown: None,
        base_loot: rng.gen_range(1..=5),
        difficulty: rng.gen_range(1..=3),
        difficulty_increment: 0,
    });
    QUESTS.insert(storage, &addr, &quests)
}

pub(crate) fn update_quest_after_claiming(
    addr: CanonicalAddr,
    quest_type: String,
    storage: &mut dyn Storage,
    mut rng: SmallRng,
    outcome: QuestOutcome
) -> Result<(), StdError> {
    if let Some(mut quests) = QUESTS.get(storage, &addr) {
        for quest in quests.iter_mut() {
            if quest.quest_type == quest_type {
                quest.base_loot = rng.gen_range(1..=5);
                quest.difficulty = rng.gen_range(1..=3);
                quest.pet_id = None;
                quest.finished_exploring = None;
                quest.awaiting_claiming = false;
                match outcome {
                    QuestOutcome::Pass => quest.difficulty_increment += rng.gen_range(0..=1),
                    QuestOutcome::ExceptionalPass => quest.difficulty_increment += rng.gen_range(1..=2),
                    _ => {}
                }
            }
        }
        QUESTS.insert(storage, &addr, &quests)?;
        Ok(())
    } else {
        Ok(())
    }
}

pub(crate) fn check_pet_availability(
    pet_id: String,
    storage: &dyn Storage,
) -> bool {
    if let Some(pet) = PETS.get(storage, &pet_id) {
        pet.on_quest.is_none()
    } else {
        false
    }
}

pub(crate) fn check_quest_availability(
    addr: CanonicalAddr,
    quest_type: String,
    storage: &dyn Storage,
    timestamp: Timestamp,
) -> bool {
    if let Some(quests) = QUESTS.get(storage, &addr) {
        for quest in quests.iter() {
            if quest.quest_type == quest_type {
                if let Some(finished_exploring) = quest.finished_exploring {
                    if finished_exploring.seconds() > timestamp.seconds() {
                        return false;
                    }
                }
                return true;
            }
        }
    }
    false
}

pub(crate) fn check_quest_awaiting_claim(
    addr: CanonicalAddr,
    quest_type: String,
    storage: &dyn Storage,
    timestamp: Timestamp,
) -> bool {
    if let Some(quests) = QUESTS.get(storage, &addr) {
        for quest in quests.iter() {
            if quest.quest_type == quest_type {
                if let Some(finished_exploring) = quest.finished_exploring {
                    if finished_exploring.seconds() <= timestamp.seconds() && quest.awaiting_claiming {
                        return true;
                    }
                }
                return false;
            }
        }
    }
    false
}

pub(crate) fn update_quest_after_starting_explore(
    pet_id: String,
    addr: CanonicalAddr,
    quest_type: String,
    storage: &mut dyn Storage,
    now: Timestamp
) -> Result<(), StdError> {
    if let Some(mut quests) = QUESTS.get(storage, &addr) {
        for quest in quests.iter_mut() {
            if quest.quest_type == quest_type {
                quest.pet_id = Some(pet_id.clone());
                quest.finished_exploring = Option::from(Timestamp::from_seconds(
                    now.seconds() + QUEST_EXPLORE_TIME_SECONDS));
                quest.finished_cooldown = Option::from(Timestamp::from_seconds(
                    now.seconds() + QUEST_COOLDOWN_SECONDS));
                quest.awaiting_claiming = true;
            }
        }
        QUESTS.insert(storage, &addr, &quests)?;
    }

    Ok(())
}

pub(crate) fn update_pet_on_quest(
    addr: CanonicalAddr,
    pet_id: String,
    storage: &mut dyn Storage,
    quest_type: Option<String>,
) -> Result<(), StdError> {
    if let Some(mut pet) = PETS.get(storage, &pet_id) {
        let quest = if let Some(quest_type) = quest_type {
            if let Some(quests) = QUESTS.get(storage, &addr) {
                quests.into_iter().find(|quest| quest.quest_type == quest_type)
            } else {
                None
            }
        } else {
            None
        };

        pet.on_quest = quest;
        PETS.insert(storage, &pet_id, &pet)?;
    }

    Ok(())
}

pub(crate) fn remove_pet_on_quest(
    pet_id: String,
    storage: &mut dyn Storage,
) -> Result<(), StdError> {
    match PETS.get(storage, &pet_id) {
        Some(mut pet) => {
            pet.on_quest = None;
            PETS.insert(storage, &pet_id, &pet)?;
        }
        None => {return Err(StdError::generic_err("Could not find pet"))}
    };

    Ok(())
}

pub(crate) fn insert_quest_history(
    addr: CanonicalAddr,
    new_entry: QuestHistory,
    storage: &mut dyn Storage,
) -> Result<(), StdError> {
    let mut history = QUEST_HISTORY.get(storage, &addr)
        .unwrap_or_else(|| Vec::with_capacity(10));
    history.push(new_entry);
    QUEST_HISTORY.insert(storage, &addr, &history)?;
    Ok(())
}

pub(crate) fn insert_battle_for_pet(
    pet_id: String,
    battle_id: u64,
    storage: &mut dyn Storage,
) -> Result<(), StdError> {
    let mut battles = PET_BATTLES.get(storage, &pet_id)
        .unwrap_or_else(|| Vec::with_capacity(10));
    battles.push(battle_id);
    PET_BATTLES.insert(storage, &pet_id, &battles)?;
    Ok(())
}

pub(crate) fn remove_battle_for_pet(
    pet_id: String,
    battle_id: u64,
    storage: &mut dyn Storage,
) -> Result<(), StdError> {
    let mut battles = PET_BATTLES.get(storage, &pet_id)
        .unwrap_or_else(|| Vec::with_capacity(10));
    battles.retain(|id| id != &battle_id);
    PET_BATTLES.insert(storage, &pet_id, &battles)?;
    Ok(())
}

pub(crate) fn get_quest_history(
    addr: CanonicalAddr,
    storage: &dyn Storage,
) -> Result<Vec<QuestHistory>, StdError> {
    let history = QUEST_HISTORY.get(storage, &addr);
    let history = match history {
        Some(history) => history,
        None => return Err(StdError::generic_err("History not found"))
    };
    Ok(history)
}

pub(crate) fn calculate_outcome(
    addr: CanonicalAddr,
    pet_id: String,
    quest_type: String,
    storage: &dyn Storage,
) -> Result<QuestOutcome, StdError> {
    let pet = match PETS.get(storage, &pet_id) {
        Some(pet) => pet,
        None => return Err(StdError::generic_err("Pet not found"))
    };

    let quests = match QUESTS.get(storage, &addr) {
        Some(quests) => quests,
        None => return Err(StdError::generic_err("Quest not found"))
    };

    let mut outcome: QuestOutcome =  QuestOutcome::Fail;
    for quest in quests.iter() {
        if quest.quest_type == quest_type.clone() {
            let stat = QuestType::from_string(quest_type.clone()).get_quest_data().stat;
            let current_stat_value = pet.current.get_stat(stat);
            let current_luck = pet.current.get_stat(Stat::Luck);
            let difficulty = quest.difficulty;
            let times_won = quest.difficulty_increment;

            let total_to_beat = difficulty + (2 * times_won);
            let half_total_to_beat = ((total_to_beat + 1) / 2) as i16;

            let total_stats = current_stat_value + ((current_luck + 1) / 2);

            let difference = total_stats as i16 - total_to_beat as i16;
            match difference {
                _fail if difference < 0 => {
                    outcome = QuestOutcome::Fail
                }
                _pass if difference >= 0 && difference < half_total_to_beat => {
                    outcome = QuestOutcome::Pass
                }
                _exceptional_pass if difference >= half_total_to_beat => {
                    outcome = QuestOutcome::ExceptionalPass
                }
                _ => {
                    outcome = QuestOutcome::Fail
                }
            }
        }
    }

    Ok(outcome)
}

pub(crate) fn calculate_loot(
    addr: CanonicalAddr,
    quest_type: String,
    storage: &dyn Storage,
) -> Result<Loot, StdError> {
    let quests = match QUESTS.get(storage, &addr) {
        Some(quests) => quests,
        None => return Err(StdError::generic_err("Quests not found"))
    };

    let mut loot = Loot { fail: 0, pass: 0, exceptional_pass: 0 };
    for quest in quests.iter() {
        if quest.quest_type == quest_type.clone() {
            let base = quest.base_loot + quest.difficulty + quest.difficulty_increment;
            loot = Loot {
                fail: (base + 2) / 3,
                pass: base,
                exceptional_pass: base.mul(2),
            };
        }
    }

    Ok(loot)
}

pub(crate) fn get_quest(
    addr: CanonicalAddr,
    quest_type: String,
    storage: &dyn Storage
) -> Result<Quest, StdError> {
    let quests = match QUESTS.get(storage, &addr) {
        Some(quests) => quests,
        None => return Err(StdError::generic_err("Quests not found"))
    };

    for quest in quests.iter() {
        if quest.quest_type == quest_type.clone() {
            return Ok(quest.clone())
        }
    };

    Err(StdError::generic_err("Quest not found"))
}

