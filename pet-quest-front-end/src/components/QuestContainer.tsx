// Container for displaying the quest name, image, and status (e.g. waiting to be claimed, availability, in use etc)

import {
  Button,
  Card,
  CardBody,
  Text,
  Flex,
  Tooltip,
  Badge,
  HStack,
} from "@chakra-ui/react";
import {CheckIcon, LockIcon, StarIcon, TimeIcon} from "@chakra-ui/icons";
import React from "react";
import {CoinIcon} from "@/src/icons/CoinIcon";
import {ContractFunctions} from "@/src/contractInterface/contractFunctions";
import {formatNanoseconds} from "@/src/logic/format";

type Status = "claimable" | "in_progress" | "available" | "on_cooldown";

type QuestProps = {
  pet_id: string|undefined,
  quest_name: string,
  available_loot_fail: number,
  available_loot_pass: number,
  available_loot_exceptional: number,
  status: string,
  finishes_adventure?: number,
  finishes_cooldown?: number,
  claimable_outcome?: string
};

const QuestContainer = (props: QuestProps) => {
  const {
    pet_id,
    quest_name,
    available_loot_fail,
    available_loot_pass,
    available_loot_exceptional,
    finishes_adventure,
    finishes_cooldown,
    claimable_outcome,
    status
  } = props;

  const {
    executeStartQuest,
    executeClaimQuest
  } = ContractFunctions();

  const colors = {
    "claimable": "green.300",
    "in_progress": "yellow.300",
    "available": "blue.300",
    "on_cooldown": "red.300"
  };

  const renderActionButton = () => {
    switch (status) {
      case "claimable":
        return (
          <Button
            w="100%"
            size="sm"
            colorScheme="green"
            onClick={() => executeClaimQuest(quest_name)}
            leftIcon={<CheckIcon />}
          >
            Claim Loot
          </Button>
        );
      case "available":
        return (
          <Button
            w="100%"
            size="sm"
            colorScheme="blue"
            onClick={() => executeStartQuest(pet_id, quest_name)}
            leftIcon={<StarIcon />}
          >
            Start Quest
          </Button>
        );
      case "in_progress":
        return (
          <Tooltip label={`Your pet is on this quest until ${formatNanoseconds(finishes_adventure)}`}>
            <Button w="100%" size="sm" colorScheme="yellow" isDisabled leftIcon={<TimeIcon />}>
              In Progress
            </Button>
          </Tooltip>
        );
      case "on_cooldown":
        return (
          <Tooltip label={`This quest is on cooldown until ${formatNanoseconds(finishes_cooldown)}`}>
            <Button w="100%" size="sm" colorScheme="red" isDisabled leftIcon={<LockIcon />}>
              On Cooldown
            </Button>
          </Tooltip>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      height={150}
      w="22%"
      variant="outline"
      boxShadow="sm"
      borderRadius="lg"
      overflow="hidden"
      borderColor={colors[status as Status] ?? "gray.300"}
    >
      <CardBody p={4} height="100%">
        <Flex height="100%">
          <Flex flex="1" direction="column" gap={2} alignItems="flex-start">
            <Flex direction="row" justifyContent="space-between" alignItems="top" width="100%" gap={2}>
              <Text fontWeight="bold" fontSize="md">{quest_name}</Text>
            </Flex>
            <HStack w="100%" justifyContent="space-between">
              <Badge borderRadius="md" px={2} py={1} height="fit-content"
                     bg={claimable_outcome == "Fail" ? "gold" : "gray.100"}>
                <Flex direction="row" alignItems="center" gap={1}>
                  <CoinIcon boxSize="7" color="brand.900" />
                  <Text fontSize="sm" color="brand.900">
                    {available_loot_fail}
                  </Text>
                </Flex>
              </Badge>
              <Badge borderRadius="md" px={2} py={1} height="fit-content"
                     bg={claimable_outcome == "Pass" ? "gold" : "gray.100"}>
                <Flex direction="row" alignItems="center" gap={1}>
                  <CoinIcon boxSize="7" color="brand.900" />
                  <Text fontSize="sm" color="brand.900">
                    {available_loot_pass}
                  </Text>
                </Flex>
              </Badge>
              <Badge borderRadius="md" px={2} py={1} height="fit-content"
                     bg={claimable_outcome == "Exceptional Pass" ? "gold" : "gray.100"}>
                <Flex direction="row" alignItems="center" gap={1}>
                  <CoinIcon boxSize="7" color="brand.900" />
                  <Text fontSize="sm" color="brand.900">
                    {available_loot_exceptional}
                  </Text>
                </Flex>
              </Badge>
            </HStack>
            <Flex w="100%" h="100%" alignItems="flex-end">
              {renderActionButton()}
            </Flex>
          </Flex>
        </Flex>
      </CardBody>
    </Card>
  );
};

export default QuestContainer;