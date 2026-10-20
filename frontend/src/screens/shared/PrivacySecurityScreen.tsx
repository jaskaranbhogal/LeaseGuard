import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';


export default function PrivacySecurityScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Privacy &amp; security</Text>
        </View>

        {/* Photos and videos */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your photos and videos</Text>

          <Text style={styles.infoText}>
            Stored securely and visible only to the landlord and tenant of the
            unit they belong to.
          </Text>
        </View>

        {/* Privacy policy */}
        <TouchableOpacity
  style={styles.menuItem}
  accessibilityRole="button"
>
          <Text style={styles.menuText}>Privacy policy</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Consent */}
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Consent and data handling</Text>

          <View style={styles.acceptedBadge}>
            <Text style={styles.acceptedText}>Accepted</Text>
          </View>
        </View>
{/* Camera permission */}
<TouchableOpacity
  style={styles.menuItem}
  accessibilityRole="button"
>
  <Text style={styles.menuText}>Camera permission</Text>
  <Text style={styles.chevron}>›</Text>
</TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          AI comparisons are advisory. Landlords and tenants make the final
          decisions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  backButton: {
    width: 30,
    height: 40,
    justifyContent: 'center',
  },

  backArrow: {
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '300',
    color: '#172235',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#172235',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172235',
    marginBottom: 6,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#65748B',
  },

  menuItem: {
    minHeight: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuText: {
    flex: 1,
    fontSize: 14,
    color: '#253247',
  },

  chevron: {
    fontSize: 24,
    fontWeight: '300',
    color: '#64748B',
  },

  acceptedBadge: {
    backgroundColor: '#DCF5E5',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  acceptedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#137A3D',
  },

  disclaimer: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: '#65748B',
  },
});