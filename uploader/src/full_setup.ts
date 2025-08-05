import {SecretNetworkClient, Wallet} from 'secretjs';
import * as dotenv from 'dotenv';
import {randomBytes} from 'node:crypto';
import * as fs from 'node:fs';

dotenv.config();  // Load environment variables from .env file
const mnemonic = process.env.MNEMONIC;  // Retrieve the mnemonic

const wallet = new Wallet(mnemonic);

// create a new client for the Pulsar testnet
const secretjs = new SecretNetworkClient({
  chainId: 'pulsar-3',
  url: 'https://pulsar.lcd.secretnodes.com',
  wallet: wallet,
  walletAddress: wallet.address,
});

const uploadContract = async (contract_wasm: Buffer): Promise<{code_id: string, code_hash?: string}> => {
  const tx = await secretjs.tx.compute.storeCode(
    {
      sender: wallet.address,
      wasm_byte_code: contract_wasm,
      source: '',
      builder: '',
    },
    {
      gasLimit: 4_000_000,
    });

  //@ts-ignore
  const codeId = tx.arrayLog?.find((log) =>
    log.type === 'message' && log.key === 'code_id').value;

  const contractCodeHash = (
    await secretjs.query.compute.codeHashByCodeId({ code_id: codeId })
  ).code_hash;
  return {
    code_id: codeId,
    code_hash: contractCodeHash,
  };
};

const instantiateLoot20Contract = async (codeId: string, contractCodeHash: string): Promise<string> => {
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
    admin: wallet.address,
    initial_balances: [
      {
        address: wallet.address,
        amount: '100', // if you want to give yourself starting tokens, change this :)
      },
    ],
    supported_denoms: ['uscrt']
  };

  const tx = await secretjs.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: wallet.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      admin: wallet.address,
      label: 'loot_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (tx.code !== 0) {
    console.log('Instantiation failed: ', tx.rawLog);
  }

  //@ts-ignore
  return tx.arrayLog?.find((log) =>
    log.type === 'message' && log.key === 'contract_address').value;
};

const instantiatePet721Contract = async (codeId: string, contractCodeHash: string): Promise<string> => {
  // The instantiate message is empty in this example.
  // We could also send an `admin` address if we wanted to.

  const initMsg = {
    name: 'PetToken',
    symbol: 'PET',
    entropy: randomBytes(32).toString('base64'),
    admin: wallet.address,
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

  const tx = await secretjs.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: wallet.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      admin: wallet.address,
      label: 'pet_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (tx.code !== 0) {
    console.log('Instantiation failed: ', tx.rawLog);
  }

  //@ts-ignore
  return tx.arrayLog?.find((log) =>
    log.type === 'message' && log.key === 'contract_address').value;
};

const instantiateMainContract = async (
  lootHash: string,
  lootAddr: string,
  petHash: string,
  petAddr: string,
  codeId: string,
  contractCodeHash: string
): Promise<string> => {
  const initMsg = {
    admin: wallet.address,
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

  const tx = await secretjs.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: wallet.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      admin: wallet.address,
      label: 'game_contract' + Math.ceil(Math.random() * 10000000),
    },
    {
      gasLimit: 400_000,
    }
  );

  if (tx.code !== 0) {
    console.log('Instantiation failed: ', tx.rawLog);
  }

  //@ts-ignore
  return tx.arrayLog?.find((log) =>
    log.type === 'message' && log.key === 'contract_address').value;
};

const addMinters = async (contractAddress: string, codeHash: string, minters: string[]) => {
  const msg = {
    add_minters: {
      minters,
      padding: null,
    },
  };

  const tx = await secretjs.tx.compute.executeContract(
    {
      sender: wallet.address,
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

const changeAdmin = async (contractAddress: string, codeHash: string, newAdmin: string) => {
  const msg = {
    change_admin: {
      address: newAdmin,
      padding: null,
    },
  };

  const tx = await secretjs.tx.compute.executeContract(
    {
      sender: wallet.address,
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

export const main = async (): Promise<void> => {
  const loot20_upload = await uploadContract(fs.readFileSync('./../loot20/contract.wasm.gz'));
  console.log('loot20...');
  console.log('codeId: ', loot20_upload.code_id, 'hash: ', loot20_upload.code_hash);
  const loot_20_addr = await instantiateLoot20Contract(loot20_upload.code_id, loot20_upload.code_hash);
  console.log('addr: ', loot_20_addr);

  const pet721_upload = await uploadContract(fs.readFileSync('./../pet721/contract.wasm.gz'));
  console.log('pet721...');
  console.log('codeId: ', pet721_upload.code_id, 'hash: ', pet721_upload.code_hash);
  const pet721_addr = await instantiatePet721Contract(pet721_upload.code_id, pet721_upload.code_hash);
  console.log('addr: ', pet721_addr);

  const main_upload = await uploadContract(fs.readFileSync('./../pet-quest-contract/contract.wasm.gz'));
  console.log('main...');
  console.log('codeId: ', main_upload.code_id, 'hash: ', main_upload.code_hash);
  const main_addr = await instantiateMainContract(
    loot20_upload.code_hash,
    loot_20_addr,
    pet721_upload.code_hash,
    pet721_addr,
    main_upload.code_id,
    main_upload.code_hash
  );
  console.log('addr: ', main_addr);

  console.log('adding loot minters...');
  await addMinters(loot_20_addr, loot20_upload.code_hash, [main_addr]);
  console.log('adding pet minters...');
  await addMinters(pet721_addr, pet721_upload.code_hash, [main_addr]);

  console.log('changing loot admin...');
  await changeAdmin(loot_20_addr, loot20_upload.code_hash, main_addr);
  console.log('changing pet admin...');
  await changeAdmin(pet721_addr, pet721_upload.code_hash, main_addr);

  console.log('SETUP!');
};

main().catch((err) => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});
