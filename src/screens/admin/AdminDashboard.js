import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { medicalRequestsAPI, authAPI } from '../../services/api';
import { getStoredUser } from '../../utils/auth';

const CARE_LABELS = {
  MEDICAMENTS: 'Médicaments', EXAMENS: 'Examens', IMAGERIE: 'Imagerie',
  CHIRURGIE: 'Chirurgie', CONSOMMABLES: 'Consommables', AUTRE: 'Autre',
};

const TABS = [
  { key: 'VALIDATED',          label: 'À publier',  icon: '📋' },
  { key: 'PENDING_VALIDATION', label: 'En attente', icon: '⏳' },
];

export default function AdminDashboard({ navigation }) {
  const [user, setUser]           = useState(null);
  const [tab, setTab]             = useState('VALIDATED');
  const [validated, setValidated] = useState([]);
  const [pending, setPending]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState(null); // id en cours d'action

  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      setUser(stored);
      authAPI.getCurrentUser()
        .then((me) => setUser((prev) => ({ ...prev, full_name: me.full_name })))
        .catch(() => {});

      const [v, p] = await Promise.all([
        medicalRequestsAPI.getAll({ status: 'VALIDATED',          limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'PENDING_VALIDATION', limit: 50 }),
      ]);
      setValidated(Array.isArray(v) ? v : []);
      setPending(Array.isArray(p) ? p : []);
    } catch (e) {
      console.error('AdminDashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { if (!loading) load(); });
    return unsub;
  }, [navigation, loading, load]);

  const handlePublish = (req) => {
    Alert.alert(
      'Publier la demande',
      `Publier le dossier de ${req.patient_pseudonym} ? Elle sera visible par tous les donateurs.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Publier',
          onPress: async () => {
            setActing(req.id + '_publish');
            try {
              await medicalRequestsAPI.publish(req.id);
              await load();
            } catch (e) {
              Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de publier.');
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = (req) => {
    Alert.alert(
      'Rejeter la demande',
      `Rejeter définitivement le dossier de ${req.patient_pseudonym} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            setActing(req.id + '_reject');
            try {
              await medicalRequestsAPI.reject(req.id);
              await load();
            } catch (e) {
              Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de rejeter.');
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token').catch(() => {});
    navigation.replace('Auth');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B45" />
      </View>
    );
  }

  const currentList = tab === 'VALIDATED' ? validated : pending;
  const greeting = user?.full_name
    ? `Bonjour, ${user.full_name.split(' ')[0]} 👋`
    : 'Bonjour 👋';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.roleTitle}>⚙️ Administrateur</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F5F3FF' }]}>
          <Text style={[styles.statValue, { color: '#7C3AED' }]}>{validated.length}</Text>
          <Text style={styles.statLabel}>À publier</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>{pending.length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.icon} {t.label}
              {t.key === 'VALIDATED' && validated.length > 0
                ? ` (${validated.length})` : ''}
              {t.key === 'PENDING_VALIDATION' && pending.length > 0
                ? ` (${pending.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
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
        {currentList.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{tab === 'VALIDATED' ? '🎉' : '📭'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'VALIDATED'
                ? 'Aucune demande validée en attente de publication.'
                : 'Aucune demande en attente de validation.'}
            </Text>
          </View>
        ) : (
          currentList.map((req) => (
            <AdminCard
              key={req.id}
              req={req}
              tab={tab}
              acting={acting}
              onPublish={() => handlePublish(req)}
              onReject={() => handleReject(req)}
            />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminCard({ req, tab, acting, onPublish, onReject }) {
  const careLabel = CARE_LABELS[req.care_type] || req.care_type || req.medical_need || '—';
  const amount    = req.amount_requested ?? req.amount_needed ?? 0;
  const isPublishing = acting === req.id + '_publish';
  const isRejecting  = acting === req.id + '_reject';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>
          {new Date(req.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
        {req.urgency_level && (
          <Text style={{ fontSize: 12, fontWeight: '700',
            color: req.urgency_level === 'CRITIQUE' ? '#EF4444' : '#D97706' }}>
            {req.urgency_level === 'CRITIQUE' ? '🔴 Critique' : '🟡 Relative'}
          </Text>
        )}
      </View>

      <Text style={styles.cardPseudonym}>{req.patient_pseudonym}</Text>

      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>💊 {careLabel}</Text>
        <Text style={styles.cardAmount}>{Number(amount).toLocaleString('fr-FR')} FCFA</Text>
      </View>

      {/* Validateurs */}
      <View style={styles.validatorsRow}>
        <Text style={styles.validatorItem}>
          {req.css_validator_id ? '✅' : '⏳'} CSS
        </Text>
        <Text style={styles.validatorItem}>
          {req.rm_validator_id ? '✅' : '⏳'} RM
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        {tab === 'VALIDATED' && (
          <TouchableOpacity
            style={[styles.publishBtn, isPublishing && { opacity: 0.6 }]}
            onPress={onPublish}
            disabled={isPublishing || isRejecting}
            activeOpacity={0.8}
          >
            {isPublishing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.publishBtnText}>Publier</Text>
            }
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.rejectBtn, isRejecting && { opacity: 0.6 }]}
          onPress={onReject}
          disabled={isPublishing || isRejecting}
          activeOpacity={0.8}
        >
          {isRejecting
            ? <ActivityIndicator color="#EF4444" size="small" />
            : <Text style={styles.rejectBtnText}>Rejeter</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting:   { fontSize: 12, color: '#94A3B8' },
  roleTitle:  { fontSize: 16, fontWeight: '800', color: '#1B6B45', marginTop: 2 },
  logoutBtn:  { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#1B6B45' },
  tabText:      { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#1B6B45' },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { fontSize: 11, color: '#94A3B8' },
  cardPseudonym: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardMetaText: { fontSize: 12, color: '#64748B' },
  cardAmount: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  validatorsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  validatorItem: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  actionsRow: { flexDirection: 'row', gap: 8 },
  publishBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: '#1B6B45', alignItems: 'center',
  },
  publishBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rejectBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center',
  },
  rejectBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
