import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { medicalRequestsAPI, hospitalsAPI } from '../../services/api';

// ── Données statiques ─────────────────────────────────────────────────────────

const AGE_RANGES = [
  { label: '0-18',  value: '0-18' },
  { label: '18-40', value: '18-40' },
  { label: '40-60', value: '40-60' },
  { label: '60+',   value: '60+' },
];

const URGENCY_OPTIONS = [
  { label: '🔴 Critique', value: 'CRITIQUE' },
  { label: '🟡 Relative', value: 'RELATIVE' },
];

const CARE_TYPES = [
  { label: 'Médicaments',  value: 'MEDICAMENTS' },
  { label: 'Examens',      value: 'EXAMENS' },
  { label: 'Imagerie',     value: 'IMAGERIE' },
  { label: 'Chirurgie',    value: 'CHIRURGIE' },
  { label: 'Consommables', value: 'CONSOMMABLES' },
  { label: 'Autre',        value: 'AUTRE' },
];

const PROFESSIONAL_STATUS = [
  { label: 'Actif',        value: 'ACTIF' },
  { label: 'Sans emploi',  value: 'SANS_EMPLOI' },
  { label: 'Retraité',     value: 'RETRAITE' },
  { label: 'Autre',        value: 'AUTRE' },
];

const INCOME_RANGES = [
  { label: '< 50 000 FCFA',         value: 'LESS_50K' },
  { label: '50 000 – 150 000 FCFA', value: '50K_150K' },
  { label: '> 150 000 FCFA',        value: 'MORE_150K' },
];

const DEPENDENTS = [
  { label: '0',   value: '0' },
  { label: '1-3', value: '1-3' },
  { label: '4-6', value: '4-6' },
  { label: '7+',  value: '7+' },
];

const SOCIAL_SUPPORTS = [
  { label: 'BSF',          value: 'BSF' },
  { label: 'Plan Sésame',  value: 'PLAN_SESAME' },
  { label: 'CMU',          value: 'CMU' },
  { label: 'CT',           value: 'CT' },
  { label: 'DGAS',         value: 'DGAS' },
  { label: 'Mutuelle',     value: 'MUTUELLE' },
  { label: 'Aucun',        value: 'AUCUN' },
];

// ── Composants utilitaires ────────────────────────────────────────────────────

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldLabel({ label, required }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <Text style={styles.fieldError}>{msg}</Text>;
}

function RadioGroup({ options, value, onChange }) {
  return (
    <View style={styles.radioGroup}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.radioOption, value === opt.value && styles.radioOptionSelected]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <View style={[styles.radioCircle, value === opt.value && styles.radioCircleSelected]}>
            {value === opt.value && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.radioLabel, value === opt.value && styles.radioLabelSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PillSelector({ options, value, onChange }) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.pill, value === opt.value && styles.pillSelected]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, value === opt.value && styles.pillTextSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CheckboxGroup({ options, values, onChange }) {
  const toggle = (val) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  };
  return (
    <View style={styles.checkboxGroup}>
      {options.map((opt) => {
        const checked = values.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.checkboxOption, checked && styles.checkboxOptionSelected]}
            onPress={() => toggle(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
              {checked && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RecapRow({ label, value, highlight }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={[styles.recapValue, highlight && styles.recapValueHighlight]}>{value}</Text>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────

export default function NewMedicalRequestScreen({ navigation }) {
  const [hospital, setHospital]           = useState(null);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [errors, setErrors]               = useState({});

  // Bloc 1
  const [pseudonym, setPseudonym]         = useState('');
  const [gender, setGender]               = useState(null);
  const [ageRange, setAgeRange]           = useState(null);
  const [urgency, setUrgency]             = useState(null);

  // Bloc 2
  const [careTypes, setCareTypes]         = useState([]);
  const [careTypeDetail, setCareTypeDetail] = useState('');
  const [totalCost, setTotalCost]         = useState('');
  const [patientContrib, setPatientContrib] = useState('0');
  const [thirdPartyContrib, setThirdPartyContrib] = useState('0');
  const [prescriptionRef, setPrescriptionRef] = useState('');

  // Bloc 3
  const [profStatus, setProfStatus]       = useState(null);
  const [incomeRange, setIncomeRange]     = useState(null);
  const [dependents, setDependents]       = useState(null);
  const [socialSupport, setSocialSupport] = useState([]);
  const [caseSummary, setCaseSummary]     = useState('');

  // Montant sollicité en temps réel
  const amountRequested = Math.max(
    0,
    (parseFloat(totalCost) || 0) -
      (parseFloat(patientContrib) || 0) -
      (parseFloat(thirdPartyContrib) || 0),
  );

  useEffect(() => {
    hospitalsAPI
      .getMyHospital()
      .then((h) => setHospital(h))
      .catch(() => setHospital(null))
      .finally(() => setLoadingHospital(false));
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!pseudonym.trim() || pseudonym.trim().length < 3)
      e.pseudonym = 'Pseudonyme requis (min 3 caractères)';
    if (!gender)
      e.gender = 'Sélectionnez le sexe';
    if (!ageRange)
      e.ageRange = "Sélectionnez la tranche d'âge";
    if (!urgency)
      e.urgency = "Sélectionnez le niveau d'urgence";
    if (careTypes.length === 0)
      e.careTypes = 'Sélectionnez au moins une prestation';
    if (careTypes.includes('AUTRE') && !careTypeDetail.trim())
      e.careTypeDetail = 'Veuillez préciser la prestation';
    if (!totalCost || parseFloat(totalCost) <= 0)
      e.totalCost = 'Coût total requis (valeur > 0)';
    if (amountRequested <= 0)
      e.amountRequested = 'Le montant sollicité doit être supérieur à 0';
    if (!profStatus)
      e.profStatus = 'Situation professionnelle requise';
    if (!incomeRange)
      e.incomeRange = 'Niveau de revenu requis';
    if (!dependents)
      e.dependents = 'Personnes à charge requises';
    if (socialSupport.length === 0)
      e.socialSupport = 'Sélectionnez au moins un filet social (ou "Aucun")';
    if (!caseSummary.trim() || caseSummary.trim().length < 10)
      e.caseSummary = 'Résumé requis (min 10 caractères)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Soumission ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Formulaire incomplet', 'Veuillez corriger les erreurs indiquées en rouge.');
      return;
    }

    // Si plusieurs care_types, on envoie AUTRE + les labels en détail
    let finalCareType = careTypes[0];
    let finalDetail   = careTypeDetail.trim() || undefined;
    if (careTypes.length > 1) {
      finalCareType = 'AUTRE';
      const labels = careTypes.map(
        (v) => CARE_TYPES.find((c) => c.value === v)?.label || v,
      );
      finalDetail = labels.join(' / ') + (careTypeDetail.trim() ? ` — ${careTypeDetail.trim()}` : '');
    }

    const payload = {
      hospital_id:              hospital.id,
      pseudonym:                pseudonym.trim(),
      gender,
      age_range:                ageRange,
      urgency_level:            urgency,
      care_type:                finalCareType,
      care_type_detail:         finalDetail,
      total_cost:               parseFloat(totalCost),
      patient_contribution:     parseFloat(patientContrib) || 0,
      third_party_contribution: parseFloat(thirdPartyContrib) || 0,
      amount_requested:         amountRequested,
      prescription_ref:         prescriptionRef.trim() || undefined,
      professional_status:      profStatus,
      income_range:             incomeRange,
      dependents,
      social_support:           socialSupport,
      case_summary:             caseSummary.trim(),
    };

    try {
      setSubmitting(true);
      await medicalRequestsAPI.createMedicalRequest(payload);
      setSuccess(true);
    } catch (err) {
      const msg =
        err.response?.data?.detail || 'Une erreur est survenue. Veuillez réessayer.';
      Alert.alert('Erreur', Array.isArray(msg) ? msg.map((e) => e.msg).join('\n') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── États de chargement / erreur / succès ────────────────────────────────────

  if (loadingHospital) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B6B45" />
      </View>
    );
  }

  if (!hospital) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvelle demande</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>🏥</Text>
          <Text style={styles.errorTitle}>Aucun hôpital associé</Text>
          <Text style={styles.errorSub}>
            Votre compte n'est lié à aucun établissement vérifié.{'\n'}
            Contactez l'administration.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Demande soumise !</Text>
          <Text style={styles.successMsg}>
            Votre demande a été soumise. Elle sera examinée par le Chef de Service Social et le
            Référent Médical avant publication.
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.successBtnText}>Retour au tableau de bord</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Badge hôpital */}
          <View style={styles.hospitalBadge}>
            <Text style={styles.hospitalBadgeText}>🏥 {hospital.name}</Text>
          </View>

          {/* ── BLOC 1 — Identification anonymisée ───────────────────────── */}
          <View style={styles.block}>
            <SectionTitle title="① Identification anonymisée" />

            <FieldLabel label="Pseudonyme du patient" required />
            <TextInput
              style={[styles.input, errors.pseudonym && styles.inputError]}
              value={pseudonym}
              onChangeText={(t) => setPseudonym(t.slice(0, 50))}
              placeholder="Ex : Patient-A7B3"
              placeholderTextColor="#94A3B8"
              maxLength={50}
            />
            <FieldError msg={errors.pseudonym} />

            <FieldLabel label="Sexe" required />
            <RadioGroup
              options={[
                { label: 'Masculin', value: 'M' },
                { label: 'Féminin',  value: 'F' },
              ]}
              value={gender}
              onChange={setGender}
            />
            <FieldError msg={errors.gender} />

            <FieldLabel label="Tranche d'âge" required />
            <PillSelector options={AGE_RANGES} value={ageRange} onChange={setAgeRange} />
            <FieldError msg={errors.ageRange} />

            <FieldLabel label="Niveau d'urgence" required />
            <RadioGroup options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
            <FieldError msg={errors.urgency} />
          </View>

          {/* ── BLOC 2 — Besoin médical ───────────────────────────────────── */}
          <View style={styles.block}>
            <SectionTitle title="② Besoin médical" />

            <FieldLabel label="Nature de la prestation" required />
            <CheckboxGroup options={CARE_TYPES} values={careTypes} onChange={setCareTypes} />
            <FieldError msg={errors.careTypes} />

            {careTypes.includes('AUTRE') && (
              <>
                <FieldLabel label="Préciser" required />
                <TextInput
                  style={[styles.input, errors.careTypeDetail && styles.inputError]}
                  value={careTypeDetail}
                  onChangeText={(t) => setCareTypeDetail(t.slice(0, 200))}
                  placeholder="Décrivez la prestation"
                  placeholderTextColor="#94A3B8"
                  maxLength={200}
                />
                <FieldError msg={errors.careTypeDetail} />
              </>
            )}

            <FieldLabel label="Coût total (FCFA)" required />
            <TextInput
              style={[styles.input, errors.totalCost && styles.inputError]}
              value={totalCost}
              onChangeText={setTotalCost}
              placeholder="Ex : 150 000"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
            <FieldError msg={errors.totalCost} />

            <FieldLabel label="Contribution du patient (FCFA)" />
            <TextInput
              style={styles.input}
              value={patientContrib}
              onChangeText={setPatientContrib}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />

            <FieldLabel label="Tiers payant (FCFA)" />
            <TextInput
              style={styles.input}
              value={thirdPartyContrib}
              onChangeText={setThirdPartyContrib}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />

            {/* Montant sollicité — calculé en temps réel */}
            <View style={[styles.amountBox, errors.amountRequested && styles.amountBoxError]}>
              <Text style={styles.amountLabel}>💰 Montant sollicité (calculé)</Text>
              <Text style={[styles.amountValue, errors.amountRequested && { color: '#EF4444' }]}>
                {amountRequested.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
            <FieldError msg={errors.amountRequested} />

            <FieldLabel label="Référence ordonnance" />
            <TextInput
              style={styles.input}
              value={prescriptionRef}
              onChangeText={(t) => setPrescriptionRef(t.slice(0, 100))}
              placeholder="Numéro / référence (optionnel)"
              placeholderTextColor="#94A3B8"
              maxLength={100}
            />
          </View>

          {/* ── BLOC 3 — Éligibilité sociale ─────────────────────────────── */}
          <View style={styles.block}>
            <SectionTitle title="③ Éligibilité sociale" />

            <FieldLabel label="Situation professionnelle" required />
            <RadioGroup
              options={PROFESSIONAL_STATUS}
              value={profStatus}
              onChange={setProfStatus}
            />
            <FieldError msg={errors.profStatus} />

            <FieldLabel label="Niveau de revenu" required />
            <RadioGroup options={INCOME_RANGES} value={incomeRange} onChange={setIncomeRange} />
            <FieldError msg={errors.incomeRange} />

            <FieldLabel label="Personnes à charge" required />
            <PillSelector options={DEPENDENTS} value={dependents} onChange={setDependents} />
            <FieldError msg={errors.dependents} />

            <FieldLabel label="Filets sociaux" required />
            <CheckboxGroup
              options={SOCIAL_SUPPORTS}
              values={socialSupport}
              onChange={setSocialSupport}
            />
            <FieldError msg={errors.socialSupport} />

            <FieldLabel label={`Résumé du cas (${caseSummary.length}/500)`} required />
            <TextInput
              style={[styles.inputMultiline, errors.caseSummary && styles.inputError]}
              value={caseSummary}
              onChangeText={(t) => setCaseSummary(t.slice(0, 500))}
              placeholder="Décrivez brièvement la situation médicale et sociale du patient…"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
            />
            <FieldError msg={errors.caseSummary} />
          </View>

          {/* ── BLOC 4 — Confirmation ────────────────────────────────────── */}
          <View style={styles.block}>
            <SectionTitle title="④ Récapitulatif" />
            <View style={styles.recap}>
              <RecapRow
                label="Pseudonyme"
                value={pseudonym || '—'}
              />
              <RecapRow
                label="Sexe"
                value={gender === 'M' ? 'Masculin' : gender === 'F' ? 'Féminin' : '—'}
              />
              <RecapRow label="Âge" value={ageRange || '—'} />
              <RecapRow
                label="Urgence"
                value={
                  urgency === 'CRITIQUE'
                    ? '🔴 Critique'
                    : urgency === 'RELATIVE'
                    ? '🟡 Relative'
                    : '—'
                }
              />
              <RecapRow
                label="Prestation"
                value={
                  careTypes.length
                    ? careTypes
                        .map((v) => CARE_TYPES.find((c) => c.value === v)?.label || v)
                        .join(', ')
                    : '—'
                }
              />
              <RecapRow
                label="Coût total"
                value={totalCost ? `${Number(totalCost).toLocaleString('fr-FR')} FCFA` : '—'}
              />
              <RecapRow
                label="Montant sollicité"
                value={`${amountRequested.toLocaleString('fr-FR')} FCFA`}
                highlight
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Soumettre pour validation</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFF' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8F0FE',
  },
  backBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  backText:    { color: '#1B6B45', fontWeight: '700', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },

  // Badge hôpital
  hospitalBadge: {
    margin: 16, padding: 12, backgroundColor: '#ECFDF5',
    borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center',
  },
  hospitalBadgeText: { color: '#15803D', fontWeight: '700', fontSize: 14 },

  // Blocs
  block: {
    marginHorizontal: 16, marginBottom: 16, padding: 20,
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '900', color: '#1B6B45',
    marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#ECFDF5', paddingBottom: 8,
  },

  // Labels & erreurs
  fieldLabel:  { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  required:    { color: '#EF4444' },
  fieldError:  { fontSize: 11, color: '#EF4444', marginTop: 4 },

  // TextInput
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1E293B', backgroundColor: '#FAFAFA',
  },
  inputMultiline: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1E293B', backgroundColor: '#FAFAFA',
    minHeight: 110,
  },
  inputError: { borderColor: '#EF4444' },

  // Radio
  radioGroup:  { gap: 8 },
  radioOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  radioOptionSelected: { borderColor: '#1B6B45', backgroundColor: '#ECFDF5' },
  radioCircle: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: '#CBD5E1', marginRight: 10, justifyContent: 'center', alignItems: 'center',
  },
  radioCircleSelected: { borderColor: '#1B6B45' },
  radioDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B6B45' },
  radioLabel:  { fontSize: 14, color: '#374151' },
  radioLabelSelected: { color: '#1B6B45', fontWeight: '700' },

  // Pills
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA',
  },
  pillSelected:     { borderColor: '#1B6B45', backgroundColor: '#ECFDF5' },
  pillText:         { fontSize: 13, color: '#374151', fontWeight: '600' },
  pillTextSelected: { color: '#1B6B45', fontWeight: '800' },

  // Checkboxes
  checkboxGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkboxOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA',
  },
  checkboxOptionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  checkboxBox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
    borderColor: '#CBD5E1', marginRight: 8, justifyContent: 'center', alignItems: 'center',
  },
  checkboxBoxChecked: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  checkboxCheck:      { color: '#fff', fontSize: 11, fontWeight: '900' },
  checkboxLabel:      { fontSize: 13, color: '#374151', fontWeight: '600' },
  checkboxLabelSelected: { color: '#2563EB', fontWeight: '700' },

  // Montant calculé
  amountBox: {
    marginTop: 14, padding: 16, borderRadius: 12,
    backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  amountBoxError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  amountLabel:    { fontSize: 13, color: '#374151', fontWeight: '600' },
  amountValue:    { fontSize: 18, fontWeight: '900', color: '#15803D' },

  // Récapitulatif
  recap:      { backgroundColor: '#F8FAFF', borderRadius: 12, padding: 14, gap: 10 },
  recapRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recapLabel: { fontSize: 12, color: '#64748B', flex: 1 },
  recapValue: { fontSize: 13, color: '#1E293B', fontWeight: '700', flex: 2, textAlign: 'right' },
  recapValueHighlight: { color: '#1B6B45', fontSize: 15, fontWeight: '900' },

  // Bouton soumettre
  submitBtn: {
    marginTop: 20, backgroundColor: '#1B6B45', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#1B6B45', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  scroll: { paddingTop: 8 },

  // Succès
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  successIcon:  { fontSize: 64, marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1B6B45', marginBottom: 16 },
  successMsg: {
    fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 24, marginBottom: 32,
  },
  successBtn: {
    backgroundColor: '#1B6B45', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16,
  },
  successBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Erreur hôpital
  errorIcon:  { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  errorSub:   { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
