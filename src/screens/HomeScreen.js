import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';

const LOGO = require('../../assets/LogoText.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { medicalRequestsAPI } from '../services/api';
import { t, MEDICAL_NEED_LABELS, URGENCY_LABELS } from '../utils/translations';

const FILTERS = [
  { key: null,        label: 'Toutes' },
  { key: 'SURGERY',   label: 'Chirurgie' },
  { key: 'MEDICATION',label: 'Médicaments' },
  { key: 'EXAM',      label: 'Examens' },
  { key: 'KIT',       label: 'Kit médical' },
];

const URGENCY_BG = {
  CRITICAL: '#FF3B3B',
  HIGH:     '#FF8C00',
  MEDIUM:   '#F5A623',
  LOW:      '#3B82F6',
};

const STATUS_BG = { ACTIVE: '#16A34A' };

const RequestCard = ({ item, onPress }) => {
  const pct = Math.min(Math.round((item.amount_raised / item.amount_needed) * 100), 100);
  const urgencyColor = URGENCY_BG[item.urgency_level] || '#3B82F6';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Badges */}
      <View style={styles.cardBadges}>
        <View style={[styles.badge, { backgroundColor: STATUS_BG[item.status] || '#64748B' }]}>
          <Text style={styles.badgeText}>Validée</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: urgencyColor }]}>
          <Text style={styles.badgeText}>{t(URGENCY_LABELS, item.urgency_level)}</Text>
        </View>
      </View>

      {/* Titre */}
      <Text style={styles.cardTitle}>{t(MEDICAL_NEED_LABELS, item.medical_need)}</Text>
      {item.hospital_name && (
        <Text style={styles.cardHospital}>{item.hospital_name}</Text>
      )}

      {/* Description */}
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#16A34A' }]} />
        </View>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>

      {/* Montants */}
      <View style={styles.amountsRow}>
        <Text style={styles.amountRaised}>
          {Number(item.amount_raised).toLocaleString('fr-FR')} FCFA collectés
        </Text>
        <Text style={styles.amountNeeded}>
          sur {Number(item.amount_needed).toLocaleString('fr-FR')} FCFA
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.donateBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.donateBtnText}>Faire un Don</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function HomeScreen({ navigation }) {
  const [requests, setRequests]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await medicalRequestsAPI.getAll({ status: 'ACTIVE', limit: 50 });
      setRequests(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyFilter = (key) => {
    setActiveFilter(key);
    setFiltered(key ? requests.filter(r => r.medical_need === key) : requests);
  };

  const totalRaised = requests.reduce((s, r) => s + (Number(r.amount_raised) || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1B6B45" />

      {/* Header */}
      <View style={styles.header}>
        <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1B6B45" />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Demandes d'Aide Urgente</Text>
          <Text style={styles.heroSub}>Soutenez les patients dans leurs besoins critiques</Text>
        </View>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={String(f.key)}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => applyFilter(f.key)}
            >
              <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{requests.length}</Text>
            <Text style={styles.statLabel}>Demandes Actives</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#1B6B45' }]}>
              {Number(totalRaised).toLocaleString('fr-FR')} FCFA
            </Text>
            <Text style={styles.statLabel}>Fonds Collectés</Text>
          </View>
        </View>

        {/* Liste */}
        {loading ? (
          <ActivityIndicator size="large" color="#1B6B45" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>Aucune demande pour ce filtre.</Text>
        ) : (
          <View style={styles.list}>
            {filtered.map(item => (
              <RequestCard
                key={item.id}
                item={item}
                onPress={() => navigation.navigate('RequestDetail', { request: item })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#1B1B2E',
  },
  headerLogo: { width: 220, height: 70 },
  loginBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#1B6B45', borderRadius: 20,
  },
  loginBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  hero: {
    backgroundColor: '#F4F6F9', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#1B1B2E', marginBottom: 4 },
  heroSub: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 4 },

  filters: {
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  filterChip: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 24, borderWidth: 1.5, borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#1B6B45', borderColor: '#1B6B45' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#2563EB', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },

  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 15 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardBadges: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1B1B2E', marginBottom: 2 },
  cardHospital: { fontSize: 13, fontWeight: '600', color: '#2563EB', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 12 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  progressTrack: {
    flex: 1, height: 8, backgroundColor: '#E2E8F0',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '700', color: '#16A34A', width: 38, textAlign: 'right' },

  amountsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  amountRaised: { fontSize: 14, fontWeight: '800', color: '#16A34A' },
  amountNeeded: { fontSize: 12, color: '#94A3B8' },

  donateBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  donateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
