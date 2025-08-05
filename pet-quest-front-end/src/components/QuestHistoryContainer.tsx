import {ContractFunctions, Pet, Quest, QuestHistory} from "@/src/contractInterface/contractFunctions";
import React, {useEffect, useRef, useState} from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Text, useToast,
  VStack
} from "@chakra-ui/react";
import {formatNanoseconds} from "@/src/logic/format";
import {CoinIcon} from "@/src/icons/CoinIcon";
import {getPetColor, getPetPattern, isColorDark} from "@/src/logic/pet_style";

const QuestHistoryContainer = () => {
  const {
    queryQuestHistoryInfo
  } = ContractFunctions();

  const toast = useToast();
  const [questHistory, setQuestHistory] = useState<QuestHistory[]>([]);

  const latestQueryQuestHistoryRef = useRef(queryQuestHistoryInfo);

  useEffect(() => {
    latestQueryQuestHistoryRef.current = queryQuestHistoryInfo;
  }, [queryQuestHistoryInfo]);

  useEffect(() => {
    const interval = setInterval(() => {
      handle(latestQueryQuestHistoryRef.current).then();
    }, 5_000);

    return () => clearInterval(interval);
  }, []);

  const handle = async (fn: () => Promise<any>) => {
    try {
      const res = await fn();
      if (res !== undefined) {
        console.log("quest history: ", res.history.quest_history)
        setQuestHistory(res.history.quest_history);
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

  const getOutcomeBgColour = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'fail':
        return 'red.300';
      case 'pass':
        return 'green.200';
      case 'exceptional pass':
        return 'green.400';
      default:
        return 'gray.300';
    }
  };

  const renderQuestHistoryItems = () => {
    return questHistory.sort((a, b) => b.time_ended - a.time_ended).map(item => (
      <Card
        key={`${item.pet_id}-${item.time_started}`}
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
            <Heading size="sm">{item.quest_type}</Heading>
            <Badge bg="gold" borderRadius="md" px={2} py={1}>
              <HStack spacing={1}>
                <CoinIcon boxSize={5} />
                <Text fontSize="xs" fontWeight="semibold">
                  {item.loot_collected}
                </Text>
              </HStack>
            </Badge>
          </Flex>
        </CardHeader>

        <CardBody p={2}>
          <HStack
            gap={3}
            mb={2}
            alignItems="center"
            justifyContent="center"
            width="100%"
          >
            <Badge bg={getPetColor(item.pet_id)} backgroundImage={getPetPattern(item.pet_id)}
                   color="theme.900" borderRadius="md" px={2} py={1}>
              <Text color={isColorDark(getPetColor(item.pet_id)) ? "gray.50" : "gray.800"} fontSize="xs" fontWeight="medium">
                #{item.pet_id}
              </Text>
            </Badge>
            <Badge bg={getOutcomeBgColour(item.outcome)} color="theme.900" borderRadius="md" px={2} py={1}>
              <Text fontSize="xs" fontWeight="medium">
                {item.outcome}
              </Text>
            </Badge>
          </HStack>

          <VStack gap={1} mb={1}>
            <Flex direction="row" alignItems="center" gap={2}>
              <Text fontSize="xs" color="gray.500">
                Started
              </Text>
              <Text fontSize="sm">
                {formatNanoseconds(item.time_started)}
              </Text>
            </Flex>
            <Flex direction="row" alignItems="center" gap={2}>
              <Text fontSize="xs" color="gray.500">
                Ended
              </Text>
              <Text fontSize="sm">
                {formatNanoseconds(item.time_ended)}
              </Text>
            </Flex>
          </VStack>
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
      {questHistory.length == 0 ? (
          <Flex h="100%" w="100%" align="center" justify="center">
            <Text fontSize="lg" color="gray.500">Complete a quest to view it here</Text>
          </Flex>
        ) : renderQuestHistoryItems()
      }
    </HStack>
  );
}

export default QuestHistoryContainer