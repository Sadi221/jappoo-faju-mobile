import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { jwtDecode } from 'jwt-decode';

export const getStoredUser = async () => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) return null;
    const decoded = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) {
      await SecureStore.deleteItemAsync('token');
      return null;
    }
    return { id: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
};

export const isTokenValid = async () => {
  const user = await getStoredUser();
  return user !== null;
};

// ── Biométrie ─────────────────────────────────────────────────

export const isBiometricAvailable = async () => {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  return LocalAuthentication.isEnrolledAsync();
};

export const authenticateWithBiometrics = async () => {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const isFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: isFace ? 'Connexion avec Face ID' : 'Connexion avec empreinte digitale',
    fallbackLabel: 'Mot de passe',
    cancelLabel: 'Annuler',
    disableDeviceFallback: false,
  });
  return result.success;
};

export const setBiometricEnabled = async (enabled) => {
  if (enabled) {
    await SecureStore.setItemAsync('biometric_enabled', 'true');
  } else {
    await SecureStore.deleteItemAsync('biometric_enabled');
  }
};

export const isBiometricEnabled = async () => {
  const val = await SecureStore.getItemAsync('biometric_enabled');
  return val === 'true';
};
