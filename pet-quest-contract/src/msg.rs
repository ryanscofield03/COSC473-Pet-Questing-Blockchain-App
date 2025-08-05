use cosmwasm_std::{Addr, Binary, Uint128};
use schemars::JsonSchema;
use secret_toolkit::permit::Permit;
use secret_toolkit::snip721::ViewerInfo;
use serde::{Deserialize, Serialize};
use crate::state::{BattleInfoWithoutInitiator, ContractData, PetState, QuestHistory, QuestSummary};

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub(crate) struct InstantiateMsg {
    pub(crate) admin: Addr,
    pub(crate) max_stats: u16,
    pub(crate) entropy: String,
    pub(crate) loot_contract: ContractData,
    pub(crate) pet_contract: ContractData
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ExecuteMsg {
    MintPet {
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<Binary>,
        padding: Option<String>,
    },
    ReleasePet {
        pet_id: String,
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit
    },
    UpgradePetStats {
        pet_id: String,
        stat: String,
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit
    },
    SendPetOnQuest {
        pet_id: String,
        quest_type: String,
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit
    },
    ClaimQuestRewards {
        quest_type: String
    },
    BattlePet {
        pet_id: String,
        other_pet_id: String,
        wager: u64,
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit
    },
    AcceptBattle {
        battle_id: u64,
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit
    },
    DeclineBattle {
        battle_id: u64,
        permit: Permit,
        pet_permit: Permit
    },
    CancelBattle {
        battle_id: u64,
        permit: Permit,
        pet_permit: Permit
    },
    ClaimBattle {
        battle_id: u64,
        pet_id: String,
        pet_permit: Permit
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum QueryMsg {
    AllPets {
        start_after: Option<String>,
        limit: Option<u32>
    },
    AllLoot {
        start_after: Option<String>,
        limit: Option<u32>
    },
    WithPermits {
        permit: Permit,
        loot_permit: Permit,
        pet_permit: Permit,
        query: QueryWithPermits
    }
}

/// queries using permits
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum QueryWithPermits {
    MyPets {
        owner: String,
        viewer: Option<ViewerInfo>,
        limit: Option<u32>,
        start_after: Option<String>
    },
    MyBalance {
        owner: String,
        viewer: Option<ViewerInfo>,
        limit: Option<u32>,
        start_after: Option<String>
    },
    MyQuests { },
    MyQuestHistory { },
    MyBattles {
        pet_permit: Permit
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum QueryAnswer {
    Pets { pets: Vec<PetState> },
    Balance { amount: Uint128 },
    Quests { quests: Vec<QuestSummary> },
    History { quest_history: Vec<QuestHistory> },
    Battles { battles: Vec<BattleInfoWithoutInitiator> }
}