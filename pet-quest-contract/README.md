# PetContainer NFT QuestContainer Game

* Player mints a pet (NTFs)
  * PetContainer has randomised stats
  * Health, strength, stamina, intelligence, and luck 
  * They will have both a starting value for each, and a maximum value
* Each pet NFT can be sent out on quests, which will reward loot based on the specific stat, total stats 
  (specific stat will play a large, however). Luck determines whether the quest fails, passes, or exceptionally passes, 
  if it passes then you get the normal loot, if it fails you get less loot, and if it exceptionally passes you get bonus loot.
  * Quests will randomly drop loot based on the multiplier (NFTs)
  * Trial of Resilience (health)
  * Trial of Titans (strength)
  * Trial of Endurance (stamina)
  * Trial of Wisdom (intelligence)
  * The user will get one of each trial per day, each which takes 30 minutes
  * The user can force their pet on a quest at a price
* The loot can be used to upgrade stats, with a chance to fail the higher 
  that a stat is (e.g. 50 strength will have a higher chance to fail than 
  20 strength upgrade, along with a higher price)

Required queries:
* Query our pets and their data
  * PetContainer stats (current and max)
  * PetContainer quests available
  * PetContainer availability (if they are in a quest, and how long it has to go)
* Query our stored loot
* Query quest details, expected loot, chance of success, etc
* Query pet quest history (previous 10 quest types and their loot, etc)

Required executes:
* Mint a new pet
* Release an old pet
* Upgrade a pet's stats
* Send a pet on a specific quest
* Claim quest rewards
