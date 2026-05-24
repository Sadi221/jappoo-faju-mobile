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

// role: 'CHEF_SERVICE_SOCIAL' | 'REFERENT_MEDICAL'
export default function ValidatorDashboard({ navigation, role }) {
  const isCss = role === 'CHEF_SERVICE_SOCIAL';
  const roleLabel = isCss ? 'Chef Service Social' : 'Référent Médical';
  const roleIcon  = isCss ? '🏛️' : '🩺';
  const roleColor = isCss ? '#7C3AED' : '#0284C7';

  const [user, setUser]           = useState(null);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState(null); // id en cours

  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      setUser(stored);
      authAPI.getCurrentUser()
        .then((me) => setUser((prev) => ({ ...prev, full_name: me.full_name })))
        .catch(() => {});

      const data = await medicalRequestsAPI.getPending();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('ValidatorDashboard load error:', e);
      setRequests([]);
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

  const handleValidate = (req) => {
    Alert.alert(
      'Confirmer la validation',
      `Valider la demande de ${req.patient_pseudonym} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          style: 'default',
          onPress: async () => {
            setValidating(req.id);
            try {
              await medicalRequestsAPI.validate(req.id);
              await load();
            } catch (e) {
              Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de valider.');
            } finally {
              setValidating(null);
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

  const alreadyValidatedByMe = (req) =>
    isCss ? !!req.css_validator_id : !!req.rm_validator_id;

  const stats = {
    total:     requests.length,
    done:      requests.filter(alreadyValidatedByMe).length,
    remaining: requests.filter((r) => !alreadyValidatedByMe(r)).length,
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={roleColor} />
      </View>
    );
  }

  const greeting = user?.full_name
    ? `Bonjour, ${user.full_name.split(' ')[0]} 👋`
    : 'Bonjour 👋';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: roleColor + '30' }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={[styles.roleTitle, { color: roleColor }]}>{roleIcon} {roleLabel}</Text>
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
            tintColor={roleColor}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.remaining}</Text>
            <Text style={styles.statLabel}>À valider</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.done}</Text>
            <Text style={styles.statLabel}>Validées</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Demandes en attente</Text>

        {requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>Aucune demande en attente de validation.</Text>
          </View>
        ) : (
          requests.map((req) => (
            <ValidatorCard
              key={req.id}
              req={req}
              isCss={isCss}
              roleColor={roleColor}
              alreadyDone={alreadyValidatedByMe(req)}
              isValidating={validating === req.id}
              onValidate={() => handleValidate(req)}
            />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ValidatorCard({ req, isCss, roleColor, alreadyDone, isValidating, onValidate }) {
  const careLabel = CARE_LABELS[req.care_type] || req.care_type || req.medical_need || '—';
  const amount    = req.amount_requested ?? req.amount_needed ?? 0;
  const cssDone   = !!req.css_validator_id;
  const rmDone    = !!req.rm_validator_id;

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

      {/* État des validations */}
      <View style={styles.validationRow}>
        <View style={styles.validationItem}>
          <Text style={[styles.validationDot, { color: cssDone ? '#16A34A' : '#94A3B8' }]}>
            {cssDone ? '✅' : '⏳'}
          </Text>
          <Text style={[styles.validationLabel, { color: cssDone ? '#16A34A' : '#94A3B8' }]}>
            CSS
          </Text>
        </View>
        <View style={[styles.validationSep, { backgroundColor: cssDone && rmDone ? '#16A34A' : '#E2E8F0' }]} />
        <View style={styles.validationItem}>
          <Text style={[styles.validationDot, { color: rmDone ? '#16A34A' : '#94A3B8' }]}>
            {rmDone ? '✅' : '⏳'}
          </Text>
          <Text style={[styles.validationLabel, { color: rmDone ? '#16A34A' : '#94A3B8' }]}>
            RM
          </Text>
        </View>
      </View>

      {alreadyDone ? (
        <View style={[styles.validatedBadge, { backgroundColor: '#ECFDF5' }]}>
          <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
            ✓ Validé par vous
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.validateBtn, { backgroundColor: roleColor }, isValidating && { opacity: 0.6 }]}
          onPress={onValidate}
          disabled={isValidating}
          activeOpacity={0.8}
        >
          {isValidating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.validateBtnText}>Valider ce dossier</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting:   { fontSize: 12, color: '#94A3B8' },
  roleTitle:  { fontSize: 16, fontWeight: '800', marginTop: 2 },
  logoutBtn:  { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12,
    padding: 10, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { fontSize: 11, color: '#94A3B8' },
  cardPseudonym: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardMetaText: { fontSize: 12, color: '#64748B' },
  cardAmount: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  validationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  validationItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  validationDot:  { fontSize: 14 },
  validationLabel: { fontSize: 12, fontWeight: '600' },
  validationSep: { flex: 1, height: 2, marginHorizontal: 8 },

  validatedBadge: { paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  validateBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  validateBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
