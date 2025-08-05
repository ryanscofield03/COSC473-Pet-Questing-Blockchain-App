import type { NextPage } from 'next'
import {ChakraProvider, extendTheme} from '@chakra-ui/react'
import {ContractContextProvider} from "@/src/contractInterface/contractContext";
import AppContainer from "@/src/components/AppContainer";

const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    background: {
      primary: '#f8fafc',
      secondary: '#f1f5f9',
    },
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem'
  },
});

const App: NextPage = () => {
  return (
    <ContractContextProvider>
      <ChakraProvider theme={theme}>
        <AppContainer/>
      </ChakraProvider>
    </ContractContextProvider>
  )
}

export default App
