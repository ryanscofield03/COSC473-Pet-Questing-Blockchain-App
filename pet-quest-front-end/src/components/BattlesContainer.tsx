import {Battle, ContractFunctions, Pet} from "@/src/contractInterface/contractFunctions";
import React, {useEffect, useRef, useState} from "react";
import {
  Badge, Button,
  Card,
  CardBody, CardHeader,
  Flex, Heading,
  HStack, Spacer,
  Text, useToast,
} from "@chakra-ui/react";
import {getPetColor, getPetPattern, isColorDark} from "@/src/logic/pet_style";
import {CoinIcon} from "@/src/icons/CoinIcon";
import isEqual from "rc-util/es/isEqual";

const BattlesContainer = () => {
  const {
    queryBattleInfo,
    queryPetInfo,
    executeCancelBattle,
    executeDeclineBattle,
    executeAcceptBattle,
    executeClaimBattle
  } = ContractFunctions();

  const toast = useToast();
  const [unprocessedBattles, setUnprocessedBattles] = useState<Battle[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  const latestQueryBattleInfoRef = useRef(queryBattleInfo);
  const latestQueryPetsRef = useRef(queryPetInfo);

  useEffect(() => {
    latestQueryPetsRef.current = queryPetInfo;
    latestQueryBattleInfoRef.current = queryBattleInfo;
  }, [queryPetInfo, queryBattleInfo]);

  const fetchPets = async () => {
    try {
      const res = await latestQueryPetsRef.current();
      // @ts-ignore
      if (res?.pets?.pets && !isEqual(res.pets.pets, pets)) {
        // @ts-ignore
        setPets(res.pets.pets);
      }
    } catch (err: any) {
      toast({
        title: "Pet query error!",
        description: err.message?.replace("Generic error:", ""),
        status: "warning",
        isClosable: true,
        position: "bottom-right",
      });
    }
  };

  const fetchBattles = async () => {
    try {
      const res = await latestQueryBattleInfoRef.current();
      // @ts-ignore
      if (res?.battles?.battles && !isEqual(res.battles.battles, unprocessedBattles)) {
        // @ts-ignore
        setUnprocessedBattles(res.battles.battles);
      }
    } catch (err: any) {
      toast({
        title: "Battle query error!",
        description: err.message?.replace("Generic error:", ""),
        status: "warning",
        isClosable: true,
        position: "bottom-right",
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([fetchPets(), fetchBattles()]).catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (unprocessedBattles.length === 0 || pets.length === 0) return;

    const updatedBattles = unprocessedBattles.map((battle) => {
      let outcome = "unknown";

      if (battle.outcome !== undefined) {
        const isWin = battle.outcome;
        const owned = pets.some((pet) =>
          pet.pet_id === (isWin ? battle.pet_id : battle.other_pet_id)
        );
        outcome = owned ? "win" : "loss";
      }

      return { ...battle, outcome };
    });

    if (!isEqual(battles, updatedBattles)) {
      setBattles(updatedBattles);
    }
  }, [pets, unprocessedBattles]);

  const getOutcomeBgColour = (outcome: string | undefined) => {
    switch (outcome?.toLowerCase()) {
      case 'loss':
        return 'red.300';
      case 'win':
        return 'green.400';
      default:
        return 'gray.300';
    }
  };

  const renderBattleItems = () => {
    return battles.map(item => (
      <Card
        key={`${item.id}`}
        bg="gray.50"
        borderColor="gray.300"
        borderWidth={1}
        borderRadius="lg"
        boxShadow="sm"
        flexShrink={0}
        width="43%"
        _hover={{ boxShadow: 'md' }}
      >
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="sm">Battle #{item.id}</Heading>
            <Badge bg="gold" borderRadius="md" px={2} py={1}>
              <HStack spacing={1}>
                <Text fontSize="xs" fontWeight="semibold">Wager:</Text>
                <CoinIcon boxSize={5} />
                <Text fontSize="xs" fontWeight="semibold">{item.wager}</Text>
              </HStack>
            </Badge>
          </Flex>
        </CardHeader>
        <CardBody p={2} as={Flex} direction="column">
          <HStack
            gap={2}
            mb={4}
            align="center"
            justifyContent="center"
            width="100%"
          >
            <Badge
              bg={getPetColor(item.pet_id)}
              backgroundImage={getPetPattern(item.pet_id)}
              color="theme.900"
              borderRadius="md"
              px={1}
              py={1}
            >
              <Text
                color={isColorDark(getPetColor(item.pet_id)) ? "gray.50" : "gray.800"}
                fontSize="xs"
                fontWeight="medium"
              >
                #{item.pet_id}
              </Text>
            </Badge>
            <Text fontSize="xs" color="gray.500">vs</Text>
            <Badge
              bg={getPetColor(item.other_pet_id)}
              backgroundImage={getPetPattern(item.other_pet_id)}
              color="theme.900"
              borderRadius="md"
              px={1}
              py={1}
            >
              <Text
                color={isColorDark(getPetColor(item.other_pet_id)) ? "gray.50" : "gray.800"}
                fontSize="xs"
                fontWeight="medium"
              >
                #{item.other_pet_id}
              </Text>
            </Badge>
            {item.status === "pending" ? (
              <Badge colorScheme="red" borderRadius="md" px={1} py={1}>
                <Text fontSize="xs" fontWeight="medium">{item.status}</Text>
              </Badge>
            ) : (
              <Badge bg={getOutcomeBgColour(item.outcome)} color="theme.900" borderRadius="md" px={1} py={1}>
                <Text fontSize="xs" fontWeight="medium">{item.outcome}</Text>
              </Badge>
            )}
          </HStack>

          <Spacer />

          {item.status === "pending" ? (
            pets.some(pet => pet.pet_id === item.pet_id) ? (
              <Button w="100%" h="36px" mt={2} bg="gray.400" color="white"
                      onClick={() => executeCancelBattle(item.id)}>
                Cancel
              </Button>
            ) : (
              <Flex w="100%" gap={2} mt={2}>
                <Button w="50%" h="36px" bg="blue.500" color="white"
                        onClick={() => executeAcceptBattle(item.id, item.wager)}>
                  Accept
                </Button>
                <Button w="50%" h="36px" bg="gray.300" color="black"
                        onClick={() => executeDeclineBattle(item.id)}>
                  Decline
                </Button>
              </Flex>
            )
          ) : (
            (() => {
              const ownedPetId = pets.some(p => p.pet_id === item.pet_id) ? item.pet_id : item.other_pet_id;
              return (
                <Button w="100%" h="36px" mt={2}
                        bg={item.outcome == "win" ? "green.500" : "red.300"}
                        color="white"
                        onClick={() => executeClaimBattle(item.id, ownedPetId)}>
                  {item.outcome == "win" ? "Claim" : "Remove"}
                </Button>
              );
            })()
          )}
        </CardBody>
      </Card>
    ));
  };

  return (
    <HStack
      w="100%"
      h="100%"
      overflowX="auto"
      overflowY="hidden"
      whiteSpace="nowrap"
      spacing={4}
      align="center"
      p={2}
    >
      {battles.length == 0 ? (
          <Flex h="100%" w="100%" align="center" justify="center">
            <Text fontSize="lg" color="gray.500">Start a battle to see it here</Text>
          </Flex>
        ) : renderBattleItems()
      }
    </HStack>
  );
}

export default BattlesContainer