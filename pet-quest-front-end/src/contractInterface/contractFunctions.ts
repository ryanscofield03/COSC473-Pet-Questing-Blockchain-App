import { useContext } from "react";
import { SECRET_CHAIN_ID, ContractContext } from "./contractContext";
import { QueryError, WalletError } from "./contractError";
import type { Permit } from "secretjs";

const MAIN_CONTRACT_HASH = process.env.NEXT_PUBLIC_MAIN_CONTRACT_HASH!
const MAIN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ADDRESS!

const LOOT_CONTRACT_HASH = process.env.NEXT_PUBLIC_LOOT_CONTRACT_HASH!
const LOOT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LOOT_CONTRACT_ADDRESS!

const PET_CONTRACT_HASH = process.env.NEXT_PUBLIC_PET_CONTRACT_HASH!
const PET_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PET_CONTRACT_ADDRESS!

export type QuestBase = {
  pet_id?: string;
  quest_type: string;
  awaiting_claiming: boolean;
  finished_exploring?: string;
  finished_cooldown?: string;
  base_loot: string;
  difficulty: string;
  times_won: string;
}

export type Quest = {
  status: string;
  quest_type: string;
  finished_exploring?: number;
  finished_cooldown?: number;
  outcome?: string,
  loot?: {
    fail: number;
    pass: number;
    exceptional_pass: number;
  };
};

export type QuestsInfoResponse = Quest | string;

export type QuestHistory = {
  pet_id: string;
  quest_type: string;
  time_started: number;
  time_ended: number;
  loot_collected: number;
  outcome: string
}

export type QuestHistoryInfoResponse = QuestHistory | string;

export type PetStats = {
  health: number;
  strength: number;
  stamina: number;
  intelligence: number;
  luck: number;
}

export type Pet = {
  pet_id: string,
  on_quest?: QuestBase,
  current: PetStats,
  max: PetStats,
  upgrade_costs: PetStats
};

export type PetsInfoResponse = Pet | string;

export type AllPetsResponse = { tokens: string[] } | string;

export type Loot = {
  amount: number
}

export type LootInfoResponse = Loot | string;

export type Battle = {
  id: string,
  pet_id: string,
  other_pet_id: string,
  wager: string
  status: string, // accepted, pending, declined
  outcome?: string, // true/false
}

export type BattleInfoResponse = Battle | string;


const ContractFunctions = () => {
  const context = useContext(ContractContext);

  if (!context) {
    throw new Error("ContractFunctions must be used within a ContractProvider");
  }

  const { secretJs, secretAddress } = context;

  const queryLootInfo = async (): Promise<LootInfoResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const lootInfoMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        with_permits: {
          permit,
          loot_permit,
          pet_permit,
          query: {
            my_balance: {
              owner: secretAddress,
            },
          }
        }
      },
    };

    const result = await secretJs.query.compute.queryContract(lootInfoMsg) as LootInfoResponse;
    console.log(result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  // queries quest history info
  const queryQuestHistoryInfo = async (): Promise<QuestHistoryInfoResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const questHistoryInfoMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        with_permits: {
          permit,
          loot_permit,
          pet_permit,
          query: {
            my_quest_history: { }
          }
        }
      },
    };

    const result = await secretJs.query.compute.queryContract(questHistoryInfoMsg) as QuestHistoryInfoResponse;
    console.log(result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  // queries quest info
  const queryQuestInfo = async (): Promise<QuestsInfoResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const questsInfoMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        with_permits: {
          permit,
          loot_permit,
          pet_permit,
          query: {
            my_quests: { }
          }
        }
      },
    };

    const result = await secretJs.query.compute.queryContract(questsInfoMsg) as QuestsInfoResponse;
    console.log(result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  // queries pet info
  const queryPetInfo = async (): Promise<PetsInfoResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const petsInfoMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        with_permits: {
          permit,
          loot_permit,
          pet_permit,
          query: {
            my_pets: {
              owner: secretAddress,
            },
          }
        }
      },
    };

    const result = await secretJs.query.compute.queryContract(petsInfoMsg) as PetsInfoResponse;
    console.log(result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  const queryBattleInfo = async (): Promise<BattleInfoResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const battleInfoMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        with_permits: {
          permit,
          loot_permit,
          pet_permit,
          query: {
            my_battles: {
              pet_permit
            },
          }
        }
      },
    };

    const result = await secretJs.query.compute.queryContract(battleInfoMsg) as BattleInfoResponse;
    console.log(result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  const queryAllPets = async (): Promise<AllPetsResponse> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const allPetsMsg = {
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      query: {
        all_pets: {}
      },
    };

    const result = await secretJs.query.compute.queryContract(allPetsMsg) as AllPetsResponse;
    console.log("all pets", result);

    if (typeof result === "string") {
      throw(new QueryError(result));
    }

    return result;
  };

  const executeMintPet = async () => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const mintMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        mint_pet: {
          recipient: secretAddress,
          amount: "1"
        },
      },
    };

    console.log(mintMsg)

    const tx = await secretJs.tx.compute.executeContract(
      mintMsg,
      {
        gasLimit: 100_000,
      }
    );

    console.log(tx);
  }

  const giveContractAllowance = async (allowance: number): Promise<boolean> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const increasedAllowanceMsg = {
      sender: secretAddress,
      contract_address: LOOT_CONTRACT_ADDRESS,
      code_hash: LOOT_CONTRACT_HASH,
      msg: {
        increase_allowance: {
          spender: MAIN_CONTRACT_ADDRESS,
          amount: allowance.toString()
        },
      },
    };

    const increaseAllowanceTx = await secretJs.tx.compute.executeContract(
      increasedAllowanceMsg,
      {
        gasLimit: 80_000,
      }
    );

    console.log(increaseAllowanceTx)
    return increaseAllowanceTx.code === 0;
  }

  const executeBattlePet = async (selected_pet_id: string, pet_id: string, wager: number): Promise<boolean> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const given_wager = await giveContractAllowance(wager);
    if (!given_wager) return given_wager;

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const mintMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        battle_pet: {
          pet_id: selected_pet_id,
          other_pet_id: pet_id,
          wager,
          permit,
          pet_permit,
          loot_permit
        },
      },
    };

    console.log(mintMsg)

    const tx = await secretJs.tx.compute.executeContract(
      mintMsg,
      {
        gasLimit: 200_000,
      }
    );

    console.log(tx);
    return tx.code === 0;
  }

  const executeReleasePet = async (pet_id: string): Promise<boolean> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const releaseMainMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        release_pet: {
          pet_id,
          permit,
          loot_permit,
          pet_permit
        },
      },
    };

    console.log(releaseMainMsg)

    const tx = await secretJs.tx.compute.executeContract(
      releaseMainMsg,
      {
        gasLimit: 100_000,
      }
    );

    console.log(tx);
    const released = tx?.code === 0
    if (!released) {
      return released
    }

    const releasePetMsg = {
      sender: secretAddress,
      contract_address: PET_CONTRACT_ADDRESS,
      code_hash: PET_CONTRACT_HASH,
      msg: {
        burn_nft: {
          token_id: pet_id,
        },
      },
    };

    console.log(releasePetMsg)

    const tx2 = await secretJs.tx.compute.executeContract(
      releasePetMsg,
      {
        gasLimit: 100_000,
      }
    );

    return released;
  }

  const executePetUpgrade = async (pet_id: string, stat: string, cost: number) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const given_wager = await giveContractAllowance(cost);
    if (!given_wager) {
      throw new QueryError(`You must permit the contract to use ${cost}LTK to upgrade your pet.`);
    }

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const upgradeMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        upgrade_pet_stats: {
          pet_id,
          stat,
          permit,
          loot_permit,
          pet_permit,
        },
      },
    };

    console.log("upgrade msg", upgradeMsg);

    const tx = await secretJs.tx.compute.executeContract(
      upgradeMsg,
      {
        gasLimit: 200_000,
      }
    );

    console.log(tx);
  };


  const executeStartQuest = async (pet_id: string|undefined, quest_type: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    if (pet_id == undefined) {
      throw new QueryError("Could not start quest");
    }

    console.log(quest_type);

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);
    const startQuestMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        send_pet_on_quest: {
          pet_id,
          quest_type,
          permit,
          loot_permit,
          pet_permit,
        },
      },
    };

    console.log(startQuestMsg);

    const tx = await secretJs.tx.compute.executeContract(
      startQuestMsg,
      {
        gasLimit: 100_000,
      }
    );

    console.log(tx);
  };


  const executeClaimQuest = async (quest_type: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const claimQuestMsg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        claim_quest_rewards: {
          quest_type,
        },
      },
    };

    console.log(claimQuestMsg);

    const tx = await secretJs.tx.compute.executeContract(
      claimQuestMsg,
      {
        gasLimit: 100_000,
      }
    );

    console.log(tx);
  };

  const executeAcceptBattle = async (battle_id: string, wager: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const given_wager = await giveContractAllowance(parseInt(wager));
    if (!given_wager) return given_wager;

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const loot_permit = await getPermit(LOOT_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);

    const msg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        accept_battle: {
          battle_id,
          permit,
          loot_permit,
          pet_permit,
        },
      },
    };

    const tx = await secretJs.tx.compute.executeContract(msg, {
      gasLimit: 200_000,
    });

    console.log(tx);
  };

  const executeDeclineBattle = async (battle_id: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);

    const msg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        decline_battle: {
          battle_id,
          permit,
          pet_permit,
        },
      },
    };

    const tx = await secretJs.tx.compute.executeContract(msg, {
      gasLimit: 200_000,
    });

    console.log(tx);
  };

  const executeCancelBattle = async (battle_id: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const permit = await getPermit(MAIN_CONTRACT_ADDRESS);
    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);

    const msg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        cancel_battle: {
          battle_id,
          permit,
          pet_permit,
        },
      },
    };

    const tx = await secretJs.tx.compute.executeContract(msg, {
      gasLimit: 200_000,
    });

    console.log(tx);
  };

  const executeClaimBattle = async (battle_id: string, pet_id: string) => {
    if (!secretJs) throw new WalletError("no wallet connected");

    const pet_permit = await getPermit(PET_CONTRACT_ADDRESS);

    const msg = {
      sender: secretAddress,
      contract_address: MAIN_CONTRACT_ADDRESS,
      code_hash: MAIN_CONTRACT_HASH,
      msg: {
        claim_battle: {
          battle_id,
          pet_id,
          pet_permit,
        },
      },
    };

    const tx = await secretJs.tx.compute.executeContract(msg, {
      gasLimit: 200_000,
    });

    console.log(tx);
  };

  const setUpPermits = async () => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    // clear local storage (useful for changing accounts or remaking the contract)
    localStorage.clear();

    [MAIN_CONTRACT_ADDRESS, LOOT_CONTRACT_ADDRESS, PET_CONTRACT_ADDRESS].map(async(addr) => {
      const storageKey = `${secretAddress}:${addr}:queryPermit}`;
      const permit = await secretJs.utils.accessControl.permit.sign(
        secretAddress,
        SECRET_CHAIN_ID,
        "PetQuestPermit",
        [addr],
        ["owner", "balance", "history"],
        true
      );
      localStorage.setItem(storageKey, JSON.stringify(permit));
    })
  }

  // helper function to create query permit. caches in localstorage
  const getPermit = async (givenContractAddress: string): Promise<Permit> => {
    if (!secretJs) throw(new WalletError("no wallet connected"));

    // permit storage key
    const storageKey = `${secretAddress}:${givenContractAddress}:queryPermit}`;

    const queryPermitStored = localStorage.getItem(storageKey);

    let permit: Permit;
    if (queryPermitStored) {
      permit = JSON.parse(queryPermitStored);
    } else {
      throw(new QueryError("You must setup permissions with keplr"));
    }

    return permit;
  }

  return {
    setUpPermits,
    queryLootInfo,
    queryPetInfo,
    queryQuestInfo,
    queryQuestHistoryInfo,
    queryAllPets,
    queryBattleInfo,
    executeMintPet,
    executeReleasePet,
    executePetUpgrade,
    executeStartQuest,
    executeClaimQuest,
    executeBattlePet,
    executeCancelBattle,
    executeDeclineBattle,
    executeAcceptBattle,
    executeClaimBattle
  };
};

export { ContractFunctions };