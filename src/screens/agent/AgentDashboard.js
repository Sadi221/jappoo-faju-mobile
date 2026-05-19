import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { medicalRequestsAPI, hospitalsAPI, authAPI } from '../../services/api';
import { getStoredUser } from '../../utils/auth';

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING_VALIDATION: '#F59E0B',
  VALIDATED:          '#8B5CF6',
  ACTIVE:             '#16A34A',
  COMPLETED:          '#2563EB',
  REJECTED:           '#EF4444',
  EXPIRED:            '#94A3B8',
  PENDING:            '#F59E0B',
};

const STATUS_LABELS = {
  PENDING_VALIDATION: 'En attente',
  VALIDATED:          'Validée',
  ACTIVE:             'Active',
  COMPLETED:          'Complétée',
  REJECTED:           'Rejetée',
  EXPIRED:            'Expirée',
  PENDING:            'En attente',
};

const CARE_LABELS = {
  MEDICAMENTS:  'Médicaments',
  EXAMENS:      'Examens',
  IMAGERIE:     'Imagerie',
  CHIRURGIE:    'Chirurgie',
  CONSOMMABLES: 'Consommables',
  AUTRE:        'Autre',
};

// ── Composant principal ───────────────────────────────────────────────────────

export default function AgentDashboard({ navigation }) {
  const [user, setUser]           = useState(null);
  const [hospital, setHospital]   = useState(null);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Récupère l'utilisateur depuis le JWT (sync rapide)
      const stored = await getStoredUser();
      setUser(stored);

      // Essaie d'enrichir avec le full_name depuis l'API
      authAPI.getCurrentUser()
        .then((me) => setUser((prev) => ({ ...prev, full_name: me.full_name })))
        .catch(() => {});

      // Hôpital de l'agent
      const hosp = await hospitalsAPI.getMyHospital();
      setHospital(hosp);

      // Demandes soumises par cet hôpital (tous statuts)
      const data = await medicalRequestsAPI.getAll({
        hospital_id: hosp.id,
        status: 'ALL',
        limit: 50,
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('AgentDashboard load error:', e);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Rafraîchir la liste quand on revient sur cet écran
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!loading) load();
    });
    return unsubscribe;
  }, [navigation, loading, load]);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token').catch(() => {});
    navigation.replace('Auth');
  };

  // ── Chargement initial ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B45" />
      </View>
    );
  }

  // ── Statistiques rapides ──────────────────────────────────────────────────

  const stats = {
    total:      requests.length,
    pending:    requests.filter((r) => r.status === 'PENDING_VALIDATION').length,
    active:     requests.filter((r) => r.status === 'ACTIVE').length,
    completed:  requests.filter((r) => r.status === 'COMPLETED').length,
  };

  const greeting = user?.full_name
    ? `Bonjour, ${user.full_name.split(' ')[0]} 👋`
    : 'Bonjour 👋';

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.hospitalName} numberOfLines={1}>
            🏥 {hospital?.name || user?.email || '—'}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleLabel}>🏥 Agent Hospitalier</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#1B6B45"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton principal — Nouvelle demande */}
        <TouchableOpacity
          style={styles.newRequestBtn}
          onPress={() => navigation.navigate('NewMedicalRequest')}
          activeOpacity={0.85}
        >
          <Text style={styles.newRequestIcon}>＋</Text>
          <View style={styles.newRequestTextBlock}>
            <Text style={styles.newRequestTitle}>Nouvelle demande de financement</Text>
            <Text style={styles.newRequestSub}>Soumettre un dossier patient</Text>
          </View>
          <Text style={styles.newRequestArrow}>›</Text>
        </TouchableOpacity>

        {/* Stats rapides */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFFBEB' }]}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Complétées</Text>
          </View>
        </View>

        {/* Liste des demandes soumises */}
        <Text style={styles.sectionTitle}>Mes demandes soumises</Text>

        {requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              Aucune demande soumise pour le moment.{'\n'}
              Utilisez le bouton ci-dessus pour créer la première.
            </Text>
          </View>
        ) : (
          requests.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Carte demande ─────────────────────────────────────────────────────────────

function RequestCard({ req }) {
  const statusColor = STATUS_COLORS[req.status] || '#94A3B8';
  const statusLabel = STATUS_LABELS[req.status] || req.status;
  const careLabel   = CARE_LABELS[req.care_type] || req.care_type || req.medical_need || '—';
  const amount      = req.amount_requested ?? req.amount_needed ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.cardDate}>
          {new Date(req.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
      </View>

      <Text style={styles.cardPseudonym}>{req.patient_pseudonym}</Text>

      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>💊 {careLabel}</Text>
        {req.urgency_level && (
          <Text style={[
            styles.urgencyBadge,
            { color: req.urgency_level === 'CRITIQUE' ? '#EF4444' : '#D97706' },
          ]}>
            {req.urgency_level === 'CRITIQUE' ? '🔴 Critique' : '🟡 Relative'}
          </Text>
        )}
      </View>

      <Text style={styles.cardAmount}>
        {Number(amount).toLocaleString('fr-FR')} FCFA sollicités
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  headerLeft:   { flex: 1, marginRight: 12 },
  greeting:     { fontSize: 12, color: '#94A3B8' },
  hospitalName: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  rolePill:     { marginTop: 4 },
  roleLabel:    { fontSize: 11, color: '#1B6B45', fontWeight: '700' },
  logoutBtn:    {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
  },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  // Bouton Nouvelle demande
  newRequestBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1B6B45', borderRadius: 16,
    padding: 18, marginBottom: 20,
    shadowColor: '#1B6B45', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  newRequestIcon:      { fontSize: 28, color: '#fff', marginRight: 14 },
  newRequestTextBlock: { flex: 1 },
  newRequestTitle:     { color: '#fff', fontSize: 15, fontWeight: '800' },
  newRequestSub:       { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  newRequestArrow:     { color: 'rgba(255,255,255,0.8)', fontSize: 24, fontWeight: '300' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12,
    padding: 10, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },

  // Section titre
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 12,
  },

  // Carte demande
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  cardDate:    { fontSize: 11, color: '#94A3B8' },
  cardPseudonym: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardMetaText: { fontSize: 12, color: '#64748B' },
  urgencyBadge: { fontSize: 12, fontWeight: '700' },
  cardAmount: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  // Vide
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22,
  },
});
