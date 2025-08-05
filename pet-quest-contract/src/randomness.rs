use cosmwasm_std::Addr;
use sha2::{Digest, Sha256};

pub fn generate_seed(sender: &Addr, block_time: u64, entropy: &[u8]) -> u64 {
    let mut hasher = Sha256::new();
    hasher.update(sender.as_bytes());
    hasher.update(&block_time.to_be_bytes());
    hasher.update(entropy);
    let hash = hasher.finalize();
    u64::from_be_bytes(hash[0..8].try_into().unwrap())
}