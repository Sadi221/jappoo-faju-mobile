import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import api, { medicalRequestsAPI, authAPI, hospitalsAPI } from '../../services/api';
import { getStoredUser } from '../../utils/auth';

const CARE_LABELS = {
  MEDICAMENTS: 'Médicaments', EXAMENS: 'Examens', IMAGERIE: 'Imagerie',
  CHIRURGIE: 'Chirurgie', CONSOMMABLES: 'Consommables', AUTRE: 'Autre',
};

const TABS = [
  { key: 'VALIDATED',          label: 'À publier',  icon: '📋' },
  { key: 'PENDING_VALIDATION', label: 'En attente', icon: '⏳' },
  { key: 'ACTIVE',             label: 'Actives',    icon: '🟢' },
  { key: 'AGENTS',             label: 'Agents',     icon: '🏥' },
  { key: 'HOPITAUX',           label: 'Hôpitaux',   icon: '🏛️' },
];

export default function AdminDashboard({ navigation }) {
  const [user, setUser]             = useState(null);
  const [tab, setTab]               = useState('VALIDATED');
  const [validated, setValidated]   = useState([]);
  const [pending, setPending]       = useState([]);
  const [active, setActive]         = useState([]);
  const [completed, setCompleted]   = useState([]);
  const [agents, setAgents]         = useState([]);
  const [hospitals, setHospitals]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState(null);

  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      setUser(stored);
      authAPI.getCurrentUser()
        .then((me) => setUser((prev) => ({ ...prev, full_name: me.full_name })))
        .catch(() => {});

      const [v, p, a, c, agRes, hRes] = await Promise.all([
        medicalRequestsAPI.getAll({ status: 'VALIDATED',          limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'PENDING_VALIDATION', limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'ACTIVE',             limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'COMPLETED',          limit: 50 }),
        api.get('/admin/users', { params: { role: 'HOSPITAL_AGENT', limit: 100 } })
           .then(r => r.data).catch(() => []),
        hospitalsAPI.getAll().catch(() => []),
      ]);

      setValidated(Array.isArray(v) ? v : []);
      setPending(Array.isArray(p) ? p : []);
      setActive(Array.isArray(a) ? a : []);
      setCompleted(Array.isArray(c) ? c : []);
      setAgents(Array.isArray(agRes) ? agRes : []);
      setHospitals(Array.isArray(hRes) ? hRes : []);
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

  const greeting = user?.full_name
    ? `Bonjour, ${user.full_name.split(' ')[0]} 👋`
    : 'Bonjour 👋';

  const stats = [
    { label: 'À valider',  value: pending.length,   color: '#D97706', bg: '#FFFBEB' },
    { label: 'À publier',  value: validated.length, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Actives',    value: active.length,    color: '#0284C7', bg: '#E0F2FE' },
    { label: 'Complétées', value: completed.length, color: '#16A34A', bg: '#ECFDF5' },
  ];

  const tabCount = {
    VALIDATED:          validated.length,
    PENDING_VALIDATION: pending.length,
    ACTIVE:             active.length,
    AGENTS:             agents.length,
    HOPITAUX:           hospitals.length,
  };

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
        {stats.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Onglets scrollables */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.icon} {t.label}
              {tabCount[t.key] > 0 ? ` (${tabCount[t.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenu */}
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
        {tab === 'VALIDATED' && (
          validated.length === 0
            ? <EmptyState icon="🎉" text="Aucune demande validée en attente de publication." />
            : validated.map((req) => (
                <AdminCard
                  key={req.id} req={req} tab={tab} acting={acting}
                  onPublish={() => handlePublish(req)}
                  onReject={() => handleReject(req)}
                />
              ))
        )}

        {tab === 'PENDING_VALIDATION' && (
          pending.length === 0
            ? <EmptyState icon="📭" text="Aucune demande en attente de validation." />
            : pending.map((req) => (
                <AdminCard
                  key={req.id} req={req} tab={tab} acting={acting}
                  onPublish={() => handlePublish(req)}
                  onReject={() => handleReject(req)}
                />
              ))
        )}

        {tab === 'ACTIVE' && (
          active.length === 0
            ? <EmptyState icon="🟢" text="Aucune demande active pour le moment." />
            : active.map((req) => <ActiveCard key={req.id} req={req} />)
        )}

        {tab === 'AGENTS' && (
          agents.length === 0
            ? <EmptyState icon="👨‍⚕️" text="Aucun agent enregistré." />
            : agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        )}

        {tab === 'HOPITAUX' && (
          hospitals.length === 0
            ? <EmptyState icon="🏥" text="Aucun hôpital enregistré." />
            : hospitals.map((h) => <HospitalCard key={h.id} hospital={h} />)
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sous-composants ───────────────────────────────────────────

function EmptyState({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ActiveCard({ req }) {
  const careLabel = CARE_LABELS[req.care_type] || req.care_type || '—';
  const goal      = req.amount_requested ?? req.amount_needed ?? 0;
  const collected = req.amount_collected ?? req.amount_raised ?? 0;
  const progress  = goal > 0 ? Math.min(collected / goal, 1) : 0;
  const pct       = Math.round(progress * 100);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDate}>
          {new Date(req.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
        {req.urgency_level && (
          <Text style={[styles.urgencyText,
            { color: req.urgency_level === 'CRITIQUE' ? '#EF4444' : '#D97706' }]}>
            {req.urgency_level === 'CRITIQUE' ? '🔴 Critique' : '🟡 Relative'}
          </Text>
        )}
      </View>
      <Text style={styles.cardPseudonym}>{req.patient_pseudonym}</Text>
      <Text style={styles.cardMetaSingle}>💊 {careLabel}</Text>

      <View style={styles.progressRow}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
      <View style={styles.progressAmounts}>
        <Text style={styles.progressCollected}>
          {Number(collected).toLocaleString('fr-FR')} FCFA collectés
        </Text>
        <Text style={styles.progressGoal}>
          / {Number(goal).toLocaleString('fr-FR')} FCFA
        </Text>
      </View>
    </View>
  );
}

function AgentCard({ agent }) {
  const hospitalName = agent.hospital_name ?? agent.hospital?.name ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.agentRow}>
        <View style={styles.agentAvatar}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agentName}>{agent.full_name || '—'}</Text>
          <Text style={styles.agentEmail}>{agent.email}</Text>
          {hospitalName ? (
            <Text style={styles.agentHospital}>🏥 {hospitalName}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function HospitalCard({ hospital }) {
  return (
    <View style={styles.card}>
      <View style={styles.hospitalRow}>
        <Text style={styles.hospitalName} numberOfLines={2}>{hospital.name}</Text>
        <View style={[styles.verifiedBadge,
          { backgroundColor: hospital.is_verified ? '#ECFDF5' : '#F1F5F9' }]}>
          <Text style={[styles.verifiedText,
            { color: hospital.is_verified ? '#16A34A' : '#94A3B8' }]}>
            {hospital.is_verified ? '✅ Vérifié' : '⏳ En attente'}
          </Text>
        </View>
      </View>
      {hospital.city ? (
        <Text style={styles.hospitalCity}>📍 {hospital.city}</Text>
      ) : null}
    </View>
  );
}

function AdminCard({ req, tab, acting, onPublish, onReject }) {
  const careLabel    = CARE_LABELS[req.care_type] || req.care_type || '—';
  const amount       = req.amount_requested ?? req.amount_needed ?? 0;
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
          <Text style={[styles.urgencyText,
            { color: req.urgency_level === 'CRITIQUE' ? '#EF4444' : '#D97706' }]}>
            {req.urgency_level === 'CRITIQUE' ? '🔴 Critique' : '🟡 Relative'}
          </Text>
        )}
      </View>

      <Text style={styles.cardPseudonym}>{req.patient_pseudonym}</Text>

      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMetaText}>💊 {careLabel}</Text>
        <Text style={styles.cardAmount}>{Number(amount).toLocaleString('fr-FR')} FCFA</Text>
      </View>

      <View style={styles.validatorsRow}>
        <Text style={styles.validatorItem}>{req.css_validator_id ? '✅' : '⏳'} CSS</Text>
        <Text style={styles.validatorItem}>{req.rm_validator_id  ? '✅' : '⏳'} RM</Text>
      </View>

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

// ── Styles ────────────────────────────────────────────────────

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
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  statCard:  { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 9, color: '#64748B', marginTop: 2, textAlign: 'center' },

  tabsRow:     { maxHeight: 48, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE' },
  tabsContent: { paddingHorizontal: 6, alignItems: 'center' },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 13,
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginHorizontal: 2,
  },
  tabBtnActive:  { borderBottomColor: '#1B6B45' },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#1B6B45', fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate:      { fontSize: 11, color: '#94A3B8' },
  urgencyText:   { fontSize: 12, fontWeight: '700' },
  cardPseudonym: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  cardMetaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardMetaText:  { fontSize: 12, color: '#64748B' },
  cardMetaSingle:{ fontSize: 12, color: '#64748B', marginBottom: 12 },
  cardAmount:    { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

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

  // Actives — barre de progression
  progressRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  progressBg:        { flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill:      { height: 8, backgroundColor: '#1B6B45', borderRadius: 4 },
  progressPct:       { fontSize: 12, fontWeight: '700', color: '#1B6B45', minWidth: 32, textAlign: 'right' },
  progressAmounts:   { flexDirection: 'row', justifyContent: 'space-between' },
  progressCollected: { fontSize: 12, fontWeight: '700', color: '#1B6B45' },
  progressGoal:      { fontSize: 12, color: '#94A3B8' },

  // Agents
  agentRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agentAvatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  agentName:    { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  agentEmail:   { fontSize: 12, color: '#64748B', marginTop: 2 },
  agentHospital:{ fontSize: 12, color: '#0284C7', marginTop: 2 },

  // Hôpitaux
  hospitalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  hospitalName:  { fontSize: 14, fontWeight: '800', color: '#1E293B', flex: 1 },
  verifiedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  verifiedText:  { fontSize: 12, fontWeight: '700' },
  hospitalCity:  { fontSize: 12, color: '#64748B' },

  // Empty state
  empty:     { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
