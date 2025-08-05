use cosmwasm_std::{Addr, Binary, Uint128};
use secret_toolkit::permit::Permit;
use serde::{Deserialize, Serialize};
use crate::msg::{QueryMsg, QueryWithPermits};

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Loot20QueryMsg {
    AllTokens {
        start_after: Option<String>,
        limit: Option<u32>
    },
    WithPermit {
        query: Loot20QueryWithPermit,
        permit: Permit
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Loot20QueryWithPermit {
    Balance { }
}

impl Loot20QueryMsg {
    pub(crate) fn from_query_message(msg: QueryMsg) -> Self {
        match msg {
            QueryMsg::AllLoot { start_after, limit } => {
                Loot20QueryMsg::AllTokens {
                    start_after,
                    limit
                }
            }
            QueryMsg::WithPermits { permit: _, query, loot_permit, pet_permit: _ } => {
                match query {
                    QueryWithPermits::MyBalance { owner: _, viewer: _, limit: _, start_after: _ } => {
                        Loot20QueryMsg::WithPermit {
                            query: Loot20QueryWithPermit::Balance { },
                            permit: loot_permit
                        }
                    }
                    _ => panic!("Expected a loot FT permitted query")
                }
            }
            _ => panic!("Expected a loot FT query")
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Loot20ExecuteMsg {
    Mint {
        recipient: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<Addr>>,
        entropy: Option<Binary>,
        padding: Option<String>,
    },
    BurnFrom {
        owner: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<Addr>>,
        entropy: Option<Binary>,
        padding: Option<String>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Loot20QueryAnswer {
    Balance {
        amount: Uint128
    }
}