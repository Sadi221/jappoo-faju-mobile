import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { donationsAPI } from '../services/api';
import { getStoredUser } from '../utils/auth';

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
  const [user, setUser]           = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await getStoredUser();
      setUser(u);
      if (u) {
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

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
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
        <View>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.userName}>{user?.email || 'Donateur'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

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
  greeting: { fontSize: 12, color: '#94A3B8' },
  userName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

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
