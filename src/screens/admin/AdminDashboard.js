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
  { key: 'PENDING_VALIDATION', label: 'À valider',  icon: '⏳' },
  { key: 'VALIDATED',          label: 'À publier',  icon: '📋' },
  { key: 'ACTIVE',             label: 'Actives',    icon: '🟢' },
  { key: 'AGENTS',             label: 'Agents',     icon: '🏥' },
  { key: 'HOPITAUX',           label: 'Hôpitaux',   icon: '🏛️' },
];

export default function AdminDashboard({ navigation }) {
  const [user, setUser]           = useState(null);
  const [tab, setTab]             = useState('PENDING_VALIDATION');
  const [pending, setPending]     = useState([]);
  const [validated, setValidated] = useState([]);
  const [active, setActive]       = useState([]);
  const [completed, setCompleted] = useState([]);
  const [agents, setAgents]       = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState(null);

  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      setUser(stored);
      authAPI.getCurrentUser()
        .then((me) => setUser((prev) => ({ ...prev, full_name: me.full_name })))
        .catch(() => {});

      const [p, v, a, c, h] = await Promise.all([
        medicalRequestsAPI.getAll({ status: 'PENDING_VALIDATION', limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'VALIDATED',          limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'ACTIVE',             limit: 50 }),
        medicalRequestsAPI.getAll({ status: 'COMPLETED',          limit: 50 }),
        hospitalsAPI.getAll(),
      ]);
      setPending(Array.isArray(p) ? p : []);
      setValidated(Array.isArray(v) ? v : []);
      setActive(Array.isArray(a) ? a : []);
      setCompleted(Array.isArray(c) ? c : []);
      setHospitals(Array.isArray(h) ? h : []);

      api.get('/admin/users', { params: { role: 'HOSPITAL_AGENT', limit: 50 } })
        .then((res) => setAgents(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
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

  const listByTab = {
    PENDING_VALIDATION: pending,
    VALIDATED:          validated,
    ACTIVE:             active,
  };
  const currentList = listByTab[tab] ?? [];

  const stats = [
    { label: 'À valider',  value: pending.length,   color: '#D97706', bg: '#FFFBEB' },
    { label: 'À publier',  value: validated.length,  color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Actives',    value: active.length,     color: '#1B6B45', bg: '#F0FDF4' },
    { label: 'Complétées', value: completed.length,  color: '#2563EB', bg: '#EFF6FF' },
  ];

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsRow}
      >
        {stats.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Onglets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((t) => {
          const count = listByTab[t.key]?.length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.icon} {t.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
        {/* Onglets demandes médicales */}
        {(tab === 'PENDING_VALIDATION' || tab === 'VALIDATED' || tab === 'ACTIVE') && (
          currentList.length === 0
            ? <EmptyState tab={tab} />
            : currentList.map((req) => (
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

        {/* Onglet Agents */}
        {tab === 'AGENTS' && (
          agents.length === 0
            ? <EmptyState tab="AGENTS" />
            : agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        )}

        {/* Onglet Hôpitaux */}
        {tab === 'HOPITAUX' && (
          hospitals.length === 0
            ? <EmptyState tab="HOPITAUX" />
            : hospitals.map((hosp) => <HospitalCard key={hosp.id} hosp={hosp} />)
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sous-composants ────────────────────────────────────────────

function AdminCard({ req, tab, acting, onPublish, onReject }) {
  const careLabel    = CARE_LABELS[req.care_type] || req.care_type || req.medical_need || '—';
  const amount       = req.amount_requested ?? req.amount_needed ?? 0;
  const collected    = req.amount_collected ?? req.amount_raised ?? 0;
  const progress     = amount > 0 ? Math.min(collected / amount, 1) : 0;
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
          <Text style={{
            fontSize: 12, fontWeight: '700',
            color: req.urgency_level === 'CRITIQUE' ? '#EF4444' : '#D97706',
          }}>
            {req.urgency_level === 'CRITIQUE' ? '🔴 Critique' : '🟡 Relative'}
          </Text>
        )}
      </View>

      <Text style={styles.cardPseudonym}>{req.patient_pseudonym}</Text>

      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>💊 {careLabel}</Text>
        <Text style={styles.cardAmount}>{Number(amount).toLocaleString('fr-FR')} FCFA</Text>
      </View>

      {/* Barre de progression (onglet Actives) */}
      {tab === 'ACTIVE' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {Number(collected).toLocaleString('fr-FR')} / {Number(amount).toLocaleString('fr-FR')} FCFA
            {'  '}({Math.round(progress * 100)}%)
          </Text>
        </View>
      )}

      {/* Validateurs (onglets VALIDATED / PENDING) */}
      {tab !== 'ACTIVE' && (
        <View style={styles.validatorsRow}>
          <Text style={styles.validatorItem}>{req.css_validator_id ? '✅' : '⏳'} CSS</Text>
          <Text style={styles.validatorItem}>{req.rm_validator_id  ? '✅' : '⏳'} RM</Text>
        </View>
      )}

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
        {(tab === 'VALIDATED' || tab === 'PENDING_VALIDATION') && (
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
        )}
      </View>
    </View>
  );
}

function AgentCard({ agent }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardPseudonym}>{agent.full_name || '—'}</Text>
      <Text style={styles.cardMetaText}>📧 {agent.email}</Text>
      {agent.hospital_name && (
        <Text style={[styles.cardMetaText, { marginTop: 4 }]}>🏥 {agent.hospital_name}</Text>
      )}
    </View>
  );
}

function HospitalCard({ hosp }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardPseudonym}>{hosp.name || hosp.nom || '—'}</Text>
        <Text style={{
          fontSize: 12, fontWeight: '700',
          color: hosp.is_verified ? '#1B6B45' : '#D97706',
        }}>
          {hosp.is_verified ? '✅ Vérifié' : '⏳ Non vérifié'}
        </Text>
      </View>
      {(hosp.city || hosp.ville) && (
        <Text style={styles.cardMetaText}>📍 {hosp.city || hosp.ville}</Text>
      )}
    </View>
  );
}

function EmptyState({ tab }) {
  const config = {
    PENDING_VALIDATION: { icon: '📭', text: 'Aucune demande en attente de validation.' },
    VALIDATED:          { icon: '🎉', text: 'Aucune demande validée en attente de publication.' },
    ACTIVE:             { icon: '📊', text: 'Aucune demande active en cours.' },
    AGENTS:             { icon: '👤', text: 'Aucun agent hospitalier enregistré.' },
    HOPITAUX:           { icon: '🏥', text: 'Aucun hôpital enregistré.' },
  };
  const { icon, text } = config[tab] || { icon: '📭', text: 'Aucune donnée.' };
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

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

  statsScroll: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE' },
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statCard:    { borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 80 },
  statValue:   { fontSize: 20, fontWeight: '900' },
  statLabel:   { fontSize: 10, color: '#64748B', marginTop: 2 },

  tabsScroll: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE' },
  tabs:       { flexDirection: 'row', paddingHorizontal: 4 },
  tabBtn: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:  { borderBottomColor: '#1B6B45' },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#1B6B45' },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate:      { fontSize: 11, color: '#94A3B8' },
  cardPseudonym: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  cardMeta:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardMetaText:  { fontSize: 12, color: '#64748B' },
  cardAmount:    { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  progressContainer: { marginBottom: 12 },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden', marginBottom: 4,
  },
  progressFill:  { height: '100%', backgroundColor: '#1B6B45', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#64748B' },

  validatorsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  validatorItem: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  actionsRow:     { flexDirection: 'row', gap: 8 },
  publishBtn:     { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#1B6B45', alignItems: 'center' },
  publishBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rejectBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center',
  },
  rejectBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },

  empty:     { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
