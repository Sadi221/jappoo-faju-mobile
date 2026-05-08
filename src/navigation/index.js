import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as SecureStore from 'expo-secure-store';
import {
  getStoredUser,
  isBiometricEnabled,
  authenticateWithBiometrics,
} from '../utils/auth';
import api from '../services/api';
import OnboardingScreen    from '../screens/OnboardingScreen';
import HomeScreen          from '../screens/HomeScreen';
import RequestDetailScreen from '../screens/RequestDetailScreen';
import AuthScreen          from '../screens/AuthScreen';
import DonorDashboard      from '../screens/DonorDashboard';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1B6B45',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { borderTopColor: '#E8F0FE' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏥</Text> }}
      />
      <Tab.Screen
        name="Compte"
        component={DonorDashboard}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem('onboarding_done');
        if (!onboardingDone) {
          setInitialRoute('Onboarding');
          return;
        }

        // Biométrie : si activée et refresh_token présent → challenge
        const bioEnabled = await isBiometricEnabled();
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (bioEnabled && refreshToken) {
          const { success } = await authenticateWithBiometrics();
          if (success) {
            try {
              const resp = await api.post('/auth/refresh', { refresh_token: refreshToken });
              await SecureStore.setItemAsync('token', resp.data.access_token);
              await SecureStore.setItemAsync('refresh_token', resp.data.refresh_token);
              setInitialRoute('Main');
              return;
            } catch {
              // Refresh échoué (token révoqué etc.) → login classique
            }
          }
          setInitialRoute('Auth');
          return;
        }

        const user = await getStoredUser();
        setInitialRoute(user ? 'Main' : 'Auth');
      } catch {
        setInitialRoute('Auth');
      }
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1B6B45' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2 }}>JAPPOO FAJU</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding"    component={OnboardingScreen} />
        <Stack.Screen name="Auth"          component={AuthScreen} />
        <Stack.Screen name="Main"          component={MainTabs} />
        <Stack.Screen
          name="RequestDetail"
          component={RequestDetailScreen}
          options={{
            headerShown: true,
            headerTitle: 'Détail du cas',
            headerBackTitle: 'Retour',
            headerTintColor: '#1B6B45',
            headerStyle: { backgroundColor: '#fff' },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
