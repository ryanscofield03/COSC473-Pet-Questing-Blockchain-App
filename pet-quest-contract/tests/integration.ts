import axios from "axios";
import {BroadcastMode, Permit, SecretNetworkClient, TxResponse, Wallet} from "secretjs";
import fs from "fs";
import assert from "assert";
import {randomBytes} from "node:crypto";

type ContractInfo = {
  codeHash: string;
  address: string;
};

type UserInfo = {
  client: SecretNetworkClient,
  permit: Permit,
  loot_permit: Permit,
  pet_permit: Permit,
}

type ClientInfo = {
  user1: UserInfo;
  user2: UserInfo;
  user3: UserInfo;
  loot: ContractInfo;
  pet: ContractInfo;
  main: ContractInfo;
};

type QuestBase = {
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

type PetStats = {
  health: number;
  strength: number;
  stamina: number;
  intelligence: number;
  luck: number;
}

type Pet = {
  pet_id: string,
  on_quest?: QuestBase,
  current: PetStats,
  max: PetStats,
  upgrade_costs: PetStats
}

type QuestHistory = {
  pet_id: string;
  quest_type: string;
  time_started: number;
  time_ended: number;
  loot_collected: number;
  outcome: string
}

type Battle = {
  id: string,
  pet_id: string,
  other_pet_id: string,
  wager: string
  status: string, // accepted, pending, declined
  outcome?: boolean, // true/false
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns a client with which we can interact with secret network
const initializeClient = async (endpoint: string, chainId: string) => {
  const wallet = new Wallet(); // Use default constructor of wallet to generate random mnemonic.
  const accAddress = wallet.address;
  const client = new SecretNetworkClient({
    // Create a client to interact with the network
    url: endpoint,
    chainId: chainId,
    wallet: wallet,
    walletAddress: accAddress,
  });

  console.log(`Initialized client with wallet address: ${accAddress}`);
  return client;
};

// Stores and instantiaties a new contract in our network
const initializeLootContract = async (
  client1: SecretNetworkClient,
  client2: SecretNetworkClient,
) => {
  const wasmCode = fs.readFileSync("../../loot20/contract.wasm.gz");
  console.log("Uploading contract");

  const uploadReceipt = await client1.tx.compute.storeCode(
    {
      wasm_byte_code: wasmCode,
      sender: client1.address,
      source: "",
      builder: "",
    },
    {
      gasLimit: 5000000,
    }
  );

  if (uploadReceipt.code !== 0) {
    console.log(
      `Failed to get code id: ${JSON.stringify(uploadReceipt.rawLog)}`
    );
    throw new Error(`Failed to upload contract`);
  }

  const codeIdKv = uploadReceipt.jsonLog![0].events[0].attributes.find(
    (a: any) => {
      return a.key === "code_id";
    }
  );

  const codeId = Number(codeIdKv!.value);
  console.log("Contract codeId: ", codeId);

  const contractCodeHash = (await client1.query.compute.codeHashByCodeId({code_id: String(codeId)})).code_hash;

  if (contractCodeHash === undefined) {
    throw new Error(`Failed to get code hash`);
  }

  console.log(`Contract hash: ${contractCodeHash}`);

  const initMsg = {
    name: 'LootToken',
    symbol: 'LTK',
    decimals: 6,
    prng_seed: randomBytes(32).toString('base64'),
    config: {
      public_total_supply: false,
      enable_deposit: false,
      enable_redeem: false,
      enable_mint: true,
      enable_burn: true,
      can_modify_denoms: false,
    },
    admin: client1.address,
    initial_balances: [
      {
        address: client1.address,
        amount: '100',
      },
      {
        address: client2.address,
        amount: '100',
      },
    ],
    supported_denoms: ['uscrt']
  };

  const contract = await client1.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: client1.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      label: 'loot_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (contract.code !== 0) {
    console.log('Instantiation failed: ', contract.rawLog);
  }

  const contractAddress = contract.arrayLog!.find(
    (log) => log.type === "message" && log.key === "contract_address"
  )!.value;

  console.log(`Contract address: ${contractAddress}`);

  const contractInfo: [string, string] = [contractCodeHash, contractAddress];
  return contractInfo;
};

const initializeMainContract = async (
  client: SecretNetworkClient,
  lootHash: string,
  lootAddr: string,
  petHash: string,
  petAddr: string
) => {
  const wasmCode = fs.readFileSync("../contract.wasm.gz");
  console.log("Uploading contract");

  const uploadReceipt = await client.tx.compute.storeCode(
    {
      wasm_byte_code: wasmCode,
      sender: client.address,
      source: "",
      builder: "",
    },
    {
      gasLimit: 5000000,
    }
  );

  if (uploadReceipt.code !== 0) {
    console.log(
      `Failed to get code id: ${JSON.stringify(uploadReceipt.rawLog)}`
    );
    throw new Error(`Failed to upload contract`);
  }

  const codeIdKv = uploadReceipt.jsonLog![0].events[0].attributes.find(
    (a: any) => {
      return a.key === "code_id";
    }
  );

  const codeId = Number(codeIdKv!.value);
  console.log("Contract codeId: ", codeId);

  const contractCodeHash = (await client.query.compute.codeHashByCodeId({code_id: String(codeId)})).code_hash;

  if (contractCodeHash === undefined) {
    throw new Error(`Failed to get code hash`);
  }

  console.log(`Contract hash: ${contractCodeHash}`);

  const initMsg = {
    admin: client.address,
    max_stats: 20,
    entropy: randomBytes(32).toString('base64'),
    loot_contract: {
      hash: lootHash,
      addr: lootAddr
    },
    pet_contract: {
      hash: petHash,
      addr: petAddr
    }
  };

  const contract = await client.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: client.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      label: 'game_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (contract.code !== 0) {
    console.log('Instantiation failed: ', contract.rawLog);
  }

  const contractAddress = contract.arrayLog!.find(
    (log) => log.type === "message" && log.key === "contract_address"
  )!.value;

  console.log(`Contract address: ${contractAddress}`);

  const contractInfo: [string, string] = [contractCodeHash, contractAddress];
  return contractInfo;
};

const initializePetContract = async (
  client: SecretNetworkClient,
) => {
  const wasmCode = fs.readFileSync("../../pet721/contract.wasm.gz");
  console.log("Uploading contract");

  const uploadReceipt = await client.tx.compute.storeCode(
    {
      wasm_byte_code: wasmCode,
      sender: client.address,
      source: "",
      builder: "",
    },
    {
      gasLimit: 5000000,
      broadcastMode: BroadcastMode.Sync,
    }
  );

  if (uploadReceipt.code !== 0) {
    console.log(
      `Failed to get code id: ${JSON.stringify(uploadReceipt.rawLog)}`
    );
    throw new Error(`Failed to upload contract`);
  }

  const codeIdKv = uploadReceipt.jsonLog![0].events[0].attributes.find(
    (a: any) => {
      return a.key === "code_id";
    }
  );

  const codeId = Number(codeIdKv!.value);
  console.log("Contract codeId: ", codeId);

  const contractCodeHash = (await client.query.compute.codeHashByCodeId({code_id: String(codeId)})).code_hash;

  if (contractCodeHash === undefined) {
    throw new Error(`Failed to get code hash`);
  }

  console.log(`Contract hash: ${contractCodeHash}`);

  const initMsg = {
    name: 'PetToken',
    symbol: 'PET',
    entropy: randomBytes(32).toString('base64'),
    admin: client.address,
    config: {
      public_token_supply: true,
      public_owner: true,
      enable_sealed_metadata: false,
      unwrapped_metadata_is_private: false,
      minter_may_update_metadata: false,
      owner_may_update_metadata: false,
      enable_burn: true,
    },
  };

  const contract = await client.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: client.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      label: 'pet_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (contract.code !== 0) {
    console.log('Instantiation failed: ', contract.rawLog);
  }

  const contractAddress = contract.arrayLog!.find(
    (log) => log.type === "message" && log.key === "contract_address"
  )!.value;

  console.log(`Contract address: ${contractAddress}`);

  const contractInfo: [string, string] = [contractCodeHash, contractAddress];
  return contractInfo;
};

const addMinters = async (
  client: SecretNetworkClient,
  contractAddress: string,
  codeHash: string,
  minters: string[]
) => {
  const msg = {
    add_minters: {
      minters,
      padding: null,
    },
  };

  const tx = await client.tx.compute.executeContract(
    {
      sender: client.address,
      contract_address: contractAddress,
      code_hash: codeHash,
      msg,
    },
    {
      gasLimit: 100_000,
    }
  );

  if (tx.code !== 0) {
    console.error('AddMinters failed:', tx.rawLog);
  } else {
    console.log('Minters added successfully!');
    console.log('Transaction hash:', tx.transactionHash);
  }
};

const changeAdmin = async (
  client: SecretNetworkClient,
  contractAddress: string,
  codeHash: string,
  newAdmin: string
) => {
  const msg = {
    change_admin: {
      address: newAdmin,
    },
  };

  const tx = await client.tx.compute.executeContract(
    {
      sender: client.address,
      contract_address: contractAddress,
      code_hash: codeHash,
      msg,
    },
    {
      gasLimit: 100_000,
    }
  );

  if (tx.code !== 0) {
    console.error('ChangeAdmin failed:', tx.rawLog);
  } else {
    console.log('Admin changed successfully!');
    console.log('Transaction hash:', tx.transactionHash);
  }
};

const getFromFaucet = async (address: string) => {
  await axios.get(`https://5000-scrtlabs-gitpodlocalsec-e4pvrpgp5t2.ws-us120.gitpod.io///faucet?address=${address}`);
};

async function getScrtBalance(userCli: SecretNetworkClient): Promise<string> {
  let balanceResponse = await userCli.query.bank.balance({
    address: userCli.address,
    denom: "uscrt",
  });

  if (balanceResponse?.balance?.amount === undefined) {
    throw new Error(`Failed to get balance for address: ${userCli.address}`)
  }

  return balanceResponse.balance.amount;
}

async function fillUpFromFaucet(
  client: SecretNetworkClient,
  targetBalance: Number
) {
  let balance = await getScrtBalance(client);
  while (Number(balance) < targetBalance) {
    try {
      await getFromFaucet(client.address);
    } catch (e) {
      console.error(`failed to get tokens from faucet: ${e}`);
    }
    balance = await getScrtBalance(client);
  }
  console.error(`got tokens from faucet: ${balance}`);
}

// Initialization procedure
async function initializeAndUploadContract(): Promise<ClientInfo> {
  let endpoint = "https://1317-scrtlabs-gitpodlocalsec-e4pvrpgp5t2.ws-us120.gitpod.io";
  let chainId = "secretdev-1";

  const client1 = await initializeClient(endpoint, chainId);
  const client2 = await initializeClient(endpoint, chainId);
  const client3 = await initializeClient(endpoint, chainId);

  await fillUpFromFaucet(client1, 100_000_000);
  await fillUpFromFaucet(client2, 100_000_000);
  await fillUpFromFaucet(client3, 100_000_000);

  const [petContractHash, petContractAddress] = await initializePetContract(
    client1,
  );

  const [lootContractHash, lootContractAddress] = await initializeLootContract(
    client1,
    client2
  );

  const [mainContractHash, mainContractAddress] = await initializeMainContract(
    client1,
    lootContractHash,
    lootContractAddress,
    petContractHash,
    petContractAddress,
  );

  await addMinters(client1, petContractAddress, petContractHash, [mainContractAddress])
  await addMinters(client1, lootContractAddress, lootContractHash, [mainContractAddress])

  await changeAdmin(client1, petContractAddress, petContractHash, mainContractAddress)
  await changeAdmin(client1, lootContractAddress, lootContractHash, mainContractAddress)

  return {
    user1: {
      client: client1,
      permit: await client1.utils.accessControl.permit.sign(
        client1.address,
        "secretdev-1",
        "PetQuestPermit",
        [mainContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      loot_permit: await client1.utils.accessControl.permit.sign(
        client1.address,
        "secretdev-1",
        "PetQuestPermit",
        [lootContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      pet_permit: await client1.utils.accessControl.permit.sign(
        client1.address,
        "secretdev-1",
        "PetQuestPermit",
        [petContractAddress],
        ["owner", "balance", "history"],
        false
      )
    },
    user2: {
      client: client2,
      permit: await client2.utils.accessControl.permit.sign(
        client2.address,
        "secretdev-1",
        "PetQuestPermit",
        [mainContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      loot_permit: await client2.utils.accessControl.permit.sign(
        client2.address,
        "secretdev-1",
        "PetQuestPermit",
        [lootContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      pet_permit: await client2.utils.accessControl.permit.sign(
        client2.address,
        "secretdev-1",
        "PetQuestPermit",
        [petContractAddress],
        ["owner", "balance", "history"],
        false
      )
    },
    user3: {
      client: client3,
      permit: await client3.utils.accessControl.permit.sign(
        client3.address,
        "secretdev-1",
        "PetQuestPermit",
        [mainContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      loot_permit: await client3.utils.accessControl.permit.sign(
        client3.address,
        "secretdev-1",
        "PetQuestPermit",
        [lootContractAddress],
        ["owner", "balance", "history"],
        false
      ),
      pet_permit: await client3.utils.accessControl.permit.sign(
        client3.address,
        "secretdev-1",
        "PetQuestPermit",
        [petContractAddress],
        ["owner", "balance", "history"],
        false
      )
    },
    loot: {
      codeHash: lootContractHash,
      address: lootContractAddress,
    },
    pet: {
      codeHash: petContractHash,
      address: petContractAddress,
    },
    main: {
      codeHash: mainContractHash,
      address: mainContractAddress,
    },
  };
}

async function mintPet(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
) {
  const tx = await user_info.client.tx.compute.executeContract(
    {
      sender: user_info.client.address,
      contract_address: contractAddress,
      code_hash: contractHash,
      msg: {
        mint_pet: {
          recipient: user_info.client.address,
          amount: "1"
        },
      },
    },
    {
      gasLimit: 200000,
    }
  );
}

async function questPet(
  user_info: UserInfo,
  pet_id: string,
  quest_type: string,
  contractHash: string,
  contractAddress: string
): Promise<TxResponse> {
  return await user_info.client.tx.compute.executeContract(
    {
      sender: user_info.client.address,
      contract_address: contractAddress,
      code_hash: contractHash,
      msg: {
        send_pet_on_quest: {
          pet_id,
          quest_type,
          permit: user_info.permit,
          loot_permit: user_info.loot_permit,
          pet_permit: user_info.pet_permit,
        },
      },
    },
    {
      gasLimit: 200000,
    }
  )
}

async function claimQuest(
  user_info: UserInfo,
  quest_type: string,
  contractHash: string,
  contractAddress: string
): Promise<TxResponse> {
  return await user_info.client.tx.compute.executeContract(
    {
      sender: user_info.client.address,
      contract_address: contractAddress,
      code_hash: contractHash,
      msg: {
        claim_quest_rewards: {
          quest_type,
        },
      },
    },
    {
      gasLimit: 200000,
    }
  )
}

async function releasePet(
  user_info: UserInfo,
  pet_id: string,
  mainContractHash: string,
  mainContractAddress: string,
  petContractHash: string,
  petContractAddress: string,
) {
  const releasePetMsg = {
    sender: user_info.client.address,
    contract_address: petContractAddress,
    code_hash: petContractHash,
    msg: {
      burn_nft: {
        token_id: pet_id,
      },
    },
  };

  const tx2 = await user_info.client.tx.compute.executeContract(
    releasePetMsg,
    {
      gasLimit: 100_000,
    }
  );

  const releaseMainMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      release_pet: {
        pet_id,
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  const tx = await user_info.client.tx.compute.executeContract(
    releaseMainMsg,
    {
      gasLimit: 100_000,
    }
  );
}

async function upgradeStat(
  user_info: UserInfo,
  pet_id: string,
  stat: string,
  cost: number,
  mainContractHash: string,
  mainContractAddress: string,
  lootContractHash: string,
  lootContractAddress: string,
): Promise<TxResponse[]> {
  const increasedAllowanceMsg = {
    sender: user_info.client.address,
    contract_address: lootContractAddress,
    code_hash: lootContractHash,
    msg: {
      increase_allowance: {
        spender: mainContractAddress,
        amount: cost.toString()
      },
    },
  };

  const increaseAllowanceTx = await user_info.client.tx.compute.executeContract(
    increasedAllowanceMsg,
    {
      gasLimit: 80_000,
    }
  );

  const upgradeMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      upgrade_pet_stats: {
        pet_id,
        stat,
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  const tx = await user_info.client.tx.compute.executeContract(
    upgradeMsg,
    {
      gasLimit: 200_000,
    }
  );

  return [increaseAllowanceTx, tx]
}

async function battlePet(
  user_info: UserInfo,
  pet_id: string,
  other_pet_id: string,
  wager: number,
  mainContractHash: string,
  mainContractAddress: string,
  lootContractHash: string,
  lootContractAddress: string,
): Promise<TxResponse[]> {
  const increasedAllowanceMsg = {
    sender: user_info.client.address,
    contract_address: lootContractAddress,
    code_hash: lootContractHash,
    msg: {
      increase_allowance: {
        spender: mainContractAddress,
        amount: wager.toString()
      },
    },
  };

  const increaseAllowanceTx = await user_info.client.tx.compute.executeContract(
    increasedAllowanceMsg,
    {
      gasLimit: 80_000,
    }
  );

  const battleMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      battle_pet: {
        pet_id,
        other_pet_id,
        wager,
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  let tx = await user_info.client.tx.compute.executeContract(
    battleMsg,
    {
      gasLimit: 200_000,
    }
  )

  return [increaseAllowanceTx, tx]
}

async function acceptBattlePet(
  user_info: UserInfo,
  battle_id: string,
  wager: string,
  mainContractHash: string,
  mainContractAddress: string,
  lootContractHash: string,
  lootContractAddress: string,
): Promise<TxResponse[]> {
  const increasedAllowanceMsg = {
    sender: user_info.client.address,
    contract_address: lootContractAddress,
    code_hash: lootContractHash,
    msg: {
      increase_allowance: {
        spender: mainContractAddress,
        amount: wager.toString()
      },
    },
  };

  const increaseAllowanceTx = await user_info.client.tx.compute.executeContract(
    increasedAllowanceMsg,
    {
      gasLimit: 80_000,
    }
  );

  const acceptBattleMessage = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      accept_battle: {
        battle_id,
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  let tx = await user_info.client.tx.compute.executeContract(
    acceptBattleMessage,
    {
      gasLimit: 200_000,
    }
  )

  return [increaseAllowanceTx, tx]
}

async function declineBattle(
  user_info: UserInfo,
  battle_id: string,
  mainContractHash: string,
  mainContractAddress: string,
): Promise<TxResponse> {
  const declineBattleMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      decline_battle: {
        battle_id,
        permit: user_info.permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  return await user_info.client.tx.compute.executeContract(
    declineBattleMsg,
    {
      gasLimit: 200_000,
    }
  )
}

async function cancelBattle(
  user_info: UserInfo,
  battle_id: string,
  mainContractHash: string,
  mainContractAddress: string,
): Promise<TxResponse> {
  const declineBattleMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      cancel_battle: {
        battle_id,
        permit: user_info.permit,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  return await user_info.client.tx.compute.executeContract(
    declineBattleMsg,
    {
      gasLimit: 200_000,
    }
  )
}

async function claimBattle(
  user_info: UserInfo,
  battle_id: string,
  pet_id: string,
  mainContractHash: string,
  mainContractAddress: string,
): Promise<TxResponse> {
  const claimBattleMsg = {
    sender: user_info.client.address,
    contract_address: mainContractAddress,
    code_hash: mainContractHash,
    msg: {
      claim_battle: {
        battle_id,
        pet_id,
        pet_permit: user_info.pet_permit,
      },
    },
  };

  return await user_info.client.tx.compute.executeContract(
    claimBattleMsg,
    {
      gasLimit: 200_000,
    }
  )
}

async function queryPets(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
): Promise<Pet[]> {
  const petsResponse = (await user_info.client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: {
      with_permits: {
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
        query: {
          my_pets: {
            owner: user_info.client.address,
          },
        }
      }}})) as { pets: { pets: Pet[] } } | string;

  if (typeof petsResponse === "string") {
    throw new Error(
      `Query pets failed with error ${petsResponse}`
    );
  }

  return petsResponse.pets.pets;
}

async function queryQuests(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
): Promise<Quest[]> {
  const questsResponse = (await user_info.client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: {
      with_permits: {
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
        query: {
          my_quests: { },
        }
      }}})) as { quests: { quests: Quest[] } } | string;

  if (typeof questsResponse === "string") {
    throw new Error(
      `Query quests failed with error ${questsResponse}`
    );
  }

  return questsResponse.quests.quests;
}

async function queryQuestHistory(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
): Promise<QuestHistory[]> {
  const questHistoryResponse = (await user_info.client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: {
      with_permits: {
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
        query: {
          my_quest_history: { }
        }
      }}})) as { history: { quest_history: QuestHistory[] } } | string;

  if (typeof questHistoryResponse === "string") {
    throw new Error(
      `Query quests history failed with error ${questHistoryResponse}`
    );
  }

  return questHistoryResponse.history.quest_history;
}

async function queryBalance(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
): Promise<number> {
  const lootResponse = (await user_info.client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: {
      with_permits: {
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
        query: {
          my_balance: {
            owner: user_info.client.address,
          },
        }
      }
    },
  })) as { balance: { amount: number } } | string

  if (typeof lootResponse === "string") {
    throw new Error(
      `Query quests failed with error ${lootResponse}`
    );
  }

  return lootResponse.balance.amount;
}

async function queryBattles(
  user_info: UserInfo,
  contractHash: string,
  contractAddress: string
): Promise<Battle[]> {
  const battleResponse = (await user_info.client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: {
      with_permits: {
        permit: user_info.permit,
        loot_permit: user_info.loot_permit,
        pet_permit: user_info.pet_permit,
        query: {
          my_battles: {
            pet_permit: user_info.pet_permit,
          },
        }
      }
    },
  })) as { battles: { battles: Battle[] } } | string

  if (typeof battleResponse === "string") {
    throw new Error(
      `Query quests failed with error ${battleResponse}`
    );
  }

  return battleResponse.battles.battles;
}

async function test_mint_pet(
  client_info: ClientInfo
) {
  await mintPet(client_info.user1, client_info.main.codeHash, client_info.main.address)
  await mintPet(client_info.user1, client_info.main.codeHash, client_info.main.address)
  await mintPet(client_info.user1, client_info.main.codeHash, client_info.main.address)
  await mintPet(client_info.user1, client_info.main.codeHash, client_info.main.address)
  await mintPet(client_info.user1, client_info.main.codeHash, client_info.main.address)

  await mintPet(client_info.user2, client_info.main.codeHash, client_info.main.address)
  await mintPet(client_info.user3, client_info.main.codeHash, client_info.main.address)

  let pets = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)

  assert(
    pets.length === 5,
    `expected to have 5 pets, got ${pets.length}`
  );
}

async function test_release_pet(
  client_info: ClientInfo
) {
  // assumption that this is run AFTER minting a pet already
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  await releasePet(client_info.user1, pet_id, client_info.main.codeHash,
    client_info.main.address, client_info.pet.codeHash, client_info.pet.address)
  pets = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)

  assert(
    pets.find((pet: Pet) => pet.pet_id == pet_id) === undefined,
    `expected to not find pet with id ${pet_id} in ${pets}`
  )
}

async function test_start_quest(
  client_info: ClientInfo
) {
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  let quests: Quest[] = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let quest_type = quests[0].quest_type

  await questPet(client_info.user1, pet_id, quest_type, client_info.main.codeHash, client_info.main.address)
  pets = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  quests = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)

  const foundPet = pets.find((pet: Pet) => pet.pet_id == pet_id);
  assert(
    foundPet?.on_quest?.quest_type === quest_type,
    `expected that ${pet_id} was on quest type ${quest_type}, but instead was on ${foundPet?.on_quest?.quest_type}`
  )

  const foundQuest = quests.find((quest: Quest) => quest.quest_type === quest_type);
  assert(
    foundQuest?.status === "in_progress",
    `expected that quest status was in_progress, but found it was ${foundQuest?.status}`
  )
}

async function test_quest_cannot_be_run_when_in_progress(
  client_info: ClientInfo
) {
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  let quests: Quest[] = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let quest_type = quests[0].quest_type

  let txResponse = await questPet(client_info.user1, pet_id, quest_type, client_info.main.codeHash, client_info.main.address);

  const foundQuest = quests.find((quest: Quest) => quest.quest_type === quest_type);
  assert(
    foundQuest?.status === "in_progress",
    `expected that quest status was in_progress, but found it was ${foundQuest?.status}`
  )

  assert(
    txResponse.code !== 0,
    `Expected quest to fail when it was already being adventured, but it succeeded: ${JSON.stringify(txResponse)}`
  );
}

async function test_pet_cannot_be_used_when_in_a_quest(
  client_info: ClientInfo
) {
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  let current_quest = pets[0].on_quest?.quest_type
  let quests: Quest[] = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let new_quest = quests[1].quest_type

  let txResponse = await questPet(client_info.user1, pet_id, new_quest, client_info.main.codeHash, client_info.main.address);

  const foundPet = pets.find((pet: Pet) => pet.pet_id == pet_id);
  assert(
    foundPet?.on_quest?.quest_type === current_quest,
    `expected that ${pet_id} was on quest type ${current_quest}, but instead was on ${foundPet?.on_quest?.quest_type}`
  )

  assert(
    txResponse.code !== 0,
    `Expected quest to fail when pet was already in an adventure, but it succeeded: ${JSON.stringify(txResponse)}`
  );
}

async function test_collect_quest(
  client_info: ClientInfo
) {
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[2].pet_id
  let quests: Quest[] = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let quest_type = quests[2].quest_type

  await questPet(client_info.user1, pet_id, quest_type, client_info.main.codeHash, client_info.main.address);
  await sleep(30_000)

  quests = await queryQuests(client_info.user1, client_info.main.codeHash, client_info.main.address)

  const quest = quests.find((q: Quest) => q.quest_type == quest_type);
  assert(
    quest?.status === "claimable",
    `expected that quest status was claimable, but found it was ${quest?.status}`
  )

  let balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);

  await claimQuest(client_info.user1, quest_type, client_info.main.codeHash, client_info.main.address);
  let balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);

  let loot: number = 0;
  if (quest!.outcome === "Fail") {
    loot = quest.loot?.fail || 0;
  } else if (quest!.outcome === "Pass") {
    loot = quest!.loot?.pass || 0;
  } else if (quest.outcome === "Exceptional Pass") {
    loot = quest!.loot?.exceptional_pass || 0;
  } else {
    assert(false, `do not recognise the outcome ${quest!.outcome}`)
  }

  let expected_balance_after = +balance_before + +loot
  assert(
    balance_after == expected_balance_after,
    `expected new balance of ${expected_balance_after} but found ${balance_after}`
  )
}

async function test_quest_in_history(
  client_info: ClientInfo
) {
  // assumes that quest has been claimed from previous tests
  let quest_history = await queryQuestHistory(client_info.user1, client_info.main.codeHash, client_info.main.address)

  assert(
    quest_history?.length >= 1,
    `expected that quest history length of at least 1 but found ${quest_history?.length}`
  )
}

async function test_upgrade_pet(
  client_info: ClientInfo
) {
  // query pets and check for stat
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  let strength_before = pets[0].current?.strength
  let balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let cost_of_upgrade = pets[0].upgrade_costs?.strength

  // upgrade stat
  await upgradeStat(client_info.user1, pet_id, "Strength", cost_of_upgrade, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  // check that stat is +1 than before
  pets = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let strength_after = pets.find((pet: Pet) => pet.pet_id == pet_id)?.current?.strength;
  assert(
    strength_after === strength_before + 1,
    `expected strength after of ${strength_after} but found ${strength_before + 1}`
  )

  let balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let expected_balance_after = +balance_before - +cost_of_upgrade
  assert(
    balance_after == expected_balance_after,
    `expected balance after of ${expected_balance_after} but found ${balance_after}`
  )
}

async function test_upgrade_pet_without_funds(
  client_info: ClientInfo
) {
  let pets: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id
  let cost_of_upgrade = pets[0].upgrade_costs.strength

  let txList = await upgradeStat(client_info.user3, pet_id, "Strength", cost_of_upgrade, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  assert(
    txList[1]?.code !== 0,
    `Expected upgrade to fail but it didnt`
  );
}

async function test_battle_pet(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let wager = 20

  await battlePet(client_info.user1, pet_id1, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let expected_balance_after = +balance_before - +wager
  assert(
    balance_after == expected_balance_after,
    `expected balance after of ${expected_balance_after} but found ${balance_after}`
  )

  let battles1 = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let battle1_status = battles1.find((battle: Battle) => battle.pet_id == pet_id1)?.status
  assert(
    battle1_status == "pending",
    `expected user1 to have a pending battle for pet, but status was ${battle1_status}`
  )

  let battles2 = await queryBattles(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let battle2_status = battles2.find((battle: Battle) => battle.pet_id == pet_id1)?.status
  assert(
    battle2_status == "pending",
    `expected user2 to have a pending battle for pet, but status was ${battle2_status}`
  )
}

async function test_battle_pet_without_funds(
  client_info: ClientInfo
) {
  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0]?.pet_id

  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0]?.pet_id

  let wager = 99 // user3 has balance of 0

  let txList = await battlePet(client_info.user3, pet_id3, pet_id1, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  assert(
    txList[1].code !== 0,
    `Expected starting battle to fail but it didnt`
  );
}

async function test_accept_battle(
  client_info: ClientInfo
) {
  let balance_before = await queryBalance(client_info.user2, client_info.main.codeHash, client_info.main.address);
  let battles = await queryBattles(client_info.user2, client_info.main.codeHash, client_info.main.address);
  let battle_id = battles[0].id
  let wager = battles[0].wager

  await acceptBattlePet(client_info.user2, battle_id, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let balance_after = await queryBalance(client_info.user2, client_info.main.codeHash, client_info.main.address);
  let expected_balance_after = +balance_before - +wager
  assert(
    balance_after == expected_balance_after,
    `expected balance after of ${expected_balance_after} but found ${balance_after}`
  )

  let battles_after1 = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_status1 = battles_after1.find((battle: Battle) => battle.id == battle_id)?.status
  assert(
    "accepted" === battle_status1,
    `expected battle status for user1 to be accepted but it was ${battle_status1}`
  )

  let battles_after2 = await queryBattles(client_info.user2, client_info.main.codeHash, client_info.main.address);
  let battle_status2 = battles_after2.find((battle: Battle) => battle.id == battle_id)?.status
  assert(
    "accepted" === battle_status2,
    `expected battle status for user2 to be accepted but it was ${battle_status2}`
  )
}

async function test_accept_battle_with_insufficient_funds(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0].pet_id

  let wager = 20

  await battlePet(client_info.user1, pet_id1, pet_id3, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user3, client_info.main.codeHash, client_info.main.address);
  let battle_id = battles[0].id
  let wager_offered = battles[0].wager

  let txList = await acceptBattlePet(client_info.user3, battle_id, wager_offered, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  assert(
    txList[1].code !== 0,
    `Expected accepting battle to fail but it didnt`
  );

  let battles_after1 = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_status1 = battles_after1.find((battle: Battle) => battle.id == battle_id)?.status
  assert(
    "pending" === battle_status1,
    `expected battle status for user1 to be pending but it was ${battle_status1}`
  )

  let battles_after3 = await queryBattles(client_info.user3, client_info.main.codeHash, client_info.main.address);
  let battle_status3 = battles_after3.find((battle: Battle) => battle.id == battle_id)?.status
  assert(
    "pending" === battle_status3,
    `expected battle status for user3 to be pending but it was ${battle_status3}`
  )
}

async function test_decline_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let wager = 5

  await battlePet(client_info.user1, pet_id1, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_id: string = battles.find((battle: Battle) => battle.wager == "5")?.id != undefined ?
    battles.find((battle: Battle) => battle.wager == "5")!.id : battles[0].id

  await declineBattle(client_info.user2, battle_id, client_info.main.codeHash, client_info.main.address)

  let balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  assert(
    balance_after == balance_before,
    `expected user1 balance after to be ${balance_before} but it was ${balance_after}`
  )

  let battles_after1 = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  assert (
    battles_after1.find((battle: Battle) => battle.id == battle_id) == undefined,
    'expected to not find the declined battle for user1 but did'
  )

  let battles_after2 = await queryBattles(client_info.user2, client_info.main.codeHash, client_info.main.address);
  assert (
    battles_after2.find((battle: Battle) => battle.id == battle_id) == undefined,
    'expected to not find the declined battle for user2 but did'
  )
}

async function test_cancel_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let wager = 15

  await battlePet(client_info.user1, pet_id1, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_id: string = battles.find((battle: Battle) => battle.wager == "15")?.id != undefined ?
    battles.find((battle: Battle) => battle.wager == "15")!.id : battles[0].id

  await cancelBattle(client_info.user1, battle_id, client_info.main.codeHash, client_info.main.address)

  let balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  assert(
    balance_after == balance_before,
    `expected user1 balance after to be ${balance_before} but it was ${balance_after}`
  )

  let battles_after1 = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  assert (
    battles_after1.find((battle: Battle) => battle.id == battle_id) == undefined,
    'expected to not find the declined battle for user1 but did'
  )

  let battles_after2 = await queryBattles(client_info.user2, client_info.main.codeHash, client_info.main.address);
  assert (
    battles_after2.find((battle: Battle) => battle.id == battle_id) == undefined,
    'expected to not find the declined battle for user2 but did'
  )
}

async function test_collect_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let wager = 7

  await battlePet(client_info.user1, pet_id1, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_before: Battle = battles.find((battle: Battle) => battle.wager == wager.toString()) != undefined ?
    battles.find((battle: Battle) => battle.wager == wager.toString())! : battles[0]

  await acceptBattlePet(client_info.user2, battle_before.id, wager.toString(), client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let user1_balance_before = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let user2_balance_before = await queryBalance(client_info.user2, client_info.main.codeHash, client_info.main.address);

  battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_after: Battle = battles.find((battle: Battle) => battle.id == battle_before.id) != undefined ?
    battles.find((battle: Battle) => battle.id == battle_before.id)! : battles[0]

  await claimBattle(client_info.user1, battle_before.id, pet_id1, client_info.main.codeHash, client_info.main.address)
  await claimBattle(client_info.user2, battle_before.id, pet_id2, client_info.main.codeHash, client_info.main.address)

  let user1_expected_claim = 0;
  let user2_expected_claim = 0;
  if (battle_after.outcome === true) {
    user1_expected_claim = parseInt(battle_after.wager) * 2
  } else {
    user2_expected_claim = parseInt(battle_after.wager) * 2
  }

  let user1_balance_after = await queryBalance(client_info.user1, client_info.main.codeHash, client_info.main.address);
  assert(
    user1_balance_after == (+user1_balance_before + +user1_expected_claim),
    `expected user1 to have balance ${+user1_balance_before + +user1_expected_claim} but instead had ${user1_balance_after}`
  )

  let user2_balance_after = await queryBalance(client_info.user2, client_info.main.codeHash, client_info.main.address);
  assert(
    user2_balance_after == (+user2_balance_before + +user2_expected_claim),
    `expected user2 to have balance ${+user2_balance_before + +user2_expected_claim} but instead had ${user2_balance_after}`
  )
}

async function test_use_other_user_pet_for_battle(
  client_info: ClientInfo
) {
  // user3s pet, but user1 is battling
  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0].pet_id

  // quest for user3
  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let wager = 1

  let txList = await battlePet(client_info.user1, pet_id3, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  assert(
    txList[1].code !== 0,
    `Expected accepting a battle that is not for you to fail, but it didnt`
  );
}

async function test_accept_other_user_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  // quest for user3
  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0].pet_id

  let wager = 1

  await battlePet(client_info.user1, pet_id1, pet_id3, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_before: Battle = battles.find((battle: Battle) => battle.wager == wager.toString()) != undefined ?
    battles.find((battle: Battle) => battle.wager == wager.toString())! : battles[0]

  let txList = await acceptBattlePet(client_info.user2, battle_before.id, wager.toString(), client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  assert(
    txList[1].code !== 0,
    `Expected accepting a battle that is not for you to fail, but it didnt`
  );
}

async function test_decline_other_user_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  // quest for user3
  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0].pet_id

  let wager = 1

  // battle for user3
  await battlePet(client_info.user1, pet_id1, pet_id3, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_before: Battle = battles.find((battle: Battle) => battle.wager == wager.toString()) != undefined ?
    battles.find((battle: Battle) => battle.wager == wager.toString())! : battles[0]

  // user2 declines
  let tx = await declineBattle(client_info.user2, battle_before.id,
    client_info.main.codeHash, client_info.main.address)

  assert(
    tx.code !== 0,
    `Expected declining a battle that is not for you to fail, but it didnt`
  );
}

async function test_cancel_other_user_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  // quest for user3
  let pets3: Pet[] = await queryPets(client_info.user3, client_info.main.codeHash, client_info.main.address)
  let pet_id3 = pets3[0].pet_id

  let wager = 1

  // battle for user3
  await battlePet(client_info.user1, pet_id1, pet_id3, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_before: Battle = battles.find((battle: Battle) => battle.wager == wager.toString()) != undefined ?
    battles.find((battle: Battle) => battle.wager == wager.toString())! : battles[0]

  // user3 cancels when user1 made the battle
  let tx = await cancelBattle(client_info.user3, battle_before.id,
    client_info.main.codeHash, client_info.main.address)

  assert(
    tx.code !== 0,
    `Expected cancelling a battle that you did not make to fail, but it didnt`
  );
}

async function test_use_other_pet_for_quest(
  client_info: ClientInfo
) {
  // user1s pet
  let pets: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id = pets[0].pet_id

  // user2 quest
  let quests: Quest[] = await queryQuests(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let quest_type = quests[0].quest_type

  // user2 starts quest with user1 pet
  let tx = await questPet(client_info.user2, pet_id, quest_type, client_info.main.codeHash, client_info.main.address)
  assert(
    tx.code !== 0,
    `Expected quest with other user's pet to fail but it didnt`
  );
}

async function test_claim_other_user_battle(
  client_info: ClientInfo
) {
  let pets1: Pet[] = await queryPets(client_info.user1, client_info.main.codeHash, client_info.main.address)
  let pet_id1 = pets1[0].pet_id

  let pets2: Pet[] = await queryPets(client_info.user2, client_info.main.codeHash, client_info.main.address)
  let pet_id2 = pets2[0].pet_id

  let wager = 7

  await battlePet(client_info.user1, pet_id1, pet_id2, wager, client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let battles = await queryBattles(client_info.user1, client_info.main.codeHash, client_info.main.address);
  let battle_before: Battle = battles.find((battle: Battle) => battle.wager == wager.toString()) != undefined ?
    battles.find((battle: Battle) => battle.wager == wager.toString())! : battles[0]

  await acceptBattlePet(client_info.user2, battle_before.id, wager.toString(), client_info.main.codeHash,
    client_info.main.address, client_info.loot.codeHash, client_info.loot.address)

  let tx1 = await claimBattle(client_info.user3, battle_before.id, pet_id1, client_info.main.codeHash, client_info.main.address)
  let tx2 = await claimBattle(client_info.user3, battle_before.id, pet_id2, client_info.main.codeHash, client_info.main.address)

  assert(
    tx1.code !== 0,
    `Expected claiming user1's battle to fail, but it didn't`
  );
  assert(
    tx2.code !== 0,
    `Expected claiming user2's battle to fail, but it didn't`
  );
}

async function runTestFunction(
  tester: (
    clientInfo: ClientInfo
  ) => void,
  clientInfo: ClientInfo
) {
  console.log(`Testing ${tester.name}`);
  await tester(clientInfo);
  console.log(`[SUCCESS] ${tester.name}`);
}

(async () => {
  const clientInfo: ClientInfo =
    await initializeAndUploadContract();

  // BLUE SKY (MOSTLY)

  // mint pet and check we have a pet
  await runTestFunction(
    test_mint_pet,
    clientInfo
  )

  // release pet and check we dont have that pet
  await runTestFunction(
    test_release_pet,
    clientInfo
  )

  // start quest
  await runTestFunction(
    test_start_quest,
    clientInfo
  )

  // check that quest cannot be run when in progress
  await runTestFunction(
    test_quest_cannot_be_run_when_in_progress,
    clientInfo
  )

  // check that pet cannot be used when in a quest
  await runTestFunction(
    test_pet_cannot_be_used_when_in_a_quest,
    clientInfo
  )

  // collect loot from quest and check ltk balance
  await runTestFunction(
    test_collect_quest,
    clientInfo
  )

  // check quest history
  await runTestFunction(
    test_quest_in_history,
    clientInfo
  )

  // upgrade pet
  await runTestFunction(
    test_upgrade_pet,
    clientInfo
  )

  await runTestFunction(
    test_upgrade_pet_without_funds,
    clientInfo
  )

  // battle pet and check that we lose loot tokens and battle appears for other user
  await runTestFunction(
    test_battle_pet,
    clientInfo
  )

  // battle with insufficient funds for the wager
  await runTestFunction(
    test_battle_pet_without_funds,
    clientInfo
  )

  // accept battle and check that we lose loot tokens
  await runTestFunction(
    test_accept_battle,
    clientInfo
  )

  // accept battle with insufficient funds for the wager
  await runTestFunction(
    test_accept_battle_with_insufficient_funds,
    clientInfo
  )

  // decline battle and check that initiator gains back the wager
  await runTestFunction(
    test_decline_battle,
    clientInfo
  )

  // cancel and check that initiator gains back the wager
  await runTestFunction(
    test_cancel_battle,
    clientInfo
  )

  // collect loot from battle (win or lose) and check that winner gains double the wager, loser gains nothing
  await runTestFunction(
    test_collect_battle,
    clientInfo
  )

  // invalid ownership test cases
  await runTestFunction(
    test_use_other_pet_for_quest,
    clientInfo
  )

  await runTestFunction(
    test_use_other_user_pet_for_battle,
    clientInfo
  )

  await runTestFunction(
    test_accept_other_user_battle,
    clientInfo
  )

  await runTestFunction(
    test_decline_other_user_battle,
    clientInfo
  )

  await runTestFunction(
    test_cancel_other_user_battle,
    clientInfo
  )

  await runTestFunction(
    test_claim_other_user_battle,
    clientInfo
  )
})();
