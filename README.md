# Pet Quest dApp

Pet Questing dApp using the Secret Network to create pets, quest them, upgrade them, and battle other pets.
The rest of this README contains a video demo, and then the setup and instructions for the application. 

## Demo

<img width="3246" height="1974" alt="image" src="https://github.com/user-attachments/assets/95ad1236-1646-4527-adaa-c91b4bdbcac5" />
VIDEO DEMO TODO - need to fix newly found issue with wallet

## Installation and running the application

The application has already been configured to run after cloning the repository, however, 
there are optional additional steps that we have noted in the case that you would like to reinstantiate the 
dApp and give your personal address a number of starting loot tokens. 

First, clone the git repository and change into the cloned directory:
```
    git clone https://eng-git.canterbury.ac.nz/rsc104/cosc473assignment3.git
    cd cosc473assignment3
```

If you would like to recreate the contracts, and give yourself a starting loot token balance,
you can run the following commands from the root directory. First, navigate to the uploader
folder and create an .env file, which requires MNEMONIC=your_keplr_wallet_mnemonic. Then run
the following commands from the root directory:

```
    cd uploader
    npm run setup
```

This will then output a number of different lines, we are particularly interested in each contracts'
address, as these will change when we instantiate the contract (unlike the hashes). Please copy each
contract address into the pet-quest-contract/.env file (hashes will not change unless the contracts
are changed, uploaded, and instantiated)

To  run the frontend, please navigate to the frontend folder and run the frontend with the following
commands from the root directory:
```
    cd pet-quest-front-end
    npm run build
    npm build
```

## Setting up Keplr

With the frontend running, and connected to our contract instances, we can use the application. This
section will describe how to get started with keplr.

First, you will be required to set up keplr and accept three permits. These permits are for our main,
pet, and loot contracts. These make querying data a more seamless process, but all actions which
update on-chain storage will require your explicit confirmation.

To do this, you will need to click the cog icon in the top right. If you do not have keplr set up, 
then this will not work. Please also note that clicking this icon resets your local storage, so
if you are swapping between accounts, you will be required to do this each time you swap. 

## Minting a pet

After you have set up keplr, you can mint your first pet! Our UI has a "mint a new pet" button, 
which you will find in the bottom left of the screen. Clicking this will ask you to confirm the minting of a pet
via keplr. Shortly after confirmation, you will see your newly minted pet in the sidebar. 

You may have noticed that some stats have started high, while other stats have a higher maximum. 
This is because of our pet generation randomness, which randomises each stats start and maximum 
value between ranges. The following table will show the current ranges of current and maximum stats.

| Type     | Minimum roll | Maximum roll |
|----------|--------------|--------------|
| Current  | 5            | 8            |
| Maximum  | 12           | 20           |

The maximum roll for stat maximums can be configured in the config on instantiation.

## Releasing a pet

If you aren't happy with your pet and its current rolls, you can release it. To release it, simply
press the bin icon on the pet you want to delete in the pet sidebar. This will then ask for your confirmation. After
confirming in the app, and with your keplr wallet, you will see the pet removed from your account.

## Questing your pet

Once you've minted a pet, you can click on it to bring up a stats and questing menu. For now, we
will just talk about questing to earn some loot tokens!

Each account has bound quests, these slowly become more difficult as you beat them, but with higher
difficulties comes more loot! Each type of quest also relies on one type of stat more than the others, 
except for luck, which all quests rely on equally. This is to ensure that all pets have their place 
in your lineup.

| Quest Name          | Excelling Stat Type |
|---------------------|---------------------|
| Trial of Resilience | Health              |
| Trial of Endurance  | Stamina             |
| Trial of Titans     | Strength            |
| Trial of Wisdom     | Intelligence        |

To start a quest, select a pet and then click "start quest" on one of the quests. After
confirming this with keplr, you will see that your quest is in progress. After 30 seconds, 
the quest will finish, and you can click "claim loot" to claim your rewards. This will then be
followed by a cooldown if you started the quest within the last 60 seconds. 

Each quest has three outcomes, determined by how well you do in the quest. Your pet can either 
"Exceptional Pass", "Pass", or "Fail" a quest, and each outcome has its own tier of loot.

To ensure that you can look back on your fond times questing, there is a questing history container
at the bottom of the page. This will show you history of all quests you have ever explored, the
the pet that explored them, the datetime of exploration, the outcome, and the loot earned.

## Upgrading your pet

After a few quests, your stats will no longer be good enough for exceptional passes. You
can use your acquired loot tokens to upgrade pet stats. Do this by clicking the + button next to
the stat you desire upgrading. 

## Battling your pet

Once you've conquered quests and upgraded your pet, you can wager a battle against another user's
pet. This requires you to navigate to the battle sidebar, and start a battle with another pet by
clicking the sword icon. This can only be done when you already have a pet selected. 

You will then be able to set a wager, but it must be within your total balance to work.
After this and keplr confirmations, your funds will be removed. If you change your mind before
the opponent has accepted, you can cancel a battle by clicking the cancel button, and your funds
will be restored. 

When someone invites you to a battle, this will be shown this in your battles container at the bottom
besides the quest history container. This gives users the option to accept or decline the wager. 
If you accept, the battle will commence, and you will shortly find out whether your pet won or lost. 
If your pet won, then you can claim double the wager, but if your pet lost, then you cannot claim 
anything and you will be prompted to remove the battle. If you instead decline, then the battle will be 
removed, and the wager will be returned to the battle initiator. 

## Running tests

To run the tests, run the following commands from the root directory:

```
    cd pet-quest-contract/test
    npm install
    npx ts-node integration.ts
```

Note: I used https://docs.scrt.network/secret-network-documentation/development/example-contracts/tools-and-libraries/local-secret
to setup a local secret network for tests, this means that the end points are not 
on localhost, but rather are on https://port-gitpod-link. You will have to change
the end points to be your own gitpod link or to localhost if you run it locally.
