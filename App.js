import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation';

enableScreens();

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}
