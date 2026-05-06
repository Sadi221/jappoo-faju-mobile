import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { paymentsAPI } from '../services/api';
import { t, MEDICAL_NEED_LABELS } from '../utils/translations';

const AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];
const METHODS = [
  { id: 'PAYDUNYA', label: 'Mobile Money', sub: 'Wave · Orange Money', emoji: '📱' },
  { id: 'STRIPE',   label: 'Carte bancaire', sub: 'Visa · Mastercard',  emoji: '💳' },
];

export default function DonationModal({ request, onClose }) {
  const [amount, setAmount]         = useState('');
  const [custom, setCustom]         = useState('');
  const [method, setMethod]         = useState('PAYDUNYA');
  const [phone, setPhone]           = useState('');
  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [loading, setLoading]       = useState(false);

  const fmt = (v) => Number(v).toLocaleString('fr-FR');
  const toEur = (f) => (f / 655.957).toFixed(2);

  const handleSubmit = async () => {
    if (!amount || Number(amount) < 1000) {
      Alert.alert('Montant invalide', 'Le minimum est 1 000 FCFA');
      return;
    }

    setLoading(true);
    try {
      const donation = await paymentsAPI.createDonation({
        medical_request_id: request.id,
        amount: Number(amount),
        payment_method: method,
      });

      let paymentResp;
      if (method === 'PAYDUNYA') {
        paymentResp = await paymentsAPI.initiatePayDunya({
          donation_id: donation.donation_id,
          amount: Number(amount),
          payer_name: name || undefined,
          payer_email: email || undefined,
          payer_phone: phone ? `+221${phone}` : undefined,
        });
      } else {
        paymentResp = await paymentsAPI.createStripeCheckout({
          donation_id: donation.donation_id,
          amount: Number(amount),
          payer_name: name || undefined,
          payer_email: email || undefined,
        });
      }

      if (paymentResp.checkout_url) {
        const ALLOWED_HOSTS = ['checkout.stripe.com', 'app.paydunya.com'];
        let urlHost;
        try { urlHost = new URL(paymentResp.checkout_url).hostname; } catch { urlHost = ''; }
        if (!ALLOWED_HOSTS.some(h => urlHost === h || urlHost.endsWith('.' + h))) {
          Alert.alert('Erreur', 'URL de paiement non autorisée');
          return;
        }
        await Linking.openURL(paymentResp.checkout_url);
        onClose();
      } else {
        Alert.alert('Erreur', 'Impossible d\'obtenir l\'URL de paiement');
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>❤️  Faire un don</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Résumé */}
          <View style={styles.summary}>
            <Row label="Patient" value={request.patient_pseudonym} />
            <Row label="Besoin" value={t(MEDICAL_NEED_LABELS, request.medical_need)} />
            <Row label="Objectif" value={`${fmt(request.amount_needed)} FCFA`} color="#2563EB" />
            <Row label="Collecté" value={`${fmt(request.amount_raised)} FCFA`} color="#16A34A" />
          </View>

          {/* Montants */}
          <Text style={styles.label}>Choisir un montant</Text>
          <View style={styles.amountGrid}>
            {AMOUNTS.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.amountBtn, amount == v && styles.amountBtnActive]}
                onPress={() => { setAmount(String(v)); setCustom(''); }}
              >
                <Text style={[styles.amountBtnText, amount == v && styles.amountBtnTextActive]}>
                  {v >= 1000 ? `${v / 1000}K` : v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Montant libre */}
          <Text style={styles.label}>Ou montant libre</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={custom}
              onChangeText={v => { setCustom(v.replace(/\D/g, '')); setAmount(v.replace(/\D/g, '')); }}
              placeholder="Ex : 75000"
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.inputSuffix}>FCFA</Text>
          </View>
          {method === 'STRIPE' && Number(amount) >= 1000 && (
            <Text style={styles.eurNote}>≈ {toEur(amount)} EUR</Text>
          )}

          {/* Méthode */}
          <Text style={styles.label}>Moyen de paiement</Text>
          <View style={styles.methodRow}>
            {METHODS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodBtn, method === m.id && styles.methodBtnActive]}
                onPress={() => setMethod(m.id)}
              >
                <Text style={styles.methodEmoji}>{m.emoji}</Text>
                <Text style={[styles.methodLabel, method === m.id && styles.methodLabelActive]}>{m.label}</Text>
                <Text style={styles.methodSub}>{m.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Téléphone (PayDunya) */}
          {method === 'PAYDUNYA' && (
            <>
              <Text style={styles.label}>Numéro mobile <Text style={styles.optional}>(optionnel)</Text></Text>
              <View style={styles.inputRow}>
                <Text style={styles.phonePrefix}>+221</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={phone}
                  onChangeText={v => setPhone(v.replace(/\D/g, ''))}
                  placeholder="77 123 45 67"
                  keyboardType="phone-pad"
                  maxLength={9}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </>
          )}

          {/* Email */}
          <Text style={styles.label}>E-mail <Text style={styles.optional}>(pour votre reçu)</Text></Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#94A3B8"
          />

          {/* Nom */}
          <Text style={styles.label}>Votre nom <Text style={styles.optional}>(optionnel)</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Fatou Diop"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.infoText}>
            Vous serez redirigé vers la page de paiement sécurisée de votre navigateur.
          </Text>
        </ScrollView>

        {/* Bouton */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!amount || loading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!amount || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {method === 'STRIPE' ? '💳  Payer par carte' : '📱  Contribuer'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const Row = ({ label, value, color }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label} :</Text>
    <Text style={[styles.summaryValue, color && { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#2563EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#fff', fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 8 },

  summary: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 20, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },

  label: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8, marginTop: 16 },
  optional: { fontWeight: '400', color: '#94A3B8' },

  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: '#F1F5F9', borderRadius: 10,
  },
  amountBtnActive: { backgroundColor: '#2563EB' },
  amountBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  amountBtnTextActive: { color: '#fff' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1E293B', marginBottom: 4,
  },
  inputSuffix: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  phonePrefix: { fontSize: 14, fontWeight: '700', color: '#475569' },
  eurNote: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },

  methodRow: { flexDirection: 'row', gap: 10 },
  methodBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2,
    borderColor: '#E2E8F0', padding: 12, alignItems: 'center',
  },
  methodBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  methodEmoji: { fontSize: 24, marginBottom: 4 },
  methodLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  methodLabelActive: { color: '#2563EB' },
  methodSub: { fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 2 },

  infoText: {
    fontSize: 12, color: '#94A3B8', textAlign: 'center',
    marginTop: 20, lineHeight: 18,
  },

  footer: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E8F0FE',
  },
  submitBtn: {
    backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#CBD5E1' },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
