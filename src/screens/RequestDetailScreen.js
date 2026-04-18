import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t, MEDICAL_NEED_LABELS, URGENCY_LABELS } from '../utils/translations';
import DonationModal from '../components/DonationModal';

const URGENCY_BG = {
  CRITICAL: '#FF3B3B',
  HIGH:     '#FF8C00',
  MEDIUM:   '#F5A623',
  LOW:      '#3B82F6',
};

export default function RequestDetailScreen({ route, navigation }) {
  const { request } = route.params;
  const [showDonation, setShowDonation] = useState(false);

  const pct = Math.min(Math.round((request.amount_raised / request.amount_needed) * 100), 100);
  const urgencyColor = URGENCY_BG[request.urgency_level] || '#3B82F6';
  const canDonate = request.status === 'ACTIVE';
  const daysLeft = request.expiry_date
    ? Math.max(0, Math.ceil((new Date(request.expiry_date) - new Date()) / 86400000))
    : null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Aidez ce patient sur JAPPOO FAJU : https://jappoo-faju.org/cas/${request.id}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B2E" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top coloré */}
        <View style={styles.topBand}>
          <View style={styles.topBadges}>
            <View style={[styles.badge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.badgeText}>{t(URGENCY_LABELS, request.urgency_level)}</Text>
            </View>
            {daysLeft !== null && (
              <View style={[styles.badge, { backgroundColor: daysLeft <= 3 ? '#EF4444' : '#475569' }]}>
                <Text style={styles.badgeText}>
                  {daysLeft > 0 ? `${daysLeft}j restants` : 'Expiré'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.topTitle}>{t(MEDICAL_NEED_LABELS, request.medical_need)}</Text>
          <Text style={styles.topPatient}>Patient : {request.patient_pseudonym}</Text>
          {request.hospital_name && (
            <Text style={styles.topHospital}>{request.hospital_name}</Text>
          )}
        </View>

        <View style={styles.content}>
          {/* Progression */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.raisedAmount}>
                  {Number(request.amount_raised).toLocaleString('fr-FR')} FCFA
                </Text>
                <Text style={styles.raisedLabel}>collectés</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pctText}>{pct}%</Text>
                <Text style={styles.goalLabel}>
                  sur {Number(request.amount_needed).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{request.description}</Text>
          </View>

          {/* Infos */}
          <View style={styles.infoGrid}>
            <InfoItem label="Type de besoin" value={t(MEDICAL_NEED_LABELS, request.medical_need)} />
            <InfoItem label="Urgence" value={t(URGENCY_LABELS, request.urgency_level)} color={urgencyColor} />
            <InfoItem label="Créé le" value={new Date(request.created_at).toLocaleDateString('fr-FR')} />
            {daysLeft !== null && (
              <InfoItem
                label="Jours restants"
                value={daysLeft > 0 ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : 'Expiré'}
                color={daysLeft <= 3 ? '#EF4444' : undefined}
              />
            )}
          </View>

          {/* Partager */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>🔗  Partager ce cas</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer sticky */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.donateBtn, !canDonate && styles.donateBtnDisabled]}
          onPress={() => canDonate && setShowDonation(true)}
          disabled={!canDonate}
        >
          <Text style={styles.donateBtnText}>
            {canDonate ? '❤️  Faire un Don' : 'Collecte fermée'}
          </Text>
        </TouchableOpacity>
      </View>

      {showDonation && (
        <DonationModal request={request} onClose={() => setShowDonation(false)} />
      )}
    </SafeAreaView>
  );
}

const InfoItem = ({ label, value, color }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, color && { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  topBand: {
    backgroundColor: '#1B1B2E', paddingHorizontal: 20,
    paddingTop: 20, paddingBottom: 28,
  },
  topBadges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  topTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
  topPatient: { fontSize: 13, color: '#CBD5E1', marginBottom: 2 },
  topHospital: { fontSize: 13, color: '#94A3B8' },

  content: { padding: 16 },

  progressCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 14, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  raisedAmount: { fontSize: 22, fontWeight: '900', color: '#1B6B45' },
  raisedLabel: { fontSize: 12, color: '#64748B' },
  pctText: { fontSize: 20, fontWeight: '900', color: '#1B6B45' },
  goalLabel: { fontSize: 12, color: '#94A3B8' },
  progressTrack: {
    height: 10, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#1B6B45' },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 14, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1B1B2E', marginBottom: 8 },
  description: { fontSize: 14, color: '#475569', lineHeight: 22 },

  infoGrid: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
  },
  infoItem: { width: '50%', paddingVertical: 8 },
  infoLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#1B1B2E' },

  shareBtn: {
    borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff',
  },
  shareBtnText: { color: '#1B6B45', fontWeight: '700', fontSize: 14 },

  footer: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E8F0FE',
  },
  donateBtn: {
    backgroundColor: '#E8673A', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  donateBtnDisabled: { backgroundColor: '#CBD5E1' },
  donateBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
