import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { donationsAPI } from '../services/api';
import { getStoredUser, isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, hasEnrolledBiometrics } from '../utils/auth';

const STATUS_COLORS = {
  COMPLETED: '#16A34A',
  PENDING:   '#F59E0B',
  FAILED:    '#EF4444',
  REFUNDED:  '#6366F1',
};

const STATUS_LABELS = {
  COMPLETED: 'Complété',
  PENDING:   'En attente',
  FAILED:    'Échoué',
  REFUNDED:  'Remboursé',
};

export default function DonorDashboard({ navigation }) {
  const [user, setUser]               = useState(null);
  const [donations, setDonations]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [bioEnabled, setBioEnabled]     = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasRealBio, setHasRealBio]     = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await getStoredUser();
      setUser(u);
      if (u && u.role === 'DONOR') {
        const data = await donationsAPI.getMyDonations();
        setDonations(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const [available, enabled, realBio] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
        hasEnrolledBiometrics(),
      ]);
      setBioAvailable(available);
      setBioEnabled(enabled);
      setHasRealBio(realBio);
    })();
  }, [load]);

  const toggleBiometric = async () => {
    const newVal = !bioEnabled;
    await setBiometricEnabled(newVal);
    setBioEnabled(newVal);
  };

  const handleLogout = async () => {
    // Soft logout : on efface uniquement l'access token.
    // Le refresh_token reste en SecureStore (protégé par Face ID / iOS Keychain)
    // pour permettre la reconnexion biométrique sans mot de passe.
    await SecureStore.deleteItemAsync('token').catch(() => {});
    navigation.replace('Auth');
  };

  const totalDonated = donations
    .filter(d => d.payment_status === 'COMPLETED')
    .reduce((s, d) => s + d.amount, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.userName} numberOfLines={1}>{user?.email || 'Utilisateur'}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleLabel}>
              {user?.role === 'ADMIN' ? '🛡️ Administrateur' : user?.role === 'HOSPITAL_AGENT' ? '🏥 Agent Hospitalier' : '❤️ Donateur'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Toggle biométrie — visible pour tous les rôles */}
      {bioAvailable && (
        <TouchableOpacity style={styles.bioRow} onPress={toggleBiometric} activeOpacity={0.7}>
          <View style={styles.bioRowLeft}>
            <Text style={styles.bioRowIcon}>🔒</Text>
            <View>
              <Text style={styles.bioRowTitle}>Connexion biométrique</Text>
              <Text style={styles.bioRowSub}>
                {hasRealBio ? 'Face ID / Empreinte digitale' : 'Code appareil (configurez Face ID/Empreinte dans Paramètres)'}
              </Text>
            </View>
          </View>
          <View style={[styles.bioToggle, bioEnabled && styles.bioToggleOn]}>
            <View style={[styles.bioThumb, bioEnabled && styles.bioThumbOn]} />
          </View>
        </TouchableOpacity>
      )}

      {user?.role === 'HOSPITAL_AGENT' ? (
        <View style={styles.agentSection}>
          <Text style={styles.agentSectionTitle}>🏥 Tableau de bord agent</Text>
          <TouchableOpacity
            style={styles.newRequestBtn}
            onPress={() => navigation.navigate('NewMedicalRequest')}
            activeOpacity={0.85}
          >
            <Text style={styles.newRequestBtnIcon}>＋</Text>
            <Text style={styles.newRequestBtnText}>Nouvelle demande de financement</Text>
          </TouchableOpacity>
          <Text style={styles.agentHint}>
            Les demandes soumises seront examinées par le Chef de Service Social et le Référent
            Médical avant publication.
          </Text>
        </View>
      ) : user?.role !== 'DONOR' ? (
        <View style={styles.nonDonorBanner}>
          <Text style={styles.nonDonorIcon}>🛡️</Text>
          <Text style={styles.nonDonorTitle}>Compte Administrateur</Text>
          <Text style={styles.nonDonorSub}>
            La gestion complète est disponible sur le tableau de bord web.
          </Text>
        </View>
      ) : (
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{donations.length}</Text>
              <Text style={styles.statLabel}>Dons effectués</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.statValue, { color: '#16A34A' }]}>
                {Number(totalDonated).toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.statLabel}>FCFA donnés</Text>
            </View>
          </View>

          {/* Historique */}
          <Text style={styles.sectionTitle}>Historique des dons</Text>
        </>
      )}

      {user?.role === 'DONOR' && (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
        showsVerticalScrollIndicator={false}
      >
        {donations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💝</Text>
            <Text style={styles.emptyText}>Vous n'avez pas encore fait de don.</Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => navigation.navigate('Accueil')}
            >
              <Text style={styles.exploreBtnText}>Voir les cas urgents</Text>
            </TouchableOpacity>
          </View>
        ) : (
          donations.map(d => (
            <View key={d.id} style={styles.donationCard}>
              <View style={styles.donationTop}>
                <Text style={styles.donationAmount}>
                  {Number(d.amount).toLocaleString('fr-FR')} FCFA
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[d.payment_status] || '#94A3B8') + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[d.payment_status] || '#94A3B8' }]}>
                    {STATUS_LABELS[d.payment_status] || d.payment_status}
                  </Text>
                </View>
              </View>
              <Text style={styles.donationDate}>
                {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={styles.donationMethod}>
                {d.payment_method === 'PAYDUNYA' ? '📱 Mobile Money' : '💳 Carte bancaire'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 12, color: '#94A3B8' },
  userName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  rolePill: { marginTop: 4 },
  roleLabel: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  bioRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  bioRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bioRowIcon: { fontSize: 22 },
  bioRowTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  bioRowSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  bioToggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: '#CBD5E1', padding: 3, justifyContent: 'center',
  },
  bioToggleOn: { backgroundColor: '#2563EB' },
  bioThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  bioThumbOn: { alignSelf: 'flex-end' },
  agentSection: {
    margin: 16, padding: 20, backgroundColor: '#ECFDF5',
    borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0',
  },
  agentSectionTitle: {
    fontSize: 16, fontWeight: '900', color: '#15803D', marginBottom: 14,
  },
  newRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1B6B45', borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20, gap: 8,
    shadowColor: '#1B6B45', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  newRequestBtnIcon: { color: '#fff', fontSize: 20, fontWeight: '900' },
  newRequestBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  agentHint: {
    fontSize: 12, color: '#16A34A', textAlign: 'center',
    marginTop: 12, lineHeight: 18,
  },

  nonDonorBanner: {
    margin: 24, padding: 28, backgroundColor: '#EFF6FF',
    borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE',
  },
  nonDonorIcon: { fontSize: 48, marginBottom: 12 },
  nonDonorTitle: { fontSize: 18, fontWeight: '900', color: '#1E40AF', marginBottom: 8 },
  nonDonorSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  statCard: {
    flex: 1, backgroundColor: '#EFF6FF', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '900', color: '#2563EB', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },

  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#1E293B',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  exploreBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  exploreBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  donationCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 10, elevation: 2,
  },
  donationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  donationAmount: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  donationDate: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  donationMethod: { fontSize: 12, color: '#94A3B8' },
});
