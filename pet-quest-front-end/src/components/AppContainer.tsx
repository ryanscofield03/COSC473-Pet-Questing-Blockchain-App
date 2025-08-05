import {Box, Flex, HStack} from "@chakra-ui/react";
import SideBar from "@/src/components/SideBar";
import MainContainer from "@/src/components/MainContainer";
import {useContext, useEffect, useState} from "react";
import {ContractContext} from "@/src/contractInterface/contractContext";
import QuestHistoryContainer from "@/src/components/QuestHistoryContainer";
import BattlesContainer from "@/src/components/BattlesContainer";

const AppContainer = () => {
  const [selectedPet, setSelectedPet] = useState<string|null>(null);

  const { connectWallet } = useContext(ContractContext)!;
  useEffect(() => {
    connectWallet().then();
  });

  return (
    <Box width="100%" height="100vh" bg="gray.700" p={4}>
      <Flex
        width="100%"
        height="100%"
        gap={4}
      >
        <Box
          width="20%"
          bg="gray.200"
          flexShrink={0}
          flexGrow={0}
          borderRadius="xl"
          boxShadow="md"
          p={6}
          m={2}
        >
          <SideBar selected_pet_id={selectedPet} change_selected_pet={(new_pet_id: string) => setSelectedPet(new_pet_id)}/>
        </Box>
        <Flex flexShrink={0} flexGrow={0} height="100%" width="78%" alignItems="center" direction="column">
          <Box
            width="100%"
            height="75%"
            flexShrink={0}
            flexGrow={0}
            bg="gray.50"
            borderRadius="xl"
            boxShadow="md"
            p={6}
            m={4}
          >
            <MainContainer pet_id={selectedPet} />
          </Box>
          <HStack height="22%" width="100%">
            <Box
              width="50%"
              height="95%"
              bg="gray.100"
              borderRadius="xl"
              boxShadow="md"
              p={2}
              m={2}
            >
              <QuestHistoryContainer />
            </Box>
            <Box
              width="50%"
              height="95%"
              bg="gray.100"
              borderRadius="xl"
              boxShadow="md"
              p={2}
              m={2}
            >
              <BattlesContainer />
            </Box>
          </HStack>
        </Flex>
      </Flex>
    </Box>
  )
}

export default AppContainer