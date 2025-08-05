import {
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Slider, SliderFilledTrack, SliderThumb, SliderTrack,
  Text,
  Tooltip,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import {DeleteIcon, useDisclosure, WarningIcon} from "@chakra-ui/icons";
import React, {useState} from "react";
import { getPetColor, getPetPattern } from "@/src/logic/pet_style"
import {ContractFunctions} from "@/src/contractInterface/contractFunctions";
import {BalanceIcon} from "@/src/icons/BalanceIcon";
import {ClashIcon} from "@/src/icons/ClashIcon";
import {CoinIcon} from "@/src/icons/CoinIcon";

type PetProps = {
  selected_pet_id: string | null
  pet_id: string;
};

const PetBattleContainer = (props: PetProps) => {
  const {
    executeBattlePet
  } = ContractFunctions();

  const { selected_pet_id, pet_id } = props;

  const battlingPetToast = useToast();
  const [challengeAmount, setChallengeAmount] = useState(5);
  const [battlingPet, setBattlingPet] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const backgroundColor = getPetColor(pet_id);
  const backgroundPattern = getPetPattern(pet_id);
  const textColor = useColorModeValue("gray.800", "white");

  const handleBattlingPet = async () => {
    setBattlingPet(true);

    const success = await executeBattlePet(selected_pet_id!, pet_id, challengeAmount);

    setTimeout(() => {
      setBattlingPet(false);
      onClose();

      if (success) {
        battlingPetToast({
          title: "Pet challenged",
          description: `#${pet_id} has been challenged for ${challengeAmount}LTK.`,
          status: "success",
          duration: 3000,
          position: "bottom-right",
          isClosable: true,
        });
      } else {
        battlingPetToast({
          title: "Pet battle error",
          description: `Failed to challenge #${pet_id}.`,
          status: "error",
          duration: 3000,
          position: "bottom-right",
          isClosable: true,
        });
      }
    }, 1000);
  };

  const handleBattleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpen();
  };

  return (
    <>
      <Card
        aspectRatio={1}
        width="100%"
        mb={6}
        position="relative"
      >
        <Tooltip label="Wager" hasArrow placement="top">
          <IconButton
            aria-label="Wager"
            icon={<ClashIcon />}
            size="xl"
            position="absolute"
            top={3}
            right={3}
            colorScheme="red"
            variant="ghost"
            disabled={selected_pet_id == null}
            onClick={handleBattleClick}
            zIndex={999}
          />
        </Tooltip>

        <Flex
          direction="column"
          height="100%"
          width="100%"
          justify="center"
          align="center"
          bg={backgroundColor}
          backgroundImage={backgroundPattern}
          borderRadius="lg"
        >
          <Box position="absolute" bottom={3} width="100%" textAlign="center">
            <Text
              fontSize="lg"
              color={textColor}
              bg="gray.200"
              px={2}
              py={1}
              borderRadius="md"
              display="inline-block"
            >
              #{pet_id}
            </Text>
          </Box>
        </Flex>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader display="flex" alignItems="center">
            <CoinIcon mr={1}/>
            Wager
          </ModalHeader>
          <ModalBody>
            You are waging
            <Text as="span" fontWeight="bold">
              {" " + challengeAmount + "LTK "}
            </Text>
            against #{pet_id}
            <Slider aria-label='loot waged slider' value={challengeAmount} min={0} max={50} step={1} onChange={setChallengeAmount}>
              <SliderTrack h="8px" bg="gray.200" borderRadius="md">
                <SliderFilledTrack bg="gold" />
              </SliderTrack>
              <SliderThumb boxSize={6} />
            </Slider>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleBattlingPet}
            >
              Battle!
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PetBattleContainer;