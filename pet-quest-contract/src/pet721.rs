use cosmwasm_std::{Addr, Uint128};
use secret_toolkit::permit::Permit;
use secret_toolkit::snip721::{Cw721Approval, ViewerInfo};
use serde::{Deserialize, Serialize};
use crate::msg::{ExecuteMsg, QueryMsg, QueryWithPermits};

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Pet721QueryMsg {
    AllTokens {
        start_after: Option<String>,
        limit: Option<u32>
    },
    WithPermit {
        query: Pet721QueryWithPermit,
        permit: Permit
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Pet721QueryWithPermit {
    Tokens {
        owner: String,
        viewer: Option<ViewerInfo>,
        limit: Option<u32>,
        start_after: Option<String>
    },
    OwnerOf {
        token_id: String,
        include_expired: Option<bool>,
    },
}

impl Pet721QueryMsg {
    pub(crate) fn from_query_message(msg: QueryMsg) -> Self {
        match msg {
            QueryMsg::AllPets { start_after, limit } => {
                Pet721QueryMsg::AllTokens { start_after, limit }
            }
            QueryMsg::WithPermits { query, permit: _, loot_permit: _, pet_permit } => {
                match query {
                    QueryWithPermits::MyPets { owner, viewer, limit, start_after} => {
                        Pet721QueryMsg::WithPermit {
                            query: Pet721QueryWithPermit::Tokens {
                                owner, viewer, limit, start_after
                            },
                            permit: pet_permit
                        }
                    }
                    _ => panic!("Expected a pet NFT permitted query")
                }
            }
            _ => panic!("Expected a pet NFT query")
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Pet721ExecuteMsg {
    MintNft {
        token_id: String,
        owner: String,
        amount: Uint128,
        memo: Option<String>,
        decoys: Option<Vec<String>>,
        entropy: Option<String>,
        padding: Option<String>,
    },
}

impl Pet721ExecuteMsg {
    pub(crate) fn from_execute_msg(msg: ExecuteMsg, token_id: Option<String>) -> Self {
        match msg {
            ExecuteMsg::MintPet {
                recipient,
                amount,
                memo,
                decoys,
                entropy,
                padding,
            } => {
                let entropy_str = entropy.map(|b| b.to_base64());
                Pet721ExecuteMsg::MintNft {
                    token_id: token_id.unwrap(),
                    owner: recipient,
                    amount,
                    memo,
                    decoys,
                    entropy: entropy_str,
                    padding,
                }
            },
            _ => panic!("Expected MintPet variant")
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Pet721QueryAnswer {
    TokenList {
        tokens: Vec<String>,
    },
    OwnerOf {
        owner: Addr,
        approvals: Vec<Cw721Approval>,
    },
}