import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO = require('../../assets/LogoText.png');

const SLIDES = [
  {
    title: 'Solidarité\nSanté',
    sub: 'Connectez-vous aux patients sénégalais qui ont besoin d\'aide médicale urgente.',
    bg: '#1B6B45',
    accent: '#E8673A',
  },
  {
    title: 'Chaque don\nsauve une vie',
    sub: 'Contribuez directement aux frais médicaux — chirurgie, médicaments, examens.',
    bg: '#1B1B2E',
    accent: '#1B6B45',
  },
  {
    title: 'Paiement\nsécurisé',
    sub: 'Wave, Orange Money ou carte bancaire — donnez en quelques secondes depuis partout.',
    bg: '#0F172A',
    accent: '#E8673A',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', '1');
    navigation.replace('Auth');
  };

  const next = () => {
    if (isLast) finish();
    else setStep(step + 1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: slide.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={slide.bg} />

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.logoArea}>
          <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
        </View>

        <View style={styles.textArea}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.sub}>{slide.sub}</Text>
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step
                  ? [styles.dotActive, { backgroundColor: slide.accent }]
                  : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isLast ? slide.accent : 'rgba(255,255,255,0.15)' }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, isLast && { color: slide.bg }]}>
            {isLast ? 'Commencer →' : 'Suivant →'}
          </Text>
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity style={styles.guestBtn} onPress={finish}>
            <Text style={styles.guestText}>Continuer sans compte</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  skipBtn: {
    alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  skipText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },

  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoImg: { width: 200, height: 200 },

  textArea: { alignItems: 'center', marginBottom: 40 },
  title: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    textAlign: 'center', lineHeight: 42, marginBottom: 16,
  },
  sub: {
    fontSize: 16, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', lineHeight: 24,
  },

  dots: { flexDirection: 'row', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.3)' },

  footer: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  btn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  guestBtn: { alignItems: 'center', paddingVertical: 8 },
  guestText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
