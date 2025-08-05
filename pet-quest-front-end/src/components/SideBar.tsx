// This is the entire sidebar which holds pets in a scrollable box, and has a mint new pet button at the bottom

import PetComponent from "@/src/components/PetContainer";
import {Box, Button, Flex, HStack, Text, useToast} from "@chakra-ui/react";

import {ContractFunctions, Pet} from "@/src/contractInterface/contractFunctions";
import React, {useEffect, useRef, useState} from "react";
import PetBattleContainer from "@/src/components/PetBattleContainer";

type PetSideBarProps = {
  selected_pet_id: string|null,
  change_selected_pet: Function
};

const SideBar = (props: PetSideBarProps) => {
  const {
    queryPetInfo,
    queryAllPets,
    executeMintPet,
  } = ContractFunctions();
  const toast = useToast();
  const [page, setPage] = useState<String>("Pets")
  const [pets, setPets] = useState<Pet[]>([]);
  const [allPets, setAllPets] = useState<string[]>([]);
  const [notOurPets, setNotOurPets] = useState<string[]>([]);

  const { selected_pet_id, change_selected_pet } = props;
  const latestQueryPetsRef = useRef(queryPetInfo);
  const latestQueryAllPetsRef = useRef(queryAllPets);

  useEffect(() => {
    latestQueryPetsRef.current = queryPetInfo;
  }, [queryPetInfo]);

  useEffect(() => {
    latestQueryAllPetsRef.current = queryAllPets;
  }, [queryAllPets]);

  useEffect(() => {
    const interval = setInterval(() => {
      handle(latestQueryPetsRef.current).then();
      handle(latestQueryAllPetsRef.current).then();
    }, 5_000);

    return () => clearInterval(interval);
  }, []);

  const handle = async (fn: () => Promise<any>) => {
    try {
      const res = await fn();
      if (res !== undefined) {
        if ("pets" in res) {
          setPets(res.pets.pets);
        }
        if ("token_list" in res) {
          setAllPets(res.token_list.tokens);
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

  useEffect(() => {
    if (allPets.length) {
      const ourPetIds = new Set(pets.map(({ pet_id }) => pet_id.toString()));
      setNotOurPets(allPets.filter(id => !ourPetIds.has(id.toString())));
    }
  }, [pets, allPets]);


  const renderPetItems= () => {
    return pets.map((pet) => (
      <PetComponent key={pet.pet_id.toString()} pet_id={pet.pet_id} clickable={true}
                    onClick={() => change_selected_pet(pet.pet_id)}></PetComponent>
    ));
  }

  const renderOtherPetItems = () => {
    return notOurPets.map((pet_id) => (
      <PetBattleContainer key={pet_id.toString()} selected_pet_id={selected_pet_id} pet_id={pet_id} />
    ));
  }

  return (
    <Flex height="100%" direction="column" gap={4}>
      <HStack height="5%" width="100%">
        <Button
          width="50%"
          variant="contained"
          bg={page == "Pets" ? "gray.700" : "gray.400"}
          color="white"
          onClick={() => setPage("Pets")}
        >
          Pets
        </Button>
        <Button
          width="50%"
          variant="contained"
          bg={page == "Battle" ? "gray.700" : "gray.400"}
          color="white"
          onClick={() => setPage("Battle")}
        >
          Battle
        </Button>
      </HStack>
      { page == "Pets" ?
        <Box height="95%" width="100%" gap={2}>
          <Box height="95%" bg="gray.300" p={7} borderRadius={8} overflowY="auto">
            <Flex direction="column" width="100%">
              {pets.length == 0 ? (
                <Flex h="100%" w="100%" align="center" justify="center">
                  <Text fontSize="md" color="gray.500">Mint a pet to view it here</Text>
                </Flex>
              ) : renderPetItems()
              }
            </Flex>
          </Box>
          <Button
            variant="contained"
            bg="gray.700"
            color="white"
            width="100%"
            height="5%"
            borderRadius={8}
            onClick={executeMintPet}
          >
            Mint a New Pet
          </Button>
        </Box>
        :
        <Box height="95%" width="100%" gap={2}>
          <Box height="100%" bg="gray.300" p={7} borderRadius={8} overflowY="auto">
            <Flex direction="column" width="100%">
              {renderOtherPetItems()}
            </Flex>
          </Box>
        </Box>
      }
    </Flex>
  )
}

export default SideBar;