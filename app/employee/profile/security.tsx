import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SecurityView } from '@/components/shared/SecurityView';
import { useColors } from '@/lib/themeContext';

export default function EmployeeSecurityScreen() {
  const C = useColors();

  const privacyPolicy = (
    <>
      <Text style={[st.policyPara, { color: C.text2 }]}>
        <Text style={{ fontWeight: '800' }}>1. Data Collection: </Text>
        We collect information necessary for service fulfillment, including your name, email, phone number, and home address. For cleaners, we also collect background check information.
      </Text>
      <Text style={[st.policyPara, { color: C.text2 }]}>
        <Text style={{ fontWeight: '800' }}>2. Home & Pet Info: </Text>
        To provide accurate cleaning services, we store data about your home (size, rooms) and any pets to ensure cleaner safety and appropriate equipment.
      </Text>
      <Text style={[st.policyPara, { color: C.text2 }]}>
        <Text style={{ fontWeight: '800' }}>3. Data Sharing: </Text>
        Your address and specific cleaning instructions are shared with the assigned cleaner only to facilitate the requested service. We do not sell your personal data. 
      </Text>
      <Text style={[st.policyPara, { color: C.text2 }]}>
        <Text style={{ fontWeight: '800' }}>4. Your Rights: </Text>
        You have the right to access, correct, or request deletion of your personal data at any time via the profile settings or by contacting support.
      </Text>
    </>
  );

  return (
    <SecurityView 
      role="employee"
      privacyPolicyContent={privacyPolicy}
      accentColor="#22c55e"
    />
  );
}

const st = StyleSheet.create({
  policyPara: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
});
