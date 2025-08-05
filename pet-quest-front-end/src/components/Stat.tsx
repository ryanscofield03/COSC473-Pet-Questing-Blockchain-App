// Container for displaying a specific stat for a pet, it's current and max value, and an upgrade button which handles
// upgrading the pet

import {
  Box,
  Text,
  Flex,
  Heading,
  IconButton,
  Progress,
  Tooltip
} from '@chakra-ui/react'
import { AddIcon } from '@chakra-ui/icons';
import React from 'react';

type StatProps = {
  stat_type: String,
  current: number,
  max: number,
  cost: number,
  upgrade_stat: Function
};

const Stat = (props: StatProps) => {
  const { stat_type, current, max, cost, upgrade_stat } = props;
  const percentage = Math.round((current / max) * 100);

  return (
    <Flex alignItems="center" justifyContent="space-between" gap={8} width="100%" padding={4}>
      <Box width="20%">
        <Heading size="sm">{stat_type}</Heading>
        <Text fontSize="sm">{current} / {max}</Text>
      </Box>
      <Progress value={percentage} width="full" size="lg" colorScheme="teal"/>
      <Tooltip label={`Upgrade cost: ${cost}LTK`} placement="top">
        <IconButton
          aria-label="Upgrade stat"
          icon={<AddIcon />}
          size="sm"
          onClick={() => upgrade_stat()}
        />
      </Tooltip>
    </Flex>
  );
};

export default Stat;