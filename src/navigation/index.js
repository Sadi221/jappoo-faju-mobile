import React, { useEffect, useState, createContext, useContext } from 'react';
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
import { registerPushToken } from '../utils/notifications';
import api from '../services/api';
import OnboardingScreen          from '../screens/OnboardingScreen';
import HomeScreen                from '../screens/HomeScreen';
import RequestDetailScreen       from '../screens/RequestDetailScreen';
import AuthScreen                from '../screens/AuthScreen';
import DonorDashboard            from '../screens/DonorDashboard';
import AgentDashboard            from '../screens/agent/AgentDashboard';
import NewMedicalRequestScreen   from '../screens/agent/NewMedicalRequestScreen';
import ValidatorDashboard        from '../screens/validator/ValidatorDashboard';
import AdminDashboard            from '../screens/admin/AdminDashboard';

// Contexte partagé : userRole disponible dans tout l'arbre sans render prop
export const UserRoleContext = createContext(null);

// Wrappers stables (hors render) pour éviter les re-montages React Navigation
const CssDashboardScreen = (props) => <ValidatorDashboard {...props} role="CHEF_SERVICE_SOCIAL" />;
const RmDashboardScreen  = (props) => <ValidatorDashboard {...props} role="REFERENT_MEDICAL" />;

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// MainTabs est un composant stable (pas de render prop) — lit le rôle via contexte
function MainTabs() {
  const userRole = useContext(UserRoleContext);

  const dashboardComponent = {
    HOSPITAL_AGENT:      AgentDashboard,
    CHEF_SERVICE_SOCIAL: CssDashboardScreen,
    REFERENT_MEDICAL:    RmDashboardScreen,
    ADMIN:               AdminDashboard,
  }[userRole] ?? DonorDashboard;

  const isInternalRole = ['CHEF_SERVICE_SOCIAL', 'REFERENT_MEDICAL', 'ADMIN'].includes(userRole);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1B6B45',
        tabBarInactiveTintColor: '#94A3B8',
        // Masquer la barre pour les rôles mono-onglet (elle serait inactive et inutile)
        tabBarStyle: isInternalRole ? { display: 'none' } : { borderTopColor: '#E8F0FE' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {!isInternalRole && (
        <Tab.Screen
          name="Accueil"
          component={HomeScreen}
          options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏥</Text> }}
        />
      )}
      <Tab.Screen
        name="Compte"
        component={dashboardComponent}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [userRole, setUserRole]         = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem('onboarding_done');
        if (!onboardingDone) {
          setInitialRoute('Onboarding');
          return;
        }

        // Biométrie : si activée et refresh_token présent → challenge
        const bioEnabled   = await isBiometricEnabled();
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (bioEnabled && refreshToken) {
          const { success } = await authenticateWithBiometrics();
          if (success) {
            try {
              const resp = await api.post('/auth/refresh', { refresh_token: refreshToken });
              await SecureStore.setItemAsync('token', resp.data.access_token);
              await SecureStore.setItemAsync('refresh_token', resp.data.refresh_token);
              const user = await getStoredUser();
              if (user) {
                setUserRole(user.role);
                registerPushToken().catch(() => {});
              }
              setInitialRoute('Main');
              return;
            } catch {
              // Refresh échoué → login classique
            }
          }
          setInitialRoute('Auth');
          return;
        }

        const user = await getStoredUser();
        if (user) {
          setUserRole(user.role);
          registerPushToken().catch(() => {});
        }
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
    <UserRoleContext.Provider value={userRole}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Auth">
            {(props) => <AuthScreen {...props} onLogin={(role) => setUserRole(role)} />}
          </Stack.Screen>

          {/* Composant stable — pas de render prop, rôle lu depuis UserRoleContext */}
          <Stack.Screen name="Main" component={MainTabs} />

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
          <Stack.Screen
            name="NewMedicalRequest"
            component={NewMedicalRequestScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </UserRoleContext.Provider>
  );
}
