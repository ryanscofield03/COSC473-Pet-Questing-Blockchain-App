// Entire container for the selected pet, its information, and its interaction

// display pet_id, pet box, pet stats, current loot, stats (and upgrades), and quests

import {Box, Card, Divider, Flex, IconButton, Text, HStack, useToast} from "@chakra-ui/react";
import React, {useEffect, useRef, useState} from "react";
import Stat from "@/src/components/Stat";
import PetContainer from "@/src/components/PetContainer";
import QuestContainer from "@/src/components/QuestContainer";
import {BalanceIcon} from "@/src/icons/BalanceIcon";
import {SetupIcon} from "@/src/icons/SetupIcon";
import {ContractFunctions, Quest} from "@/src/contractInterface/contractFunctions";
import { Pet } from "@/src/contractInterface/contractFunctions";


type MainContainerProps = {
  pet_id: string|null,
};

const MainContainer = (props: MainContainerProps) => {
  let { pet_id } = props;
  const {
    setUpPermits,
    queryLootInfo,
    queryQuestInfo,
    queryPetInfo,
    executePetUpgrade
  } = ContractFunctions();

  const toast = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [loot, setLoot] = useState<number>(0);
  const [quests, setQuests] = useState<Quest[]>([]);

  const latestQueryLootRef = useRef(queryLootInfo);
  const latestQueryPetsRef = useRef(queryPetInfo);
  const latestQueryQuestRef = useRef(queryQuestInfo);

  useEffect(() => {
    const foundPet = pets.find((p) => p.pet_id === pet_id);
    setPet(foundPet ?? null);
  }, [pet_id, pets]);

  useEffect(() => {
    latestQueryLootRef.current = queryLootInfo;
  }, [queryLootInfo]);

  useEffect(() => {
    latestQueryQuestRef.current = queryQuestInfo;
  }, [queryQuestInfo]);

  useEffect(() => {
    latestQueryPetsRef.current = queryPetInfo;
  }, [queryPetInfo]);

  useEffect(() => {
    const interval = setInterval(() => {
      handle(latestQueryLootRef.current).then();
      handle(latestQueryQuestRef.current).then();
      handle(latestQueryPetsRef.current).then();
    }, 5_000);

    return () => clearInterval(interval);
  }, []);

  const handle = async (fn: () => Promise<any>) => {
    try {
      const res = await fn();
      if (res !== undefined) {
        if ("balance" in res) {
          setLoot(res.balance.amount);
        }
        if ("quests" in res) {
          setQuests(res.quests.quests);
        }
        if ("pets" in res) {
          setPets(res.pets.pets);
        }
      }
    } catch (err: any) {
      toast({
        title: "Query error!",
        description: err.message?.replace("Generic error:", ""),
        status: "warning",
        isClosable: true,
        position: "bottom-right",
      });
    }
  };

  const questItems= quests.map((quest) => (
    <QuestContainer key={quest.quest_type}
                    pet_id={pet?.pet_id}
                    quest_name={quest.quest_type}
                    available_loot_fail={quest.loot?.fail ? quest.loot?.fail : 0 }
                    available_loot_pass={quest.loot?.pass ? quest.loot?.pass : 0}
                    available_loot_exceptional={quest.loot?.exceptional_pass ? quest.loot?.exceptional_pass : 0}
                    status={quest.status}
                    finishes_cooldown={quest.finished_cooldown}
                    finishes_adventure={quest.finished_exploring}
                    claimable_outcome={quest.outcome}
    />
  ));

  return (
    <Box h="100%">
      <Flex alignItems="center" justifyContent="space-between" gap={2} pb={2}>
        <HStack alignItems="center" gap={1}>
          <BalanceIcon boxSize="6" color="brand.900" />
          <Text fontSize="2xl" color="brand.900">
            {loot}LTK
          </Text>
        </HStack>
        <Box width="100%" textAlign="end">
          <IconButton
            aria-label="setup keplr"
            onClick={setUpPermits}
            bg="transparent"
            _hover={{ bg: "gray.300" }}
            icon={<SetupIcon boxSize="6" color="brand.900"/>}
          />
        </Box>
      </Flex>

      <Divider orientation="horizontal" borderWidth={1} borderColor="brand.900"/>

      <Box w="100%" h="100%">
        {pet == null ? (
          <Flex h="100%" align="center" justify="center">
            <Text fontSize="lg" color="gray.500">Select a pet to view it here</Text>
          </Flex>
        ) : (
          <Flex flexDirection="column" h="100%" p={4}>
            <Flex w="100%" h="75%" gap={10}>
              <Box w="39%">
                <PetContainer pet_id={pet.pet_id} onClick={() => {}} clickable={false}/>
              </Box>

              <Card w="64%" bg="white" boxShadow="md" p={4} height="fit-content" alignSelf="flex-start">
                <Flex pb={2} alignItems="flex-end">
                  <Box>
                    <Text fontSize="xl" color="brand.900">
                      Stats
                    </Text>
                  </Box>
                </Flex>

                <Divider orientation="horizontal" borderWidth={1} borderColor="brand.900"/>
                <Stat stat_type="Health"
                      current={pet!.current.health}
                      max={pet!.max.health}
                      cost={pet!.upgrade_costs.health}
                      upgrade_stat={() => executePetUpgrade(pet!.pet_id, "Health", pet!.upgrade_costs.health)}
                />
                <Stat stat_type="Strength"
                      current={pet!.current.strength}
                      max={pet!.max.strength}
                      cost={pet!.upgrade_costs.strength}
                      upgrade_stat={() => executePetUpgrade(pet!.pet_id, "Strength", pet!.upgrade_costs.strength)}
                />
                <Stat stat_type="Stamina"
                      current={pet!.current.stamina}
                      max={pet!.max.stamina}
                      cost={pet!.upgrade_costs.stamina}
                      upgrade_stat={() => executePetUpgrade(pet!.pet_id, "Stamina", pet!.upgrade_costs.stamina)}
                />
                <Stat stat_type="Intelligence"
                      current={pet!.current.intelligence}
                      max={pet!.max.intelligence}
                      cost={pet!.upgrade_costs.intelligence}
                      upgrade_stat={() => executePetUpgrade(pet!.pet_id, "Intelligence", pet!.upgrade_costs.intelligence)}
                />
                <Stat stat_type="Luck"
                      current={pet!.current.luck}
                      max={pet!.max.luck}
                      cost={pet!.upgrade_costs.luck}
                      upgrade_stat={() => executePetUpgrade(pet!.pet_id, "Luck", pet!.upgrade_costs.luck)}
                />
              </Card>
            </Flex>
            <Box w="100%" h="100%" alignContent="center">
              <Flex direction="row" justifyContent="space-between">
                {questItems}
              </Flex>
            </Box>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default MainContainer;