// Container for a pet, will likely just be a box with an image or colour and some border, with a delete button for
// burning pets we no longer want. Make sure to double-check with the user before burning

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
  Text,
  Tooltip,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import {DeleteIcon, useDisclosure, WarningIcon} from "@chakra-ui/icons";
import React, {useState} from "react";
import { getPetColor, getPetPattern } from "@/src/logic/pet_style"
import {ContractFunctions} from "@/src/contractInterface/contractFunctions";

type PetProps = {
  pet_id: string;
  onClick: Function;
  clickable: Boolean;
};

const PetContainer = (props: PetProps) => {
  const {
    executeReleasePet
  } = ContractFunctions();

  const { pet_id, onClick, clickable } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const releasePetToast = useToast();
  const [releasingPet, setReleasingPet] = useState(false);

  const backgroundColor = getPetColor(pet_id);
  const backgroundPattern = getPetPattern(pet_id);

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBorderColor = useColorModeValue("blue.300", "blue.500");
  const textColor = useColorModeValue("gray.800", "white");

  const handleReleasingPet = async () => {
    setReleasingPet(true);

    const success = await executeReleasePet(pet_id);

    setTimeout(() => {
      setReleasingPet(false);
      onClose();

      if (success) {
        releasePetToast({
          title: "Pet released",
          description: `Pet #${pet_id} has been released.`,
          status: "success",
          duration: 3000,
          position: "bottom-right",
          isClosable: true,
        });
      } else {
        releasePetToast({
          title: "Pet releasing error",
          description: "Failed to release pet. Please try again.",
          status: "error",
          duration: 3000,
          position: "bottom-right",
          isClosable: true,
        });
      }
    }, 1000);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <>
      <Card
        aspectRatio={1}
        width="100%"
        mb={6}
        position="relative"
        cursor={clickable ? "pointer" : "default"}
        transition="all 0.1s"
        borderWidth="2px"
        borderColor={borderColor}
        _hover={clickable ? {
          transform: "translateY(-2px)",
          boxShadow: "lg",
          borderColor: hoverBorderColor
        } : {}}
        onClick={() => {
          if (clickable) { onClick(pet_id) }
        }}
      >
        {clickable && (
          <Tooltip label="Release Pet" hasArrow placement="top">
            <IconButton
              aria-label="Release pet"
              icon={<DeleteIcon />}
              size="xl"
              position="absolute"
              top={3}
              right={3}
              colorScheme="red"
              variant="ghost"
              onClick={handleDeleteClick}
              zIndex={999}
            />
          </Tooltip>
        )}

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
            <WarningIcon color="red.500" mr={2} />
            Confirm Releasing Pet
          </ModalHeader>
          <ModalBody>
            Are you sure you want to release #{pet_id}?
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onClose} isDisabled={releasingPet}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleReleasingPet}
              isLoading={releasingPet}
              loadingText="Releasing"
            >
              Yes, release pet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PetContainer;