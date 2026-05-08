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

// Retourne le niveau de sécurité réel du device
export const getSecurityLevel = async () => {
  try {
    return await LocalAuthentication.getEnrolledLevelAsync();
  } catch {
    return LocalAuthentication.SecurityLevel.NONE;
  }
};

// Vrai si le device a au moins un PIN/mot de passe (toggle visible)
export const isBiometricAvailable = async () => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level >= LocalAuthentication.SecurityLevel.SECRET;
  } catch {
    return false;
  }
};

// Vrai si une biométrie réelle (empreinte ou face) est enrollée
export const hasEnrolledBiometrics = async () => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  } catch {
    return false;
  }
};

// Lance le challenge biométrique — retourne { success, error? }
export const authenticateWithBiometrics = async () => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const isFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

    let promptMessage = 'Confirmer votre identité';
    if (isFace) promptMessage = 'Connexion avec Face ID';
    else if (hasFingerprint) promptMessage = 'Connexion avec empreinte digitale';

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Annuler',
      disableDeviceFallback: true,
    });
    return { success: result.success, error: result.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
