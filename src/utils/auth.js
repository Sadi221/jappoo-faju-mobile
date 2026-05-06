import * as SecureStore from 'expo-secure-store';
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
